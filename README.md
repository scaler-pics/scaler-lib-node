# Scaler Node.js API Documentation

## Installation

To use the [Scaler](https://scaler.pics) Node.js API, install the npm package as follows:

```shell
npm install scaler.pics
```

## Basic Usage

```javascript
import Scaler from 'scaler.pics';

const scaler = new Scaler('YOUR_API_KEY');

const { image } = await scaler.transform({
   source: { localPath: '/path/to/large-image.heic' },
   destination: {
      type: 'jpeg',
      fit: { width: 512, height: 512 },
      quality: 0.8,
   },
});
```

Initialize the scaler object with your API key (only once in your project), which you can obtain from [Scaler](https://scaler.pics). Then use it to transform images as needed.

## Multiple Destinations

```javascript
import Scaler from 'scaler.pics';

const scaler = new Scaler('YOUR_API_KEY');

const response = await scaler.transform({
   source: { localPath: '/path/to/large-image.heic' },
   destinations: [
      {
         type: 'jpeg',
         fit: { width: 1280, height: 1280 },
         quality: 0.8,
         imageDelivery: {
            saveToLocalPath: '/tmp/image-1280.jpeg',
         },
      },
      {
         type: 'jpeg',
         fit: { width: 1024, height: 1024 },
         quality: 0.8,
         imageDelivery: {
            upload: {
               url: signUploadUrl(
                  'https://bucket.domain/path/to/image-1024.jpeg?signature=...'
               ),
               method: 'PUT',
            },
         },
      },
   ],
});
```

Generate multiple images in a single request (up to 10). Images can be returned as an ArrayBuffer, saved to a specified local path, or uploaded to a storage bucket.

## Transform Options

Below are self-explanatory TypeScript interfaces of the transform options.

```typescript
interface TransformOptions {
   source: SourceOptions;
   destination?: DestinationOptions;
   destinations?: DestinationOptions[];
   crop?: NormalizedCrop;
}

interface SourceOptions {
   remoteUrl?: string;
   localPath?: string;
   buffer?: Buffer;
}

interface DestinationOptions {
   fit: Size;
   type: DestinationImageType;
   quality?: number;
   imageDelivery?: ImageDelivery;
}

interface ImageDelivery {
   saveTolocalPath?: string;
   upload?: Upload;
   buffer?: boolean;
}

interface Upload {
   url: string;
   method?: 'post' | 'put';
}

type DestinationImageType = 'jpeg' | 'png' | 'heic';
```

Exactly one property of the **SourceOptions** object can be specified for the source image. If specifying **remoteUrl** make sure the URL is valid and the image freely accessible.

You can set either one **destination** or multiple **destinations** (up to 10).

Exactly one optional parameter of **ImageDelivery** needs to be specified. If **imageDelivery** itself is undefined, the image will be delivered as **ArrayBuffer**.

The **upload** parameter of **ImageDelivery** allows you to upload the image directly to services like AWS S3 bucket or Google Cloud Storage. Provide a signed URL and the method for the upload.

## Transform Response

```typescript
interface TransformResponse {
   sourceImage: SourceImageInfo;
   image?: ImageResult;
   destinationImages?: DestinationImage[];
}

interface SourceImageInfo {
   pixelSize: Size;
   byteSize: number;
}

interface DestinationImage {
   fit: Size;
   pixelSize: Size;
   image: ImageResult;
}

type ImageResult = ArrayBuffer | string | 'uploaded';

interface Size {
   width: number;
   height: number;
}
```

**sourceImage** contains some information about the image sent.

If single destination was set in the **TransformOptions** then the result will be in the **image** property of the response, otherwise in the **destinationImages**.

The **image** property of the **DestinationImage** varies: it can be an ArrayBuffer, a string indicating the image was 'uploaded', or a path to the local file where the transformed image was saved.
