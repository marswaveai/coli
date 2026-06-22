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
import {
	ensureModels,
	ensureVadModel,
	resolveAsrModelFiles,
	resolveVadModelFile,
} from './models.js';
import {streamAsr} from './stream-asr.js';

export function register(program: Command) {
	program
		.command('asr')
		.description('Transcribe an audio file using speech recognition')
		.argument('<file>', 'Audio file to transcribe')
		.option('-j, --json', 'Output result in JSON format', false)
		.option('--model <name>', 'Model to use: whisper, sensevoice', 'sensevoice')
		.option('--model-path <path>', 'Path to a local model file or directory')
		.option(
			'--language <lang>',
			'Language for sensevoice: auto, zh, en, ja, ko, yue',
			'auto',
		)
		.action(
			async (
				file: string,
				options: {
					json: boolean;
					model: string;
					modelPath?: string;
					language: string;
				},
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

				if (options.modelPath) {
					resolveAsrModelFiles(model, options.modelPath);
				} else {
					await ensureModels([model]);
				}

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
						modelPath: options.modelPath,
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
			'--model-path <path>',
			'Path to a local SenseVoice model file or directory',
		)
		.option('--vad-model-path <path>', 'Path to a local VAD model file')
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
				modelPath?: string;
				vadModelPath?: string;
				language: string;
				asrIntervalMs: string;
			}) => {
				const validLanguages = new Set(['auto', 'zh', 'en', 'ja', 'ko', 'yue']);
				if (!validLanguages.has(options.language)) {
					throw new Error(
						`Unknown language "${options.language}". Use one of: auto, zh, en, ja, ko, yue.`,
					);
				}

				if (options.modelPath) {
					resolveAsrModelFiles('sensevoice', options.modelPath);
				} else {
					await ensureModels();
				}

				if (options.vadModelPath) {
					if (options.vad) {
						resolveVadModelFile(options.vadModelPath);
					} else {
						throw new Error('Use --vad with --vad-model-path.');
					}
				} else if (options.vad) {
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
					modelPath: options.modelPath,
					vad: options.vad ? {modelPath: options.vadModelPath} : undefined,
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
