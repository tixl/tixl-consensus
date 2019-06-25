import React from 'react';
import { FBASInstance } from '../../FBAS/FBASInstance';
import Pill from '../Pill';

const Topic: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    return <Pill className="bg-blue-200 border border-blue-400 text-blue-800">Topic:<span className="font-bold">{instance.topic.value}</span></Pill>
}

export default Topic;
