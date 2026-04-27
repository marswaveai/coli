import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {execa} from 'execa';
import {deprecationAsrFilePath} from '../deprecations.js';
import {type ModelName, getModelPath, modelDisplayNames} from './models.js';

const require = createRequire(import.meta.url);

type SherpaOnnx = {
	OfflineRecognizer: new (config: Record<string, unknown>) => {
		createStream(): {
			acceptWaveform(wave: {sampleRate: number; samples: Float32Array}): void;
		};
		decode(stream: unknown): void;
		getResult(stream: unknown): {
			text: string;
			lang: string;
			emotion: string;
			event: string;
			timestamps: number[];
			tokens: string[];
		};
	};
	readWave(filename: string): {sampleRate: number; samples: Float32Array};
};

// Loaded lazily to avoid loading the native addon until needed
let _sherpaOnnx: SherpaOnnx | undefined;
function sherpaOnnx(): SherpaOnnx {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	_sherpaOnnx ??= require('sherpa-onnx-node') as SherpaOnnx;
	return _sherpaOnnx;
}

export function readWave(filename: string): AudioData {
	return sherpaOnnx().readWave(filename);
}

export async function convertToWav(inputPath: string): Promise<string> {
	const outputPath = path.join(os.tmpdir(), `coli-${Date.now()}.wav`);
	try {
		await execa('ffmpeg', [
			'-i',
			inputPath,
			'-ar',
			'16000',
			'-ac',
			'1',
			'-f',
			'wav',
			'-acodec',
			'pcm_s16le',
			outputPath,
			'-y',
		]);
	} catch {
		throw new Error(
			'Failed to convert audio file. Please make sure ffmpeg is installed.\n' +
				'  brew install ffmpeg    # macOS\n' +
				'  sudo apt install ffmpeg # Debian/Ubuntu',
		);
	}

	return outputPath;
}

export type SenseVoiceLanguage = 'auto' | 'zh' | 'en' | 'ja' | 'ko' | 'yue';

export type AsrHotwordEntry = string | {phrase: string; score?: number};

export type AsrHotwords =
	| {words: AsrHotwordEntry[]; score?: number}
	| {file: string; score?: number};

export const defaultHotwordsScore = 1.5;

export function formatHotwordLine(entry: AsrHotwordEntry): string {
	if (typeof entry === 'string') {
		return entry;
	}

	if (entry.score === undefined) {
		return entry.phrase;
	}

	return `${entry.phrase} :${entry.score}`;
}

export type PreparedHotwords = {
	file: string;
	score: number;
	cleanup?: () => void;
};

export function prepareHotwordsFile(hotwords: AsrHotwords): PreparedHotwords {
	const score = hotwords.score ?? defaultHotwordsScore;

	if ('file' in hotwords) {
		const resolved = path.resolve(hotwords.file);
		if (!fs.existsSync(resolved)) {
			throw new Error(`Hotwords file not found: ${resolved}`);
		}

		return {file: resolved, score};
	}

	const temporaryPath = path.join(
		os.tmpdir(),
		`coli-hotwords-${process.pid}-${Date.now()}.txt`,
	);
	const content =
		hotwords.words.map((w) => formatHotwordLine(w)).join('\n') + '\n';
	fs.writeFileSync(temporaryPath, content);

	return {
		file: temporaryPath,
		score,
		cleanup() {
			if (fs.existsSync(temporaryPath)) {
				fs.unlinkSync(temporaryPath);
			}
		},
	};
}

export function assertHotwordsSupported(
	model: ModelName,
	hotwords: AsrHotwords | undefined,
): void {
	if (!hotwords) {
		return;
	}

	if (model === 'whisper' || model === 'sensevoice') {
		throw new Error(
			`Hotwords are not supported for model "${model}" (only greedy_search decoding is available). Use --model zipformer-zh-en.`,
		);
	}
}

function createRecognizer(
	model: ModelName,
	language?: SenseVoiceLanguage,
	hotwords?: {file: string; score: number},
) {
	const modelDir = getModelPath(model);
	const onnx = sherpaOnnx();

	if (model === 'whisper') {
		return new onnx.OfflineRecognizer({
			featConfig: {sampleRate: 16_000, featureDim: 80},
			modelConfig: {
				whisper: {
					encoder: path.join(modelDir, 'tiny.en-encoder.int8.onnx'),
					decoder: path.join(modelDir, 'tiny.en-decoder.int8.onnx'),
				},
				tokens: path.join(modelDir, 'tiny.en-tokens.txt'),
				numThreads: 2,
				provider: 'cpu',
				debug: 0,
			},
		});
	}

	if (model === 'zipformer-zh-en') {
		const config: Record<string, unknown> = {
			featConfig: {sampleRate: 16_000, featureDim: 80},
			modelConfig: {
				transducer: {
					encoder: path.join(modelDir, 'encoder-epoch-34-avg-19.int8.onnx'),
					decoder: path.join(modelDir, 'decoder-epoch-34-avg-19.onnx'),
					joiner: path.join(modelDir, 'joiner-epoch-34-avg-19.int8.onnx'),
				},
				tokens: path.join(modelDir, 'tokens.txt'),
				numThreads: 2,
				provider: 'cpu',
				debug: 0,
			},
		};

		if (hotwords) {
			config['hotwordsFile'] = hotwords.file;
			config['hotwordsScore'] = hotwords.score;
			config['decodingMethod'] = 'modified_beam_search';
		}

		return new onnx.OfflineRecognizer(config);
	}

	if (model === 'streaming-zipformer-zh-en') {
		throw new Error(
			'Model "streaming-zipformer-zh-en" is only available for streaming recognition (coli asr-stream).',
		);
	}

	return new onnx.OfflineRecognizer({
		featConfig: {sampleRate: 16_000, featureDim: 80},
		modelConfig: {
			senseVoice: {
				model: path.join(modelDir, 'model.int8.onnx'),
				useInverseTextNormalization: 1,
				language: language ?? 'auto',
			},
			tokens: path.join(modelDir, 'tokens.txt'),
			numThreads: 2,
			provider: 'cpu',
			debug: 0,
		},
	});
}

export type AsrOptions = {
	json: boolean;
	model: ModelName;
	language?: SenseVoiceLanguage;
	hotwords?: AsrHotwords;
};

export type AudioData = {
	sampleRate: number;
	samples: Float32Array;
};

export async function runAsr(
	input: string | AudioData,
	options: AsrOptions,
): Promise<void> {
	assertHotwordsSupported(options.model, options.hotwords);

	let wave: {sampleRate: number; samples: Float32Array};
	let needsCleanup = false;
	let wavPath: string | undefined;

	if (typeof input === 'string') {
		process.emitWarning(
			'Passing a file path to runAsr() is deprecated. Pass an AudioData object ({ sampleRate, samples }) instead.',
			{type: 'DeprecationWarning', code: deprecationAsrFilePath},
		);

		const resolvedPath = path.resolve(input);
		if (!fs.existsSync(resolvedPath)) {
			throw new Error(`File not found: ${resolvedPath}`);
		}

		const ext = path.extname(resolvedPath).toLowerCase();

		if (ext === '.wav') {
			wavPath = resolvedPath;
		} else {
			wavPath = await convertToWav(resolvedPath);
			needsCleanup = true;
		}

		wave = sherpaOnnx().readWave(wavPath);
	} else {
		wave = input;
	}

	const hotwords = options.hotwords
		? prepareHotwordsFile(options.hotwords)
		: undefined;

	try {
		const recognizer = createRecognizer(
			options.model,
			options.language,
			hotwords && {file: hotwords.file, score: hotwords.score},
		);
		const stream = recognizer.createStream();

		stream.acceptWaveform({sampleRate: wave.sampleRate, samples: wave.samples});
		recognizer.decode(stream);
		const result = recognizer.getResult(stream);

		if (options.json) {
			console.log(
				JSON.stringify(
					{
						text: result.text.trim(),
						model: modelDisplayNames[options.model],
						lang: result.lang || undefined,
						emotion: result.emotion || undefined,
						event: result.event || undefined,
						tokens: result.tokens,
						timestamps: result.timestamps,
						duration: wave.samples.length / wave.sampleRate,
					},
					null,
					2,
				),
			);
		} else {
			console.log(result.text.trim());
		}
	} finally {
		hotwords?.cleanup?.();
		if (needsCleanup && wavPath && fs.existsSync(wavPath)) {
			fs.unlinkSync(wavPath);
		}
	}
}
