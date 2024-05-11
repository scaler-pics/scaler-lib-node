import Scaler from '../src/scaler';
import signUploadUrl from './signUploadUrl';

const scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		input: { localPath: 'test-data/test.heic' },
		output: {
			type: 'jpeg',
			fit: { width: 1024, height: 1024 },
			quality: 0.8,
			imageDelivery: {
				upload: {
					url: signUploadUrl('atest/test-image4-1280.jpeg'),
					method: 'PUT',
				},
			},
		},
	});
	console.log('response', JSON.stringify(response, null, 3));
}

test();
