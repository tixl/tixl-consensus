import React from 'react';
import { FBASInstance } from '../FBAS/FBASInstance';
import Pill from './Pill';

const FbasInstanceView: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    const instanceValueToString = (value: boolean | null) => {
        if (value === null) return 'n/a';
        if (value === true) return 'yes';
        else return 'false';
    }
    return (
        <div className="bg-gray-100 m-4 rounded shadow p-4 mb-2">
            <div>
                <Pill className="bg-blue-200 border border-blue-400 text-blue-800">Topic:<span className="font-bold">{instance.topic.value}</span></Pill>
                <Pill className="bg-orange-200 border border-orange-400 text-orange-800">Vote:<span className="font-bold"> {instanceValueToString(instance.vote)}</span></Pill>
                <Pill className="bg-yellow-200 border border-yellow-400 text-yellow-800">Accept: <span className="font-bold">{instanceValueToString(instance.accept)}</span></Pill>
                <Pill className="bg-green-200 border border-green-400 text-green-800">Confirm:<span className="font-bold"> {instanceValueToString(instance.confirm)}</span></Pill>
            </div>
            <div>
                <p className="text-lg inline-block mr-2">Slices:</p>
                {instance.slices.toArray().map(slice => (<Pill className="bg-blue-200 border border-blue-400 text-blue-800">{slice.join(' - ')}</Pill>))}
            </div>
        </div>
    );
}

export default FbasInstanceView;
