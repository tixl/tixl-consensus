import * as toml from 'toml';
import fs = require('fs');
import { EventEmitter } from 'events';
import { BroadcastFunction, protocol } from './protocol';
import { MessageEnvelope, ScpSlices } from './types';
import * as Chance from 'chance';

const chance = new Chance('Iamaseed');
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

const ta = _.range(0, 10).map(String);

const getTransactionsForNode = (i: number) => {
    switch (i) {
        case 1: return [ta[0], ta[1], ta[2], ta[3], ta[4]];
        case 2: return [ta[5], ta[6], ta[7], ta[8], ta[9]];
        case 3: return [ta[0], ta[2], ta[4]];
        case 4: return [ta[1], ta[3]];
        default: return [];
    }
}
let i = 0;
const inits = [];
for (const node of Object.values(nodes)) {
    i++;
    const slices: ScpSlices = {
        threshold: (node as any).slices.t,
        validators: (node as any).slices.validators,
    };
    const { receive, init } = protocol(broadcast, { slot: 20, self: (node as any).pk, slices, suggestedValues: getTransactionsForNode(i) })
    inits.push(init);
    evt.addListener('broadcast', (e: MessageEnvelope) => {
        setTimeout(() => {
            receive(e);
        }, chance.integer({ min: 0, max: 3000 }));
    });
}
inits.forEach(init => init());
