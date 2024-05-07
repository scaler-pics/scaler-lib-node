import { jwtDecode } from 'jwt-decode';
import {
	Destination as ApiDestination,
	DestinationImageType,
	NormalizedCrop,
	Size,
	SourceImageInfo,
	TransfomResponse as ApiTransfomResponse,
	TransformOptions as ApiTransformOptions,
	Upload,
	ImageDeleteBody,
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
	source: SourceOptions;
	destination?: DestinationOptions;
	destinations?: DestinationOptions[];
}

export interface TransformResponse {
	sourceImage: SourceImageInfo;
	image?: ImageResult;
	destinationImages?: DestinationImage[];
	timeStats: {
		signMs: number;
		sendImageMs: number;
		transformMs: number;
		getImagesMs: number;
		totalMs: number;
	};
}

export interface SourceOptions {
	remoteUrl?: string;
	localPath?: string;
	buffer?: Buffer;
}

export interface ImageDelivery {
	saveToLocalPath?: string;
	upload?: Upload;
	buffer?: boolean;
}

export interface DestinationOptions {
	fit: Size;
	type: DestinationImageType;
	quality?: number;
	imageDelivery?: ImageDelivery;
	crop?: NormalizedCrop;
}

export interface DestinationImage {
	fit: Size;
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
		if (
			(!options.destinations || !options.destinations!.length) &&
			!options.destination
		) {
			throw new Error('No destination provided');
		}
		const dests: DestinationOptions[] = options.destinations
			? options.destinations
			: [options.destination!];
		const destinations: ApiDestination[] = dests.map((dest) => {
			return {
				fit: dest.fit,
				type: dest.type,
				quality: dest.quality,
				upload: dest.imageDelivery?.upload,
				crop: dest.crop,
			};
		});
		const options2: ApiTransformOptions = {
			source: options.source.remoteUrl || 'body',
			destinations,
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
		if (options.source.buffer) {
			headers['Content-Type'] = 'application/x-octet-stream';
			headers['Content-Length'] = `${options.source.buffer.length}`;
			body = options.source.buffer;
		} else if (options.source.localPath) {
			headers['Content-Type'] = 'application/x-octet-stream';
			const { size } = fs.statSync(options.source.localPath);
			headers['Content-Type'] = 'application/x-octet-stream';
			headers['Content-Length'] = `${size}`;
			body = fs.createReadStream(options.source.localPath);
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
		const {
			sourceImage,
			destinationImages,
			deleteUrl,
			timeStats: apiTimeStats,
		} = (await res2.json()) as ApiTransfomResponse;
		const sendImageMs =
			endTransformTime -
			startTransformTime -
			apiTimeStats.transformMs -
			(apiTimeStats.uploadImagesMs || 0);
		const startGetImages = Date.now();
		const promises = destinationImages.map(
			(dest, i): Promise<{ image: ArrayBuffer | string | 'uploaded' }> => {
				if (dest.downloadUrl) {
					const dlUrl = dest.downloadUrl;
					if (dests[i].imageDelivery?.saveToLocalPath) {
						const destPath = dests[i].imageDelivery!
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
		const destinationImages2 = await Promise.all(promises);
		const getImagesMs =
			apiTimeStats.uploadImagesMs || Date.now() - startGetImages;
		const deleteBody: ImageDeleteBody = {
			images: destinationImages
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
		const response: TransformResponse = {
			sourceImage,
			image: options.destination ? destinationImages2[0].image : undefined,
			destinationImages: options.destinations
				? destinationImages.map((dest, i) => {
						return {
							fit: dest.fit,
							pixelSize: dest.pixelSize,
							image: destinationImages2[i].image,
						};
						// eslint-disable-next-line
				  })
				: undefined,
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
