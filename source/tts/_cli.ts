import type {Command} from 'commander';
import {type TtsVoice, getVoices, runTts} from './tts.js';

function formatVoice(voice: TtsVoice): string {
	if ('languageCode' in voice) {
		return `${voice.name}\t${voice.languageCode}\t${voice.example}`;
	}

	const enabled = voice.enabled ? 'enabled' : 'disabled';
	return `${voice.name}\t${voice.culture}\t${enabled}\t${voice.description}`;
}

export function register(program: Command) {
	program
		.command('tts')
		.description('Speak text using native text-to-speech')
		.argument('[text]', 'Text to speak')
		.option('-v, --voice <name>', 'Voice to use, defaults to system voice')
		.option('-r, --rate <wpm>', 'Speech rate in words per minute', Number)
		.option('-o, --output <file>', 'Save audio to file instead of speaking')
		.option('--list-voices', 'List available voices')
		.option('-j, --json', 'Output in JSON format (use with --list-voices)')
		.action(
			async (
				text: string | undefined,
				options: {
					voice?: string;
					rate?: number;
					output?: string;
					listVoices?: boolean;
					json?: boolean;
				},
			) => {
				if (options.listVoices) {
					const voices = await getVoices();
					if (options.json) {
						console.log(JSON.stringify(voices, null, 2));
					} else {
						for (const voice of voices) {
							console.log(formatVoice(voice));
						}
					}

					return;
				}

				if (!text) {
					throw new Error('Please provide text to speak.');
				}

				await runTts(text, options);
			},
		);
}
