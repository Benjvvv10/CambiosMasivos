/**
 * Página de Recuperación de Contraseña
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as authService from '@/services/auth.service';
import styles from '../login/login.module.css';

export default function RecuperarPasswordPage() {
  const [usuario, setUsuario] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  /**
   * Manejar envío del formulario
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      // Validación básica
      if (!usuario) {
        setError('Por favor ingrese su usuario o correo electrónico');
        setIsLoading(false);
        return;
      }

      // Solicitar recuperación (puede ser usuario o email)
      const response = await authService.recoverPassword(usuario);
      
      // Mostrar éxito
      setSuccess(true);
      setEmailEnviado(response.email);
      
      // Redirigir al login después de 5 segundos
      setTimeout(() => {
        router.push('/login');
      }, 5000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al recuperar contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <img src="/logo_cial.svg" alt="CIAL Alimentos" className={styles.logo} />
        
        <div className={styles.header}>
          <h1>Recuperar Contraseña</h1>
          <p className={styles.subtitle}>
            Ingrese su usuario o correo electrónico para recibir una contraseña temporal
          </p>
        </div>

        {success ? (
          <div className={styles.success} style={{ 
            backgroundColor: '#e8f5ea', 
            padding: '20px', 
            borderRadius: '8px', 
            borderLeft: '4px solid #2d7a3e',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <p style={{ fontWeight: 600, color: '#2d7a3e', marginBottom: '10px', fontSize: '16px' }}>
              Contraseña temporal enviada
            </p>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Se ha enviado una contraseña temporal a: <strong>{emailEnviado}</strong>
            </p>
            <p style={{ fontSize: '13px', color: '#666', marginTop: '10px' }}>
              Revisa tu correo y luego inicia sesión. Redirigiendo...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="usuario">Usuario o correo electrónico</label>
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ingrese su usuario o correo electrónico"
                disabled={isLoading}
                autoComplete="username"
                autoFocus
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
              {isLoading ? 'Enviando...' : 'Enviar Contraseña Temporal'}
            </button>
          </form>
        )}

        <div className={styles.footer} style={{ marginTop: '20px', textAlign: 'center' }}>
          <button 
            onClick={() => router.push('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '8px'
            }}
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}
