import {Buffer} from 'node:buffer';
import process from 'node:process';
import type {Command} from 'commander';
import {runAsr} from './asr.js';
import {ensureModels, ensureVadModel} from './models.js';
import {streamAsr} from './stream-asr.js';

export function register(program: Command) {
	program
		.command('asr')
		.description('Transcribe an audio file using speech recognition')
		.argument('<file>', 'Audio file to transcribe')
		.option('-j, --json', 'Output result in JSON format', false)
		.option('--model <name>', 'Model to use: whisper, sensevoice', 'sensevoice')
		.action(async (file: string, options: {json: boolean; model: string}) => {
			const {model} = options;
			if (model !== 'whisper' && model !== 'sensevoice') {
				throw new Error(
					`Unknown model "${model}". Use "whisper" or "sensevoice".`,
				);
			}

			await ensureModels([model]);
			await runAsr(file, {json: options.json, model});
		});

	program
		.command('asr-stream')
		.description(
			'Stream speech recognition from stdin (expects 16kHz mono s16le PCM)',
		)
		.option('-j, --json', 'Output each result as a JSON line', false)
		.option('--vad', 'Enable voice activity detection', false)
		.option(
			'--asr-interval-ms <ms>',
			'Recognition interval in ms (ignored with --vad)',
			'1000',
		)
		.action(
			async (options: {json: boolean; vad: boolean; asrIntervalMs: string}) => {
				await ensureModels();
				if (options.vad) {
					await ensureVadModel();
				}

				async function* stdinAudio() {
					for await (const chunk of process.stdin) {
						const buf = Buffer.from(chunk as Uint8Array);
						const pcm = new Int16Array(
							buf.buffer,
							buf.byteOffset,
							buf.byteLength / 2,
						);
						const float32 = new Float32Array(pcm.length);
						for (const [i, sample] of pcm.entries()) {
							float32[i] = sample / 32_768;
						}

						yield float32;
					}
				}

				await streamAsr(stdinAudio(), {
					vad: options.vad || undefined,
					asrIntervalMs: Number(options.asrIntervalMs),
					onResult(result) {
						if (options.json) {
							console.log(JSON.stringify(result));
						} else {
							console.log(result.text);
						}
					},
				});
			},
		);
}
