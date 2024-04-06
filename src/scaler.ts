import { jwtDecode } from 'jwt-decode';
import {
	Destination as ApiDestination,
	DestinationImageType,
	NormalizedCrop,
	Size,
	SourceImage as SourceImageInfo,
	TransfomResponse as ApiTransfomResponse,
	TransformOptions as ApiTransformOptions,
	Upload,
} from './models/transform';
import fs from 'fs';
import { Readable } from 'stream';

const refreshAccessTokenUrl =
	process.env.REFRESH_URL || 'https://api.scaler.com/auth/api-key-token';
const transformUrl =
	process.env.TRANSFORM_URL || 'https://api.scaler.com/signed-url';

interface PromiseResolvers {
	resolve: (value: void | PromiseLike<void>) => void;
	reject: (reason?: any) => void;
}

export interface TransformOptions {
	source: SourceOptions;
	destination?: DestinationOptions;
	destinations?: DestinationOptions[];
	crop?: NormalizedCrop;
}

export interface TransformResponse {
	sourceImage: SourceImageInfo;
	image?: ImageResult;
	destinationImages?: DestinationImage[];
}

export interface SourceOptions {
	remoteUrl?: string;
	localPath?: string;
	buffer?: Buffer;
}

export interface ImageDelivery {
	saveTolocalPath?: string;
	upload?: Upload;
	buffer?: boolean;
}

export interface DestinationOptions {
	fit: Size;
	type: DestinationImageType;
	quality?: number;
	imageDelivery?: ImageDelivery;
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
			};
		});
		const options2: ApiTransformOptions = {
			source: options.source.remoteUrl || 'body',
			destinations,
		};
		const res = await fetch(transformUrl, {
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
		const { sourceImage, destinationImages } =
			(await res2.json()) as ApiTransfomResponse;
		const promises = destinationImages.map(
			(dest, i): Promise<{ image: ArrayBuffer | string | 'uploaded' }> => {
				if (dest.downloadUrl) {
					const dlUrl = dest.downloadUrl;
					if (dests[i].imageDelivery?.saveTolocalPath) {
						const destPath = dests[i].imageDelivery!
							.saveTolocalPath as string;
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
