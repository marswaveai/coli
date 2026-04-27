import {createRequire} from 'node:module';
import path from 'node:path';
import {getPunctModelPath} from './models.js';

const require = createRequire(import.meta.url);

type OfflinePunctuation = {
	addPunct(text: string): string;
};

type SherpaOnnx = {
	OfflinePunctuation: new (
		config: Record<string, unknown>,
	) => OfflinePunctuation;
};

let _sherpaOnnx: SherpaOnnx | undefined;
function sherpaOnnx(): SherpaOnnx {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	_sherpaOnnx ??= require('sherpa-onnx-node') as SherpaOnnx;
	return _sherpaOnnx;
}

let _punctuation: OfflinePunctuation | undefined;
function getPunctuation(): OfflinePunctuation {
	if (!_punctuation) {
		const modelDir = getPunctModelPath();
		_punctuation = new (sherpaOnnx().OfflinePunctuation)({
			model: {
				ctTransformer: path.join(modelDir, 'model.int8.onnx'),
				numThreads: 1,
				provider: 'cpu',
				debug: 0,
			},
		});
	}

	return _punctuation;
}

export function applyPunctuation(text: string): string {
	return getPunctuation().addPunct(text);
}
