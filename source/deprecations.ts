/**
 * Direct audio playback depends on platform-specific tools (afplay on macOS,
 * ffplay on Linux) and is not supported on Windows. Users should use -o <file>
 * to save the audio file and play it with their preferred player.
 */
export const deprecationDirectPlayback = 'COLI_DEP001';

/**
 * Passing a file path string to `runAsr` is deprecated. Non-WAV formats
 * require a system-installed ffmpeg, and WAV reading ties the API to the
 * filesystem. Pass an `AudioData` object (`{ sampleRate, samples }`) instead.
 */
export const deprecationAsrFilePath = 'COLI_DEP002';
