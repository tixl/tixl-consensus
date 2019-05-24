import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export const useGetClientId = (socket?: SocketIOClient.Socket) => {
    const [clientId, setClientId] = useState<string>('');

    useEffect(() => {
        socket && socket.emit('register', {}, (ack: any) => {
            setClientId(ack.name);
        })
    }, [socket])

    return clientId;
}