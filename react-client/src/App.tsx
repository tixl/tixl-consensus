import React from 'react';
import FbasDisplay from './components/FbasDisplay';
import { useSocket } from './hooks/useSocket';
import { SocketContext } from './components/SocketContext';

const App: React.FC = () => {
  const socketData = useSocket();
  console.log('render app')
  return (
    <SocketContext.Provider value={{ ...socketData }}>
      <div className="w-screen h-screen bg-gray-200 p-8">
        <h1 className="text-3xl mb-4">FBAS</h1>
        <FbasDisplay />
      </div>
    </SocketContext.Provider>
  );
}

export default App;
