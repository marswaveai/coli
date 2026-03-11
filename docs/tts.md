# TTS (Text-to-Speech)

Speak text or save to audio files using macOS built-in speech synthesis, powered by [mac-say](https://github.com/nickcoutsos/mac-say).

> **Note:** Currently macOS only.

## CLI

```sh
# Speak text
coli tts "Hello world"

# Use a specific voice and rate
coli tts -v Samantha -r 200 "Hello world"

# Save to audio file
coli tts -o output.aiff "Hello world"

# List available voices
coli tts --list-voices
```

**Options**

```
-v, --voice <name>    Voice to use, defaults to macOS system voice
-r, --rate <wpm>      Speech rate in words per minute
-o, --output <file>   Save audio to file instead of speaking
--list-voices         List available voices
```

## API

### `runTts(text, options?)`

Speak text or save to an audio file.

```js
import {runTts} from '@marswave/coli';

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

Returns a list of available voices on the system. Each voice includes its name, language code, and an example phrase.

```js
import {getVoices} from '@marswave/coli';

const voices = await getVoices();
// => [
//   { name: 'Alex', languageCode: 'en_US', example: 'Most people recognize me by my voice.' },
//   { name: 'Samantha', languageCode: 'en_US', example: 'Hello, my name is Samantha.' },
//   ...
// ]
```

**Voice properties**

| Property       | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| `name`         | `string` | Voice name                    |
| `languageCode` | `string` | Language code (e.g. `en_US`)  |
| `example`      | `string` | Example phrase for this voice |
