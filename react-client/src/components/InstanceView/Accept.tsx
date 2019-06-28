import React from 'react';
import { FBASInstance } from '../../algo/FBAS/FBASInstance';
import Pill from '../Pill';
import { instanceValueToString } from './instanceValueToString';

const Accept: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    return <Pill className="bg-yellow-200 border border-yellow-400 text-yellow-800">Accept: <span className="font-bold">{instanceValueToString(instance.accept)}</span></Pill>
}

export default Accept;
