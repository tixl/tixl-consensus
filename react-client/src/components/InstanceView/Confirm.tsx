import React from 'react';
import { FBASInstance } from '../../algo/FBAS/FBASInstance';
import Pill from '../Pill';
import { instanceValueToString } from './instanceValueToString';

const Confirm: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    return <Pill className="bg-green-200 border border-green-400 text-green-800">Confirm:<span className="font-bold"> {instanceValueToString(instance.confirm)}</span></Pill>
}

export default Confirm;
