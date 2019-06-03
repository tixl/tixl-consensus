import React from 'react';
import FbasDisplay from './components/FbasDisplay';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-gray-200 p-8">
      <h1 className="text-3xl mb-4">FBAS</h1>
      <FbasDisplay />
    </div>
  );
}

export default App;
