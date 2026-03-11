import type {Command} from 'commander';
import {runTts} from './tts.js';

export function register(program: Command) {
	program
		.command('tts')
		.description('Speak text using text-to-speech (macOS only)')
		.argument('<text>', 'Text to speak')
		.option(
			'-v, --voice <name>',
			'Voice to use, defaults to macOS system voice (run `say -v "?"` to list)',
		)
		.option('-r, --rate <wpm>', 'Speech rate in words per minute', Number)
		.option('-o, --output <file>', 'Save audio to file instead of speaking')
		.action(
			async (
				text: string,
				options: {voice?: string; rate?: number; output?: string},
			) => {
				await runTts(text, options);
			},
		);
}
