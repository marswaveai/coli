import {createRequire} from 'node:module';
import path from 'node:path';
import type {SenseVoiceLanguage} from './asr.js';
import {getModelPath, getVadModelPath} from './models.js';

const require = createRequire(import.meta.url);

type RecognitionResult = {
	text: string;
	lang: string;
	emotion: string;
	event: string;
	timestamps: number[];
	tokens: string[];
};

type OfflineRecognizer = {
	createStream(): {
		acceptWaveform(wave: {sampleRate: number; samples: Float32Array}): void;
	};
	decode(stream: unknown): void;
	getResult(stream: unknown): RecognitionResult;
};

type SpeechSegment = {
	start: number;
	samples: Float32Array;
};

type VadInstance = {
	config: {sileroVad: {windowSize: number}; sampleRate: number};
	acceptWaveform(samples: Float32Array): void;
	isEmpty(): boolean;
	isDetected(): boolean;
	front(enableExternalBuffer?: boolean): SpeechSegment;
	pop(): void;
	flush(): void;
};

type SherpaOnnx = {
	OfflineRecognizer: new (config: Record<string, unknown>) => OfflineRecognizer;
	Vad: new (
		config: Record<string, unknown>,
		bufferSizeInSeconds: number,
	) => VadInstance;
};

let _sherpaOnnx: SherpaOnnx | undefined;
function sherpaOnnx(): SherpaOnnx {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	_sherpaOnnx ??= require('sherpa-onnx-node') as SherpaOnnx;
	return _sherpaOnnx;
}

const defaultSampleRate = 16_000;
const defaultAsrIntervalMs = 1000;

function createRecognizer(language?: SenseVoiceLanguage): OfflineRecognizer {
	const modelDir = getModelPath('sensevoice');
	const onnx = sherpaOnnx();

	return new onnx.OfflineRecognizer({
		featConfig: {sampleRate: defaultSampleRate, featureDim: 80},
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

export type VadOptions = {
	threshold?: number;
	minSpeechDuration?: number;
	minSilenceDuration?: number;
	maxSpeechDuration?: number;
	enableExternalBuffer?: boolean;
};

export type StreamAsrOptions = {
	sampleRate?: number;
	asrIntervalMs?: number;
	language?: SenseVoiceLanguage;
	vad?: boolean | VadOptions;
	onResult: (result: AsrStreamResult) => void;
};

function createVad(vadOptions: VadOptions): VadInstance {
	const onnx = sherpaOnnx();
	return new onnx.Vad(
		{
			sileroVad: {
				model: getVadModelPath(),
				threshold: vadOptions.threshold ?? 0.5,
				minSpeechDuration: vadOptions.minSpeechDuration ?? 0.25,
				minSilenceDuration: vadOptions.minSilenceDuration ?? 0.5,
				maxSpeechDuration: vadOptions.maxSpeechDuration ?? 15,
				windowSize: 512,
			},
			sampleRate: defaultSampleRate,
			debug: 0,
			numThreads: 1,
		},
		60,
	);
}

function emitResult(
	result: RecognitionResult,
	isFinal: boolean,
	onResult: StreamAsrOptions['onResult'],
) {
	const text = result.text.trim();
	if (text) {
		onResult({...result, text, isFinal});
	}
}

async function streamWithVad(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
	vadOptions: VadOptions,
): Promise<void> {
	const recognizer = createRecognizer(options.language);
	const vad = createVad(vadOptions);
	const {windowSize} = vad.config.sileroVad;

	let pending = new Float32Array(0);

	function drainSegments() {
		while (!vad.isEmpty()) {
			const segment = vad.front(vadOptions.enableExternalBuffer);
			vad.pop();
			emitResult(
				recognize(recognizer, segment.samples),
				true,
				options.onResult,
			);
		}
	}

	for await (const chunk of audio) {
		const combined = new Float32Array(pending.length + chunk.length);
		combined.set(pending);
		combined.set(chunk, pending.length);
		pending = combined;

		while (pending.length >= windowSize) {
			vad.acceptWaveform(pending.subarray(0, windowSize));
			pending = pending.subarray(windowSize);
			drainSegments();
		}
	}

	if (pending.length > 0) {
		const padded = new Float32Array(windowSize);
		padded.set(pending);
		vad.acceptWaveform(padded);
	}

	vad.flush();
	drainSegments();
}

async function streamWithInterval(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
): Promise<void> {
	const inputSampleRate = options.sampleRate ?? defaultSampleRate;
	const intervalMs = options.asrIntervalMs ?? defaultAsrIntervalMs;
	const chunkInterval = (defaultSampleRate * intervalMs) / 1000;
	const recognizer = createRecognizer(options.language);

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
		emitResult(recognize(recognizer, merged), true, options.onResult);
	}
}

export async function streamAsr(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
): Promise<void> {
	if (options.vad) {
		const vadOptions = typeof options.vad === 'object' ? options.vad : {};
		return streamWithVad(audio, options, vadOptions);
	}

	return streamWithInterval(audio, options);
}
