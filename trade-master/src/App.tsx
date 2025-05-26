import React from 'react';
import logo from './logo.svg';
import './App.css';
import TradeAnalysis from './TradeAnalysis';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <img src={logo} className="App-logo" alt="logo" />
          <h1>TradeMaster</h1>
          <p>Profesjonalna analiza transakcji handlowych</p>
        </div>
      </header>
      <main className="main-content">
        <TradeAnalysis />
      </main>
    </div>
  );
}

export default App;
