import * as socketioServer from 'socket.io';
import * as socketioClient from 'socket.io-client';
import { EventEmitter } from 'events';

export interface Options {
    enableDiscovery: boolean;
}

export default class P2P {
    server: socketioServer.Server;
    clients: SocketIOClient.Socket[];
    emitter: EventEmitter;
    enableDiscovery: boolean;
    oldHandler: ((payload: any) => void) | null;
    constructor(port: number, options?: Options) {
        this.server = socketioServer()
        this.server.on('connection', client => console.log('new client connected', client.id));
        this.server.listen(port);
        this.clients = []
        this.emitter = new EventEmitter;
        this.enableDiscovery = true;
        this.oldHandler = null;
        if (options && options.enableDiscovery === false) this.enableDiscovery = false;
    }

    addPeer(conn: string) {
        const socket = socketioClient(conn);
        this.clients.push(socket);
        socket.on('broadcast', (payload: any) => {
            this.emitter.emit('broadcast', payload);
        })
    }

    broadcast(message: any) {
        this.server.emit('broadcast', message);
    }

    subscribe(handler: (payload: any) => void) {
        if (this.oldHandler) this.emitter.removeListener('broadcast', this.oldHandler)
        this.emitter.on('broadcast', handler);
        this.oldHandler = handler;
    }

}