import Scaler from '../src/scaler';

const scaler = new Scaler(process.env.API_KEY || '');

async function test() {
	const timeStart = Date.now();
	const promises: Promise<void>[] = [];
	// get first argument from command line
	const count = parseInt(process.argv[2]) || 10;
	for (let i = 0; i < count; i++) {
		promises.push(transfromImage(i));
	}
	await Promise.all(promises);
	console.log(
		`Time elapsed for ${count} concurent transfroms :`,
		Date.now() - timeStart
	);
}

async function transfromImage(index: number) {
	const response = await scaler.transform({
		source: { localPath: 'test-data/test.heic' },
		destinations: [
			{
				type: 'jpeg',
				fit: { width: 1280, height: 1280 },
				quality: 0.8,
				imageDelivery: {
					saveToLocalPath: `test-data/test-result-${index}-1280.jpeg`,
				},
			},
			{
				type: 'jpeg',
				fit: { width: 1024, height: 1024 },
				quality: 0.8,
				imageDelivery: {
					saveToLocalPath: `test-data/test-result-${index}-1024.jpeg`,
				},
			},
			{
				type: 'jpeg',
				fit: { width: 512, height: 512 },
				quality: 0.8,
				imageDelivery: {
					saveToLocalPath: `test-data/test-result-${index}-512.jpeg`,
				},
			},
		],
	});
	console.log('response', JSON.stringify(response, null, 3));
}

test();
