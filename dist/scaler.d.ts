/// <reference types="node" />
import { DestinationImageType, NormalizedCrop, Size, SourceImageInfo, Upload } from './models/transform';
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
    private apiKey;
    accessToken: string | null;
    isRefreshingAccessToken: boolean;
    refreshPromises: PromiseResolvers[];
    constructor(apiKey: string);
    transform: (options: TransformOptions) => Promise<TransformResponse>;
    private refreshAccessTokenIfNeeded;
}
export {};
