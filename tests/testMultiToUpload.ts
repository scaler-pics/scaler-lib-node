import Scaler from '../src/scaler';
import signUploadUrl from './signUploadUrl';

let scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const response = await scaler.transform({
		source: { localPath: 'tests/test.heic' },
		destinations: [
			{
				type: 'jpeg',
				fit: { width: 1280, height: 1280 },
				quality: 0.8,
				imageDelivery: {
					upload: {
						url: signUploadUrl('atest/test-image4-1280.jpeg'),
						method: 'PUT',
					},
				},
			},
			{
				type: 'jpeg',
				fit: { width: 1024, height: 1024 },
				quality: 0.8,
				imageDelivery: {
					upload: {
						url: signUploadUrl('atest/test-image4-1024.jpeg'),
						method: 'PUT',
					},
				},
			},
			{
				type: 'jpeg',
				fit: { width: 512, height: 512 },
				quality: 0.8,
				imageDelivery: {
					upload: {
						url: signUploadUrl('atest/test-image4-512.jpeg'),
						method: 'PUT',
					},
				},
			},
		],
	});
	console.log('response', response);
}

test();
