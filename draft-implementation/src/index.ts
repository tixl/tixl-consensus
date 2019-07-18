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
    if (chance.bool({ likelihood: 100 })) {
        console.log(envelopeFormatter(envelope));
        evt.emit('broadcast', JSON.stringify(envelope))

    } else {
        console.log('SKIPPED', envelopeFormatter(envelope));
    }

};

const ta = _.range(0, 10).map(i => `T${i}`);

const enableLog = true;

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
    const { receive, init } = protocol(broadcast, { enableLog, slot: 3, self: (node as any).pk, slices, suggestedValues: getTransactionsForNode(i) })
    inits.push(init);
    evt.addListener('broadcast', (e: string) => {
        const envelope: MessageEnvelope = JSON.parse(e);
        setTimeout(() => {
            // const formatted = envelopeFormatter(envelope);
            // console.log(`Node ${(node as any).pk} receives `, formatted);
            receive(envelope);

        }, chance.integer({ min: 1000, max: 5000 }));
    });
}
inits.forEach(init => init());
