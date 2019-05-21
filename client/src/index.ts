import * as io from 'socket.io-client';
import chalk from 'chalk';
import Network from './Network';
import { FBASInstance } from './FBAS/FBASInstance';
import { NodeIdentifier } from './FBAS/NodeIdentifier';
import Slices from './FBAS/Slice';
import VoteMessage from './FBAS/messages/VoteMessage';
import Topic from './FBAS/Topic';
const readline = require('readline');
const log = console.log;
const jlog = (obj: any) => log(JSON.stringify(obj, null, 2));

const socket = io('http://localhost:4242');


const slices = new Set<Set<NodeIdentifier>>();
const fbasMap = new Map<string, FBASInstance>();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const main = (name: string) => {
    log(`I am now ${chalk.bold.red(name)}`)
    const network = new Network((obj: any) => socket.emit('broadcast', obj));
    const id = name;

    const onVote = (input: string) => {
        const [topic, value] = input.split(',');
        const vote = Boolean(Number(value));
        const fbas = fbasMap.get(topic);
        if (fbas) {
            fbas.castVote(vote);
            log(`Casted vote ${vote} on topic ${topic}`)
        } else log('Vote failed')
    }

    const onSlice = (input: string) => {
        const ids = input.split(',');
        const slice = new Set(ids);
        slices.add(slice);
        log("added new slice")
    }

    const onStart = (input: string) => {
        const [topic, value] = input.split(',');
        const vote = Boolean(Number(value));
        const fbas = new FBASInstance(new Topic(topic), id, new Slices(slices), network);
        fbasMap.set(topic, fbas);
        fbas.castVote(vote);
        console.log(`Started new FBAS ${topic} and voted for ${vote}`);
    }

    const getFbasForTopic = (topic: string): FBASInstance => {
        const fbas = fbasMap.get(topic);
        if (fbas) return fbas;
        const newFbas = new FBASInstance(new Topic(topic), id, new Slices(slices), network);
        fbasMap.set(topic, newFbas);
        return newFbas;
    }

    socket.on('broadcast', (message: any) => {
        log('received message');
        if (!message.type) {
            log('received message without type');
            return;
        }
        if (message.origin === id) {
            log('message from me, skipping')
            return;
        }
        jlog(message);
        if (message.type === "VOTE") {
            const voteMsg = new VoteMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
            const fbas = getFbasForTopic(message.topic.value);
            fbas.receiveMessage(voteMsg);
        }
    });

    rl.on('line', (input: string) => {
        const cmd = input.slice(0, input.indexOf(' ') || undefined);
        const param = input.slice(input.indexOf(' ') + 1 || 0)
        if (cmd === 'exit') process.exit();
        if (cmd === 'vote') onVote(param);
        if (cmd === 'slice') onSlice(param);
        if (cmd === 'start') onStart(param);

    });
    rl.on('SIGINT', () => process.exit());
};

socket.emit('register', {}, (ack: any) => {
    main(ack.name);
})


