import Scaler from '../src/scaler';

let scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		source: { localPath: 'tests/test.heic' },
		destination: {
			type: 'jpeg',
			fit: { width: 1024, height: 1024 },
			quality: 0.8,
			imageDelivery: {
				saveToLocalPath: 'tests/test-result1024.jpeg',
			},
		},
	});
	console.log('response', response);
}

test();
