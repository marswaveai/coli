import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Writable} from 'node:stream';
import {execa} from 'execa';
import {ListenHubApi} from '../_api/listenhub-openapi.js';
import type {SpeakerLanguage} from '../_api/types.js';

export type CloudTtsOptions = {
	apiKey: string;
	voice: string;
	model?: string;
	output?: string;
};

export type ListSpeakersOptions = {
	apiKey: string;
	language?: SpeakerLanguage;
};

export async function listSpeakers(options: ListSpeakersOptions) {
	const api = new ListenHubApi({apiKey: options.apiKey});
	const result = await api.getAvailableSpeakers({
		language: options.language,
	});
	return result.data.items;
}

async function collectStream(
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();
	for (;;) {
		const {done, value} = await reader.read(); // eslint-disable-line no-await-in-loop
		if (done) break;
		chunks.push(value);
	}

	return Buffer.concat(chunks);
}

export async function runCloudTts(
	text: string,
	options: CloudTtsOptions,
): Promise<void> {
	const api = new ListenHubApi({apiKey: options.apiKey});
	const stream = await api.tts({
		input: text,
		voice: options.voice,
		model: options.model,
	});

	if (options.output) {
		const fileStream = fs.createWriteStream(options.output);
		await stream.pipeTo(Writable.toWeb(fileStream));
		return;
	}

	const mp3Path = path.join(os.tmpdir(), `coli-cloud-tts-${Date.now()}.mp3`);
	const audio = await collectStream(stream);
	fs.writeFileSync(mp3Path, audio);
	try {
		// eslint-disable-next-line @typescript-eslint/await-thenable
		await execa('afplay', [mp3Path]);
	} finally {
		fs.unlinkSync(mp3Path);
	}
}
