import React, { useState, useContext } from 'react';
import { useFbas } from '../hooks/useFbas';
import FbasInstanceView from './FbasInstanceView';
import { useClientDiscovery } from '../hooks/useClientDiscovery';
import { SocketContext } from './SocketContext';
import ClientList, { Slices } from './ClientList';
import StartNewFbas from './StartNewFbas';

const FbasDisplay: React.FC<{}> = ({ }) => {
    const [slices, setSlices] = useState<Slices>([]);
    const { instances, startNewFBAS } = useFbas(slices);
    const knownClients = useClientDiscovery();

    return (
        <div>
            <ClientList clients={knownClients} setSlices={setSlices} slices={slices} />
            <StartNewFbas startNewFbasHandler={startNewFBAS}/>
            <h2>FBAS Instances</h2>
            {instances.map((instance) => <FbasInstanceView instance={instance} key={instance.topic.value} />)}

        </div>
    )
}

export default FbasDisplay;
