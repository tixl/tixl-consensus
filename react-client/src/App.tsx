import React from 'react';
import FbasDisplay from './components/FbasDisplay';
import { useSocket } from './hooks/useSocket';
import { SocketContext } from './components/SocketContext';

const App: React.FC = () => {
  const socketData = useSocket();
  console.log('render app')
  return (
    <SocketContext.Provider value={{ ...socketData }}>
      <div className="w-screen min-h-screen h-full bg-gray-200 p-8">
        <h1 className="text-3xl mb-4 font-thin">FBAS Test Client</h1>
        <FbasDisplay />
      </div>
    </SocketContext.Provider>
  );
}

export default App;
