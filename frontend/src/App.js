import { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  const [status, setStatus] = useState('Conectando com o backend...');

  useEffect(() => {
    fetch('https://zapmoda.onrender.com/status')
      .then((res) => res.json())
      .then((data) => setStatus(data.message))
      .catch(() => setStatus('Erro ao conectar com o backend.'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div>
          <p>Bem-vindo ao sistema WhatsApp AI 👋</p>
          <p>Status do servidor: {status}</p>
        </div>
      </header>
    </div>
  );
}

export default App;
