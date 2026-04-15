import process from 'node:process';
import {type Voice, getVoices as nativeGetVoices, say} from 'native-say';

function assertSupportedPlatform(): void {
	if (process.platform !== 'darwin' && process.platform !== 'win32') {
		throw new Error(
			'Local TTS is only supported on macOS and Windows. Use the cloud-tts command instead.',
		);
	}
}

export type TtsVoice = Voice;

export type TtsOptions = {
	voice?: string;
	rate?: number;
	output?: string;
};

export async function getVoices(): Promise<TtsVoice[]> {
	assertSupportedPlatform();
	return nativeGetVoices();
}

export async function runTts(
	text: string,
	options: TtsOptions = {},
): Promise<void> {
	assertSupportedPlatform();
	await say(text, {
		voice: options.voice,
		rate: options.rate,
		outputFile: options.output,
	});
}
