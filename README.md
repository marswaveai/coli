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
  asr    Transcribe an audio file using speech recognition
  tts    Speak text using text-to-speech (macOS only)

Examples
  $ coli asr recording.m4a
  $ coli asr -j recording.m4a
  $ coli tts "Hello world"
  $ coli tts -v Samantha -r 200 "Hello world"
```

## API Usage

```sh
npm install @marswave/coli
```

```js
import {ensureModels, runAsr, runTts} from '@marswave/coli';

// ASR
await ensureModels();
await runAsr('recording.m4a', {json: false, model: 'sensevoice'});

// TTS (macOS only)
await runTts('Hello world', {voice: 'Samantha', rate: 200});
```

## Documentation

- [ASR](docs/asr.md) — Automatic speech recognition
- [TTS](docs/tts.md) — Text-to-speech synthesis (macOS only)

## License

MIT
