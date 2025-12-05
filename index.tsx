import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: The error "Module './App' has no exported member 'App'" indicates that App.tsx is using a default export.
// Changed to a default import to match.
import App from './App';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);