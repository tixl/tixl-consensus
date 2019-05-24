import { useState, useEffect } from 'react';
import { FBASInstance } from '../FBAS/FBASInstance';
import Topic from '../FBAS/Topic';
import Network from '../types/Network';
import Slices from '../FBAS/Slice';
import VoteMessage from '../FBAS/messages/VoteMessage';
import AcceptMessage from '../FBAS/messages/AcceptMessage';
import ConfirmMessage from '../FBAS/messages/ConfirmMessage';
import io from 'socket.io-client';

export interface ReturnValues {
    instances: FBASInstance[],
    clientId: string;
}

export const useFbas = (): ReturnValues => {
    const [instances, setInstances] = useState<FBASInstance[]>([]);
    const [messageLog, setMessageLog] = useState<any[]>([]);
    console.log('use fbas')


    const [clientId, setClientId] = useState<string>('');

    const [socket, setSocket] = useState<SocketIOClient.Socket>();

    useEffect(() => {
        console.log('use fbas socket effect')
        const _socket = io('http://localhost:4242');
        setSocket(_socket);
    }, [])


    useEffect(() => {
        console.log('use fbas effect')
        if (!socket) return;

        socket && socket.emit('register', {}, (ack: any) => {
            setClientId(ack.name);
        })

        const network = new Network((obj: any) => socket.emit('broadcast', obj));

        const getOrCreateInstance = (id: string) => {
            const instance = instances.find(x => x.topic.value === id);
            if (instance) return instance;
            const newInstance = new FBASInstance(new Topic(id), clientId, new Slices(), network);
            const newInstances = [...instances, newInstance];
            setInstances(newInstances);
            return newInstance;
        }

        socket.on('broadcast', (message: any) => {
            if (!message.type) {
                return;
            }
            console.log(message)
            // if (message.origin === id) {
            //     log('message from me, skipping')
            //     return;
            // }
            if (message.type === "VOTE") {
                const voteMsg = new VoteMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
                const fbas = getOrCreateInstance(message.topic.value);
                fbas.receiveMessage(voteMsg);
            }
            if (message.type === 'ACCEPT') {
                const acceptMsg = new AcceptMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
                const fbas = getOrCreateInstance(message.topic.value);
                fbas.receiveMessage(acceptMsg);
            }
            if (message.type === 'CONFIRM') {
                const confirmMsg = new ConfirmMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
                const fbas = getOrCreateInstance(message.topic.value);
                fbas.receiveMessage(confirmMsg);
            }
        });
    }, [socket])



    return {
        instances,
        clientId
    }
}