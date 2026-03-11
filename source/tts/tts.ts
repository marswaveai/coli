import process from 'node:process';
import {execa} from 'execa';

export type TtsOptions = {
	voice?: string;
	rate?: number;
	output?: string;
};

function ensureMacos(): void {
	if (process.platform !== 'darwin') {
		throw new Error('TTS is currently only supported on macOS.');
	}
}

export async function getVoices(): Promise<string[]> {
	ensureMacos();
	const {stdout} = await execa('say', ['-v', '?']);
	return stdout
		.split('\n')
		.map((line) => line.replace(/\s{2,}.*$/, '').trim())
		.filter(Boolean);
}

export async function runTts(
	text: string,
	options: TtsOptions = {},
): Promise<void> {
	ensureMacos();

	const args: string[] = [];

	if (options.voice) {
		args.push('-v', options.voice);
	}

	if (options.rate !== undefined) {
		args.push('-r', String(options.rate));
	}

	if (options.output) {
		args.push('-o', options.output);
	}

	args.push(text);

	await execa('say', args);
}
