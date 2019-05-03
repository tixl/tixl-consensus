import * as io from 'socket.io-client';
import chalk from 'chalk';
import * as prompt from 'prompt';
const log = console.log;

const socket = io('http://localhost:4242');

const main = (name: string) => {
    log(`I am now ${chalk.bold.red(name)}`)
    const query = () => {
        prompt.get(['command', 'args'], (err: any, { command, args }: { command: string, args: string }) => {
            if (err) log(chalk.red(err));
            if (command === 'exit') process.exit();
            socket.emit(command, { args }, (ack: any) => {
                log(`Ack: ${ack}`);
                query();
            });
        })
    }
    prompt.start();
    query();
}

socket.emit('register', {}, (ack: any) => {
    main(ack.name);
})
