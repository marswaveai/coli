#!/usr/bin/env node
import process from 'node:process';
import meow from 'meow';
import {runAsr} from './asr.js';
import {ensureModels} from './models.js';

const cli = meow(
	`
  Usage
    $ coli asr [options] <file>

  Commands
    asr    Transcribe an audio file using speech recognition

  Options
    -j, --json     Output result in JSON format
    --model        Model to use: whisper, sensevoice (default: sensevoice)

  Examples
    $ coli asr recording.m4a
    $ coli asr -j recording.m4a
    $ coli asr --model whisper recording.wav
`,
	{
		importMeta: import.meta,
		flags: {
			json: {
				type: 'boolean',
				shortFlag: 'j',
				default: false,
			},
			model: {
				type: 'string',
				default: 'sensevoice',
			},
		},
	},
);

const [command, ...args] = cli.input;

if (command === 'asr') {
	const filePath = args[0];
	if (!filePath) {
		console.error('Error: please provide an audio file path.\n');
		cli.showHelp();
		process.exit(1);
	}

	const {model} = cli.flags;
	if (model !== 'whisper' && model !== 'sensevoice') {
		console.error(
			`Error: unknown model "${model}". Use "whisper" or "sensevoice".`,
		);
		process.exit(1);
	}

	await ensureModels();
	runAsr(filePath, {json: cli.flags.json, model});
} else {
	cli.showHelp();
}
