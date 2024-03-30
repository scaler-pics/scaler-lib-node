import { jwtDecode } from 'jwt-decode';
import {
	Destination,
	DestinationImageType,
	NormalizedCrop,
	Size,
	SizeFit,
	SourceImage,
	TransfomResponse,
	TransformUrlBody,
	Upload,
} from './models/transform';
import fs from 'fs';
import fetch from 'node-fetch';

const refreshAccessTokenUrl = 'https://api.scaler.com/auth/api-key-token';
const transformUrl = 'https://api.scaler.com/signed-url';

interface PromiseResolvers {
	resolve: (value: void | PromiseLike<void>) => void;
	reject: (reason?: any) => void;
}

export interface TransfromSource {
	remoteUrl?: string;
	localPath?: string;
	buffer?: Buffer;
}

export interface ImageDelivery {
	saveTolocalPath?: string;
	upload?: Upload;
	buffer?: boolean;
}

export interface TransfromDestination {
	fit: SizeFit;
	type: DestinationImageType;
	quality?: number;
	imageDelivery: ImageDelivery;
}

export interface TransformOptions {
	source: TransfromSource;
	destinations: TransfromDestination[];
	crop?: NormalizedCrop;
}

export interface TransformResponse2 {
	sourceImage: SourceImage;
	destinationImages: DestinationImage2[];
}

export interface DestinationImage2 {
	fit: Size;
	pixelSize: Size;
	image: Buffer | string | 'uploaded';
}

export default class Scaler {
	private apiKey: string;
	accessToken: string | null = null;
	isRefreshingAccessToken = false;
	refreshPromises: PromiseResolvers[] = [];

	constructor(apiKey: string) {
		this.apiKey = apiKey;
		this.refreshAccessTokenIfNeeded();
	}

	public transform = async (options: TransformOptions): TransformResponse2 => {
		await this.refreshAccessTokenIfNeeded();
		const destinations: Destination[] = options.destinations.map((dest) => {
			return {
				fit: dest.fit,
				type: dest.type,
				quality: dest.quality,
				upload: dest.imageDelivery.upload,
			};
		});
		const options2: TransformUrlBody = {
			source: { url: options.source.remoteUrl },
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
			let text = await res.text();
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
			body = options.source.buffer;
		} else if (options.source.localPath) {
			headers['Content-Type'] = 'application/x-octet-stream';
			body = fs.createReadStream(options.source.localPath);
		}
		const res2 = await fetch(url, {
			method: 'POST',
			headers,
			body,
		});
		if (res2.status !== 200) {
			let text = await res2.text();
			throw new Error(
				`Failed to transform image. status: ${res2.status}, text: ${text}`
			);
		}
		const { sourceImage, destinationImages } =
			(await res2.json()) as TransfomResponse;
		const promises = destinationImages.map(
			(dest, i): Promise<{ image: Buffer | string | 'uploaded' }> => {
				if (dest.downloadUrl) {
					let dlUrl = dest.downloadUrl;
					if (options.destinations[i].imageDelivery.saveTolocalPath) {
						const destPath = options.destinations[i].imageDelivery
							.saveTolocalPath as string;
						return new Promise<{ image: Buffer | string | 'uploaded' }>(
							(resolve, reject) => {
								fetch(dlUrl)
									.then((res3) => {
										if (res3.status !== 200) {
											let text = res3.text();
											reject(
												new Error(
													`Failed to download image. status: ${res3.status}, text: ${text}`
												)
											);
											return;
										}
										const destStream = fs.createWriteStream(destPath);
										res3.body.pipe(destStream);
										destStream.on('finish', () => {
											resolve({ image: destPath });
										});
										destStream.on('error', reject);
									})
									.catch((err) => {
										reject(err);
									});
							}
						);
					} else {
						return new Promise<{ image: Buffer | string | 'uploaded' }>(
							(resolve, reject) => {
								fetch(dlUrl)
									.then((res3) => {
										if (res3.status !== 200) {
											let text = res3.text();
											reject(
												new Error(
													`Failed to download image. status: ${res3.status}, text: ${text}`
												)
											);
											return;
										}
										res3
											.buffer()
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
							}
						);
					}
				} else {
					return Promise.resolve({ image: 'uploaded' });
				}
			}
		);
		const destinationImages2 = await Promise.all(promises);
		const response: TransformResponse2 = {
			sourceImage,
			destinationImages: destinationImages.map((dest, i) => {
				return {
					fit: dest.fit,
					pixelSize: dest.pixelSize,
					image: destinationImages2[i].image,
				};
			}),
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
				let text = await res.text();
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
