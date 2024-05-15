/// <reference types="node" />
import { OutputImageType, NormalizedCrop, Size, InputImageInfo, Upload, Fit } from './models/transform';
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
declare class Scaler {
    private apiKey;
    accessToken: string | null;
    isRefreshingAccessToken: boolean;
    refreshPromises: PromiseResolvers[];
    constructor(apiKey: string);
    transform: (options: TransformOptions) => Promise<TransformResponse>;
    private refreshAccessTokenIfNeeded;
}
export default Scaler;
