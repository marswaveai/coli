# coli

Core library for Cola. Provides essential capabilities commonly used by agents.

## CLI

```shell
npm i -g @litomore/coli
```

```
Usage
  $ coli <command> [options]

Commands
  asr    Transcribe an audio file using speech recognition
  tts    Speak text using text-to-speech (macOS only)

Examples
  $ coli asr recording.m4a
  $ coli asr -j recording.m4a
  $ coli asr --model whisper recording.wav
  $ coli tts "Hello world"
  $ coli tts -v Samantha -r 200 "Hello world"
```

### `coli asr`

Transcribe an audio file using speech recognition.

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

### `coli tts`

Speak text using text-to-speech. Currently macOS only.

```sh
# Speak text
coli tts "Hello world"

# Use a specific voice and rate
coli tts -v Samantha -r 200 "Hello world"

# Save to audio file
coli tts -o output.aiff "Hello world"
```

**Options**

```
-v, --voice <name>    Voice to use (run `say -v "?"` to list)
-r, --rate <wpm>      Speech rate in words per minute
-o, --output <file>   Save audio to file instead of speaking
```

## API

```shell
npm i @litomore/coli
```

### ASR

#### `ensureModels()`

Check for required models and download any that are missing. Call this before `runAsr`.

```js
import {ensureModels} from '@litomore/coli';

await ensureModels();
```

#### `runAsr(filePath, options)`

Run speech recognition on an audio file. Results are printed to stdout.

```js
import {ensureModels, runAsr} from '@litomore/coli';

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

#### `getModelPath(model)`

Returns the local filesystem path for a given model.

```js
import {getModelPath} from '@litomore/coli';

getModelPath('sensevoice');
// => '/Users/you/.coli/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17'

getModelPath('whisper');
// => '/Users/you/.coli/models/sherpa-onnx-whisper-tiny.en'
```

#### `modelDisplayNames`

A mapping from model key to its human-readable display name.

```js
import {modelDisplayNames} from '@litomore/coli';

modelDisplayNames.sensevoice; // => 'sensevoice-small'
modelDisplayNames.whisper; // => 'whisper-tiny.en'
```

### TTS

#### `runTts(text, options?)`

Speak text or save to an audio file. macOS only.

```js
import {runTts} from '@litomore/coli';

// Speak text
await runTts('Hello world');

// With options
await runTts('Hello world', {voice: 'Samantha', rate: 200});

// Save to file
await runTts('Hello world', {output: 'output.aiff'});
```

**Options**

| Property | Type     | Description                                  |
| -------- | -------- | -------------------------------------------- |
| `voice`  | `string` | Voice name to use                            |
| `rate`   | `number` | Speech rate in words per minute              |
| `output` | `string` | Save to file instead of speaking             |

#### `getVoices()`

Returns a list of available voice names on the system. macOS only.

```js
import {getVoices} from '@litomore/coli';

const voices = await getVoices();
// => ['Alex', 'Alice', 'Samantha', ...]
```

## Models

On first run, coli automatically downloads ASR models to `~/.coli/models/`:

| Name                   | Model                                                              | Languages                                     |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `sensevoice` (default) | [SenseVoice Small](https://github.com/FunAudioLLM/SenseVoice) int8 | Chinese, English, Japanese, Korean, Cantonese |
| `whisper`              | [Whisper tiny.en](https://github.com/openai/whisper) int8          | English                                       |

## Supported audio formats

WAV files are passed directly to the recognizer. All other formats (m4a, mp3, ogg, flac, etc.) are automatically converted to 16 kHz mono WAV via ffmpeg.

## License

MIT
