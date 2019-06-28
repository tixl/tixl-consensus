import React from 'react';
import { FBASInstance } from '../../algo/FBAS/FBASInstance';
import Pill from '../Pill';
import Topic from './Topic';
import Vote from './Vote';
import Confirm from './Confirm';
import Accept from './Accept';
import AcceptedBy from './AcceptedBy';
import ConfirmedBy from './ConfirmedBy';
import classnames from 'classnames'

const FbasInstanceView: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    let bgColor = 'bg-gray-100';
    if (instance.confirm === true) bgColor = 'bg-green-200';
    if (instance.confirm === false) bgColor = 'bg-red-200';

    return (
        <div className={classnames('m-4 rounded shadow p-4 mb-2 ', bgColor)}>
            <div className="mb-2">
                <Topic instance={instance} />
                <Vote instance={instance} />
                <Accept instance={instance} />
                <Confirm instance={instance} />
            </div>
            <div className="mb-2">
                <AcceptedBy instance={instance} />
                <ConfirmedBy instance={instance} />
            </div>
            <div>
                <p className="inline-block mr-2 text-sm font-light">Slices for this instance:</p>
                {instance.slices.toArray().map(slice => (<Pill className="bg-blue-200 border border-blue-400 text-blue-800">{slice.join(' - ')}</Pill>))}
            </div>
        </div>
    );
}

export default FbasInstanceView;
