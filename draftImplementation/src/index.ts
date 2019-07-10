import * as toml from 'toml';
import fs = require('fs');
import { EventEmitter } from 'events';
import { BroadcastFunction, protocol } from './protocol';
import { MessageEnvelope, ScpSlices } from './types';
// import * as uuid from 'uuid/v4'
import * as _ from 'lodash';
import { envelopeFormatter } from './formatters';

const cfgFile = fs.readFileSync('./src/config.toml', "utf8");
const config = toml.parse(cfgFile)
const nodes = config.nodes as any;

const evt = new EventEmitter();
const broadcast: BroadcastFunction = (envelope: MessageEnvelope) => {
    console.log(envelopeFormatter(envelope));
    evt.emit('broadcast', envelope)
};

const transactions = _.range(0, 10).map((i) => `TA-${i}`);

for (const node of Object.values(nodes)) {
    const slices: ScpSlices = {
        threshold: (node as any).slices.t,
        validators: (node as any).slices.validators,
    };
    const receiveFunction = protocol(broadcast, { slot: 20, self: (node as any).pk, slices, suggestedValues: _.sampleSize(transactions, 5) })
    evt.addListener('broadcast', (e: MessageEnvelope) => {
        setTimeout(() => {
            receiveFunction(e);
        }, 200 + Math.random() * 800);
    });
}
