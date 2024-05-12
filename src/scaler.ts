import { jwtDecode } from 'jwt-decode';
import {
	Output as ApiOutput,
	OutputImageType,
	NormalizedCrop,
	Size,
	InputImageInfo,
	TransfomResponse as ApiTransfomResponse,
	TransformOptions as ApiTransformOptions,
	Upload,
	ImageDeleteBody,
	Fit,
} from './models/transform';
import fs from 'fs';
import { Readable } from 'stream';

const refreshAccessTokenUrl =
	process.env.REFRESH_URL || 'https://api.scaler.pics/auth/api-key-token';
const signUrl = process.env.SIGN_URL || 'https://sign.scaler.pics/sign';

interface PromiseResolvers {
	resolve: (value: void | PromiseLike<void>) => void;
	reject: (reason?: any) => void;
}

export interface TransformOptions {
	input: InputOptions;
	output?: OutputOptions | OutputOptions[];
}

export interface TransformResponse {
	inputImage: InputImageInfo;
	outputImage?: OutputImage | OutputImage[];
	timeStats: {
		signMs: number;
		sendImageMs: number;
		transformMs: number;
		getImagesMs: number;
		totalMs: number;
	};
}

export interface InputOptions {
	remoteUrl?: string;
	localPath?: string;
	buffer?: Buffer | ArrayBuffer;
}

export interface ImageDelivery {
	saveToLocalPath?: string;
	upload?: Upload;
	buffer?: boolean;
}

export interface OutputOptions {
	fit: Fit;
	type: OutputImageType;
	quality?: number;
	imageDelivery?: ImageDelivery;
	crop?: NormalizedCrop;
}

export interface OutputImage {
	fit: Fit;
	pixelSize: Size;
	image: ImageResult;
}

export type ImageResult = ArrayBuffer | string | 'uploaded';

export default class Scaler {
	private apiKey: string;
	accessToken: string | null = null;
	isRefreshingAccessToken = false;
	refreshPromises: PromiseResolvers[] = [];

	constructor(apiKey: string) {
		this.apiKey = apiKey;
		this.refreshAccessTokenIfNeeded();
	}

	public transform = async (
		options: TransformOptions
	): Promise<TransformResponse> => {
		await this.refreshAccessTokenIfNeeded();
		const start = Date.now();
		if (!options.output) {
			throw new Error('No output provided');
		}
		const outs: OutputOptions[] = Array.isArray(options.output)
			? options.output
			: [options.output];
		const outputs: ApiOutput[] = outs.map((out) => {
			return {
				fit: out.fit,
				type: out.type,
				quality: out.quality,
				upload: out.imageDelivery?.upload,
				crop: out.crop,
			};
		});
		const options2: ApiTransformOptions = {
			input: options.input.remoteUrl || 'body',
			output: outputs,
		};
		const startSignUrl = Date.now();
		const res = await fetch(signUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options2),
		});
		if (res.status !== 200) {
			const text = await res.text();
			throw new Error(
				`Failed to get transform url. status: ${res.status}, text: ${text}`
			);
		}
		const json = await res.json();
		const signMs = Date.now() - startSignUrl;
		const { url } = json as { url: string };
		const headers: HeadersInit = {};
		let body: any = undefined;
		if (options.input.buffer) {
			headers['Content-Type'] = 'application/x-octet-stream';
			const anyBuffer = options.input.buffer as any;
			const len = anyBuffer.length || anyBuffer.byteLength || 0;
			headers['Content-Length'] = `${len}`;
			body = options.input.buffer;
		} else if (options.input.localPath) {
			headers['Content-Type'] = 'application/x-octet-stream';
			const { size } = fs.statSync(options.input.localPath);
			headers['Content-Type'] = 'application/x-octet-stream';
			headers['Content-Length'] = `${size}`;
			body = fs.createReadStream(options.input.localPath);
		}
		const startTransformTime = Date.now();
		const res2 = await fetch(url, {
			method: 'POST',
			headers,
			body,
			duplex: 'half',
		} as any);
		if (res2.status !== 200) {
			const text = await res2.text();
			throw new Error(
				`Failed to transform image. status: ${res2.status}, text: ${text}`
			);
		}
		const endTransformTime = Date.now();
		const transfromResponse = (await res2.json()) as ApiTransfomResponse;
		const {
			inputImage: inputApiImage,
			outputImages: outputApiImages,
			deleteUrl,
			timeStats: apiTimeStats,
		} = transfromResponse;
		const sendImageMs =
			endTransformTime -
			startTransformTime -
			apiTimeStats.transformMs -
			(apiTimeStats.uploadImagesMs || 0);
		const startGetImages = Date.now();
		const promises = outputApiImages.map(
			(dest, i): Promise<{ image: ArrayBuffer | string | 'uploaded' }> => {
				if (dest.downloadUrl) {
					const dlUrl = dest.downloadUrl;
					if (outs[i].imageDelivery?.saveToLocalPath) {
						const destPath = outs[i].imageDelivery!
							.saveToLocalPath as string;
						return new Promise<{
							image: ArrayBuffer | string | 'uploaded';
						}>((resolve, reject) => {
							fetch(dlUrl)
								.then((res3) => {
									if (res3.status !== 200) {
										const text = res3.text();
										reject(
											new Error(
												`Failed to download image. status: ${res3.status}, text: ${text}`
											)
										);
										return;
									}
									if (res3.body === null) {
										reject(new Error('Response body is null'));
										return;
									}
									const reader = res3.body.getReader();
									const stream = new Readable({
										async read() {
											const { done, value } = await reader.read();
											if (done) {
												this.push(null);
											} else {
												this.push(Buffer.from(value));
											}
										},
									});
									const destStream = fs.createWriteStream(destPath);
									stream.pipe(destStream);
									destStream.on('finish', () => {
										resolve({ image: destPath });
									});
									destStream.on('error', reject);
								})
								.catch((err) => {
									reject(err);
								});
						});
					} else {
						return new Promise<{
							image: ArrayBuffer | string | 'uploaded';
						}>((resolve, reject) => {
							fetch(dlUrl)
								.then((res3) => {
									if (res3.status !== 200) {
										const text = res3.text();
										reject(
											new Error(
												`Failed to download image. status: ${res3.status}, text: ${text}`
											)
										);
										return;
									}
									res3
										.arrayBuffer()
										.then((buffer) => {
											resolve({ image: buffer });
										})
										.catch((err) => {
											reject(err);
										});
								})
								.catch((err) => {
									reject(err);
								});
						});
					}
				} else {
					return Promise.resolve({ image: 'uploaded' });
				}
			}
		);
		const outputImageResults = await Promise.all(promises);
		const getImagesMs =
			apiTimeStats.uploadImagesMs || Date.now() - startGetImages;
		const deleteBody: ImageDeleteBody = {
			images: outputApiImages
				.filter((dest) => dest.fileId)
				.map((dest) => dest.fileId!),
		};
		fetch(deleteUrl, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(deleteBody),
		}).catch((error) => {
			console.error('Failed to delete received images', error);
		});
		const totalMs = Date.now() - start;
		const outputImages = outputApiImages.map((dest, i) => {
			return {
				fit: dest.fit,
				pixelSize: dest.pixelSize,
				image: outputImageResults[i].image,
			};
		});
		const response: TransformResponse = {
			inputImage: inputApiImage,
			outputImage: Array.isArray(options.output)
				? outputImages
				: outputImages[0],
			timeStats: {
				signMs,
				sendImageMs,
				transformMs: apiTimeStats.transformMs,
				getImagesMs,
				totalMs,
			},
		};
		return response;
	};

	private refreshAccessTokenIfNeeded = async () => {
		let shouldRefresh = false;
		if (this.accessToken === null) {
			shouldRefresh = true;
		} else {
			const decoded = jwtDecode(this.accessToken) as any;
			const now = Date.now() / 1000;
			if (now >= decoded.exp) {
				shouldRefresh = true;
			}
		}
		if (!shouldRefresh) {
			return;
		}
		if (this.isRefreshingAccessToken) {
			return new Promise<void>((resolve, reject) => {
				this.refreshPromises.push({ resolve, reject });
			});
		}

		this.isRefreshingAccessToken = false;
		try {
			const res = await fetch(refreshAccessTokenUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
				},
			});
			if (res.status !== 200) {
				const text = await res.text();
				throw new Error(
					`Failed to refresh the access token. status: ${res.status}, text: ${text}`
				);
			}
			const json = await res.json();
			const { accessToken } = json as { accessToken: string };
			this.accessToken = accessToken;
			for (const { resolve } of this.refreshPromises) {
				resolve();
			}
			this.refreshPromises = [];
			this.isRefreshingAccessToken = false;
		} catch (error) {
			for (const { reject } of this.refreshPromises) {
				reject(error);
			}
			this.refreshPromises = [];
			this.isRefreshingAccessToken = false;
			throw error;
		}
	};
}
