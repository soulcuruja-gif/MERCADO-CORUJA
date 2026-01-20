import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Elemento #root não encontrado no HTML.");
  }

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("App montado com sucesso.");
} catch (error) {
  console.error("Erro fatal na montagem do React:", error);
}