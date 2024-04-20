import Scaler from '../src/scaler';

let scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		source: { localPath: 'test-data/test.heic' },
		destinations: [
			{
				type: 'jpeg',
				fit: { width: 1280, height: 1280 },
				quality: 0.8,
				imageDelivery: {
					saveToLocalPath: 'test-data/test-result1280.jpeg',
				},
			},
			{
				type: 'jpeg',
				fit: { width: 1024, height: 1024 },
				quality: 0.8,
				imageDelivery: {
					saveToLocalPath: 'test-data/test-result1024.jpeg',
				},
			},
			{
				type: 'jpeg',
				fit: { width: 512, height: 512 },
				quality: 0.8,
				imageDelivery: {
					saveToLocalPath: 'test-data/test-result512.jpeg',
				},
			},
		],
	});
	console.log('response', response);
}

test();
