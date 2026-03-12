/**
 * Módulo de Cambios Masivos
 * Página principal para realizar cambios masivos en el sistema
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Cookies from 'js-cookie';
import styles from './cambios-masivos.module.css';
import UserMenu from '@/components/UserMenu';
import { getApiUrl } from '@/utils/api-url';

export default function CambiosMasivosPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [esPendienteValidacion, setEsPendienteValidacion] = useState(false);
  const [esEstructuraValidada, setEsEstructuraValidada] = useState(false);
  const [esPendienteValidacionCartera, setEsPendienteValidacionCartera] = useState(false);
  const [esCarteraValidada, setEsCarteraValidada] = useState(false);
  const [cambiosMasivosActivo, setCambiosMasivosActivo] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingEstructura, setLoadingEstructura] = useState(true);
  const [loadingCartera, setLoadingCartera] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showConfirmModalCartera, setShowConfirmModalCartera] = useState(false);

  // Proteger ruta - redirigir a login si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Verificar estado de Cambios Masivos (activo/desactivado)
  useEffect(() => {
    const verificarEstadoCambiosMasivos = async () => {
      try {
        const token = Cookies.get('auth_token');
        const API_URL = getApiUrl();
        
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/api/config/cambios-masivos-status`, {
          headers
        });

        if (response.ok) {
          const data = await response.json();
          setCambiosMasivosActivo(data.app_activa);
        }
      } catch (error) {
        console.error('Error al verificar estado de Cambios Masivos:', error);
      } finally {
        setLoadingConfig(false);
      }
    };

    if (isAuthenticated) {
      verificarEstadoCambiosMasivos();
      
      // Verificar cada 30 segundos para actualizar en tiempo real
      const interval = setInterval(verificarEstadoCambiosMasivos, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Verificar estado de validación pendiente
  useEffect(() => {
    const verificarEstadoPendiente = async () => {
      try {
        const token = Cookies.get('auth_token');
        if (!token) return;

        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/api/estructura-venta/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const esPendiente = data.es_pendiente_validacion || false;
          setEsPendienteValidacion(esPendiente);
          setEsEstructuraValidada(data.esta_validado || false);
        }
      } catch (error) {
        console.error('Error al verificar estado pendiente:', error);
      } finally {
        setLoadingEstructura(false);
      }
    };

    if (isAuthenticated) {
      verificarEstadoPendiente();
      
      // Verificar cada 60 segundos para actualizar en tiempo real
      const interval = setInterval(verificarEstadoPendiente, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Verificar estado de validación de Carteras
  useEffect(() => {
    const verificarEstadoCartera = async () => {
      try {
        const token = Cookies.get('auth_token');
        if (!token) return;

        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/api/carteras/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const esPendiente = data.es_pendiente_validacion || false;
          const estaValidado = data.esta_validado || false;
          setEsPendienteValidacionCartera(esPendiente);
          setEsCarteraValidada(estaValidado);
        }
      } catch (error) {
        console.error('Error al verificar estado de cartera:', error);
      } finally {
        setLoadingCartera(false);
      }
    };

    if (isAuthenticated) {
      verificarEstadoCartera();
      
      // Verificar cada 60 segundos para actualizar en tiempo real
      const interval = setInterval(verificarEstadoCartera, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (isLoading || loadingConfig) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Cargando Cambios Masivos...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleBackToMenu = () => {
    router.push('/menu');
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleAccederEstructuraVenta = () => {
    if (esEstructuraValidada) {
      // Si ya está validada, mostrar modal de confirmación
      setShowConfirmModal(true);
    } else {
      // Si no está validada, navegar directamente
      router.push('/app-Cambios-Masivos/estructura-venta');
    }
  };

  const handleConfirmarAcceso = () => {
    setShowConfirmModal(false);
    router.push('/app-Cambios-Masivos/estructura-venta');
  };

  const handleCancelarAcceso = () => {
    setShowConfirmModal(false);
  };

  const handleAccederCarteras = () => {
    if (esCarteraValidada) {
      // Si ya está validada, mostrar modal de confirmación
      setShowConfirmModalCartera(true);
    } else {
      // Si no está validada, navegar directamente
      router.push('/app-Cambios-Masivos/carteras');
    }
  };

  const handleConfirmarAccesoCartera = () => {
    setShowConfirmModalCartera(false);
    router.push('/app-Cambios-Masivos/carteras');
  };

  const handleCancelarAccesoCartera = () => {
    setShowConfirmModalCartera(false);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button onClick={handleBackToMenu} className={styles.backButton}>
              ← Volver
            </button>
          </div>
          <UserMenu
            userName={user.nombre}
            userEmail={user.email || ''}
            userRole={user.cargo}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.welcomeCard}>
          <div>
            <h2>Cambios Masivos</h2>
            <p>Configure la estructura de ventas antes de proceder con los cambios masivos</p>
          </div>
        </div>

        {/* Menú de Opciones */}
        <div className={styles.menuGrid}>
          {/* Opción 1: Administrar Dotación - Siempre visible */}
          <div className={styles.menuCard}>
            <div className={styles.cardIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                <path d="M15 11h6"/>
                <path d="M18 8v6"/>
              </svg>
            </div>
            <h3>Administrar Dotación</h3>
            <p>Gestión completa de vendedores: edición masiva de datos personales, contacto y uniformes</p>
            <button 
              onClick={() => router.push('/app-Cambios-Masivos/administrar-dotacion')}
              className={styles.moduleButton}
            >
              Acceder
            </button>
          </div>

          {/* Opción 2: Estructura de Venta - Solo mostrar si está activo */}
          {cambiosMasivosActivo && (
            <div className={styles.menuCard} style={{ position: 'relative' }}>
              {loadingEstructura ? (
                <div className={styles.loadingBadgeCard}>
                  <span className={styles.loadingBadgeSpinner}></span>
                  CARGANDO...
                </div>
              ) : esEstructuraValidada ? (
                <div className={styles.validatedBadgeCard}>
                  ESTRUCTURA VALIDADA
                </div>
              ) : esPendienteValidacion ? (
                <div className={styles.pendingBadgeCard}>
                  VALIDACIÓN PENDIENTE
                </div>
              ) : null}
              <div className={styles.cardIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="M18 17V9"/>
                  <path d="M13 17V5"/>
                  <path d="M8 17v-3"/>
                </svg>
              </div>
              <h3>Estructura de Venta</h3>
              <p>Carga y gestión de la estructura organizacional: vendedores, distritos y oficinas</p>
              <button 
                onClick={handleAccederEstructuraVenta}
                className={styles.moduleButton}
              >
                Acceder
              </button>
            </div>
          )}

          {/* Opción 3: Carteras - Solo mostrar si está activo */}
          {cambiosMasivosActivo && (
            <div className={styles.menuCard} style={{ 
              position: 'relative',
              opacity: (loadingCartera || loadingEstructura) ? 1 : esEstructuraValidada ? 1 : 0.6,
              pointerEvents: (loadingCartera || loadingEstructura) ? 'none' : esEstructuraValidada ? 'auto' : 'none'
            }}>
              {/* Badge de estado - Prioridad: CARGANDO > BLOQUEADO > VALIDADA > PENDIENTE */}
              {loadingCartera || loadingEstructura ? (
                <div className={styles.loadingBadgeCard}>
                  <span className={styles.loadingBadgeSpinner}></span>
                  CARGANDO...
                </div>
              ) : !esEstructuraValidada ? (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  zIndex: 1
                }}>
                  BLOQUEADO
                </div>
              ) : esCarteraValidada ? (
                <div className={styles.validatedBadgeCard}>
                  CARTERA VALIDADA
                </div>
              ) : esPendienteValidacionCartera ? (
                <div className={styles.pendingBadgeCard}>
                  VALIDACIÓN PENDIENTE
                </div>
              ) : null}
              <div className={styles.cardIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <h3>Carteras</h3>
              <p>
                {esEstructuraValidada 
                  ? "Gestión y asignación de carteras de clientes para los vendedores"
                  : "Requiere validación de la Estructura de Venta para acceder"
                }
              </p>
              <button 
                onClick={() => esEstructuraValidada && handleAccederCarteras()}
                className={styles.moduleButton}
                disabled={!esEstructuraValidada}
                style={{
                  cursor: esEstructuraValidada ? 'pointer' : 'not-allowed',
                  opacity: esEstructuraValidada ? 1 : 0.5
                }}
              >
                {esEstructuraValidada ? 'Acceder' : 'Bloqueado'}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #eee'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '1rem'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem' }}>
                Estructura Validada
              </h2>
            </div>
            
            <p style={{ 
              margin: '0 0 2rem 0', 
              color: '#666',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}>
              Tu estructura de venta ya está validada. ¿Estás seguro que quieres volver a ingresar? Cualquier cambio requerirá una nueva validación.
            </p>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={handleCancelarAcceso}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid #ddd',
                  background: 'white',
                  color: '#666',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#999';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#ddd';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAcceso}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
                }}
              >
                Sí, ingresar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Carteras */}
      {showConfirmModalCartera && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #eee'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '1rem'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem' }}>
                Cartera Validada
              </h2>
            </div>
            
            <p style={{ 
              margin: '0 0 2rem 0', 
              color: '#666',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}>
              Tu cartera de clientes ya está validada. ¿Estás seguro que quieres volver a ingresar? Cualquier cambio requerirá una nueva validación.
            </p>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={handleCancelarAccesoCartera}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid #ddd',
                  background: 'white',
                  color: '#666',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#999';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#ddd';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAccesoCartera}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
                }}
              >
                Sí, ingresar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
