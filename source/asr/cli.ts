import type meow from 'meow';
import {runAsr} from './asr.js';
import {ensureModels} from './models.js';

export async function asrCommand(cli: ReturnType<typeof meow>, args: string[]) {
	const filePath = args[0];
	if (!filePath) {
		cli.showHelp();
		throw new Error('Please provide an audio file path.');
	}

	const {model} = cli.flags as {model: string};
	if (model !== 'whisper' && model !== 'sensevoice') {
		throw new Error(`Unknown model "${model}". Use "whisper" or "sensevoice".`);
	}

	await ensureModels();
	runAsr(filePath, {json: (cli.flags as {json: boolean}).json, model});
}
