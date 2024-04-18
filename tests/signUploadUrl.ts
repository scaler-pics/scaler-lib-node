import dateFormat from 'dateformat';
import crypto from 'crypto';
import bucketSecrets from './bucketSecrets';

const { bucketName, signedURLExpiration, host, private_key, client_email } =
	bucketSecrets;

export default function signUploadUrl(imagePath: string) {
	const contentType = 'image/jpeg';
	const method = 'PUT';

	const now = new Date();
	const credentalScope = `${dateFormat(
		now,
		'yyyymmdd',
		true
	)}/auto/storage/goog4_request`;
	const credental = encodeURIComponent(`${client_email}/${credentalScope}`);
	const date = dateFormat(now, `yyyymmdd'T'HHMMss'Z'`, true);
	const signedHeaders = contentType ? 'content-type;host' : 'host';
	// tslint:disable-next-line:max-line-length
	const queryString = `X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=${credental}&X-Goog-Date=${date}&X-Goog-Expires=${signedURLExpiration}&X-Goog-SignedHeaders=${encodeURIComponent(
		signedHeaders
	)}`;
	const headers = contentType
		? `content-type:${contentType}\nhost:${host}`
		: `host:${host}`;
	const payload = 'UNSIGNED-PAYLOAD';
	// tslint:disable-next-line:max-line-length
	const canonicalRequest = `${method}\n/${bucketName}/${imagePath}\n${queryString}\n${headers}\n\n${signedHeaders}\n${payload}`;
	const canonicalRequestHash = crypto
		.createHash('sha256')
		.update(canonicalRequest)
		.digest('hex');
	const stringToSign = `GOOG4-RSA-SHA256\n${date}\n${credentalScope}\n${canonicalRequestHash}`;
	const signature = crypto
		.createSign('sha256')
		.update(stringToSign)
		.sign(private_key, 'hex');
	// tslint:disable-next-line:max-line-length
	const signedUrl = `https://${host}/${bucketName}/${imagePath}?${queryString}&X-Goog-Signature=${signature}`;
	return signedUrl;
}
