/**
 * Componente de Header Global
 * Header consistente para todas las páginas de la aplicación
 */

'use client';

import { ReactNode } from 'react';
import UserMenu from './UserMenu';
import styles from './Header.module.css';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  subtitleCode?: string;
  subtitleName?: string;
  subtitleDay?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  userName: string;
  userEmail: string;
  userRole: string;
  onLogout: () => void;
}

export default function Header({
  title = 'Optimización de Rutas CIAL',
  subtitle,
  subtitleCode,
  subtitleName,
  subtitleDay,
  showBackButton = false,
  onBackClick,
  userName,
  userEmail,
  userRole,
  onLogout
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          {showBackButton ? (
            <button onClick={onBackClick} className={styles.volverButton}>
              ← Volver
            </button>
          ) : (
            <div className={styles.buttonPlaceholder}></div>
          )}
          <div className={styles.headerTitles}>
            <h1>{title}</h1>
            {subtitle && <span className={styles.headerSecondary}>{subtitle}</span>}
            {(subtitleCode || subtitleName || subtitleDay) && (
              <span className={styles.headerSecondary}>
                {subtitleCode && <span className={styles.code}>{subtitleCode}</span>}
                {subtitleCode && (subtitleName || subtitleDay) && <span className={styles.separator}>•</span>}
                {subtitleName && <span className={styles.name}>{subtitleName}</span>}
                {subtitleName && subtitleDay && <span className={styles.separator}>•</span>}
                {subtitleDay && <span className={styles.day}>{subtitleDay}</span>}
              </span>
            )}
          </div>
        </div>
        <UserMenu 
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
