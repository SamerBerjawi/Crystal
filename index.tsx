import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { IconContext } from '@phosphor-icons/react';
import RootErrorBoundary from './components/RootErrorBoundary';

// Unregister any active service worker and clear stale caches in iframe/cloud preview
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().catch(error => console.warn('Could not unregister a service worker:', error));
    }
  }).catch(error => console.warn('Could not list service workers:', error));
  if ('caches' in window) {
    caches.keys().then(names => {
      for (const name of names) {
        caches.delete(name).catch(error => console.warn('Could not delete cache', name, error));
      }
    }).catch(error => console.warn('Could not list caches:', error));
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={{ weight: 'duotone', mirrored: false }}>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </IconContext.Provider>
    </QueryClientProvider>
  </React.StrictMode>
);