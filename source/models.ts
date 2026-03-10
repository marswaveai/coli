import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const modelsDirectory = path.join(os.homedir(), '.coli', 'models');

type ModelName = 'whisper' | 'sensevoice';

const models: Record<
	ModelName,
	{dirName: string; url: string; checkFile: string}
> = {
	whisper: {
		dirName: 'sherpa-onnx-whisper-tiny.en',
		url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2',
		checkFile: 'tiny.en-encoder.int8.onnx',
	},
	sensevoice: {
		dirName: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
		url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2',
		checkFile: 'model.int8.onnx',
	},
};

export const modelDisplayNames: Record<ModelName, string> = {
	whisper: 'whisper-tiny.en',
	sensevoice: 'sensevoice-small',
};

export function getModelPath(model: ModelName): string {
	return path.join(modelsDirectory, models[model].dirName);
}

function isModelInstalled(model: ModelName): boolean {
	return fs.existsSync(path.join(getModelPath(model), models[model].checkFile));
}

async function downloadModel(model: ModelName): Promise<void> {
	const {dirName, url} = models[model];

	console.log(`Downloading ${dirName}...`);
	fs.mkdirSync(modelsDirectory, {recursive: true});

	const tarPath = path.join(modelsDirectory, `${dirName}.tar.bz2`);
	const response = await fetch(url, {redirect: 'follow'});
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download model: ${response.statusText}`);
	}

	const contentLength = Number(response.headers.get('content-length') ?? 0);
	const reader = response.body.getReader();
	const fileHandle = fs.openSync(tarPath, 'w');

	let downloaded = 0;
	try {
		for (;;) {
			const {done, value} = await reader.read(); // eslint-disable-line no-await-in-loop
			if (done) {
				break;
			}

			fs.writeSync(fileHandle, value);
			downloaded += value.length;
			if (contentLength > 0) {
				const percent = ((downloaded / contentLength) * 100).toFixed(1);
				const mb = (downloaded / (1024 * 1024)).toFixed(1);
				const totalMb = (contentLength / (1024 * 1024)).toFixed(1);
				process.stdout.write(`\r  ${mb} MB / ${totalMb} MB (${percent}%)`);
			}
		}
	} finally {
		fs.closeSync(fileHandle);
	}

	process.stdout.write('\n');
	console.log('  Extracting...');

	execFileSync('tar', ['xjf', tarPath, '-C', modelsDirectory], {stdio: 'pipe'});
	fs.unlinkSync(tarPath);

	console.log(`  ${dirName} ready.\n`);
}

export async function ensureModels(): Promise<void> {
	const pending: ModelName[] = [];
	for (const name of ['whisper', 'sensevoice'] as const) {
		if (!isModelInstalled(name)) {
			pending.push(name);
		}
	}

	if (pending.length === 0) {
		return;
	}

	console.log('First run: downloading ASR models...\n');
	for (const model of pending) {
		await downloadModel(model); // eslint-disable-line no-await-in-loop
	}

	console.log('All models ready.\n');
}
