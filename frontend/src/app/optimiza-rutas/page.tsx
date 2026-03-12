/**
 * Redirección a Dashboard de Optimiza Rutas
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OptimizaRutasPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/optimiza-rutas/dashboard');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <p>Redirigiendo...</p>
    </div>
  );
}
