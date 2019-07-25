import * as toml from 'toml';
import fs = require('fs');
import { EventEmitter } from 'events';
import { BroadcastFunction, protocol } from './protocol';
import { MessageEnvelope, ScpSlices } from './types';
import * as Chance from 'chance';
import * as _ from 'lodash';
import { envelopeFormatter } from './formatters';
import chalk from 'chalk';

const chance = new Chance('Iamaseed');
const enableLog = false;
const startSlot = 2 //25
const runs = 50;
const delay = { min: 1000, max: 5000 };
const determineEndInterval = 500;

const cfgFile = fs.readFileSync('./src/config.toml', "utf8");
const config = toml.parse(cfgFile)
const nodes = config.nodes as any;

const wrapSCP = async (slot: number) => new Promise((resolve, reject) => {
    console.log(' ======================= ')
    console.log(' Run SCP for slot ' + slot)
    console.log(' ======================= ')

    let msgCounter = 0;
    const externalizedNodes: string[] = [];
    let externalizedValue: string | null = null;

    const evt = new EventEmitter();
    const broadcast: BroadcastFunction = (envelope: MessageEnvelope) => {
        if (chance.bool({ likelihood: 100 })) {
            console.log(chalk.green(`${slot} Node ${chalk.bold(envelope.sender)} sends    `), envelopeFormatter(envelope));
            // console.log(envelopeFormatter(envelope));
            msgCounter++;
            evt.emit('broadcast', JSON.stringify(envelope))
            if (envelope.type === 'ScpExternalize') {
                externalizedNodes.push(envelope.sender);
                if (externalizedValue === null) {
                    externalizedValue = JSON.stringify(envelope.message.commit.value);
                }
                else {
                    if (JSON.stringify(envelope.message.commit.value) !== externalizedValue) {
                        console.error('DIFFERENT VALUES EXTERNALIZED');
                        console.error(externalizedValue)
                        console.error(JSON.stringify(envelope.message.commit.value))
                        reject();
                    }
                }
            }
        } else {
            console.log('SKIPPED', envelopeFormatter(envelope));
        }

    };

    const ta = _.range(0, 10).map(i => `T${i}`);

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
        const { receive, init } = protocol(broadcast, { enableLog, slot, self: (node as any).pk, slices, suggestedValues: getTransactionsForNode(i) })
        inits.push(init);
        evt.addListener('broadcast', (e: string) => {
            const envelope: MessageEnvelope = JSON.parse(e);
            setTimeout(() => {
                const formatted = envelopeFormatter(envelope);
                console.log(chalk.red(`${slot} Node ${chalk.bold((node as any).pk)} receives `), formatted);
                receive(envelope);

            }, chance.integer(delay));
        });
    }
    inits.forEach(init => init());
    const logInfo = () => {
        setTimeout(() => {
            if (inits.length === externalizedNodes.length) {
                console.log({ msgCounter, externalizedNodes })
                setTimeout(() => {
                    resolve();
                }, delay.max)
            }
            else {
                logInfo();
            }
        }, determineEndInterval)
    }
    logInfo();
})

const main = async () => {
    let i = startSlot;
    const runSCP = async () => {
        await wrapSCP(i)
        if (i <= runs + startSlot) {
            i++;
            await runSCP();
        }
    }
    await runSCP();
}

main();