import React, { useState, useContext } from 'react';
import { useFbas } from '../hooks/useFbas';
import FbasInstanceView from './FbasInstanceView';
import { useClientDiscovery } from '../hooks/useClientDiscovery';
import { SocketContext } from './SocketContext';
import ClientList, { Slices } from './ClientList';

const FbasDisplay: React.FC<{}> = ({ }) => {
    const { instances, startNewFBAS } = useFbas();
    const { clientId } = useContext(SocketContext);
    const knownClients = useClientDiscovery();
    const [input, setInput] = useState('');
    const [slices, setSlices] = useState<Slices>([]);


    console.log('render', { input });
    return (
        <div>
            ClientId {clientId} <br />
            <input type="text" value={input} onChange={(e) => setInput(e.currentTarget.value)} />
            <button onClick={() => startNewFBAS(input)}>Start new FBAS</button>
            <br />
            <ClientList clients={knownClients} setSlices={setSlices} slices={slices} />

            <h2>FBAS Instances</h2>
            {instances.map((instance) => <FbasInstanceView instance={instance} key={instance.topic.value} />)}

        </div>
    )
}

export default FbasDisplay;
