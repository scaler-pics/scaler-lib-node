import Scaler from '../src/scaler';

const scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		source: { localPath: 'test-data/test.heic' },
		destination: {
			type: 'jpeg',
			fit: { width: 1024, height: 1024 },
			quality: 0.8,
			imageDelivery: {
				saveToLocalPath: 'test-data/test-result1024.jpeg',
			},
		},
	});
	console.log('response', JSON.stringify(response, null, 3));
}

test();
