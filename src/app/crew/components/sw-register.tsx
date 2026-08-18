'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      console.log('Attempting to register crew SW...');
      navigator.serviceWorker.register('/crew-sw.js', { scope: '/crew/' })
        .then(function(registration) {
          console.log('Crew SW registered with scope:', registration.scope);
        })
        .catch(function(error) {
          console.error('Crew SW registration failed:', error);
        });
    }
  }, []);

  return null;
}
