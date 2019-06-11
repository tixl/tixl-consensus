import React, { useState } from 'react';

interface Props {
    startNewFbasHandler: (topic: string) => void;
}

const StartNewFbas: React.FC<Props> = ({ startNewFbasHandler }) => {
    const [topic, setTopic] = useState('');

    const handleButton = () => {
        startNewFbasHandler(topic);
        setTopic('');
    }

    return (
        <div className="bg-gray-100 m-4 rounded shadow p-4">
            <p className="mr-4">Start new FBAS</p>
            <input className="p-2 h-8 rounded border border-blue-300 mr-4"
                type="text" placeholder="Topic" value={topic}
                onChange={(e) => setTopic(e.currentTarget.value)} />
            <button className="bg-blue-300 px-2 rounded border-blue-400 border"
                onClick={handleButton}>Start</button>
        </div>
    )
};

export default StartNewFbas;