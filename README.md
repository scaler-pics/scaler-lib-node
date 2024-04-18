# Scaler Node.js API Documentation

## Installation

To use [Scaler](https://scaler.pics) Node.js API, you need to install the package from npm.

```shell
npm install scaler.pics
```

## Basic Usage

```javascript
import Scaler from 'scaler';

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

Initialize the `scaler` object with your API key (only once in your project), and then use it to transform images as needed. You can get API key here [scaler.pics](https://scaler.pics).

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

You can set either one **destination** or multiple **destionations** (up to 10).

Exactly one optional parameter of **ImageDelivery** needs to be specified. If **imageDelivery** itself is undefined, the image will be delivered as **ArrayBuffer**.

The **upload** parameter of **ImageDelivery** is useful if you want to upload the image directly to an **AWS S3 bucket**, **Google Cloud Storage**, or similar service. Just provide signed URL for the upload and method to use.

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

**image** property of the **DestinationImage** is either **ArrayBuffer**, the string value **'uploaded'** if image was uploaded to the storage bucket or path to local file where transformed image was saved.
