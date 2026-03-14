# ListenHub OpenAPI

Client for the [ListenHub OpenAPI](https://listenhub.ai/docs/en/openapi), providing cloud-based TTS with streaming audio output.

## Setup

```js
import {ListenHubApi} from '@marswave/coli';

const api = new ListenHubApi({apiKey: 'lh_sk_...'});
```

## `getAvailableSpeakers(options?)`

Get a list of available speakers.

```js
const result = await api.getAvailableSpeakers({language: 'en'});

for (const speaker of result.data.items) {
	console.log(`${speaker.name} (${speaker.speakerId}) - ${speaker.gender}`);
}
```

**Options**

| Property   | Type                   | Description                                       |
| ---------- | ---------------------- | ------------------------------------------------- |
| `language` | `'en' \| 'zh' \| 'ja'` | Filter speakers by language. Defaults to English. |

**Response item**

| Property       | Type     | Description                 |
| -------------- | -------- | --------------------------- |
| `name`         | `string` | Display name of the speaker |
| `speakerId`    | `string` | ID to pass to `tts()`       |
| `demoAudioUrl` | `string` | URL to a demo audio clip    |
| `gender`       | `string` | Speaker gender              |
| `language`     | `string` | Speaker language            |

## `tts(options)`

Generate audio from text using the streaming TTS API. Returns a `ReadableStream<Uint8Array>` of MP3 audio data, suitable for real-time playback or saving to a file.

```js
const stream = await api.tts({
	input: 'Hello world',
	voice: 'cozy-man-english',
});
```

**Options**

| Property | Type     | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `input`  | `string` | Text to synthesize                             |
| `voice`  | `string` | Speaker ID (from `getAvailableSpeakers`)       |
| `model`  | `string` | Model to use (optional, defaults to `flowtts`) |

### Streaming playback example

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {ListenHubApi} from '@marswave/coli';

const api = new ListenHubApi({apiKey: 'lh_sk_...'});
const stream = await api.tts({
	input: 'Hello world',
	voice: 'cozy-man-english',
});

// Collect stream and save to file
const chunks = [];
const reader = stream.getReader();
for (;;) {
	const {done, value} = await reader.read();
	if (done) break;
	chunks.push(value);
}

const mp3Path = path.join(os.tmpdir(), 'output.mp3');
fs.writeFileSync(mp3Path, Buffer.concat(chunks));

// Play on macOS
execSync(`afplay "${mp3Path}"`);
```

### Save to file example

```js
import fs from 'node:fs';
import {Writable} from 'node:stream';
import {ListenHubApi} from '@marswave/coli';

const api = new ListenHubApi({apiKey: 'lh_sk_...'});
const stream = await api.tts({
	input: 'Hello world',
	voice: 'cozy-man-english',
});

const fileStream = fs.createWriteStream('output.mp3');
await stream.pipeTo(Writable.toWeb(fileStream));
```
