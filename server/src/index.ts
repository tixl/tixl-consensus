import * as http from 'http';
import * as socketio from 'socket.io';
import chalk from 'chalk';
import * as namor from 'namor';
import * as _ from 'lodash';
const log = console.log;

const server = http.createServer();
const io = socketio(server);
const nameToNode = new Map<string, Node>();

setInterval(() => {
    console.log('BROADCASTING KNOWN CLIENTS')
    const clients = Array.from(nameToNode.values())
    clients.forEach(client => client.send({ type: 'CLIENTS', clients: clients.map(x => x.name) }))
}, 6000)

io.on('connection', (socket) => {
    socket.on('register', ({ }, callback: any) => {
        const client = new Node(socket);
        log(`New client: ${client.name}`);
        callback({ name: client.name });
    })
});
server.listen(4242);
log(chalk.bold.red('Simulation server on Port 4242'));


class Node {
    name: string;
    socket: socketio.Socket;
    trusts: Node[];
    trustedBy: Node[];
    constructor(socket: socketio.Socket) {
        this.name = namor.generate({ manly: true, words: 1, numbers: 0 });
        this.socket = socket;
        this.trusts = [];
        this.trustedBy = [];
        nameToNode.set(this.name, this);

        socket.on('c', ({ param }: { param: string }, callback: any) => {
            if (this.addTrustedNodeByName(param)) {
                log(chalk.green(`${this.name} trusts ${param}`));
                callback('Connection successful.')
            }
            else {
                log(chalk.red(`${this.name} connect to ${param} failed`));
                callback('Connection failed.')
            }
        })

        socket.on('broadcast', (obj: any) => {
            this.broadcast(obj);
            log(`${this.name} broadcasts: ${JSON.stringify(obj, null, 2)}`);
        })

        socket.on('disconnect', () => {
            log(chalk.red(`${this.name} disconnected`))
            this.trusts.forEach((node) => node.removeKnownNode(this));
            nameToNode.delete(this.name);
        })
    }

    removeKnownNode(node: Node) {
        this.trusts = this.trusts.filter(x => x.name !== node.name);
        node.trustedBy = node.trustedBy.filter(x => x.name !== this.name);
    }

    send(obj: any) {
        setTimeout(() => {
            this.socket.emit('broadcast', obj)
        }, 2000)
    }

    broadcast(obj: any) {
        setTimeout(() => {
            for (let node of nameToNode.values()) {
                node.socket.emit('broadcast', obj);
            }
        }, 2000)
    };

    addTrustedNodeByName(name: string): boolean {
        try {
            const node = nameToNode.get(name);
            if (!node) return false;
            this.trusts.push(node);
            node.trustedBy.push(this);
            return true;
        }
        catch (error) {
            return false;
        }
    }
}

setInterval(() => {
    log('');
    log(chalk.green('ACTIVE TRUSTS'))
    for (let [, node] of nameToNode) {
        log(`${node.name}: ${node.trusts.map(x => x.name)}`)
    }
    log('');
}, 60000);