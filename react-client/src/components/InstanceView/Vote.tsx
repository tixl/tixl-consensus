import React, { useState } from 'react';
import { FBASInstance } from '../../algo/FBAS/FBASInstance';
import Pill from '../Pill';
import { instanceValueToString } from './instanceValueToString';
import SweetAlert from 'sweetalert-react';

const Vote: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    const [showDialog, setShowDialog] = useState(false);
    const handleClick = () => {
        setShowDialog(true);
    }
    const onConfirm = () => {
        setShowDialog(false);
        instance.castVote(true);
    }
    const onCancel = () => {
        setShowDialog(false);
        instance.castVote(false);
    }

    return (
        <>
            <SweetAlert
                show={showDialog}
                title={`Vote for topic: ${instance.topic.value}`}
                onConfirm={onConfirm}
                showCancelButton
                onCancel={onCancel}
                onClose={() => setShowDialog(false)}
                cancelButtonText="No"
                confirmButtonText="Yes"
                onOutsideClick={() => setShowDialog(false)}
            />
            <Pill onClick={handleClick}
                className="bg-orange-200 border border-orange-400 text-orange-800">
                Vote:<span className="font-bold"> {instanceValueToString(instance.vote)}</span>
            </Pill>
        </>
    );
}

export default Vote;
