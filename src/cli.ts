import { EventEmitter } from 'events';
import protocol, { BroadcastFunction } from './index';
import { MessageEnvelope, ScpSlices, ProtocolFunctions } from './types';
import * as Chance from 'chance';
import * as _ from 'lodash';
import * as yargs from 'yargs';
import { parseConfig } from './parseConfig';

const ta = _.range(0, 10).map(i => `TX${i}`);

const getTransactionsForNode = (i: number) => {
  switch (i) {
    case 1:
      return [ta[0], ta[1], ta[2], ta[3], ta[4], 'TS1'];
    case 2:
      return [ta[5], ta[6], ta[7], ta[8], ta[9], 'TS2'];
    case 3:
      return [ta[0], ta[2], ta[4], 'TS3'];
    case 4:
      return [ta[1], ta[3], 'TS4'];
    default:
      return [];
  }
};

const argv = yargs
  .default('s', 1) // slot
  .default('r', 1)
  .default('x', 50) // delay min
  .default('y', 100) // delay max
  .default('g', 'seed')
  .default('debug', false)
  .alias('s', 'slot')
  .alias('r', 'runs')
  .alias('x', 'mindelay')
  .alias('y', 'maxdelay')
  .alias('g', 'seed').argv;

const { slot, runs, mindelay, maxdelay, seed, debug } = argv;
if (mindelay > maxdelay) throw new Error('Min Delay must be < max delay');

const chance = new Chance(seed);
const enableLog = debug;
const startSlot = slot; //25
const defaultDelay = { min: mindelay, max: maxdelay };
const determineEndInterval = 1000;

const { nodes } = parseConfig('./simConfig.toml');

const wrapSCP = async (slot: number) =>
  new Promise((resolve, reject) => {
    console.log('+++++++++++++++++++++++++++');
    console.log('+ Run SCP for slot ' + slot + '    +');
    console.log('+++++++++++++++++++++++++++ ');

    let msgCounter = 0;
    const externalizedNodes: string[] = [];
    let externalizedValue: string | null = null;

    const evt = new EventEmitter();
    const broadcast: BroadcastFunction = (envelope: MessageEnvelope) => {
      msgCounter++;
      evt.emit('broadcast', JSON.stringify(envelope));
      if (envelope.type === 'ScpExternalize') {
        externalizedNodes.push(envelope.sender);
        if (externalizedValue === null) {
          externalizedValue = JSON.stringify(envelope.message.commit.value);
        } else {
          if (JSON.stringify(envelope.message.commit.value) !== externalizedValue) {
            console.error('DIFFERENT VALUES EXTERNALIZED');
            console.error(externalizedValue);
            console.error(JSON.stringify(envelope.message.commit.value));
            reject();
          }
        }
      }
    };

    let i = 0;
    const inits = [];
    for (const node of Object.values(nodes)) {
      i++;

      const slices: ScpSlices = {
        threshold: (node as any).slices.t,
        validators: (node as any).slices.validators,
      };
      const functions: ProtocolFunctions = {
        broadcast,
        validate: (x: string) => { x; return true; },
        getInput: () => getTransactionsForNode(i)
      }
      const { receive, init } = protocol(functions, {
        logDebug: enableLog,
        logMessages: true,
        slot,
        self: (node as any).pk,
        slices,
      });
      inits.push(init);
      evt.addListener('broadcast', (e: string) => {
        const envelope: MessageEnvelope = JSON.parse(e);
        const delay_ = chance.integer(defaultDelay);
        setTimeout(() => {
          receive(envelope);
        }, delay_);
      });
    }
    inits.forEach(init => init());
    const logInfo = () => {
      setTimeout(() => {
        if (inits.length === externalizedNodes.length) {
          console.log({ msgCounter, externalizedNodes });
          setTimeout(() => {
            resolve();
          }, 2000);
        } else {
          logInfo();
        }
      }, determineEndInterval);
    };
    logInfo();
  });

const main = async () => {
  let i = startSlot;
  const runSCP = async () => {
    await wrapSCP(i);
    if (i < runs + startSlot - 1) {
      i++;
      await runSCP();
    }
  };
  await runSCP();
};

main();
