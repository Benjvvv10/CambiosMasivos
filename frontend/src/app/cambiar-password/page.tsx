/**
 * Página de Cambio Obligatorio de Contraseña
 * Se muestra cuando el usuario debe cambiar su contraseña por primera vez
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as authService from '@/services/auth.service';
import styles from './cambiar-password.module.css';

export default function CambiarPasswordPage() {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  /**
   * Validar fortaleza de contraseña
   */
  const validarPassword = (password: string): { valida: boolean; mensaje: string } => {
    if (password.length < 8) {
      return { valida: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' };
    }
    
    if (!/[A-Z]/.test(password)) {
      return { valida: false, mensaje: 'Debe contener al menos una letra mayúscula' };
    }
    
    if (!/[a-z]/.test(password)) {
      return { valida: false, mensaje: 'Debe contener al menos una letra minúscula' };
    }
    
    if (!/[0-9]/.test(password)) {
      return { valida: false, mensaje: 'Debe contener al menos un número' };
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valida: false, mensaje: 'Debe contener al menos un carácter especial (!@#$%^&*...)' };
    }
    
    return { valida: true, mensaje: '' };
  };

  /**
   * Manejar envío del formulario
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validaciones básicas
      if (!nuevaPassword || !confirmarPassword) {
        setError('Todos los campos son requeridos');
        setIsLoading(false);
        return;
      }

      // Validar que las contraseñas nuevas coincidan
      if (nuevaPassword !== confirmarPassword) {
        setError('Las contraseñas nuevas no coinciden');
        setIsLoading(false);
        return;
      }

      // Validar fortaleza de la nueva contraseña
      const validacion = validarPassword(nuevaPassword);
      if (!validacion.valida) {
        setError(validacion.mensaje);
        setIsLoading(false);
        return;
      }

      // Cambiar contraseña
      await authService.changePassword(nuevaPassword);
      
      // Mostrar mensaje de éxito
      setSuccess(true);
      
      // Redirigir automáticamente después de 3 segundos
      setTimeout(async () => {
        await logout();
        router.push('/login');
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.changeBox}>
        <img src="/logo_cial.svg" alt="CIAL Alimentos" className={styles.logo} />
        
        <div className={styles.header}>
          <h1>Cambio de Contraseña Obligatorio</h1>
          <p className={styles.subtitle}>
            Por seguridad, debe cambiar su contraseña antes de continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Nueva Contraseña */}
          <div className={styles.formGroup}>
            <label htmlFor="nuevaPassword">Nueva Contraseña</label>
            <input
              id="nuevaPassword"
              type="password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Ingrese su nueva contraseña"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          {/* Confirmar Nueva Contraseña */}
          <div className={styles.formGroup}>
            <label htmlFor="confirmarPassword">Confirmar Nueva Contraseña</label>
            <input
              id="confirmarPassword"
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="Confirme su nueva contraseña"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          {/* Requisitos de seguridad o mensaje de éxito */}
          {success ? (
            <div className={styles.success}>
              <p className={styles.successTitle}>✅ Contraseña cambiada exitosamente</p>
              <p className={styles.successMessage}>Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <div className={styles.requirements}>
              <p className={styles.requirementsTitle}>Requisitos de seguridad:</p>
              <ul>
                <li>Mínimo 8 caracteres</li>
                <li>Al menos una letra mayúscula</li>
                <li>Al menos una letra minúscula</li>
                <li>Al menos un número</li>
                <li>Al menos un carácter especial (!@#$%^&*...)</li>
              </ul>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading || success}
          >
            {isLoading ? 'Cambiando contraseña...' : success ? 'Redirigiendo...' : 'Cambiar Contraseña'}
          </button>
        </form>

        <div className={styles.footer}>
          <button onClick={logout} className={styles.cancelButton}>
            Cancelar y Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
