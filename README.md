# coli

A local-first CLI for automatic speech recognition (ASR), powered by [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). All inference runs offline on your machine.

## Prerequisites

- Node.js >= 20
- [ffmpeg](https://ffmpeg.org/) (for non-WAV audio formats like `.m4a`, `.mp3`, etc.)

```sh
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt install ffmpeg
```

## Install

CLI:

```sh
npm install -g @litomore/coli
```

Library:

```sh
npm install @litomore/coli
```

## Models

On first run, coli automatically downloads two ASR models to `~/.coli/models/`:

| Name                   | Model                                                              | Languages                                     |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `sensevoice` (default) | [SenseVoice Small](https://github.com/FunAudioLLM/SenseVoice) int8 | Chinese, English, Japanese, Korean, Cantonese |
| `whisper`              | [Whisper tiny.en](https://github.com/openai/whisper) int8          | English                                       |

## Usage

### Plain text output

```sh
coli asr recording.m4a
```

### JSON output

```sh
coli asr -j recording.m4a
```

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

### Select model

```sh
coli asr --model whisper recording.wav
```

### Options

```
-j, --json     Output result in JSON format
--model        Model to use: whisper, sensevoice (default: sensevoice)
```

## API

### `ensureModels()`

Check for required models and download any that are missing. Call this before `runAsr`.

```js
import { ensureModels } from "@litomore/coli";

await ensureModels();
```

### `runAsr(filePath, options)`

Run speech recognition on an audio file. Results are printed to stdout.

```js
import { ensureModels, runAsr } from "@litomore/coli";

await ensureModels();

// Plain text output
await runAsr("recording.m4a", { json: false, model: "sensevoice" });

// JSON output
await runAsr("recording.m4a", { json: true, model: "whisper" });
```

**Options**

| Property | Type                        | Description                                                                   |
| -------- | --------------------------- | ----------------------------------------------------------------------------- |
| `json`   | `boolean`                   | Output JSON (with model name, tokens, timestamps, etc.) instead of plain text |
| `model`  | `'whisper' \| 'sensevoice'` | Which model to use for recognition                                            |

### `getModelPath(model)`

Returns the local filesystem path for a given model.

```js
import { getModelPath } from "@litomore/coli";

getModelPath("sensevoice");
// => '/Users/you/.coli/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17'

getModelPath("whisper");
// => '/Users/you/.coli/models/sherpa-onnx-whisper-tiny.en'
```

### `modelDisplayNames`

A mapping from model key to its human-readable display name.

```js
import { modelDisplayNames } from "@litomore/coli";

modelDisplayNames.sensevoice; // => 'sensevoice-small'
modelDisplayNames.whisper; // => 'whisper-tiny.en'
```

## Supported audio formats

WAV files are passed directly to the recognizer. All other formats (m4a, mp3, ogg, flac, etc.) are automatically converted to 16 kHz mono WAV via ffmpeg.

## License

MIT
