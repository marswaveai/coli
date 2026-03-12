import type {Command} from 'commander';
import {runAsr} from './asr.js';
import {ensureModel} from './models.js';

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

			await ensureModel(model);
			await runAsr(file, {json: options.json, model});
		});
}
