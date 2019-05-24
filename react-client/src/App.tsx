import React from 'react';
import FbasDisplay from './components/FbasDisplay';
import { ClientSocket } from "use-socketio";
import { useCreateSocketConnection } from './hooks/useCreateSocketConnection';

const App: React.FC = () => {
  console.log('render app')

  return (
    <div className="w-screen h-screen bg-gray-200 p-8">
      <h1 className="text-3xl mb-4">FBAS</h1>
      <FbasDisplay />
    </div>
  );
}

export default App;
