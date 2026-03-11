# TTS (Text-to-Speech)

Speak text or save to audio files using macOS built-in speech synthesis.

> **Note:** Currently macOS only.

## CLI

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
-v, --voice <name>    Voice to use, defaults to macOS system voice (run `say -v "?"` to list)
-r, --rate <wpm>      Speech rate in words per minute
-o, --output <file>   Save audio to file instead of speaking
```

## API

### `runTts(text, options?)`

Speak text or save to an audio file.

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

| Property | Type     | Description                      |
| -------- | -------- | -------------------------------- |
| `voice`  | `string` | Voice name to use                |
| `rate`   | `number` | Speech rate in words per minute  |
| `output` | `string` | Save to file instead of speaking |

### `getVoices()`

Returns a list of available voice names on the system.

```js
import {getVoices} from '@litomore/coli';

const voices = await getVoices();
// => ['Alex', 'Alice', 'Samantha', ...]
```
