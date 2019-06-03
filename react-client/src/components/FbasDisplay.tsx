import React, { useState } from 'react';
import { useFbas } from '../hooks/useFbas';
import FbasInstanceView from './FbasInstanceView';

const FbasDisplay: React.FC<{}> = ({ }) => {
    const { instances, clientId, startNewFBAS } = useFbas();
    const [input, setInput] = useState('');
    return (
        <div>
            ClientId {clientId} <br />
            <input type="text" value={input} onChange={(e) => setInput(e.currentTarget.value)} />
            <button onClick={() => startNewFBAS(input)}>Start new FBAS</button>
            <br />
            {instances.map((instance) => <FbasInstanceView instance={instance} key={instance.topic.value} />)}
        </div>
    )
}

export default FbasDisplay;
