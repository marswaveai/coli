import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type {Command} from 'commander';
import {
	type AsrHotwordEntry,
	type AsrHotwords,
	type SenseVoiceLanguage,
	convertToWav,
	readWave,
	runAsr,
} from './asr.js';
import {type ModelName, ensureModels, ensureVadModel} from './models.js';
import {type StreamModelName, streamAsr} from './stream-asr.js';

const batchModels = new Set<ModelName>([
	'whisper',
	'sensevoice',
	'zipformer-zh-en',
]);

const streamModels = new Set<StreamModelName>([
	'sensevoice',
	'zipformer-zh-en',
	'streaming-zipformer-zh-en',
]);

function parseHotwordEntry(raw: string): AsrHotwordEntry | undefined {
	const trimmed = raw.trim();
	if (!trimmed) {
		return undefined;
	}

	const lastColon = trimmed.lastIndexOf(':');
	if (lastColon <= 0) {
		return trimmed;
	}

	const phrase = trimmed.slice(0, lastColon).trim();
	const scoreText = trimmed.slice(lastColon + 1).trim();
	if (!phrase) {
		return undefined;
	}

	const score = Number(scoreText);
	if (Number.isNaN(score)) {
		throw new TypeError(
			`Invalid hotword score "${scoreText}" in "${trimmed}". Expected a number.`,
		);
	}

	return {phrase, score};
}

type HotwordsCliOptions = {
	hotwords?: string;
	hotwordsFile?: string;
	hotwordsScore?: string;
};

function resolveHotwords(options: HotwordsCliOptions): AsrHotwords | undefined {
	if (options.hotwords && options.hotwordsFile) {
		throw new Error('Use either --hotwords or --hotwords-file, not both.');
	}

	let score: number | undefined;
	if (options.hotwordsScore !== undefined) {
		score = Number(options.hotwordsScore);
		if (Number.isNaN(score)) {
			throw new TypeError(
				`Invalid --hotwords-score "${options.hotwordsScore}". Expected a number.`,
			);
		}
	}

	if (options.hotwordsFile) {
		return score === undefined
			? {file: options.hotwordsFile}
			: {file: options.hotwordsFile, score};
	}

	if (options.hotwords) {
		const words: AsrHotwordEntry[] = [];
		for (const part of options.hotwords.split(',')) {
			const entry = parseHotwordEntry(part);
			if (entry) {
				words.push(entry);
			}
		}

		if (words.length === 0) {
			throw new Error('--hotwords contained no valid entries.');
		}

		return score === undefined ? {words} : {words, score};
	}

	return undefined;
}

function isBatchModel(model: string): model is ModelName {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return batchModels.has(model as ModelName);
}

function isStreamModel(model: string): model is StreamModelName {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return streamModels.has(model as StreamModelName);
}

export function register(program: Command) {
	program
		.command('asr')
		.description('Transcribe an audio file using speech recognition')
		.argument('<file>', 'Audio file to transcribe')
		.option('-j, --json', 'Output result in JSON format', false)
		.option(
			'--model <name>',
			'Model to use: whisper, sensevoice, zipformer-zh-en',
			'sensevoice',
		)
		.option(
			'--language <lang>',
			'Language for sensevoice: auto, zh, en, ja, ko, yue',
			'auto',
		)
		.option(
			'--hotwords <words>',
			'Comma-separated hotwords (e.g. "Anthropic,Claude:2.5")',
		)
		.option('--hotwords-file <path>', 'Path to a sherpa-onnx hotwords file')
		.option('--hotwords-score <number>', 'Default score for hotwords')
		.action(
			async (
				file: string,
				options: {
					json: boolean;
					model: string;
					language: string;
					hotwords?: string;
					hotwordsFile?: string;
					hotwordsScore?: string;
				},
			) => {
				const {model} = options;
				if (!isBatchModel(model)) {
					throw new Error(
						`Unknown model "${model}". Use "whisper", "sensevoice", or "zipformer-zh-en".`,
					);
				}

				const validLanguages = new Set(['auto', 'zh', 'en', 'ja', 'ko', 'yue']);
				if (!validLanguages.has(options.language)) {
					throw new Error(
						`Unknown language "${options.language}". Use one of: auto, zh, en, ja, ko, yue.`,
					);
				}

				const hotwords = resolveHotwords(options);

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
						hotwords,
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
			'--model <name>',
			'Model to use: sensevoice, zipformer-zh-en, streaming-zipformer-zh-en',
			'sensevoice',
		)
		.option(
			'--language <lang>',
			'Language for sensevoice: auto, zh, en, ja, ko, yue',
			'auto',
		)
		.option(
			'--asr-interval-ms <ms>',
			'Recognition interval in ms (ignored with --vad or streaming model)',
			'1000',
		)
		.option(
			'--hotwords <words>',
			'Comma-separated hotwords (e.g. "Anthropic,Claude:2.5")',
		)
		.option('--hotwords-file <path>', 'Path to a sherpa-onnx hotwords file')
		.option('--hotwords-score <number>', 'Default score for hotwords')
		.action(
			async (options: {
				json: boolean;
				vad: boolean;
				model: string;
				language: string;
				asrIntervalMs: string;
				hotwords?: string;
				hotwordsFile?: string;
				hotwordsScore?: string;
			}) => {
				const {model} = options;
				if (!isStreamModel(model)) {
					throw new Error(
						`Unknown model "${model}". Use "sensevoice", "zipformer-zh-en", or "streaming-zipformer-zh-en".`,
					);
				}

				const validLanguages = new Set(['auto', 'zh', 'en', 'ja', 'ko', 'yue']);
				if (!validLanguages.has(options.language)) {
					throw new Error(
						`Unknown language "${options.language}". Use one of: auto, zh, en, ja, ko, yue.`,
					);
				}

				const hotwords = resolveHotwords(options);

				await ensureModels([model]);
				if (options.vad && model !== 'streaming-zipformer-zh-en') {
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
					model,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
					language: options.language as SenseVoiceLanguage,
					vad:
						options.vad && model !== 'streaming-zipformer-zh-en'
							? true
							: undefined,
					asrIntervalMs: Number(options.asrIntervalMs),
					hotwords,
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
