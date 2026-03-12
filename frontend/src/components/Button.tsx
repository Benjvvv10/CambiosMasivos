/**
 * Componente Button reutilizable
 * Proporciona botones con estilos consistentes en toda la aplicación
 */

import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 
  | 'primary'      // Verde principal (Validar Rutas)
  | 'secondary'    // Verde outline (Exportar Documento)
  | 'confirm'      // Azul (Confirmar, Guardar Ruta)
  | 'calculate'    // Celeste (Calcular Ruta)
  | 'danger'       // Rojo (Restablecer)
  | 'cancel'       // Gris (Cancelar, Cerrar)
  | 'ghost';       // Transparente con borde

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const buttonClasses = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
    isLoading ? styles.loading : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className={styles.loadingContent}>
          <span className={styles.spinner}></span>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
