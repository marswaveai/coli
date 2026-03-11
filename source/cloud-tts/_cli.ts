import process from 'node:process';
import type {Command} from 'commander';
import type {SpeakerLanguage} from '../_api/types.js';
import {listSpeakers, runCloudTts} from './cloud-tts.js';

function getApiKey(options: {apiKey?: string}): string {
	const key = options.apiKey ?? process.env['LISTENHUB_API_KEY'];
	if (!key) {
		throw new Error(
			'API key required. Use --api-key or set LISTENHUB_API_KEY environment variable.',
		);
	}

	return key;
}

export function register(program: Command) {
	program
		.command('cloud-tts')
		.description('Generate speech using ListenHub OpenAPI')
		.argument('[text]', 'Text to synthesize')
		.option('--api-key <key>', 'ListenHub API key (or set LISTENHUB_API_KEY)')
		.option('--voice <id>', 'Speaker ID to use')
		.option('--model <name>', 'Model to use (default: flowtts)')
		.option('-o, --output <file>', 'Save audio to file')
		.option('--list-speakers', 'List available speakers')
		.option(
			'--language <lang>',
			'Filter speakers by language (use with --list-speakers)',
		)
		.option('-j, --json', 'Output in JSON format (use with --list-speakers)')
		.action(
			async (
				text: string | undefined,
				options: {
					apiKey?: string;
					voice?: string;
					model?: string;
					output?: string;
					listSpeakers?: boolean;
					language?: SpeakerLanguage;
					json?: boolean;
				},
			) => {
				if (options.listSpeakers) {
					const apiKey = getApiKey(options);
					const speakers = await listSpeakers({
						apiKey,
						language: options.language,
					});

					if (options.json) {
						console.log(JSON.stringify(speakers, null, 2));
					} else {
						for (const speaker of speakers) {
							console.log(
								`${speaker.name}\t${speaker.speakerId}\t${speaker.gender}\t${speaker.language}`,
							);
						}
					}

					return;
				}

				if (!text) {
					throw new Error('Please provide text to synthesize.');
				}

				if (!options.voice) {
					throw new Error(
						'Please specify a speaker with --voice. Use --list-speakers to see available speakers.',
					);
				}

				const apiKey = getApiKey(options);
				await runCloudTts(text, {
					apiKey,
					voice: options.voice,
					model: options.model,
					output: options.output,
				});
			},
		);
}
