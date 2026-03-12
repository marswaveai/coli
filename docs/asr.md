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

Stream audio in and receive recognition results incrementally. Call `ensureModels()` first.

```js
import {ensureModels, streamAsr} from '@marswave/coli';

await ensureModels();

const audioSource = createAudioStream(); // AsyncIterable<Float32Array> of 16 kHz mono PCM

await streamAsr(audioSource, {
	onResult(result) {
		console.log(result.text, result.isFinal ? '(final)' : '(partial)');
	},
});
```

**Options**

| Property     | Type                                | Description                                   |
| ------------ | ----------------------------------- | --------------------------------------------- |
| `onResult`   | `(result: AsrStreamResult) => void` | Callback invoked with each recognition result |
| `sampleRate` | `number`                            | Audio sample rate in Hz (default: `16000`)    |

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

On first run, coli automatically downloads ASR models to `~/.coli/models/`:

| Name                   | Model                                                              | Languages                                     |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `sensevoice` (default) | [SenseVoice Small](https://github.com/FunAudioLLM/SenseVoice) int8 | Chinese, English, Japanese, Korean, Cantonese |
| `whisper`              | [Whisper tiny.en](https://github.com/openai/whisper) int8          | English                                       |

`streamAsr` uses the SenseVoice model.

## Supported audio formats

WAV files are passed directly to the recognizer. All other formats (m4a, mp3, ogg, flac, etc.) are automatically converted to 16 kHz mono WAV via ffmpeg.
