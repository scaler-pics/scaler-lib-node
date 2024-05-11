import Scaler from '../src/scaler';

const scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		input: { localPath: 'test-data/test.heic' },
		output: [
			{
				type: 'jpeg',
				fit: { width: 1280, height: 1280 },
				quality: 0.8,
			},
			{
				type: 'jpeg',
				fit: { width: 1024, height: 1024 },
				quality: 0.8,
			},
			{
				type: 'jpeg',
				fit: { width: 512, height: 512 },
				quality: 0.8,
			},
		],
	});
	console.log('response', JSON.stringify(response, null, 3));
}

test();
