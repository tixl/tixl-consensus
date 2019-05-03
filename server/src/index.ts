import * as http from 'http';
import * as socketio from 'socket.io';
import chalk from 'chalk';
import * as namor from 'namor';
import * as _ from 'lodash';
const log = console.log;

const server = http.createServer();
const io = socketio(server);

io.on('connection', (socket) => {
    socket.on('register', ({ }, callback: any) => {
        const client = new Node(socket);
        log(`New client: ${client.name}`);
        callback({ name: client.name });
    })
});
server.listen(4242);
log(chalk.bold.red('Simulation server on Port 4242'));

const nameToNode = new Map<string, Node>();

class Node {
    name: string;
    socket: socketio.Socket;
    knows: Node[];
    constructor(socket: socketio.Socket) {
        this.name = namor.generate({ manly: true, words: 1, numbers: 0 });
        this.socket = socket;
        this.knows = [];
        nameToNode.set(this.name, this);

        socket.on('c', ({ param }: { param: string }, callback: any) => {
            if (this.addKnownNodeByName(param)) {
                log(chalk.green(`${this.name} connects to ${param}`));
                callback('Connection successful.')
            }
            else {
                log(chalk.red(`${this.name} connect to ${param} failed`));
                callback('Connection failed.')
            }
        })

        socket.on('disconnect', () => {
            log(chalk.red(`${this.name} disconnected`))
            this.knows.forEach((node) => node.removeKnownNode(this));
            nameToNode.delete(this.name);
        })
    }

    removeKnownNode(node: Node) {
        this.knows = this.knows.filter(x => x.name !== node.name);
    }

    addKnownNodeByName(name: string): boolean {
        try {
            const node = nameToNode.get(name);
            if(!node) return false;
            this.knows.push(node);
            node.knows.push(this);
            return true;
        }
        catch (error) {
            return false;
        }
    }
}

setInterval(() => {
    log('');
    log(chalk.green('ACTIVE CONNECTIONS'))
    for (let [, node] of nameToNode) {
        log(`${node.name}: ${node.knows.map(x => x.name)}`)
    }
    log('');
}, 60000);