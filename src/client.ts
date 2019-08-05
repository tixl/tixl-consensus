import { parseConfig } from "./parseConfig";
import P2P from './network/p2p';
import * as yargs from 'yargs';
import { ProtocolOptions, protocol } from "./protocol";
import { MessageEnvelope } from "./types";
import chalk from "chalk";
import { envelopeFormatter } from "./formatters";
import * as Chance from 'chance';

const chance = new Chance('seed');

const getTime = () => Date.now() / 1000;

const { config } = yargs.default('c', 'config-a.toml').alias('c', 'config').argv;
const startTime = Math.ceil(getTime() / 60) * 60;
console.log({ startTime })
const { ports, pk, slices, port } = parseConfig(config);
const p2p = new P2P(port)
setTimeout(() => {

    ports.forEach(nodePort => {
        console.log('connect to ', nodePort)
        p2p.addPeer('http://localhost:' + String(nodePort))
    })

    const runConsensus = (slot: number) => new Promise(resolve => {
        const wrappedBroadcast = (envelope: MessageEnvelope) => {
            console.log(chalk.green(`${slot} Node ${chalk.bold(envelope.sender)} sends    `), envelopeFormatter(envelope));
            p2p.broadcast(envelope);
            if (envelope.type === 'ScpExternalize') {
                resolve(envelope.message.commit.value);
            }
        }
        const opts: ProtocolOptions = {
            slot,
            self: pk,
            slices,
            enableLog: true,
            suggestedValues: [`T-${slot}-${pk}`]
        }
        const result = protocol(wrappedBroadcast, opts);
        p2p.subscribe((envelope: MessageEnvelope) => {
            if (envelope.slot === slot) {
                const formatted = envelopeFormatter(envelope);
                const delay = chance.integer({ min: 30, max: 100 });
                setTimeout(() => {
                    console.log(chalk.red(`${slot} Node ${chalk.bold(pk)} receives (${delay}ms) `), formatted);
                    result.receive(envelope)
                }, delay)

            }
        });
        setTimeout(result.init, 500);
    })

    const startConsensus = async (slot: number) => {
        await runConsensus(slot);
        setTimeout(async () => {
            startConsensus(slot + 1);
        }, 5000);
    }

    const checkStart = () => {
        if (getTime() >= startTime) {
            console.log('start')
            startConsensus(1)
        }
        else setTimeout(checkStart, 1000);
    }
    checkStart();
}, 10000)