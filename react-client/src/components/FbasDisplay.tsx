import React, { useState } from 'react';
import { useFbas } from '../hooks/useFbas';
import FbasInstanceView from './FbasInstanceView';
import { useClientDiscovery } from '../hooks/useClientDiscovery';

const FbasDisplay: React.FC<{}> = ({ }) => {
    const { instances, startNewFBAS } = useFbas();
    // const knownClients = useClientDiscovery();
    const [input, setInput] = useState('');
    console.log('render');
    return (
        <div>
            {/* ClientId {clientId} <br /> */}
            <input type="text" value={input} onChange={(e) => setInput(e.currentTarget.value)} />
            <button onClick={() => startNewFBAS(input)}>Start new FBAS</button>
            <br />
            <h2> Known Clients </h2>
            {/* {knownClients.map(client => <p key={client}>{client}</p>)} */}
            <h2>FBAS Instances</h2>
            {instances.map((instance) => <FbasInstanceView instance={instance} key={instance.topic.value} />)}

        </div>
    )
}

export default FbasDisplay;
