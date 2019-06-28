import {createContext} from 'react';
import Network from '../algo/common/Network';

export interface SocketContextTypes {
    socket: SocketIOClient.Socket | null;
    network: Network | null;
    clientId: string | null;
}

export const SocketContext = createContext<SocketContextTypes>({
    socket: null,
    network: null,
    clientId: null,
})