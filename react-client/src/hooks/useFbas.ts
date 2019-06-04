import { useState, useEffect, useContext, useMemo } from 'react';
import { FBASInstance } from '../FBAS/FBASInstance';
import Topic from '../FBAS/Topic';
import Slices from '../FBAS/Slice';
import VoteMessage from '../FBAS/messages/VoteMessage';
import AcceptMessage from '../FBAS/messages/AcceptMessage';
import ConfirmMessage from '../FBAS/messages/ConfirmMessage';
import { SocketContext, SocketContextTypes } from '../components/SocketContext';

export const useFbas = () => {
    console.log('usefbas')
    const { socket, network, clientId }: SocketContextTypes = useContext(SocketContext);
    const [instances, setInstances] = useState<FBASInstance[]>([]);
    const [messageLog, setMessageLog] = useState<any[]>([]);

    useEffect(() => {
        console.log('useEffect')
        if (!socket || !network || !clientId) return;

        const getOrCreateInstance = (id: string) => {
            const instance = instances.find(x => x.topic.value === id);
            if (instance) return instance;
            console.log('create new for ', id, 'existing', instances)
            const newInstance = new FBASInstance(new Topic(id), clientId, Slices.fromSingleArray([id]), network);
            setInstances(oldInstances => [...oldInstances, newInstance]);
            console.log('instances', instances)
            return newInstance;
        }

        const handler = (message: any) => {
            if (!message.type || message.origin === clientId) return;
            setMessageLog(oldMessages => [...oldMessages, message]);
            let msg;
            if (!["VOTE", "ACCEPT", "CONFIRMS"].includes(message.type)) return;
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
        }

        socket.on('broadcast', handler);

        return () => {
            socket.removeListener('broadcast', handler)
        }

    }, [socket, clientId, network])

    const startNewFBAS = (topic: string) => {
        if (!socket || !network || !clientId) return;
        const instance = new FBASInstance(new Topic(topic), clientId, Slices.fromSingleArray([clientId]), network!);
        instance.castVote(true);
        setInstances([...instances, instance]);
    }


    return {
        instances,
        startNewFBAS,
    }
}