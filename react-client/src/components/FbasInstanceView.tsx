import React from 'react';
import { FBASInstance } from '../FBAS/FBASInstance';

const FbasInstanceView: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    const instanceValueToString = (value: boolean | null) => {
        if (value === null) return 'n/a';
        if (value === true) return 'yes';
        else return 'false';
    }
    return (
        <div className="border border-color-gray-400 p-4">
            Topic: {instance.topic.value} <br />
            Vote: {instanceValueToString(instance.vote)} <br />
            Accept: {instanceValueToString(instance.accept)} <br />
            Confirm: {instanceValueToString(instance.confirm)} <br />
            Slices: {instance.slices.toArray()}
        </div>
    );
}

export default FbasInstanceView;
