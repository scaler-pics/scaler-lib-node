export type SourceImageType = 'jpeg' | 'png' | 'webp' | 'heic' | 'tiff' | 'gif' | 'bmp';
export type DestinationImageType = 'jpeg' | 'png' | 'heic';
export declare const sourceImageTypes: SourceImageType[];
export declare const destinationImageTypes: DestinationImageType[];
type URLString = string;
export interface TransformOptions {
    source: 'body' | URLString;
    destinations: Destination[];
}
export interface Destination {
    fit: Size;
    type: DestinationImageType;
    quality?: number;
    upload?: Upload;
    crop?: NormalizedCrop;
}
export interface Size {
    width: number;
    height: number;
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
    sourceImage: SourceImageInfo;
    destinationImages: [DestinationImage];
    deleteUrl: string;
    timeStats: {
        transformMs: number;
        uploadImagesMs?: number;
    };
}
export interface SourceImageInfo {
    pixelSize: Size;
    byteSize: number;
}
export interface DestinationImage {
    fit: Size;
    pixelSize: Size;
    downloadUrl?: string;
    fileId?: string;
}
export interface ImageDeleteBody {
    images: string[];
}
export {};
