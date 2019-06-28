import { useState, useEffect, useContext } from 'react';
import { FBASInstance } from '../algo/FBAS/FBASInstance';
import Topic from '../algo/FBAS/Topic';
import Slices from '../algo/common/Slices';
import { Slices as UiSlices } from '../components/ClientList';
import VoteMessage from '../algo/FBAS/messages/VoteMessage';
import AcceptMessage from '../algo/FBAS/messages/AcceptMessage';
import ConfirmMessage from '../algo/FBAS/messages/ConfirmMessage';
import { SocketContext, SocketContextTypes } from '../components/SocketContext';

export const useFbas = (slices: UiSlices) => {
    console.log('usefbas')
    const { socket, network, clientId }: SocketContextTypes = useContext(SocketContext);
    const [instances, setInstances] = useState<FBASInstance[]>([]);
    // const [messageLog, setMessageLog] = useState<any[]>([]);

    const transformSlices = (slices: UiSlices): Slices => {
        const transformed = slices.map(slice => {
            const inSlice = [];
            for (let [node, value] of slice) {
                if (value === true) inSlice.push(node);
            }
            return inSlice;
        })
        return Slices.fromArray(transformed);
    }

    useEffect(() => {
        console.log('useEffect')
        if (!socket || !network || !clientId) return;

        const instanceSlices = transformSlices(slices);

        const getOrCreateInstance = (id: string) => {
            const instance = instances.find(x => x.topic.value === id);
            if (instance) return instance;
            console.log('create new for ', id, 'existing', instances)
            const newInstance = new FBASInstance(new Topic({ id }), clientId, instanceSlices, network);
            setInstances(oldInstances => [...oldInstances, newInstance]);
            console.log('instances', instances)
            return newInstance;
        }

        const handler = (message: any) => {
            if (!message.type || message.origin === clientId) return;
            // setMessageLog(oldMessages => [...oldMessages, message]);
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

    }, [socket, clientId, network, instances, slices])

    const startNewFBAS = (topic: string) => {
        if (!socket || !network || !clientId) return;
        const instance = new FBASInstance(new Topic({ id: topic }), clientId, transformSlices(slices), network!);
        instance.castVote(true);
        setInstances([...instances, instance]);
    }


    return {
        instances,
        startNewFBAS,
    }
}