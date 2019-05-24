import React from 'react';
import { FBASInstance } from '../FBAS/FBASInstance';

const FbasInstanceView: React.FC<{ instance: FBASInstance }> = ({ instance }) => {
    return (
        <div className="border border-color-gray-400 p-4">
            Topic: {instance.topic.value}
        </div>
    );
}

export default FbasInstanceView;
