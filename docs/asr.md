# ASR (Automatic Speech Recognition)

Transcribe audio files using speech recognition, powered by [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). All inference runs offline on your machine.

## Prerequisites

No external dependencies are required for WAV files. Non-WAV format support via the CLI is deprecated and requires [ffmpeg](https://ffmpeg.org/) (see [COLI_DEP002](deprecations.md#coli_dep002-file-path-input-for-asr)).

## CLI

```sh
# Plain text output
coli asr recording.wav

# JSON output
coli asr -j recording.wav

# Select model
coli asr --model whisper recording.wav

# Specify language (sensevoice only)
coli asr --language zh recording.wav
```

**Options**

```
-j, --json     Output result in JSON format
--model        Model to use: whisper, sensevoice (default: sensevoice)
--language     Language for sensevoice: auto, zh, en, ja, ko, yue (default: auto)
```

### `coli asr-stream`

Stream speech recognition from stdin. Expects raw 16kHz mono s16le PCM audio piped in.

```sh
# From microphone (macOS)
ffmpeg -f avfoundation -i :0 -ar 16000 -ac 1 -f s16le pipe:1 | coli asr-stream

# With VAD
ffmpeg -f avfoundation -i :0 -ar 16000 -ac 1 -f s16le pipe:1 | coli asr-stream --vad

# JSON output (one JSON object per line)
ffmpeg -f avfoundation -i :0 -ar 16000 -ac 1 -f s16le pipe:1 | coli asr-stream --vad --json

# From a file
ffmpeg -i podcast.m4a -ar 16000 -ac 1 -f s16le pipe:1 | coli asr-stream --vad
```

**Options**

```
-j, --json              Output each result as a JSON line
--vad                   Enable voice activity detection
--language <lang>       Language for sensevoice: auto, zh, en, ja, ko, yue (default: auto)
--asr-interval-ms <ms>  Recognition interval in ms (default: 1000, ignored with --vad)
```

**JSON output example**

```json
{
	"text": "The tribal chieftain called for the boy.",
	"model": "sensevoice-small",
	"lang": "<|en|>",
	"emotion": "<|NEUTRAL|>",
	"event": "<|Speech|>",
	"tokens": ["The", " tri", "bal", " chief", "tain", "..."],
	"timestamps": [0.9, 1.26, 1.56, 1.8, 2.16, "..."],
	"duration": 7.152
}
```

## API

### `ensureModels(models?)`

Download the specified models if not already present. Defaults to `['sensevoice']`. Call this before `runAsr` or `streamAsr`.

```js
import {ensureModels} from '@marswave/coli';

await ensureModels(); // downloads sensevoice only
await ensureModels(['whisper', 'sensevoice']); // downloads both
```

### `readWave(filename)`

Read a WAV file and return an `AudioData` object. Use this to load WAV files for `runAsr`.

```js
import {ensureModels, readWave, runAsr} from '@marswave/coli';

await ensureModels();

const audio = readWave('/path/to/recording.wav');
await runAsr(audio, {json: false, model: 'sensevoice'});
```

### `runAsr(input, options)`

Run speech recognition on audio data. Results are printed to stdout.

The `input` parameter accepts either an `AudioData` object (recommended) or a file path string (deprecated).

```js
import {ensureModels, runAsr} from '@marswave/coli';

await ensureModels();

// Recommended: pass AudioData directly
await runAsr(
	{sampleRate: 16000, samples: myFloat32Array},
	{json: false, model: 'sensevoice'},
);

// Deprecated: file path input (requires ffmpeg for non-WAV formats)
await runAsr('recording.m4a', {json: false, model: 'sensevoice'});
```

**Options**

| Property   | Type                        | Description                                                                                         |
| ---------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `json`     | `boolean`                   | Output JSON (with model name, tokens, timestamps, etc.) instead of plain text                       |
| `model`    | `'whisper' \| 'sensevoice'` | Which model to use for recognition                                                                  |
| `language` | `SenseVoiceLanguage`        | Language hint for sensevoice: `'auto'`, `'zh'`, `'en'`, `'ja'`, `'ko'`, `'yue'` (default: `'auto'`) |

### `getModelPath(model)`

Returns the local filesystem path for a given model.

```js
import {getModelPath} from '@marswave/coli';

getModelPath('sensevoice');
// => '/Users/you/.coli/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17'

getModelPath('whisper');
// => '/Users/you/.coli/models/sherpa-onnx-whisper-tiny.en'
```

### `modelDisplayNames`

A mapping from model key to its human-readable display name.

```js
import {modelDisplayNames} from '@marswave/coli';

modelDisplayNames.sensevoice; // => 'sensevoice-small'
modelDisplayNames.whisper; // => 'whisper-tiny.en'
```

## Streaming API

For streaming speech recognition, use the streaming API. It accepts audio as an async iterable of `Float32Array` chunks (16 kHz mono PCM) and delivers recognition results via the `onResult` callback as audio accumulates, using the SenseVoice model.

### `streamAsr(audio, options)`

Stream audio in and receive recognition results incrementally. Call `ensureModels()` first. If using VAD, also call `ensureVadModel()`.

```js
import {ensureModels, ensureVadModel, streamAsr} from '@marswave/coli';

await ensureModels();

const audioSource = createAudioStream(); // AsyncIterable<Float32Array> of 16 kHz mono PCM

// Interval-based (default) — emits partial results at a fixed interval
await streamAsr(audioSource, {
	onResult(result) {
		console.log(result.text, result.isFinal ? '(final)' : '(partial)');
	},
});

// VAD-based — segments speech automatically, each segment emits a final result
await ensureVadModel();
await streamAsr(audioSource, {
	vad: true,
	onResult(result) {
		console.log(result.text);
	},
});

// VAD with custom parameters
await streamAsr(audioSource, {
	vad: {threshold: 0.4, minSilenceDuration: 0.3, maxSpeechDuration: 10},
	onResult(result) {
		console.log(result.text);
	},
});
```

**Options**

| Property        | Type                                | Description                                                                                         |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `onResult`      | `(result: AsrStreamResult) => void` | Callback invoked with each recognition result                                                       |
| `sampleRate`    | `number`                            | Audio sample rate in Hz (default: `16000`)                                                          |
| `language`      | `SenseVoiceLanguage`                | Language hint for sensevoice: `'auto'`, `'zh'`, `'en'`, `'ja'`, `'ko'`, `'yue'` (default: `'auto'`) |
| `asrIntervalMs` | `number`                            | Recognition interval in milliseconds (default: `1000`). Ignored when using VAD                      |
| `vad`           | `boolean \| VadOptions`             | Enable VAD. Pass `true` for defaults or a `VadOptions` object                                       |

**VadOptions**

| Property               | Type      | Description                                                        |
| ---------------------- | --------- | ------------------------------------------------------------------ |
| `threshold`            | `number`  | Speech detection threshold (default: `0.5`)                        |
| `minSpeechDuration`    | `number`  | Minimum speech duration in seconds (default: `0.25`)               |
| `minSilenceDuration`   | `number`  | Minimum silence to end a segment in seconds (default: `0.5`)       |
| `maxSpeechDuration`    | `number`  | Maximum speech segment duration in seconds (default: `15`)         |
| `enableExternalBuffer` | `boolean` | Use external buffer for VAD speech segments (default: `undefined`) |

**Result**

| Property     | Type       | Description                     |
| ------------ | ---------- | ------------------------------- |
| `text`       | `string`   | Recognized text so far          |
| `lang`       | `string`   | Detected language tag           |
| `emotion`    | `string`   | Detected emotion tag            |
| `event`      | `string`   | Detected audio event tag        |
| `tokens`     | `string[]` | Individual tokens               |
| `timestamps` | `number[]` | Timestamp for each token        |
| `isFinal`    | `boolean`  | Whether the result is finalized |

## Models

On first run, coli automatically downloads required models to `~/.coli/models/`:

**ASR Models**

| Name                   | Model                                                              | Languages                                     |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `sensevoice` (default) | [SenseVoice Small](https://github.com/FunAudioLLM/SenseVoice) int8 | Chinese, English, Japanese, Korean, Cantonese |
| `whisper`              | [Whisper tiny.en](https://github.com/openai/whisper) int8          | English                                       |

**VAD Model**

| Name         | Model                                                                | Size    |
| ------------ | -------------------------------------------------------------------- | ------- |
| `silero_vad` | [Silero VAD](https://github.com/snakers4/silero-vad) (k2-fsa export) | ~629 KB |

`streamAsr` uses the SenseVoice model for recognition. VAD uses Silero VAD and is downloaded separately via `ensureVadModel()`.

## Supported audio formats

The CLI accepts WAV files directly. For the programmatic API, use `readWave()` to load WAV files into an `AudioData` object, or provide your own `AudioData` from any source. Non-WAV file path input is deprecated (see [COLI_DEP002](deprecations.md#coli_dep002-file-path-input-for-asr)).
