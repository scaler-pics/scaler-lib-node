# Scaler.pics

Image resizing and conversion service.

## Installation

To use the [Scaler](https://scaler.pics) Node.js API, install the npm package as follows:

```shell
npm install scaler.pics
```

## Basic Usage

Initialize the scaler object with your API key, which you can obtain from [Scaler](https://scaler.pics). Then use it to transform images as needed.

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

<em>
	When testing the api make sure you test from location with a
	good upload speed as that can greatly affect the response
	time. (for example, test from your server and not from your
	local machine)
</em>

## Multiple Destinations

Generate multiple images in a single request (up to 10). Images can be returned as an ArrayBuffer, saved to a specified local path, or uploaded to a storage bucket.

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

## Transform Options

Below are self-explanatory TypeScript interfaces of the transform options.

```typescript
export interface TransformOptions {
   source: SourceOptions;
   destination?: DestinationOptions;
   destinations?: DestinationOptions[];
}

interface Source {
   remoteUrl?: string;
   localPath?: string;
   buffer?: Buffer;
}

interface DestinationOptions {
   fit: Size;
   type: DestinationImageType;
   quality?: number;
   imageDelivery?: ImageDelivery;
   crop?: NormalizedCrop;
}

interface Size {
   width: number;
   height: number;
}

type DestinationImageType = 'jpeg' | 'png' | 'heic';

interface ImageDelivery {
   saveToLocalPath?: string;
   upload?: Upload;
   buffer?: boolean;
}

export interface Upload {
   url: string;
   method?: 'POST' | 'PUT';
}
```

Exactly one property of the **SourceOptions** object can be specified for the source image. If specifying **remoteUrl** make sure the URL is valid and the image freely accessible.

You can set either single **destination** or multiple **destinations** (up to 10).

Exactly one optional parameter of **ImageDelivery** needs to be specified. If **imageDelivery** itself is undefined, the image will be delivered as an **ArrayBuffer**.

The **upload** parameter of **ImageDelivery** allows you to upload the image directly to services like AWS S3 bucket or Google Cloud Storage. Provide a signed URL and the method for the upload.

## Transform Response

```typescript
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

**sourceImage** contains information about the image sent.

If single destination was set in the **TransformOptions** then the result will be in the **image** property of the response, otherwise in the **destinationImages**.

The **image** property of the **DestinationImage** varies: it can be an ArrayBuffer, a string indicating the image was 'uploaded', or a path to the local file where the transformed image was saved.
