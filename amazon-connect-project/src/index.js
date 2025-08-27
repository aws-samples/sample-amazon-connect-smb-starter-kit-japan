// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// React 18の新しい書き方
const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
