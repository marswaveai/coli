# Deprecated APIs

Coli uses deprecation codes (`COLI_DEPxxx`) to communicate deprecated features. When a deprecated feature is used, a `DeprecationWarning` is emitted via `process.emitWarning`. You can suppress these warnings with the `--no-deprecation` Node.js flag.

## List of deprecations

### COLI_DEP001: Direct audio playback

- Affected: `runCloudTts()` without `output` option, `coli cloud-tts` without `-o`

Direct audio playback relies on platform-specific tools (`afplay` on macOS, `ffplay` on Linux) and is not supported on Windows. Use the `-o <file>` option to save the audio file and play it with your preferred player instead.

### COLI_DEP002: File path input for ASR

- Affected: `runAsr()` with a file path string

Passing a file path string to `runAsr()` is deprecated. Non-WAV formats require a system-installed `ffmpeg` for conversion, which adds an external dependency. Pass an `AudioData` object (`{ sampleRate: number, samples: Float32Array }`) instead. The caller is responsible for reading and decoding the audio file. The `coli asr` CLI handles conversion internally and is not affected by this deprecation.
