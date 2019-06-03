import { useState, useEffect } from 'react';
import { FBASInstance } from '../FBAS/FBASInstance';
import Topic from '../FBAS/Topic';
import Network from '../types/Network';
import Slices from '../FBAS/Slice';
import VoteMessage from '../FBAS/messages/VoteMessage';
import AcceptMessage from '../FBAS/messages/AcceptMessage';
import ConfirmMessage from '../FBAS/messages/ConfirmMessage';
import io from 'socket.io-client';

export const useFbas = () => {
    console.log('usefbas')
    const [instances, setInstances] = useState<FBASInstance[]>([]);
    const [messageLog, setMessageLog] = useState<any[]>([]);
    const [clientId, setClientId] = useState<string>('');
    const [socket, setSocket] = useState<SocketIOClient.Socket>();
    const [network, setNetwork] = useState<Network | null>(null);

    useEffect(() => {
        setSocket(io('http://localhost:4242'));
    }, [])

    useEffect(() => {
        socket && setNetwork(new Network((obj: any) => socket.emit('broadcast', obj)));
    }, [socket])

    useEffect(() => {
        socket && socket.emit('register', {}, ({ name }: any) => setClientId(name))
    }, [socket])

    useEffect(() => {
        if (!socket || !network) return;

        const getOrCreateInstance = (id: string) => {
            const instance = instances.find(x => x.topic.value === id);
            if (instance) return instance;
            console.log('create new for ', id, 'existing', instances)
            const newInstance = new FBASInstance(new Topic(id), clientId, Slices.fromSingleArray([id]), network);
            const newInstances = [...instances, newInstance];
            console.log('newinstances', newInstances)
            setInstances(newInstances);
            console.log('instances', instances)
            return newInstance;
        }

        socket.on('broadcast', (message: any) => {
            if (!message.type || message.origin === clientId) return;
            setMessageLog([...messageLog, message]);
            let msg;
            if (message.type === "VOTE") {
                msg = new VoteMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
            }
            if (message.type === 'ACCEPT') {
                msg = new AcceptMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
            }
            if (message.type === 'CONFIRM') {
                msg = new ConfirmMessage(message.origin, Slices.fromArray(message.slices), message.topic, message.value);
            }
            const fbas = getOrCreateInstance(message.topic.value);
            if (!fbas || !msg) return;
            fbas.receiveMessage(msg);
        });
        
        return () => { }

    }, [socket, clientId, network, instances, messageLog])

    const startNewFBAS = (topic: string) => {
        const instance = new FBASInstance(new Topic(topic), clientId, Slices.fromSingleArray([clientId]), network!);
        instance.castVote(true);
        setInstances([...instances, instance]);
    }


    return {
        instances,
        clientId,
        startNewFBAS,
    }
}