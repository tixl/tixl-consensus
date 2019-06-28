import React, { useState } from 'react';
import { useFbas } from '../hooks/useFbas';
import FbasInstanceView from './InstanceView/FbasInstanceView';
import { useClientDiscovery } from '../hooks/useClientDiscovery';
import ClientList, { Slices } from './ClientList';
import StartNewFbas from './StartNewFbas';

const FbasDisplay: React.FC = () => {
    const [slices, setSlices] = useState<Slices>([]);
    const { instances, startNewFBAS } = useFbas(slices);
    const knownClients = useClientDiscovery();

    return (
        <div>
            <ClientList clients={knownClients} setSlices={setSlices} slices={slices} />
            <StartNewFbas startNewFbasHandler={startNewFBAS}/>
            <h2 className="ml-4 text-xl font-thin">FBAS Instances</h2>
            {instances.map((instance) => <FbasInstanceView instance={instance} key={instance.topic.id} />)}

        </div>
    )
}

export default FbasDisplay;
