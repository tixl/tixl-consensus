import Pill from '../Pill';
import Quorum from '../../algo/FBAS/Quorum';
import React from 'react';
import { arrayToString } from './arrayToString';
import { FBASInstance } from '../../algo/FBAS/FBASInstance';

const ConfirmedBy: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    return instance.confirmQuorum !== null ? (
        <Pill className="bg-green-200 border border-green-400 text-green-800">
            Confirmed By:&nbsp;
                <span className="font-bold">
                Quorum {arrayToString(Array.from((instance.confirmQuorum as Quorum).nodes))}
            </span>
        </Pill>)
        : <div />
}

export default ConfirmedBy;
