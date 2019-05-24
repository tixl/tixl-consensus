import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export const useCreateSocketConnection = () => {
    const [socket, setSocket] = useState<SocketIOClient.Socket>();

    useEffect(() => {
        const _socket = io('http://localhost:4242');
        setSocket(_socket);
    }, [])

    return socket;
}