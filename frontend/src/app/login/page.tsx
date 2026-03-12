/**
 * Página de Login
 */

'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './login.module.css';

export default function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Si estamos en localhost, redirigir automáticamente a menu
  useEffect(() => {
    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname === '::1')) {
      router.push('/menu');
    }
  }, [router]);

  /**
   * Manejar envío del formulario
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validaciones básicas
      if (!usuario || !password) {
        setError('Por favor ingrese usuario y contraseña');
        setIsLoading(false);
        return;
      }

      // Intentar login
      await login({ usuario, password });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <img src="/logo_cial.svg" alt="CIAL Alimentos" className={styles.logo} />
        <div className={styles.header}>
          <h1>Sistema CIAL</h1>
          <p className={styles.subtitle}>Ingrese sus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="usuario">Usuario o Correo Electrónico</label>
            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingrese su usuario o correo electrónico"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button
              type="button"
              onClick={() => router.push('/recuperar-password')}
              className={styles.forgotPassword}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>

        <div className={styles.footer}>
          <p>Versión 1.0.0</p>
        </div>
      </div>
    </div>
  );
}
