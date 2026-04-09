import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type {Command} from 'commander';
import {
	type SenseVoiceLanguage,
	convertToWav,
	readWave,
	runAsr,
} from './asr.js';
import {ensureModels, ensureVadModel} from './models.js';
import {streamAsr} from './stream-asr.js';

export function register(program: Command) {
	program
		.command('asr')
		.description('Transcribe an audio file using speech recognition')
		.argument('<file>', 'Audio file to transcribe')
		.option('-j, --json', 'Output result in JSON format', false)
		.option('--model <name>', 'Model to use: whisper, sensevoice', 'sensevoice')
		.option(
			'--language <lang>',
			'Language for sensevoice: auto, zh, en, ja, ko, yue',
			'auto',
		)
		.action(
			async (
				file: string,
				options: {json: boolean; model: string; language: string},
			) => {
				const {model} = options;
				if (model !== 'whisper' && model !== 'sensevoice') {
					throw new Error(
						`Unknown model "${model}". Use "whisper" or "sensevoice".`,
					);
				}

				const validLanguages = new Set(['auto', 'zh', 'en', 'ja', 'ko', 'yue']);
				if (!validLanguages.has(options.language)) {
					throw new Error(
						`Unknown language "${options.language}". Use one of: auto, zh, en, ja, ko, yue.`,
					);
				}

				await ensureModels([model]);
				const resolvedPath = path.resolve(file);
				const ext = path.extname(resolvedPath).toLowerCase();

				let wavPath: string | undefined;
				let needsCleanup = false;
				if (ext === '.wav') {
					wavPath = resolvedPath;
				} else {
					wavPath = await convertToWav(resolvedPath);
					needsCleanup = true;
				}

				try {
					const input = readWave(wavPath);
					await runAsr(input, {
						json: options.json,
						model,
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
						language: options.language as SenseVoiceLanguage,
					});
				} finally {
					if (needsCleanup && fs.existsSync(wavPath)) {
						fs.unlinkSync(wavPath);
					}
				}
			},
		);

	program
		.command('asr-stream')
		.description(
			'Stream speech recognition from stdin (expects 16kHz mono s16le PCM)',
		)
		.option('-j, --json', 'Output each result as a JSON line', false)
		.option('--vad', 'Enable voice activity detection', false)
		.option(
			'--language <lang>',
			'Language for sensevoice: auto, zh, en, ja, ko, yue',
			'auto',
		)
		.option(
			'--asr-interval-ms <ms>',
			'Recognition interval in ms (ignored with --vad)',
			'1000',
		)
		.action(
			async (options: {
				json: boolean;
				vad: boolean;
				language: string;
				asrIntervalMs: string;
			}) => {
				const validLanguages = new Set(['auto', 'zh', 'en', 'ja', 'ko', 'yue']);
				if (!validLanguages.has(options.language)) {
					throw new Error(
						`Unknown language "${options.language}". Use one of: auto, zh, en, ja, ko, yue.`,
					);
				}

				await ensureModels();
				if (options.vad) {
					await ensureVadModel();
				}

				async function* stdinAudio() {
					for await (const chunk of process.stdin) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
						const buf = Buffer.from(chunk as Uint8Array);
						const pcm = new Int16Array(
							buf.buffer,
							buf.byteOffset,
							buf.byteLength / 2,
						);
						const float32 = new Float32Array(pcm.length);
						for (const [i, sample] of pcm.entries()) {
							float32[i] = sample / 32_768;
						}

						yield float32;
					}
				}

				await streamAsr(stdinAudio(), {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
					language: options.language as SenseVoiceLanguage,
					vad: options.vad || undefined,
					asrIntervalMs: Number(options.asrIntervalMs),
					onResult(result) {
						if (options.json) {
							console.log(JSON.stringify(result));
						} else {
							console.log(result.text);
						}
					},
				});
			},
		);
}
