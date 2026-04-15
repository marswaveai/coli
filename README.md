# coli

Core library for Cola. Provides essential capabilities commonly used by agents.

## CLI Usage

```sh
npm install -g @marswave/coli
```

```
Usage
  $ coli <command> [options]

Commands
  asr         Transcribe an audio file using speech recognition
  tts         Speak text using native text-to-speech
  cloud-tts   Generate speech using ListenHub OpenAPI

Examples
  $ coli asr recording.m4a
  $ coli asr -j recording.m4a
  $ coli tts "Hello world"
  $ coli tts -v Samantha -r 200 "Hello world"
  $ coli cloud-tts --language en "Hello world"
  $ coli cloud-tts --voice cozy-man-english "Hello world"
```

## API Usage

```sh
npm install @marswave/coli
```

```js
import {ensureModels, runAsr, streamAsr, runTts} from '@marswave/coli';

// ASR
await ensureModels();
await runAsr('recording.m4a', {json: false, model: 'sensevoice'});

// Streaming ASR (see docs/asr.md for details)
await streamAsr(audioSource, {
	onResult(result) {
		console.log(result.text, result.isFinal ? '(final)' : '(partial)');
	},
});

// TTS
await runTts('Hello world', {voice: 'Samantha', rate: 200});
```

## Documentation

- [ASR](docs/asr.md) — Automatic speech recognition
- [TTS](docs/tts.md) — Native text-to-speech synthesis
- [Cloud TTS](docs/cloud-tts.md) — Cloud-based TTS via ListenHub OpenAPI
- [ListenHub OpenAPI](docs/listenhub-openapi.md) — ListenHub OpenAPI client
- [Deprecations](docs/deprecations.md) — Deprecated APIs

## License

MIT
