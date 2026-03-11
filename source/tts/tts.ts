import {type Voice, getVoices as macGetVoices, say} from 'mac-say';

export type TtsOptions = {
	voice?: string;
	rate?: number;
	output?: string;
};

export async function getVoices(): Promise<Voice[]> {
	return macGetVoices();
}

export async function runTts(
	text: string,
	options: TtsOptions = {},
): Promise<void> {
	await say(text, {
		voice: options.voice,
		rate: options.rate,
		outputFile: options.output,
	});
}
