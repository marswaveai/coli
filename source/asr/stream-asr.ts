import {createRequire} from 'node:module';
import path from 'node:path';
import {getModelPath} from './models.js';

const require = createRequire(import.meta.url);

type OfflineRecognizer = {
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

type SherpaOnnx = {
	OfflineRecognizer: new (config: Record<string, unknown>) => OfflineRecognizer;
};

let _sherpaOnnx: SherpaOnnx | undefined;
function sherpaOnnx(): SherpaOnnx {
	_sherpaOnnx ??= require('sherpa-onnx-node') as SherpaOnnx;
	return _sherpaOnnx;
}

const defaultSampleRate = 16_000;
const defaultAsrIntervalMs = 1000;

function createRecognizer(): OfflineRecognizer {
	const modelDir = getModelPath('sensevoice');
	const onnx = sherpaOnnx();

	return new onnx.OfflineRecognizer({
		featConfig: {sampleRate: defaultSampleRate, featureDim: 80},
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

function recognize(recognizer: OfflineRecognizer, samples: Float32Array) {
	const stream = recognizer.createStream();
	stream.acceptWaveform({sampleRate: defaultSampleRate, samples});
	recognizer.decode(stream);
	return recognizer.getResult(stream);
}

function mergeBuffers(
	buffers: Float32Array[],
	totalLength: number,
): Float32Array {
	if (buffers.length === 1 && buffers[0]) {
		return buffers[0];
	}

	const merged = new Float32Array(totalLength);
	let offset = 0;
	for (const buf of buffers) {
		merged.set(buf, offset);
		offset += buf.length;
	}

	return merged;
}

export type AsrStreamResult = {
	text: string;
	lang: string;
	emotion: string;
	event: string;
	tokens: string[];
	timestamps: number[];
	isFinal: boolean;
};

export type StreamAsrOptions = {
	sampleRate?: number;
	asrIntervalMs?: number;
	onResult: (result: AsrStreamResult) => void;
};

export async function streamAsr(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
): Promise<void> {
	const inputSampleRate = options.sampleRate ?? defaultSampleRate;
	const intervalMs = options.asrIntervalMs ?? defaultAsrIntervalMs;
	const chunkInterval = (defaultSampleRate * intervalMs) / 1000;
	const recognizer = createRecognizer();

	const buffers: Float32Array[] = [];
	let totalSamples = 0;
	let lastRecognizedAt = 0;
	let lastText = '';

	for await (const chunk of audio) {
		buffers.push(chunk);
		totalSamples += chunk.length;

		const samplesForInterval =
			(chunkInterval * inputSampleRate) / defaultSampleRate;
		if (totalSamples - lastRecognizedAt >= samplesForInterval) {
			lastRecognizedAt = totalSamples;
			const merged = mergeBuffers(buffers, totalSamples);
			const result = recognize(recognizer, merged);
			const text = result.text.trim();
			if (text && text !== lastText) {
				lastText = text;
				options.onResult({...result, text, isFinal: false});
			}
		}
	}

	const merged = mergeBuffers(buffers, totalSamples);
	if (merged.length > 0) {
		const result = recognize(recognizer, merged);
		const text = result.text.trim();
		if (text) {
			options.onResult({...result, text, isFinal: true});
		}
	}
}
