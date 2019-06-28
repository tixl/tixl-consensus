import { useState, useEffect } from 'react';
import Network from '../algo/common/Network';
import io from 'socket.io-client';

export const useSocket = () => {
    const [clientId, setClientId] = useState<string | null>(null);
    const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
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

    return {
        clientId,
        socket,
        network
    }
}