import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {execa} from 'execa';

const modelsDirectory = path.join(os.homedir(), '.coli', 'models');

const punctModel = {
	dirName: 'sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8',
	url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8.tar.bz2',
	checkFile: 'model.int8.onnx',
};

export function getPunctModelPath(): string {
	return path.join(modelsDirectory, punctModel.dirName);
}

function isInstalled(): boolean {
	return fs.existsSync(path.join(getPunctModelPath(), punctModel.checkFile));
}

export async function ensurePunctModel(): Promise<void> {
	if (isInstalled()) {
		return;
	}

	const {dirName, url} = punctModel;

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

	await execa('tar', ['xf', tarPath, '-C', modelsDirectory]);
	fs.unlinkSync(tarPath);

	console.log(`  ${dirName} ready.\n`);
}
