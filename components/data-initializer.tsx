'use client';

import { useEffect, useState } from 'react';
import { initializeSampleData } from '@/lib/init-data';

export function DataInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined') return;

      try {
        const wasInitialized = await initializeSampleData();
        if (wasInitialized) {
          console.log('Sample data initialized successfully');
        }
      } catch (error) {
        console.error('Error initializing data:', error);
      } finally {
        setInitialized(true);
      }
    };

    if (!initialized) {
      init();
    }
  }, [initialized]);

  return null;
}
