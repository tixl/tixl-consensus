import React from 'react';
import { FBASInstance } from '../../FBAS/FBASInstance';
import Pill from '../Pill';
import Quorum from '../../FBAS/Quorum';
import { arrayToString } from './arrayToString';

const AcceptedBy: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    return instance.acceptQuorum !== null ? (
        <Pill className="bg-yellow-200 border border-yellow-400 text-yellow-800">
            Accepted By:&nbsp;
            {instance.acceptQuorum.type === 'BLOCKINGSET' && (
                <span className="font-bold">
                    Blocking Set {arrayToString(instance.acceptQuorum.value as string[][])}
                </span>
            )}
            {instance.acceptQuorum.type === 'QUORUM' && (
                <span className="font-bold">
                    Quorum {arrayToString(Array.from((instance.acceptQuorum.value as Quorum).nodes))}
                </span>
            )}
        </Pill>)
        : <div />
}

export default AcceptedBy;
