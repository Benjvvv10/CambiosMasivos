'use client';

import { useEffect, useState } from 'react';

/**
 * Componente de Loading con animación de puntos
 */
export const LoadingDots = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return <span>Cargando{dots}</span>;
};

export default LoadingDots;
