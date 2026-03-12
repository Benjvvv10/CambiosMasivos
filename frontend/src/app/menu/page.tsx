/**
 * Menú Principal
 * Página que se muestra después del login para seleccionar entre módulos
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './menu.module.css';

export default function MenuPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Proteger ruta - redirigir a login si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <img src="/logo_cial.svg" alt="CIAL Alimentos" className={styles.logo} />
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.nombre}</span>
            <span className={styles.userRole}>{user.cargo}</span>
          </div>
          <button onClick={logout} className={styles.logoutButton}>
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.welcomeSection}>
          <h1>Bienvenido al Sistema CIAL</h1>
          <p>Seleccione el módulo con el que desea trabajar</p>
        </div>

        <div className={styles.menuGrid}>
          {/* Módulo Optimiza Rutas */}
          <div className={styles.menuCard}>
            <div className={styles.cardIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <h2>Optimiza Rutas</h2>
            <p> </p>
            <button 
              onClick={() => router.push('/optimiza-rutas')}
              className={styles.moduleButton}
            >
              Acceder al Módulo
            </button>
          </div>

          {/* Módulo Cambios Masivos */}
          <div className={styles.menuCard}>
            <div className={styles.cardIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <h2>Cambios Masivos</h2>
            <p> </p>
            <button 
              onClick={() => router.push('/app-Cambios-Masivos')}
              className={styles.moduleButton}
            >
              Acceder al Módulo
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
