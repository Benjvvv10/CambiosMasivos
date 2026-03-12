/**
 * Página principal - Redirige a login o dashboard según autenticación
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingDots from '@/components/LoadingDots';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // Si estamos en localhost, redirigir a admin directamente
      if (typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname === '::1')) {
        router.push('/admin');
        return;
      }
      
      // Para otros hosts, comportamiento normal
      if (isAuthenticated) {
        router.push('/menu');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Mostrar cargando mientras se verifica autenticación
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column' as const,
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      gap: '1.2rem',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '4px solid #e0e0e0',
        borderTopColor: '#2d7a3e',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#555', fontSize: '1.1rem', fontWeight: 500 }}><LoadingDots /></p>
    </div>
  );
}
