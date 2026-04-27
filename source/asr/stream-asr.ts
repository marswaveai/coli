import {createRequire} from 'node:module';
import path from 'node:path';
import {
	type AsrHotwords,
	type PreparedHotwords,
	type SenseVoiceLanguage,
	assertHotwordsSupported,
	prepareHotwordsFile,
} from './asr.js';
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

type OnlineRecognizerResult = {
	text: string;
	tokens: string[];
	timestamps: number[];
};

type OnlineStream = {
	acceptWaveform(wave: {sampleRate: number; samples: Float32Array}): void;
	inputFinished(): void;
};

type OnlineRecognizer = {
	createStream(): OnlineStream;
	isReady(stream: OnlineStream): boolean;
	decode(stream: OnlineStream): void;
	isEndpoint(stream: OnlineStream): boolean;
	reset(stream: OnlineStream): void;
	getResult(stream: OnlineStream): OnlineRecognizerResult;
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
	OnlineRecognizer: new (config: Record<string, unknown>) => OnlineRecognizer;
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

export type StreamModelName =
	| 'sensevoice'
	| 'zipformer-zh-en'
	| 'streaming-zipformer-zh-en';

function createOfflineRecognizer(
	model: StreamModelName,
	language?: SenseVoiceLanguage,
	hotwords?: {file: string; score: number},
): OfflineRecognizer {
	const modelDir = getModelPath(model);
	const onnx = sherpaOnnx();

	if (model === 'zipformer-zh-en') {
		const config: Record<string, unknown> = {
			featConfig: {sampleRate: defaultSampleRate, featureDim: 80},
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

function createOnlineRecognizer(hotwords?: {
	file: string;
	score: number;
}): OnlineRecognizer {
	const modelDir = getModelPath('streaming-zipformer-zh-en');
	const onnx = sherpaOnnx();

	const config: Record<string, unknown> = {
		featConfig: {sampleRate: defaultSampleRate, featureDim: 80},
		modelConfig: {
			transducer: {
				encoder: path.join(modelDir, 'encoder-epoch-99-avg-1.int8.onnx'),
				decoder: path.join(modelDir, 'decoder-epoch-99-avg-1.onnx'),
				joiner: path.join(modelDir, 'joiner-epoch-99-avg-1.int8.onnx'),
			},
			tokens: path.join(modelDir, 'tokens.txt'),
			numThreads: 2,
			provider: 'cpu',
			debug: 0,
		},
		enableEndpoint: true,
		rule1MinTrailingSilence: 2.4,
		rule2MinTrailingSilence: 1.2,
		rule3MinUtteranceLength: 20,
	};

	if (hotwords) {
		config['hotwordsFile'] = hotwords.file;
		config['hotwordsScore'] = hotwords.score;
		config['decodingMethod'] = 'modified_beam_search';
	}

	return new onnx.OnlineRecognizer(config);
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
	model?: StreamModelName;
	language?: SenseVoiceLanguage;
	vad?: boolean | VadOptions;
	hotwords?: AsrHotwords;
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

function emitOfflineResult(
	result: RecognitionResult,
	isFinal: boolean,
	onResult: StreamAsrOptions['onResult'],
) {
	const text = result.text.trim();
	if (text) {
		onResult({...result, text, isFinal});
	}
}

function emitOnlineResult(
	result: OnlineRecognizerResult,
	isFinal: boolean,
	onResult: StreamAsrOptions['onResult'],
) {
	const text = result.text.trim();
	if (text) {
		onResult({
			text,
			lang: '',
			emotion: '',
			event: '',
			tokens: result.tokens,
			timestamps: result.timestamps,
			isFinal,
		});
	}
}

async function streamWithVad(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
	vadOptions: VadOptions,
	hotwords: PreparedHotwords | undefined,
): Promise<void> {
	const recognizer = createOfflineRecognizer(
		options.model ?? 'sensevoice',
		options.language,
		hotwords && {file: hotwords.file, score: hotwords.score},
	);
	const vad = createVad(vadOptions);
	const {windowSize} = vad.config.sileroVad;

	let pending = new Float32Array(0);

	function drainSegments() {
		while (!vad.isEmpty()) {
			const segment = vad.front(vadOptions.enableExternalBuffer);
			vad.pop();
			emitOfflineResult(
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
	hotwords: PreparedHotwords | undefined,
): Promise<void> {
	const inputSampleRate = options.sampleRate ?? defaultSampleRate;
	const intervalMs = options.asrIntervalMs ?? defaultAsrIntervalMs;
	const chunkInterval = (defaultSampleRate * intervalMs) / 1000;
	const recognizer = createOfflineRecognizer(
		options.model ?? 'sensevoice',
		options.language,
		hotwords && {file: hotwords.file, score: hotwords.score},
	);

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
		emitOfflineResult(recognize(recognizer, merged), true, options.onResult);
	}
}

async function streamWithOnline(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
	hotwords: PreparedHotwords | undefined,
): Promise<void> {
	const recognizer = createOnlineRecognizer(
		hotwords && {file: hotwords.file, score: hotwords.score},
	);
	const stream = recognizer.createStream();
	let lastText = '';

	function drain(isFinalFlush: boolean) {
		while (recognizer.isReady(stream)) {
			recognizer.decode(stream);
		}

		const result = recognizer.getResult(stream);
		const text = result.text.trim();
		const endpointReached = recognizer.isEndpoint(stream);

		if (endpointReached) {
			if (text) {
				emitOnlineResult(result, true, options.onResult);
			}

			recognizer.reset(stream);
			lastText = '';
			return;
		}

		if (text && text !== lastText) {
			lastText = text;
			emitOnlineResult(result, isFinalFlush, options.onResult);
		} else if (isFinalFlush && text) {
			emitOnlineResult(result, true, options.onResult);
		}
	}

	for await (const chunk of audio) {
		stream.acceptWaveform({sampleRate: defaultSampleRate, samples: chunk});
		drain(false);
	}

	const tailPadding = new Float32Array(Math.floor(defaultSampleRate * 0.4));
	stream.acceptWaveform({sampleRate: defaultSampleRate, samples: tailPadding});
	stream.inputFinished();
	drain(true);
}

export async function streamAsr(
	audio: AsyncIterable<Float32Array>,
	options: StreamAsrOptions,
): Promise<void> {
	const model = options.model ?? 'sensevoice';
	assertHotwordsSupported(model, options.hotwords);

	const hotwords = options.hotwords
		? prepareHotwordsFile(options.hotwords)
		: undefined;

	try {
		if (model === 'streaming-zipformer-zh-en') {
			await streamWithOnline(audio, options, hotwords);
			return;
		}

		if (options.vad) {
			const vadOptions = typeof options.vad === 'object' ? options.vad : {};
			await streamWithVad(audio, options, vadOptions, hotwords);
			return;
		}

		await streamWithInterval(audio, options, hotwords);
	} finally {
		hotwords?.cleanup?.();
	}
}
