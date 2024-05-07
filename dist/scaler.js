"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_decode_1 = require("jwt-decode");
const fs_1 = __importDefault(require("fs"));
const stream_1 = require("stream");
const refreshAccessTokenUrl = process.env.REFRESH_URL || 'https://api.scaler.pics/auth/api-key-token';
const signUrl = process.env.SIGN_URL || 'https://sign.scaler.pics/sign';
class Scaler {
    constructor(apiKey) {
        this.accessToken = null;
        this.isRefreshingAccessToken = false;
        this.refreshPromises = [];
        this.transform = (options) => __awaiter(this, void 0, void 0, function* () {
            yield this.refreshAccessTokenIfNeeded();
            const start = Date.now();
            if ((!options.destinations || !options.destinations.length) &&
                !options.destination) {
                throw new Error('No destination provided');
            }
            const dests = options.destinations
                ? options.destinations
                : [options.destination];
            const destinations = dests.map((dest) => {
                var _a;
                return {
                    fit: dest.fit,
                    type: dest.type,
                    quality: dest.quality,
                    upload: (_a = dest.imageDelivery) === null || _a === void 0 ? void 0 : _a.upload,
                    crop: dest.crop,
                };
            });
            const options2 = {
                source: options.source.remoteUrl || 'body',
                destinations,
            };
            const startSignUrl = Date.now();
            const res = yield fetch(signUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(options2),
            });
            if (res.status !== 200) {
                const text = yield res.text();
                throw new Error(`Failed to get transform url. status: ${res.status}, text: ${text}`);
            }
            const json = yield res.json();
            const signMs = Date.now() - startSignUrl;
            const { url } = json;
            const headers = {};
            let body = undefined;
            if (options.source.buffer) {
                headers['Content-Type'] = 'application/x-octet-stream';
                headers['Content-Length'] = `${options.source.buffer.length}`;
                body = options.source.buffer;
            }
            else if (options.source.localPath) {
                headers['Content-Type'] = 'application/x-octet-stream';
                const { size } = fs_1.default.statSync(options.source.localPath);
                headers['Content-Type'] = 'application/x-octet-stream';
                headers['Content-Length'] = `${size}`;
                body = fs_1.default.createReadStream(options.source.localPath);
            }
            const startTransformTime = Date.now();
            const res2 = yield fetch(url, {
                method: 'POST',
                headers,
                body,
                duplex: 'half',
            });
            if (res2.status !== 200) {
                const text = yield res2.text();
                throw new Error(`Failed to transform image. status: ${res2.status}, text: ${text}`);
            }
            const endTransformTime = Date.now();
            const { sourceImage, destinationImages, deleteUrl, timeStats: apiTimeStats, } = (yield res2.json());
            const sendImageMs = endTransformTime -
                startTransformTime -
                apiTimeStats.transformMs -
                (apiTimeStats.uploadImagesMs || 0);
            const startGetImages = Date.now();
            const promises = destinationImages.map((dest, i) => {
                var _a;
                if (dest.downloadUrl) {
                    const dlUrl = dest.downloadUrl;
                    if ((_a = dests[i].imageDelivery) === null || _a === void 0 ? void 0 : _a.saveToLocalPath) {
                        const destPath = dests[i].imageDelivery
                            .saveToLocalPath;
                        return new Promise((resolve, reject) => {
                            fetch(dlUrl)
                                .then((res3) => {
                                if (res3.status !== 200) {
                                    const text = res3.text();
                                    reject(new Error(`Failed to download image. status: ${res3.status}, text: ${text}`));
                                    return;
                                }
                                if (res3.body === null) {
                                    reject(new Error('Response body is null'));
                                    return;
                                }
                                const reader = res3.body.getReader();
                                const stream = new stream_1.Readable({
                                    read() {
                                        return __awaiter(this, void 0, void 0, function* () {
                                            const { done, value } = yield reader.read();
                                            if (done) {
                                                this.push(null);
                                            }
                                            else {
                                                this.push(Buffer.from(value));
                                            }
                                        });
                                    },
                                });
                                const destStream = fs_1.default.createWriteStream(destPath);
                                stream.pipe(destStream);
                                destStream.on('finish', () => {
                                    resolve({ image: destPath });
                                });
                                destStream.on('error', reject);
                            })
                                .catch((err) => {
                                reject(err);
                            });
                        });
                    }
                    else {
                        return new Promise((resolve, reject) => {
                            fetch(dlUrl)
                                .then((res3) => {
                                if (res3.status !== 200) {
                                    const text = res3.text();
                                    reject(new Error(`Failed to download image. status: ${res3.status}, text: ${text}`));
                                    return;
                                }
                                res3
                                    .arrayBuffer()
                                    .then((buffer) => {
                                    resolve({ image: buffer });
                                })
                                    .catch((err) => {
                                    reject(err);
                                });
                            })
                                .catch((err) => {
                                reject(err);
                            });
                        });
                    }
                }
                else {
                    return Promise.resolve({ image: 'uploaded' });
                }
            });
            const destinationImages2 = yield Promise.all(promises);
            const getImagesMs = apiTimeStats.uploadImagesMs || Date.now() - startGetImages;
            const deleteBody = {
                images: destinationImages
                    .filter((dest) => dest.fileId)
                    .map((dest) => dest.fileId),
            };
            fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(deleteBody),
            }).catch((error) => {
                console.error('Failed to delete received images', error);
            });
            const totalMs = Date.now() - start;
            const response = {
                sourceImage,
                image: options.destination ? destinationImages2[0].image : undefined,
                destinationImages: options.destinations
                    ? destinationImages.map((dest, i) => {
                        return {
                            fit: dest.fit,
                            pixelSize: dest.pixelSize,
                            image: destinationImages2[i].image,
                        };
                        // eslint-disable-next-line
                    })
                    : undefined,
                timeStats: {
                    signMs,
                    sendImageMs,
                    transformMs: apiTimeStats.transformMs,
                    getImagesMs,
                    totalMs,
                },
            };
            return response;
        });
        this.refreshAccessTokenIfNeeded = () => __awaiter(this, void 0, void 0, function* () {
            let shouldRefresh = false;
            if (this.accessToken === null) {
                shouldRefresh = true;
            }
            else {
                const decoded = (0, jwt_decode_1.jwtDecode)(this.accessToken);
                const now = Date.now() / 1000;
                if (now >= decoded.exp) {
                    shouldRefresh = true;
                }
            }
            if (!shouldRefresh) {
                return;
            }
            if (this.isRefreshingAccessToken) {
                return new Promise((resolve, reject) => {
                    this.refreshPromises.push({ resolve, reject });
                });
            }
            this.isRefreshingAccessToken = false;
            try {
                const res = yield fetch(refreshAccessTokenUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                });
                if (res.status !== 200) {
                    const text = yield res.text();
                    throw new Error(`Failed to refresh the access token. status: ${res.status}, text: ${text}`);
                }
                const json = yield res.json();
                const { accessToken } = json;
                this.accessToken = accessToken;
                for (const { resolve } of this.refreshPromises) {
                    resolve();
                }
                this.refreshPromises = [];
                this.isRefreshingAccessToken = false;
            }
            catch (error) {
                for (const { reject } of this.refreshPromises) {
                    reject(error);
                }
                this.refreshPromises = [];
                this.isRefreshingAccessToken = false;
                throw error;
            }
        });
        this.apiKey = apiKey;
        this.refreshAccessTokenIfNeeded();
    }
}
exports.default = Scaler;
