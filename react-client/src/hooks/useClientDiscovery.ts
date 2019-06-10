import { useState, useContext, useMemo, useEffect } from 'react';
import { SocketContext, SocketContextTypes } from '../components/SocketContext';

export const useClientDiscovery = () => {
    const { socket }: SocketContextTypes = useContext(SocketContext);
    const [knownClients, setKnownClients] = useState<string[]>([]);

    useEffect(() => {
        if (!socket) return;
        const handler = (message: any) => {
            if (message.type === 'CLIENTS') {
                setKnownClients(message.clients);
                return;
            }
        }
        socket.on('broadcast', handler);
        return () => {
            socket.removeListener('broadcast', handler)
        }
    }, [socket])

    return knownClients
}