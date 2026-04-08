import process from 'node:process';
import {type Voice, getVoices as macGetVoices, say} from 'mac-say';

function assertMacOs(): void {
	if (process.platform !== 'darwin') {
		throw new Error(
			'Local TTS is only supported on macOS. Use the cloud-tts command instead.',
		);
	}
}

export type TtsOptions = {
	voice?: string;
	rate?: number;
	output?: string;
};

export async function getVoices(): Promise<Voice[]> {
	assertMacOs();
	return macGetVoices();
}

export async function runTts(
	text: string,
	options: TtsOptions = {},
): Promise<void> {
	assertMacOs();
	await say(text, {
		voice: options.voice,
		rate: options.rate,
		outputFile: options.output,
	});
}
