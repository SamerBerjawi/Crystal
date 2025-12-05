export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const isProduction = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD);
  if (typeof window === 'undefined' || !isProduction) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = new URL('./service-worker.ts', import.meta.url);
    navigator.serviceWorker
      .register(swUrl, { type: 'module' })
      .catch(error => {
        console.error('Service worker registration failed:', error);
      });
  });
}
