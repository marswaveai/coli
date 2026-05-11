import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {execa} from 'execa';
import ky from 'ky';

const modelsDirectory = path.join(os.homedir(), '.coli', 'models');

type ModelName = 'whisper' | 'sensevoice';

type ModelFile = {fileName: string; sha256: string};

type ModelEntry = {
	dirName: string;
	url: string;
	archiveSha256: string;
	files: ModelFile[];
};

class HashMismatchError extends Error {
	constructor(filePath: string, expectedSha256: string, actualSha256: string) {
		super(
			`SHA-256 mismatch for ${filePath}: expected ${expectedSha256}, got ${actualSha256}`,
		);
	}
}

const models: Record<ModelName, ModelEntry> = {
	whisper: {
		dirName: 'sherpa-onnx-whisper-tiny.en',
		url: 'https://files.colaos.ai/coli/models/sherpa-onnx-whisper-tiny.en.tar.bz2',
		archiveSha256:
			'2bd6cf965c8bb3e068ef9fa2191387ee63a9dfa2a4e37582a8109641c20005dd',
		files: [
			{
				fileName: 'tiny.en-encoder.int8.onnx',
				sha256:
					'0ce578b827c94a961aacb8fa14b02f096504b337e5c94be37c36238cbe3e8bc6',
			},
			{
				fileName: 'tiny.en-decoder.int8.onnx',
				sha256:
					'06c0e6ff6348d427e51839219d1c886c18cfdf411e629e33f5e1679bff9c1527',
			},
			{
				fileName: 'tiny.en-tokens.txt',
				sha256:
					'306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930',
			},
		],
	},
	sensevoice: {
		dirName: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
		url: 'https://files.colaos.ai/coli/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2',
		archiveSha256:
			'7d1efa2138a65b0b488df37f8b89e3d91a60676e416f515b952358d83dfd347e',
		files: [
			{
				fileName: 'model.int8.onnx',
				sha256:
					'c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51',
			},
			{
				fileName: 'tokens.txt',
				sha256:
					'f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc',
			},
		],
	},
};

export const modelDisplayNames: Record<ModelName, string> = {
	whisper: 'whisper-tiny.en',
	sensevoice: 'sensevoice-small',
};

export function getModelPath(model: ModelName): string {
	return path.join(modelsDirectory, models[model].dirName);
}

async function getFileSha256(filePath: string): Promise<string> {
	const hash = createHash('sha256');
	await pipeline(
		fs.createReadStream(filePath),
		new Writable({
			write(chunk: Uint8Array, _encoding, callback) {
				hash.update(chunk);
				callback();
			},
		}),
	);

	return hash.digest('hex');
}

function writeDownloadProgress(
	downloaded: number,
	contentLength: number,
	unit: 'kb' | 'mb',
): void {
	if (contentLength === 0) {
		return;
	}

	const divisor = unit === 'mb' ? 1024 * 1024 : 1024;
	const fractionDigits = unit === 'mb' ? 1 : 0;
	const percent = ((downloaded / contentLength) * 100).toFixed(1);
	const current = (downloaded / divisor).toFixed(fractionDigits);
	const total = (contentLength / divisor).toFixed(fractionDigits);
	const label = unit.toUpperCase();
	process.stdout.write(
		`\r  ${current} ${label} / ${total} ${label} (${percent}%)`,
	);
}

async function hasExpectedFiles(
	baseDirectory: string,
	files: ModelFile[],
): Promise<boolean> {
	for (const file of files) {
		const filePath = path.join(baseDirectory, file.fileName);
		if (!fs.existsSync(filePath)) {
			return false;
		}

		const actualSha256 = await getFileSha256(filePath); // eslint-disable-line no-await-in-loop
		if (actualSha256 !== file.sha256) {
			console.warn(`SHA-256 mismatch for ${filePath}; re-downloading.`);
			return false;
		}
	}

	return true;
}

async function isModelInstalled(entry: ModelEntry): Promise<boolean> {
	const modelDir = path.join(modelsDirectory, entry.dirName);
	return hasExpectedFiles(modelDir, entry.files);
}

async function downloadFile(options: {
	url: string;
	destination: string;
	expectedSha256: string;
	progressUnit: 'kb' | 'mb';
	errorLabel: string;
}): Promise<void> {
	const {url, destination, expectedSha256, progressUnit, errorLabel} = options;
	const response = await ky.get(url, {
		redirect: 'follow',
		throwHttpErrors: false,
	});
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download ${errorLabel}: ${response.statusText}`);
	}

	const contentLength = Number(response.headers.get('content-length') ?? 0);
	const reader = response.body.getReader();
	const hash = createHash('sha256');
	const fileHandle = fs.openSync(destination, 'w');

	let downloaded = 0;
	let completed = false;
	try {
		for (;;) {
			const {done, value} = await reader.read(); // eslint-disable-line no-await-in-loop
			if (done) {
				break;
			}

			fs.writeSync(fileHandle, value);
			hash.update(value);
			downloaded += value.length;
			writeDownloadProgress(downloaded, contentLength, progressUnit);
		}

		completed = true;
	} finally {
		fs.closeSync(fileHandle);
		if (contentLength > 0) {
			process.stdout.write('\n');
		}

		if (!completed) {
			fs.rmSync(destination, {force: true});
		}
	}

	const actualSha256 = hash.digest('hex');
	if (actualSha256 !== expectedSha256) {
		fs.rmSync(destination, {force: true});
		throw new HashMismatchError(destination, expectedSha256, actualSha256);
	}
}

async function withHashRetry(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		if (!(error instanceof HashMismatchError)) {
			throw error;
		}

		console.warn('  SHA-256 verification failed; re-downloading.');
		await action();
	}
}

async function downloadModel(entry: ModelEntry): Promise<void> {
	const {dirName, url} = entry;
	const modelDir = path.join(modelsDirectory, dirName);
	const tarPath = path.join(modelsDirectory, `${dirName}.tar.bz2`);

	await withHashRetry(async () => {
		console.log(`Downloading ${dirName}...`);
		fs.mkdirSync(modelsDirectory, {recursive: true});

		await downloadFile({
			url,
			destination: tarPath,
			expectedSha256: entry.archiveSha256,
			progressUnit: 'mb',
			errorLabel: 'model',
		});

		console.log('  Extracting...');
		fs.rmSync(modelDir, {recursive: true, force: true});
		try {
			await execa('tar', ['xf', tarPath, '-C', modelsDirectory]);
		} finally {
			fs.rmSync(tarPath, {force: true});
		}

		if (await hasExpectedFiles(modelDir, entry.files)) {
			console.log(`  ${dirName} ready.\n`);
			return;
		}

		fs.rmSync(modelDir, {recursive: true, force: true});
		throw new HashMismatchError(modelDir, 'expected model files', 'mismatch');
	});
}

export async function ensureModels(
	modelNames: ModelName[] = ['sensevoice'],
): Promise<void> {
	const pendingEntries = await Promise.all(
		modelNames.map(async (modelName) => {
			const entry = models[modelName];
			return (await isModelInstalled(entry)) ? undefined : entry;
		}),
	);

	for (const entry of pendingEntries) {
		if (entry) {
			await downloadModel(entry); // eslint-disable-line no-await-in-loop
		}
	}
}

const vadModelFile = 'silero_vad.onnx';
const vadModelUrl = 'https://files.colaos.ai/coli/models/silero_vad.onnx';
const vadModelSha256 =
	'9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6';

export function getVadModelPath(): string {
	return path.join(modelsDirectory, vadModelFile);
}

export async function ensureVadModel(): Promise<void> {
	const modelPath = getVadModelPath();
	if (
		await hasExpectedFiles(modelsDirectory, [
			{fileName: vadModelFile, sha256: vadModelSha256},
		])
	) {
		return;
	}

	await withHashRetry(async () => {
		console.log(`Downloading ${vadModelFile}...`);
		fs.mkdirSync(modelsDirectory, {recursive: true});

		await downloadFile({
			url: vadModelUrl,
			destination: modelPath,
			expectedSha256: vadModelSha256,
			progressUnit: 'kb',
			errorLabel: 'VAD model',
		});

		console.log(`  ${vadModelFile} ready.\n`);
	});
}
