import React from 'react';
import { useFbas, ReturnValues } from '../hooks/useFbas';
import FbasInstanceView from './FbasInstanceView';

const Display = ({ instances, clientId }: ReturnValues) => (
    <div>
        ClientId {clientId}
        {instances.map((instance) => <FbasInstanceView instance={instance} key={instance.topic.value} />)}
    </div>
);

const FbasDisplay: React.FC<{}> = ({ }) => {
    console.log('render Fbas Display')
    const { instances, clientId } = useFbas();

    return <Display clientId={clientId} instances={instances} />
}

export default FbasDisplay;
