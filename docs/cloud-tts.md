# Cloud TTS

Generate speech using [ListenHub OpenAPI](https://listenhub.ai/docs/en/openapi). Audio is streamed as MP3 from the cloud.

## Prerequisites

- A ListenHub API key. Pass it via `--api-key` or set the `COLI_LISTENHUB_API_KEY` environment variable.

## CLI

```sh
# List available speakers
coli cloud-tts --list-speakers

# List speakers filtered by language, in JSON
coli cloud-tts --list-speakers --language en --json

# Generate speech and play directly
coli cloud-tts --voice cozy-man-english "Hello world"

# Save to file
coli cloud-tts --voice cozy-man-english -o output.mp3 "Hello world"

# Specify model
coli cloud-tts --voice cozy-man-english --model flowtts "Hello world"
```

**Options**

```
--api-key <key>       ListenHub API key (or set COLI_LISTENHUB_API_KEY)
--voice <id>          Speaker ID to use
--model <name>        Model to use (default: flowtts)
-o, --output <file>   Save audio to file
--list-speakers       List available speakers
--language <lang>     Filter speakers by language: en, zh, ja (use with --list-speakers)
-j, --json            Output in JSON format (use with --list-speakers)
```

## API

### `listSpeakers(options)`

List available speakers from ListenHub.

```js
import {listSpeakers} from '@marswave/coli';

const speakers = await listSpeakers({
	apiKey: 'lh_sk_...',
	language: 'en',
});

for (const speaker of speakers) {
	console.log(`${speaker.name} (${speaker.speakerId})`);
}
```

**Options**

| Property   | Type                   | Description                                    |
| ---------- | ---------------------- | ---------------------------------------------- |
| `apiKey`   | `string`               | ListenHub API key                              |
| `language` | `'en' \| 'zh' \| 'ja'` | Filter speakers by language. Omit to list all. |

### `runCloudTts(text, options)`

Generate speech from text. When `output` is provided, saves MP3 to file. Otherwise plays the audio directly.

```js
import {runCloudTts} from '@marswave/coli';

// Save to file
await runCloudTts('Hello world', {
	apiKey: 'lh_sk_...',
	voice: 'cozy-man-english',
	output: 'output.mp3',
});
```

**Options**

| Property | Type     | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `apiKey` | `string` | ListenHub API key                              |
| `voice`  | `string` | Speaker ID (from `listSpeakers`)               |
| `model`  | `string` | Model to use (optional, defaults to `flowtts`) |
| `output` | `string` | Save to file instead of playing directly       |
