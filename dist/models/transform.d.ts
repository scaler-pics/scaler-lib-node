export type InputImageType = 'jpeg' | 'png' | 'webp' | 'heic' | 'tiff' | 'gif' | 'bmp';
export type OutputImageType = 'jpeg' | 'png' | 'heic';
export declare const inputImageTypes: InputImageType[];
export declare const outputImageTypes: OutputImageType[];
type URLString = string;
export interface TransformOptions {
    input: 'body' | URLString;
    output: Output[];
}
export interface Output {
    fit: Fit;
    type: OutputImageType;
    quality?: number;
    upload?: Upload;
    crop?: NormalizedCrop;
}
export interface Size {
    width: number;
    height: number;
}
export interface Fit {
    width: number;
    height: number;
    upscale?: boolean;
}
export interface Upload {
    url: string;
    method?: 'POST' | 'PUT';
}
export interface NormalizedCrop {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export interface TransfomResponse {
    inputImage: InputImageInfo;
    outputImages: [OutputImage];
    deleteUrl: string;
    timeStats: {
        transformMs: number;
        uploadImagesMs?: number;
    };
}
export interface InputImageInfo {
    pixelSize: Size;
    byteSize: number;
}
export interface OutputImage {
    fit: Fit;
    pixelSize: Size;
    downloadUrl?: string;
    fileId?: string;
}
export interface ImageDeleteBody {
    images: string[];
}
export {};
