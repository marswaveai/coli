# ASR (Automatic Speech Recognition)

Transcribe audio files using speech recognition, powered by [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). All inference runs offline on your machine.

## Prerequisites

- [ffmpeg](https://ffmpeg.org/) (for non-WAV audio formats like `.m4a`, `.mp3`, etc.)

```sh
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt install ffmpeg
```

## CLI

```sh
# Plain text output
coli asr recording.m4a

# JSON output
coli asr -j recording.m4a

# Select model
coli asr --model whisper recording.wav
```

**Options**

```
-j, --json     Output result in JSON format
--model        Model to use: whisper, sensevoice (default: sensevoice)
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

### `runAsr(filePath, options)`

Run speech recognition on an audio file. Results are printed to stdout.

```js
import {ensureModels, runAsr} from '@marswave/coli';

await ensureModels();

// Plain text output
await runAsr('recording.m4a', {json: false, model: 'sensevoice'});

// JSON output
await runAsr('recording.m4a', {json: true, model: 'whisper'});
```

**Options**

| Property | Type                        | Description                                                                   |
| -------- | --------------------------- | ----------------------------------------------------------------------------- |
| `json`   | `boolean`                   | Output JSON (with model name, tokens, timestamps, etc.) instead of plain text |
| `model`  | `'whisper' \| 'sensevoice'` | Which model to use for recognition                                            |

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

| Property        | Type                                | Description                                                                  |
| --------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `onResult`      | `(result: AsrStreamResult) => void` | Callback invoked with each recognition result                                |
| `sampleRate`    | `number`                            | Audio sample rate in Hz (default: `16000`)                                   |
| `asrIntervalMs` | `number`                            | Recognition interval in milliseconds (default: `1000`). Ignored when using VAD |
| `vad`           | `boolean \| VadOptions`             | Enable VAD. Pass `true` for defaults or a `VadOptions` object                |

**VadOptions**

| Property             | Type     | Description                                         |
| -------------------- | -------- | --------------------------------------------------- |
| `threshold`          | `number` | Speech detection threshold (default: `0.5`)         |
| `minSpeechDuration`  | `number` | Minimum speech duration in seconds (default: `0.25`) |
| `minSilenceDuration` | `number` | Minimum silence to end a segment in seconds (default: `0.5`) |
| `maxSpeechDuration`  | `number`  | Maximum speech segment duration in seconds (default: `15`)            |
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

| Name         | Model                                                               | Size   |
| ------------ | ------------------------------------------------------------------- | ------ |
| `silero_vad` | [Silero VAD](https://github.com/snakers4/silero-vad) (k2-fsa export) | ~629 KB |

`streamAsr` uses the SenseVoice model for recognition. VAD uses Silero VAD and is downloaded separately via `ensureVadModel()`.

## Supported audio formats

WAV files are passed directly to the recognizer. All other formats (m4a, mp3, ogg, flac, etc.) are automatically converted to 16 kHz mono WAV via ffmpeg.
