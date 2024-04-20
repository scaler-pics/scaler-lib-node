import Scaler from '../src/scaler';

let scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		source: { localPath: 'test-data/test.heic' },
		destination: {
			type: 'jpeg',
			fit: { width: 1024, height: 1024 },
			quality: 0.8,
		},
	});
	console.log('response', response);
}

test();
