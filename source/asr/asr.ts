import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {execa} from 'execa';
import {deprecationAsrFilePath} from '../deprecations.js';
import {
	type AsrModelFiles,
	type ModelName,
	modelDisplayNames,
	resolveAsrModelFiles,
} from './models.js';

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

function createRecognizer(
	modelFiles: AsrModelFiles,
	language?: SenseVoiceLanguage,
) {
	const onnx = sherpaOnnx();

	if (modelFiles.model === 'whisper') {
		return new onnx.OfflineRecognizer({
			featConfig: {sampleRate: 16_000, featureDim: 80},
			modelConfig: {
				whisper: {
					encoder: modelFiles.files.encoder,
					decoder: modelFiles.files.decoder,
				},
				tokens: modelFiles.files.tokens,
				numThreads: 2,
				provider: 'cpu',
				debug: 0,
			},
		});
	}

	return new onnx.OfflineRecognizer({
		featConfig: {sampleRate: 16_000, featureDim: 80},
		modelConfig: {
			senseVoice: {
				model: modelFiles.files.model,
				useInverseTextNormalization: 1,
				language: language ?? 'auto',
			},
			tokens: modelFiles.files.tokens,
			numThreads: 2,
			provider: 'cpu',
			debug: 0,
		},
	});
}

export type AsrOptions = {
	json: boolean;
	model: ModelName;
	modelPath?: string | undefined;
	language?: SenseVoiceLanguage;
};

export type AudioData = {
	sampleRate: number;
	samples: Float32Array;
};

export async function runAsr(
	input: string | AudioData,
	options: AsrOptions,
): Promise<void> {
	const modelFiles = resolveAsrModelFiles(options.model, options.modelPath);
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

	try {
		const recognizer = createRecognizer(modelFiles, options.language);
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
		if (needsCleanup && wavPath && fs.existsSync(wavPath)) {
			fs.unlinkSync(wavPath);
		}
	}
}
