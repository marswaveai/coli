import ky, {type KyInstance} from 'ky';
import type {ApiResponse, SpeakerLanguage} from './types.js';

export type * from './types.js';

export type ListenHubApiOptions = {
	apiKey: string;
};

export class ListenHubApi {
	public api: KyInstance;

	constructor({apiKey}: ListenHubApiOptions) {
		this.api = ky.extend({
			prefixUrl: 'https://api.marswave.ai/openapi',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				Authorization: `Bearer ${apiKey}`,
			},
		});
	}

	/**
	 * Get a list of available speakers.
	 * @param options - The options for the speakers request.
	 * @param options.language - Optional. The language of the speakers to get, defaults to list all languages.
	 * @returns A list of available speakers.
	 * @see {@link https://staging.listenhub.ai/docs/en/openapi/api-reference/speakers#list-available-speakers|List Available Speakers}
	 */
	async getAvailableSpeakers(options?: {language?: SpeakerLanguage}) {
		return this.api.get('v1/speakers/list', {searchParams: options}).json<
			ApiResponse<{
				items: Array<{
					name: string;
					speakerId: string;
					demoAudioUrl: string;
					gender: string;
					language: SpeakerLanguage;
				}>;
			}>
		>();
	}

	/**
	 * Generate audio from text using the Streaming TTS API.
	 * @param options - The options for the TTS request.
	 * @param options.input - The text to generate audio from.
	 * @param options.voice - The `speakerId` to use for the TTS.
	 * @param options.model - Optional. The model to use for the TTS, defaults to `flowtts`.
	 * @returns A readable stream of the MP3 audio.
	 * @see {@link https://staging.listenhub.ai/docs/en/openapi/api-reference/flowspeech#streaming-tts|Streaming TTS}
	 */
	async tts(options: {input: string; voice: string; model?: string}) {
		const response = await this.api.post('v1/tts', {json: options});
		if (!response.body) throw new Error('Empty response body from TTS API');
		return response.body;
	}
}
