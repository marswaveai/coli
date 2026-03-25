import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {execa} from 'execa';
import {getModelPath, modelDisplayNames} from './models.js';

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

async function convertToWav(inputPath: string): Promise<string> {
	const outputPath = path.join(os.tmpdir(), `coli-${Date.now()}.wav`);
	try {
		// eslint-disable-next-line @typescript-eslint/await-thenable
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

type ModelName = 'whisper' | 'sensevoice';

function createRecognizer(model: ModelName) {
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

	return new onnx.OfflineRecognizer({
		featConfig: {sampleRate: 16_000, featureDim: 80},
		modelConfig: {
			senseVoice: {
				model: path.join(modelDir, 'model.int8.onnx'),
				useInverseTextNormalization: 1,
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
};

export async function runAsr(
	filePath: string,
	options: AsrOptions,
): Promise<void> {
	const resolvedPath = path.resolve(filePath);
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`File not found: ${resolvedPath}`);
	}

	const ext = path.extname(resolvedPath).toLowerCase();
	let wavPath: string;
	let needsCleanup = false;

	if (ext === '.wav') {
		wavPath = resolvedPath;
	} else {
		wavPath = await convertToWav(resolvedPath);
		needsCleanup = true;
	}

	try {
		const onnx = sherpaOnnx();
		const recognizer = createRecognizer(options.model);
		const stream = recognizer.createStream();
		const wave = onnx.readWave(wavPath);

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
		if (needsCleanup && fs.existsSync(wavPath)) {
			fs.unlinkSync(wavPath);
		}
	}
}
