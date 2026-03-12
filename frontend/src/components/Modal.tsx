import React from 'react';
import styles from './Modal.module.css';

interface ModalButton {
  text: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary' | 'success';
  disabled?: boolean;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  buttons?: ModalButton[];
  type?: 'default' | 'success' | 'error' | 'warning';
  icon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  buttons,
  type = 'default',
  icon,
  size = 'medium'
}) => {
  if (!isOpen) return null;

  const getModalClass = () => {
    let className = `${styles.modal} ${styles[size]}`;
    if (type !== 'default') {
      className += ` ${styles[type]}`;
    }
    return className;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={getModalClass()} onClick={(e) => e.stopPropagation()}>
        {icon && <div className={styles.iconContainer}>{icon}</div>}
        
        <h3 className={styles.modalTitle}>{title}</h3>
        
        <div className={styles.modalContent}>
          {children}
        </div>
        
        {buttons && buttons.length > 0 && (
          <div className={styles.modalActions}>
            {buttons.map((button, index) => (
              <button
                key={index}
                className={`${styles.modalButton} ${styles[button.variant || 'secondary']}`}
                onClick={button.onClick}
                disabled={button.disabled}
              >
                {button.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente específico para modales de éxito
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'Aceptar'
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type="success"
      size="small"
      icon={<div className={styles.successIcon}>✓</div>}
      buttons={[
        {
          text: buttonText,
          onClick: onClose,
          variant: 'success'
        }
      ]}
    >
      <p className={styles.modalMessage}>{message}</p>
    </Modal>
  );
};

// Componente específico para modales de confirmación
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'success';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary',
  isLoading = false
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      buttons={[
        {
          text: cancelText,
          onClick: onClose,
          variant: 'secondary',
          disabled: isLoading
        },
        {
          text: isLoading ? 'Procesando...' : confirmText,
          onClick: onConfirm,
          variant: variant,
          disabled: isLoading
        }
      ]}
    >
      <div className={styles.modalMessage}>{message}</div>
    </Modal>
  );
};

// Componente específico para modales de error
interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'Cerrar'
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type="error"
      size="small"
      buttons={[
        {
          text: buttonText,
          onClick: onClose,
          variant: 'danger'
        }
      ]}
    >
      <p className={styles.modalMessage}>{message}</p>
    </Modal>
  );
};
