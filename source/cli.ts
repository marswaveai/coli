#!/usr/bin/env node
import meow from 'meow';
import {command as asrCommand} from './asr/_cli.js';

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

const [command = 'EMPTY', ...args] = cli.input;

switch (command) {
	case 'asr': {
		await asrCommand(cli, args);
		break;
	}

	default: {
		cli.showHelp();
		break;
	}
}
