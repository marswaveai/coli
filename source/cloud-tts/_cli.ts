import process from 'node:process';
import type {Command} from 'commander';
import {defaultSpeaker} from '../_api/constants.js';
import type {SpeakerLanguage} from '../_api/types.js';
import {listSpeakers, runCloudTts} from './cloud-tts.js';

function getApiKey(options: {apiKey?: string}): string {
	const key = options.apiKey ?? process.env['COLI_LISTENHUB_API_KEY'];
	if (!key) {
		throw new Error(
			'API key required. Use --api-key or set COLI_LISTENHUB_API_KEY environment variable. Get an API key from https://listenhub.ai/settings/api-keys',
		);
	}

	return key;
}

function getBaseUrl(options: {baseUrl?: string}): string | undefined {
	return options.baseUrl ?? process.env['COLI_TTS_BASE_URL'];
}

export function register(program: Command) {
	program
		.command('cloud-tts')
		.description('Generate speech using ListenHub OpenAPI')
		.argument('[text]', 'Text to synthesize')
		.option(
			'--api-key <key>',
			'ListenHub API key (or set COLI_LISTENHUB_API_KEY environment variable)',
		)
		.option('--voice <id>', 'Speaker ID to use')
		.option('--model <name>', 'Model to use (default: flowtts)')
		.option(
			'--base-url <url>',
			'Base URL for TTS API (or set COLI_TTS_BASE_URL environment variable)',
		)
		.option('-o, --output <file>', 'Save audio to file')
		.option('--list-speakers', 'List available speakers')
		.option('--language <lang>', 'Speaker language (en, zh, ja)')
		.option('-j, --json', 'Output in JSON format (use with --list-speakers)')
		.action(
			async (
				text: string | undefined,
				options: {
					apiKey?: string;
					voice?: string;
					model?: string;
					baseUrl?: string;
					output?: string;
					listSpeakers?: boolean;
					language?: SpeakerLanguage;
					json?: boolean;
				},
			) => {
				if (options.listSpeakers) {
					const apiKey = getApiKey(options);
					const baseUrl = getBaseUrl(options);
					const speakers = await listSpeakers({
						apiKey,
						baseUrl,
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

				const voice =
					options.voice ??
					(options.language && defaultSpeaker[options.language]);
				if (!voice) {
					throw new Error(
						'Please specify a speaker with --voice or a language with --language. Use --list-speakers to see available speakers.',
					);
				}

				const apiKey = getApiKey(options);
				const baseUrl = getBaseUrl(options);
				await runCloudTts(text, {
					apiKey,
					baseUrl,
					voice,
					model: options.model,
					output: options.output,
				});
			},
		);
}
