/**
 * Componente de Menú de Usuario
 * Muestra un avatar con iniciales y dropdown con opciones de usuario
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  userName: string;
  userEmail: string;
  userRole: string;
  onLogout: () => void;
}

export default function UserMenu({ userName, userEmail, userRole, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Obtener iniciales del nombre
  const getInitials = (name: string): string => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0]?.substring(0, 2).toUpperCase() || 'US';
  };

  const initials = getInitials(userName);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={styles.userMenuContainer} ref={menuRef}>
      <button 
        className={styles.avatarButton}
        onClick={toggleMenu}
        aria-label="Menú de usuario"
      >
        <div className={styles.avatar}>
          {initials}
        </div>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <div className={styles.companyName}>CIAL Alimentos</div>
            <button 
              className={styles.closeButton}
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              aria-label="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userHeader}>
              <div className={styles.avatarLarge}>
                {initials}
              </div>
              <div className={styles.userDetails}>
                <div className={styles.userName}>{userName}</div>
                <div className={styles.userEmail}>{userEmail}</div>
                <div className={styles.userRole}>{userRole}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
