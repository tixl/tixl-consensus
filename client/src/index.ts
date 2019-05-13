import * as io from 'socket.io-client';
import chalk from 'chalk';
const readline = require('readline');
const log = console.log;

const socket = io('http://localhost:4242');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const main = (name: string) => {
    log(`I am now ${chalk.bold.red(name)}`)
    rl.on('line', (input: string) => {
        const cmd = input.slice(0, input.indexOf(' ') || undefined);
        const param = input.slice(input.indexOf(' ') + 1 || 0)
        if (cmd === 'exit') process.exit();
        socket.emit(cmd, { param }, (ack: any) => {
            log(`Ack: ${ack}`);
        });
    });
    rl.on('SIGINT', () => process.exit());
};

socket.emit('register', {}, (ack: any) => {
    main(ack.name);
})

socket.on('broadcast', ({ msg, by }: { msg: string, by: string }) => log(`${chalk.red.bold(by)}: ${chalk.green(msg)}`));