#!/usr/bin/env node
import {Command} from 'commander';
import {register as registerAsr} from './asr/_cli.js';
import {register as registerCloudTts} from './cloud-tts/_cli.js';
import {register as registerTts} from './tts/_cli.js';

const program = new Command();

program.name('coli').description('Core CLI for Cola');

registerAsr(program);
registerTts(program);
registerCloudTts(program);

program.parse();
