/**
 * Carteras - Gestión y asignación de carteras de clientes
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './carteras.module.css';
import Cookies from 'js-cookie';
import { ModalDetalleValidacion } from '@/components/ModalDetalleValidacion';
import UserMenu from '@/components/UserMenu';
import InstructivoModal from '@/components/InstructivoModal';
import { getApiUrl } from '@/utils/api-url';

interface ClienteCartera {
  CodDistrito: string;
  DesDistrito: string;
  CodVend: number;
  NombreVend: string;
  CodCliente: number;
  RutCliente: string;
  RazonSocial: string;
  TipoNeg: string;
  Relev: number;
  NivPrecio: string;
  Direccion: string;
  Comuna: string;
}

interface CarteraData {
  clientes: ClienteCartera[];
  metadata: {
    total_clientes: number;
    total_vendedores: number;
    total_gestores: number;
    total_distritos: number;
    total_comunas: number;
    user_role: string;
    user_zonas: string[];
    tipos_negocio: { [key: string]: number };
    niveles_precio: { [key: string]: number };
    filename: string;
    es_pendiente_validacion?: boolean;
    esta_validado?: boolean;
    zona_seleccionada?: string | null;
  };
}

export default function CarterasPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  
  const [carteraData, setCarteraData] = useState<CarteraData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string>('');
  const [showInstructivo, setShowInstructivo] = useState(false);
  
  // Estados para la subida de archivos
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [validacionesDetalle, setValidacionesDetalle] = useState<Array<{nombre: string, estado: string, mensaje: string, detalle_completo?: any}>>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Estados para el modal de detalles
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalDetalleTipo, setModalDetalleTipo] = useState<'jefes_con_clientes' | 'vendedores_reemplazo' | 'jefes_sin_cartera' | 'otro'>('otro');
  const [modalDetalleTitulo, setModalDetalleTitulo] = useState('');
  const [modalDetalleDatos, setModalDetalleDatos] = useState<any>(null);

  // Estado para validación final
  const [isValidatingFinal, setIsValidatingFinal] = useState(false);
  const [canValidate, setCanValidate] = useState(false);
  const [isReValidating, setIsReValidating] = useState(false);

  // Modal de confirmación de validación
  const [modalConfirmarValidarOpen, setModalConfirmarValidarOpen] = useState(false);

  // Estado para mostrar opciones de Validar Cartera
  const [showValidarOptions, setShowValidarOptions] = useState(false);

  // Estados para zonas múltiples
  const [userZonas, setUserZonas] = useState<string[]>([]);
  const [selectedZona, setSelectedZona] = useState<string | null>(null);
  const [zonasValidadas, setZonasValidadas] = useState<Record<string, {validado: boolean; fecha_validacion: string|null}>>({});
  const [zonasNombres, setZonasNombres] = useState<Record<string, string>>({});

  // Estado para modal de éxito tras validación
  const [showValidacionExitosa, setShowValidacionExitosa] = useState(false);
  const [validacionExitosaFecha, setValidacionExitosaFecha] = useState('');

  // Proteger ruta - redirigir a login si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Verificar si Cambios Masivos está activo, si no redirigir al menú
  useEffect(() => {
    const verificarAcceso = async () => {
      try {
        const token = Cookies.get('auth_token');
        const API_URL = getApiUrl();
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`${API_URL}/api/config/cambios-masivos-status`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (!data.app_activa) {
            router.push('/app-Cambios-Masivos');
          }
        }
      } catch (error) {
        console.error('Error al verificar estado de Cambios Masivos:', error);
      }
    };
    if (isAuthenticated) {
      verificarAcceso();
    }
  }, [isAuthenticated, router]);

  // Cargar datos de carteras al montar el componente (sin zona para obtener user_zonas)
  useEffect(() => {
    if (isAuthenticated && user) {
      cargarDatosCarteras();
    }
  }, [isAuthenticated, user]);

  // Recargar al cambiar la zona seleccionada
  useEffect(() => {
    if (isAuthenticated && user && selectedZona !== null) {
      // Limpiar estado de validación/subida de la zona anterior
      setUploadSuccess('');
      setUploadError('');
      setUploadWarnings([]);
      setValidacionesDetalle([]);
      setCanValidate(false);
      setSelectedFile(null);
      setShowValidarOptions(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      cargarDatosCarteras(selectedZona);
      cargarEstadoValidacionZonas();
    }
  }, [selectedZona]);

  const cargarDatosCarteras = async (zona?: string | null) => {
    setIsLoadingData(true);
    setError('');
    
    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = zona
        ? `${API_URL}/api/carteras/cargar?zona=${encodeURIComponent(zona)}`
        : `${API_URL}/api/carteras/cargar`;

      const response = await fetch(url, { headers });

      if (response.ok) {
        const data: CarteraData = await response.json();
        setCarteraData(data);
        // Construir mapa de nombres de zonas desde los clientes
        const nombresMap: Record<string, string> = {};
        for (const cliente of data.clientes) {
          if (cliente.CodDistrito && cliente.DesDistrito) {
            nombresMap[cliente.CodDistrito] = cliente.DesDistrito;
          }
        }
        if (Object.keys(nombresMap).length > 0) {
          setZonasNombres(prev => ({ ...prev, ...nombresMap }));
        }
        // En la primera carga (sin zona), extraer y guardar las zonas del usuario
        if (!zona && data.metadata.user_zonas?.length > 0) {
          setUserZonas(data.metadata.user_zonas);
          setSelectedZona(data.metadata.user_zonas[0]);
          // El cambio de selectedZona dispara el useEffect de zona
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error al cargar datos de carteras');
      }
    } catch (error) {
      console.error('Error al cargar carteras:', error);
      setError('Error de conexión al cargar datos');
    } finally {
      setIsLoadingData(false);
    }
  };

  const cargarEstadoValidacionZonas = async () => {
    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/carteras/estado-validacion-zonas`, { headers });
      if (response.ok) {
        const data = await response.json();
        setZonasValidadas(data.estados || {});
      }
    } catch (err) {
      console.error('Error al cargar estado de validación de zonas:', err);
    }
  };


  if (isLoading || (isLoadingData && !carteraData)) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Cargando Carteras...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleBackToCambiosMasivos = () => {
    router.push('/app-Cambios-Masivos');
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDescargarExcel = async () => {
    try {
      if (!carteraData || carteraData.clientes.length === 0) {
        alert('No hay datos para descargar');
        return;
      }

      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      // Enviar los datos filtrados que ya tiene el frontend
      const response = await fetch(`${API_URL}/api/carteras/descargar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientes: carteraData.clientes
        })
      });

      if (!response.ok) {
        throw new Error('Error al descargar el archivo');
      }

      // Obtener el blob del archivo
      const blob = await response.blob();
      
      // Crear un enlace temporal para descargar
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fecha = new Date().toISOString().split('T')[0];
      const nombreZonaArchivo = selectedZona
        ? (zonasNombres[selectedZona] || selectedZona).replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '_')
        : '';
      link.download = `Cartera_Clientes_${nombreZonaArchivo ? nombreZonaArchivo + '_' : ''}${fecha}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar:', error);
      alert('Error al descargar el archivo');
    }
  };

  const handleDescargarFormato = async () => {
    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      const response = await fetch(`${API_URL}/api/carteras/descargar-formato`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al descargar el formato');
      }

      // Obtener el blob del archivo
      const blob = await response.blob();
      
      // Crear un enlace temporal para descargar
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fecha = new Date().toISOString().split('T')[0];
      link.download = `Formato_Cartera_${fecha}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar formato:', error);
      alert('Error al descargar el formato');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Limpiar mensajes anteriores
      setUploadError('');
      setUploadSuccess('');
      setUploadWarnings([]);
      setValidacionesDetalle([]);
      setCanValidate(false);
      
      // Validar que sea un archivo Excel
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setUploadError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSubirArchivo = async () => {
    if (!selectedFile) {
      setUploadError('Por favor selecciona un archivo primero');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadWarnings([]);
    setValidacionesDetalle([]);

    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedZona) {
        formData.append('zona', selectedZona);
      }

      const response = await fetch(`${API_URL}/api/carteras/upload-jefe-venta`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        // Extraer el detalle del error
        let errorDetail = data.detail;
        
        // Si detail es un objeto con message y validaciones, extraerlos
        if (typeof errorDetail === 'object' && errorDetail.message) {
          setUploadError(errorDetail.message);
          
          // Si hay validaciones en el error, mostrarlas
          if (errorDetail.validaciones && errorDetail.validaciones.length > 0) {
            setValidacionesDetalle(errorDetail.validaciones);
            
            // Detectar si hay detalles completos de ERROR o ADVERTENCIA y mostrar modal
            errorDetail.validaciones.forEach((validacion: any) => {
              if (validacion.detalle_completo && (validacion.estado === 'failed' || validacion.estado === 'warning')) {
                if (validacion.nombre === 'Clientes asignados a Jefes') {
                  mostrarDetalleValidacion('jefes_con_clientes', 'Jefes de Venta con Clientes Asignados', validacion.detalle_completo);
                }
              }
            });
          }
        } else {
          // Si detail es un string simple
          setUploadError(typeof errorDetail === 'string' ? errorDetail : 'Error al subir el archivo');
        }
        
        // Limpiar archivo para forzar re-selección en el próximo intento
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        return; // No lanzar error, ya manejamos la respuesta
      }

      // Mostrar mensaje de éxito
      let mensajeExito = `Archivo subido exitosamente: ${data.stats.total_clientes} clientes, ${data.stats.total_vendedores} vendedores, ${data.stats.total_distritos} distritos`;
      
      setUploadSuccess(mensajeExito);
      setCanValidate(true); // Permitir validar ahora que la subida fue exitosa
      
      // Guardar advertencias si existen
      if (data.warnings && data.warnings.length > 0) {
        setUploadWarnings(data.warnings);
      }
      
      // Guardar desglose de validaciones
      if (data.validaciones && data.validaciones.length > 0) {
        setValidacionesDetalle(data.validaciones);
      }
      
      // Limpiar el archivo seleccionado
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Opcional: Recargar los datos de carteras para reflejar los cambios
      // await cargarDatosCarteras();
      
    } catch (error: any) {
      console.error('Error al subir archivo:', error);
      // Error de red o error inesperado (no es un error de validación)
      setUploadError(error.message || 'Error de conexión al subir el archivo');
      // Limpiar archivo para forzar re-selección en el próximo intento
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // No hay validaciones en este caso porque es un error del sistema
    } finally {
      setIsUploading(false);
    }
  };

  const mostrarDetalleValidacion = (tipo: 'jefes_con_clientes' | 'vendedores_reemplazo' | 'jefes_sin_cartera' | 'otro', titulo: string, datos: any) => {
    setModalDetalleTipo(tipo);
    setModalDetalleTitulo(titulo);
    setModalDetalleDatos(datos);
    setModalDetalleOpen(true);
  };

  const handleVerDetalle = (validacion: any) => {
    if (validacion.detalle_completo) {
      if (validacion.nombre === 'Clientes asignados a Jefes') {
        mostrarDetalleValidacion('jefes_con_clientes', 'Jefes de Venta con Clientes Asignados', validacion.detalle_completo);
      } else if (validacion.nombre === 'Vendedores de Reemplazo') {
        mostrarDetalleValidacion('vendedores_reemplazo', 'Vendedores de Reemplazo sin Cartera', validacion.detalle_completo);
      } else if (validacion.nombre === 'Jefes de Venta') {
        mostrarDetalleValidacion('jefes_sin_cartera', 'Jefes de Venta', validacion.detalle_completo);
      } else if (validacion.nombre === 'Clientes duplicados') {
        mostrarDetalleValidacion('otro', 'Clientes Duplicados', validacion.detalle_completo);
      } else if (validacion.nombre === 'Clientes no registrados') {
        mostrarDetalleValidacion('otro', 'Clientes no Registrados en el Maestro', validacion.detalle_completo);
      } else if (validacion.nombre === 'Vendedores de Estructura de Venta') {
        mostrarDetalleValidacion('otro', 'Vendedores sin Cartera Asignada', validacion.detalle_completo);
      } else if (validacion.nombre === 'Clientes faltantes del Maestro') {
        mostrarDetalleValidacion('otro', 'Clientes del Maestro no Incluidos en tu Archivo', validacion.detalle_completo);
      } else if (validacion.nombre === 'Código de vendedor') {
        mostrarDetalleValidacion('otro', 'Registros sin Código de Vendedor', validacion.detalle_completo);
      } else if (validacion.nombre === 'Código de cliente') {
        mostrarDetalleValidacion('otro', 'Registros sin Código de Cliente', validacion.detalle_completo);
      } else {
        mostrarDetalleValidacion('otro', validacion.nombre, validacion.detalle_completo);
      }
    }
  };

  const handleValidarCartera = async () => {
    setIsValidatingFinal(true);

    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      const response = await fetch(`${API_URL}/api/carteras/validar-sin-cambios`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zona: selectedZona })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al validar cartera');
      }

      const result = await response.json();
      
      // Mostrar modal de éxito
      setValidacionExitosaFecha(result.fecha || new Date().toISOString().replace('T', ' ').slice(0, 19));
      setShowValidacionExitosa(true);
      
      // Limpiar estado de subida
      setUploadSuccess('');
      setUploadError('');
      setValidacionesDetalle([]);
      setCanValidate(false);
      setSelectedFile(null);
      setShowValidarOptions(false);

      // Recargar estado de validación por zonas
      await cargarEstadoValidacionZonas();
      
      // Recargar datos de la zona
      if (selectedZona) cargarDatosCarteras(selectedZona);
    } catch (error) {
      console.error('Error al validar cartera:', error);
      setUploadError(`Error al validar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsValidatingFinal(false);
    }
  };

  const handleReValidarActual = async () => {
    setIsReValidating(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadWarnings([]);
    setValidacionesDetalle([]);
    setCanValidate(false);

    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();

      const response = await fetch(`${API_URL}/api/carteras/re-validar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zona: selectedZona })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDetail = data.detail;
        if (typeof errorDetail === 'object' && errorDetail.message) {
          setUploadError(errorDetail.message);
          if (errorDetail.validaciones?.length > 0) {
            setValidacionesDetalle(errorDetail.validaciones);
          }
        } else {
          setUploadError(typeof errorDetail === 'string' ? errorDetail : 'Error al validar la cartera');
        }
        return;
      }

      // Éxito: mostrar resultados de validación para que el usuario los revise antes de confirmar
      setUploadSuccess(`Archivo validado. Revisa los resultados y presiona "Validar Cartera" para confirmar.`);
      setCanValidate(true); // Mostrar botón "Validar Cartera" igual que tras subir un archivo

      if (data.validaciones?.length > 0) {
        setValidacionesDetalle(data.validaciones);
      }

      if (data.warnings?.length > 0) {
        setUploadWarnings(data.warnings);
      }

    } catch (error: any) {
      console.error('Error al re-validar:', error);
      setUploadError(error.message || 'Error de conexión al validar la cartera');
    } finally {
      setIsReValidating(false);
    }
  };

  const handleCancelarSeleccion = () => {
    setSelectedFile(null);
    setUploadError('');
    setUploadSuccess('');
    setUploadWarnings([]);
    setValidacionesDetalle([]);
    setCanValidate(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button onClick={handleBackToCambiosMasivos} className={styles.backButton}>
              ← Volver
            </button>
            <h1 className={styles.pageTitle}>Gestión de Carteras</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowInstructivo(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                border: '2px solid #2d7a3e', background: 'transparent',
                color: '#2d7a3e', cursor: 'pointer', fontSize: '0.9rem',
                fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#2d7a3e'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#2d7a3e'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Instructivo
            </button>
            <UserMenu
              userName={user.nombre}
              userEmail={user.email || ''}
              userRole={user.cargo}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {error && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ color: '#856404', fontSize: '0.9rem' }}>⚠️ {error}</span>
            <button
              onClick={() => { setError(''); cargarDatosCarteras(selectedZona); }}
              style={{
                padding: '0.4rem 1rem',
                background: '#856404',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {carteraData && (
          <>
            {/* Selector de Zona - solo visible cuando hay más de una zona */}
            {userZonas.length > 1 && (
              <div className={styles.zonasContainer}>
                <p className={styles.zonasLabel}>Zona activa:</p>
                <div className={styles.zonasTabs}>
                  {userZonas.map(zona => {
                    const zonaValidada = zonasValidadas[zona]?.validado || false;
                    const esSeleccionada = selectedZona === zona;
                    let tabClass = styles.zonaTab;
                    if (esSeleccionada) {
                      tabClass += zonaValidada ? ` ${styles.zonaTabActive}` : ` ${styles.zonaTabActivePendiente}`;
                    } else if (!zonaValidada) {
                      tabClass += ` ${styles.zonaTabPendiente}`;
                    }
                    return (
                      <button
                        key={zona}
                        onClick={() => setSelectedZona(zona)}
                        className={tabClass}
                        title={zonaValidada
                          ? `Validado el ${zonasValidadas[zona]?.fecha_validacion || ''}`
                          : 'Esta zona aún no ha sido validada'
                        }
                      >
                        {zonasNombres[zona] || zona}
                        {zonaValidada && <span style={{ fontSize: '0.7rem', marginLeft: '0.2rem' }}></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alerta zona validada */}
            {selectedZona && userZonas.length > 1 && zonasValidadas[selectedZona]?.validado && (
              <div style={{
                background: '#d4edda', border: '1px solid #c3e6cb',
                borderRadius: '8px', padding: '0.75rem 1rem',
                marginBottom: '1rem', color: '#155724', fontSize: '0.9rem'
              }}>
                <strong>Zona {(selectedZona && zonasNombres[selectedZona]) || selectedZona} – Cartera validada</strong>
                {' '}{zonasValidadas[selectedZona]?.fecha_validacion && `el ${zonasValidadas[selectedZona]?.fecha_validacion}`}
              </div>
            )}

            {/* Alerta zona pendiente */}
            {selectedZona && userZonas.length > 1 && !zonasValidadas[selectedZona]?.validado && (
              <div style={{
                background: '#fff3cd', border: '1px solid #ffeaa7',
                borderRadius: '8px', padding: '0.75rem 1rem',
                marginBottom: '1rem', color: '#856404', fontSize: '0.9rem'
              }}>
                <strong>Zona {(selectedZona && zonasNombres[selectedZona]) || selectedZona} – Validación pendiente.</strong>
                {' '}Sube un archivo o presiona "Validar Cartera" para confirmar esta zona.
              </div>
            )}

            {/* Estadísticas */}
            <div className={styles.statsContainer} style={{ position: 'relative', minHeight: '80px' }}>
              {isLoadingData && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255,255,255,0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  zIndex: 10,
                  animation: 'modalOverlayIn 0.15s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2d7a3e', fontWeight: 600, fontSize: '0.95rem' }}>
                    <span style={{
                      display: 'inline-block', width: '20px', height: '20px',
                      border: '3px solid rgba(45,122,62,0.2)', borderTopColor: '#2d7a3e',
                      borderRadius: '50%', animation: 'spin 0.7s linear infinite'
                    }} />
                    Cargando datos...
                  </div>
                </div>
              )}
              <div className={styles.statCard} style={{ opacity: isLoadingData ? 0.3 : 1, transition: 'opacity 0.3s ease' }}>
                <div className={styles.statNumber}>{carteraData.metadata.total_clientes.toLocaleString()}</div>
                <div className={styles.statLabel}>Clientes</div>
              </div>
              <div className={styles.statCard} style={{ opacity: isLoadingData ? 0.3 : 1, transition: 'opacity 0.3s ease' }}>
                <div className={styles.statNumber}>{carteraData.metadata.total_vendedores}</div>
                <div className={styles.statLabel}>Vendedores</div>
              </div>
              {carteraData.metadata.total_gestores > 0 && (
              <div className={styles.statCard} style={{ opacity: isLoadingData ? 0.3 : 1, transition: 'opacity 0.3s ease' }}>
                <div className={styles.statNumber}>{carteraData.metadata.total_gestores}</div>
                <div className={styles.statLabel}>Gestores</div>
              </div>
              )}
              <div className={styles.statCard} style={{ opacity: isLoadingData ? 0.3 : 1, transition: 'opacity 0.3s ease' }}>
                <div className={styles.statNumber}>{carteraData.metadata.total_comunas}</div>
                <div className={styles.statLabel}>Comunas</div>
              </div>
            </div>

            {/* Grid de 3 columnas */}
            {(user.cargo.toUpperCase().includes('JEFE') || user.cargo.toUpperCase() === 'ADMIN') && (
              <div className={styles.gridContainer}>
                {/* COLUMNA 1: Descargar Archivos */}
                <div className={styles.gridSection}>
                  <h3>Descargar Cartera</h3>
                  <div className={styles.sectionContent}>
                    <div className={styles.iconContainer} style={{ margin: '0 auto 1rem' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center', marginBottom: '1rem' }}>
                      Descarga el archivo Excel con todos tus clientes o el formato vacío para llenar.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        onClick={handleDescargarExcel}
                        className={styles.downloadButton}
                        style={{ fontSize: '0.95rem', padding: '0.75rem 1.5rem', width: '100%', justifyContent: 'center' }}
                      >
                        Descargar Cartera
                      </button>
                    </div>
                  </div>
                </div>

                {/* COLUMNA 2: Subir Archivo */}
                <div className={styles.gridSection}>
                  <h3>Subir Archivo</h3>
                  <div className={styles.sectionContent}>
                    <div className={styles.iconContainer} style={{ margin: '0 auto 1rem' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center', marginBottom: '1rem' }}>
                      Gestiona y valida la cartera de clientes.
                    </p>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      id="file-upload"
                    />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Botón principal Validar Cartera */}
                      {!selectedFile && !showValidarOptions && (
                        <button
                          onClick={() => setShowValidarOptions(true)}
                          className={styles.downloadButton}
                          style={{
                            fontSize: '1rem',
                            padding: '0.85rem 1.5rem',
                            background: 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)',
                            width: '100%',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(45, 122, 62, 0.4)'
                          }}
                        >
                          Validar Cartera
                        </button>
                      )}

                      {/* Sub-opciones cuando se presiona Validar Cartera */}
                      {!selectedFile && showValidarOptions && (
                        <>
                          <button
                            onClick={handleReValidarActual}
                            disabled={isReValidating}
                            className={styles.downloadButton}
                            style={{
                              fontSize: '0.95rem',
                              padding: '0.75rem 1.5rem',
                              background: isReValidating ? '#6c757d' : 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)',
                              cursor: isReValidating ? 'not-allowed' : 'pointer',
                              opacity: isReValidating ? 0.7 : 1,
                              width: '100%',
                              justifyContent: 'center'
                            }}
                            title="Valida la cartera guardada actualmente sin necesidad de subir un nuevo archivo"
                          >
                            {isReValidating ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  width: '14px',
                                  height: '14px',
                                  border: '2px solid rgba(255,255,255,0.4)',
                                  borderTopColor: 'white',
                                  borderRadius: '50%',
                                  animation: 'spin 0.8s linear infinite'
                                }}></span>
                                Validando...
                              </span>
                            ) : 'Validar Cartera sin Cambios'}
                          </button>

                          <label 
                            htmlFor="file-upload" 
                            className={styles.downloadButton}
                            style={{ 
                              cursor: 'pointer', 
                              fontSize: '0.95rem', 
                              padding: '0.75rem 1.5rem',
                              backgroundColor: '#007bff',
                              margin: 0,
                              width: '100%',
                              justifyContent: 'center'
                            }}
                          >
                            Subir Cartera con Cambios
                          </label>

                          <button
                            onClick={handleDescargarFormato}
                            className={styles.downloadButton}
                            style={{ fontSize: '0.95rem', padding: '0.75rem 1.5rem', backgroundColor: '#28a745', width: '100%', justifyContent: 'center' }}
                          >
                            Descargar Formato de Archivo de Subida
                          </button>

                          <button
                            onClick={() => setShowValidarOptions(false)}
                            style={{
                              fontSize: '0.85rem',
                              padding: '0.5rem',
                              backgroundColor: 'transparent',
                              color: '#6c757d',
                              border: '1px solid #dee2e6',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              width: '100%',
                              textAlign: 'center'
                            }}
                          >
                            ← Volver
                          </button>
                        </>
                      )}
                      
                      {selectedFile && (
                        <div style={{ 
                          padding: '0.75rem', 
                          backgroundColor: '#f8f9fa', 
                          borderRadius: '8px',
                          border: '1px solid #dee2e6',
                          fontSize: '0.85rem',
                          animation: 'scaleIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {selectedFile.name}
                          </div>
                          <div style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                            Tamaño: {(selectedFile.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                      )}

                      {selectedFile && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={handleSubirArchivo}
                            disabled={isUploading}
                            className={styles.downloadButton}
                            style={{ 
                              fontSize: '0.95rem', 
                              padding: '0.75rem 1.5rem',
                              backgroundColor: isUploading ? '#6c757d' : '#007bff',
                              cursor: isUploading ? 'not-allowed' : 'pointer',
                              opacity: isUploading ? 0.7 : 1,
                              flex: 1,
                              justifyContent: 'center'
                            }}
                          >
                            {isUploading ? 'Subiendo...' : 'Subir'}
                          </button>
                          <button
                            onClick={handleCancelarSeleccion}
                            className={styles.downloadButton}
                            style={{ 
                              fontSize: '0.95rem', 
                              padding: '0.75rem 1rem',
                              backgroundColor: '#dc3545',
                              justifyContent: 'center'
                            }}
                          >
                            ❌
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ 
                      marginTop: 'auto',
                      padding: '0.75rem', 
                      backgroundColor: '#e7f3ff',
                      border: '1px solid #b3d9ff',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Información:</strong>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                        <li>Formatos: .xlsx, .xls</li>
                        <li>Orden de columnas: No importa</li>
                        <li>Nombre de columnas: Mantener el nombre original de las columnas</li>
                        <li>Nombre de archivo: No importa</li>
                        <li><strong>Campos OBLIGATORIOS:</strong> CodVend y CodCliente</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* COLUMNA 3: Resultado de Validaciones */}
                <div className={styles.gridSection}>
                  <h3>Resultado de Validación</h3>
                  <div className={styles.sectionContent}>
                    {!uploadSuccess && !uploadError && (
                      <div className={styles.validationEmpty}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
                          No hay validaciones pendientes.<br/>
                          Sube un archivo para ver los resultados aquí.
                        </p>
                      </div>
                    )}

                    {uploadSuccess && (
                      <div style={{ animation: 'slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <div style={{ 
                          padding: '1rem', 
                          backgroundColor: '#d4edda', 
                          border: '2px solid #28a745',
                          borderRadius: '8px',
                          color: '#155724',
                          marginBottom: validacionesDetalle.length > 0 ? '1rem' : '0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>✅</span>
                            <strong style={{ fontSize: '1rem' }}>Validación Exitosa</strong>
                          </div>
                          <p style={{ margin: '0', fontSize: '0.9rem', lineHeight: '1.6' }}>{uploadSuccess}</p>
                        </div>

                        {/* Botones Validar / Cancelar - Solo aparecen cuando canValidate es true */}
                        {canValidate && (
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => setModalConfirmarValidarOpen(true)}
                                disabled={isValidatingFinal}
                                className={styles.downloadButton}
                                style={{ 
                                  fontSize: '1rem', 
                                  padding: '0.85rem 1.5rem',
                                  background: isValidatingFinal ? '#6c757d' : 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)',
                                  cursor: isValidatingFinal ? 'not-allowed' : 'pointer',
                                  opacity: isValidatingFinal ? 0.7 : 1,
                                  flex: 1,
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  boxShadow: '0 4px 12px rgba(45, 122, 62, 0.4)'
                                }}
                              >
                                {isValidatingFinal ? 'Validando...' : `Validar Cartera de ${selectedZona ? (zonasNombres[selectedZona] || selectedZona) : 'tu zona'}`}
                              </button>
                              <button
                                onClick={() => {
                                  setUploadSuccess('');
                                  setUploadError('');
                                  setValidacionesDetalle([]);
                                  setCanValidate(false);
                                  setSelectedFile(null);
                                  setShowValidarOptions(false);
                                }}
                                disabled={isValidatingFinal}
                                className={styles.downloadButton}
                                style={{
                                  fontSize: '0.9rem',
                                  padding: '0.85rem 1rem',
                                  backgroundColor: '#dc3545',
                                  cursor: isValidatingFinal ? 'not-allowed' : 'pointer',
                                  justifyContent: 'center',
                                  fontWeight: 'bold'
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                            <p style={{ 
                              fontSize: '0.8rem', 
                              color: '#666', 
                              textAlign: 'center', 
                              marginTop: '0.5rem',
                              fontStyle: 'italic' 
                            }}>
                              Haz clic para confirmar y validar la cartera definitivamente
                            </p>
                          </div>
                        )}

                        {/* Desglose detallado de validaciones */}
                        {validacionesDetalle.length > 0 && (
                          <div style={{
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '1rem',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}>
                            <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                              Desglose de Validaciones:
                            </strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {validacionesDetalle.map((validacion, index) => (
                                <div 
                                  key={index}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'flex-start',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    backgroundColor: validacion.estado === 'passed' ? '#e8f5e9' : '#fff3cd',
                                    border: `1px solid ${validacion.estado === 'passed' ? '#4caf50' : '#ffc107'}`,
                                    borderRadius: '4px',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  <span style={{ 
                                    fontSize: '1rem', 
                                    fontWeight: 'bold',
                                    color: validacion.estado === 'passed' ? '#4caf50' : '#ff9800',
                                    flexShrink: 0
                                  }}>
                                    {validacion.estado === 'passed' ? '✅' : '⚠️'}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>
                                      {validacion.nombre}
                                    </div>
                                    <div style={{ 
                                      fontSize: '0.8rem', 
                                      color: validacion.estado === 'passed' ? '#2e7d32' : '#856404'
                                    }}>
                                      {validacion.mensaje}
                                    </div>
                                  </div>
                                  {validacion.detalle_completo && (
                                    <button
                                      onClick={() => handleVerDetalle(validacion)}
                                      style={{
                                        padding: '0.25rem 0.75rem',
                                        fontSize: '0.75rem',
                                        backgroundColor: '#ffc107',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d39e00'}
                                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffc107'}
                                    >
                                      Ver Detalle
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {uploadError && (
                      <div style={{ animation: 'slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <div style={{ 
                          padding: '1rem', 
                          backgroundColor: '#f8d7da', 
                          border: '2px solid #dc3545',
                          borderRadius: '8px',
                          color: '#721c24',
                          marginBottom: validacionesDetalle.length > 0 ? '1rem' : '1rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>❌</span>
                            <strong style={{ fontSize: '1rem' }}>Error en Validación</strong>
                          </div>
                          <p style={{ margin: '0', fontSize: '0.85rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                            {uploadError}
                          </p>
                        </div>

                        {/* Mostrar desglose de validaciones si hay errores con detalle */}
                        {validacionesDetalle.length > 0 && (
                          <div style={{
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '1rem',
                            marginBottom: '1rem',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}>
                            <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                              Desglose de Validaciones:
                            </strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {validacionesDetalle.map((validacion, index) => (
                                <div 
                                  key={index}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'flex-start',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    backgroundColor: validacion.estado === 'passed' ? '#e8f5e9' : 
                                                    validacion.estado === 'failed' ? '#ffebee' : '#fff3cd',
                                    border: `1px solid ${validacion.estado === 'passed' ? '#4caf50' : 
                                                         validacion.estado === 'failed' ? '#f44336' : '#ffc107'}`,
                                    borderRadius: '4px',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  <span style={{ 
                                    fontSize: '1rem', 
                                    fontWeight: 'bold',
                                    color: validacion.estado === 'passed' ? '#4caf50' : 
                                           validacion.estado === 'failed' ? '#f44336' : '#ff9800',
                                    flexShrink: 0
                                  }}>
                                    {validacion.estado === 'passed' ? '✅' : 
                                     validacion.estado === 'failed' ? '❌' : '⚠️'}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>
                                      {validacion.nombre}
                                    </div>
                                    <div style={{ 
                                      fontSize: '0.8rem', 
                                      color: validacion.estado === 'passed' ? '#2e7d32' : 
                                             validacion.estado === 'failed' ? '#c62828' : '#856404'
                                    }}>
                                      {validacion.mensaje}
                                    </div>
                                  </div>
                                  {validacion.detalle_completo && (
                                    <button
                                      onClick={() => handleVerDetalle(validacion)}
                                      style={{
                                        padding: '0.25rem 0.75rem',
                                        fontSize: '0.75rem',
                                        backgroundColor: '#ffc107',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d39e00'}
                                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffc107'}
                                    >
                                      Ver Detalle
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div style={{ 
                          padding: '0.75rem', 
                          backgroundColor: '#fff3cd', 
                          border: '1px solid #ffc107', 
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#856404' }}>¿Cómo corregir los errores?</strong>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.6', color: '#856404' }}>
                            <li>Verifica que todos los registros tengan <strong>código de vendedor</strong> y <strong>código de cliente</strong></li>
                            <li>Asegúrate de que no haya <strong>clientes repetidos</strong></li>
                            <li>El archivo debe tener las <strong>12 columnas requeridas</strong></li>
                            <li>Todos los clientes deben existir en el <strong>Maestro Cliente</strong></li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!error && !carteraData && (
          <div className={styles.contentCard}>
            <div className={styles.welcomeSection}>
              <div className={styles.iconContainer}>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <h2>Gestión de Carteras de Clientes</h2>
              <p>No hay datos de carteras disponibles. Por favor, contacta al administrador para cargar el archivo base.</p>
            </div>
          </div>
        )}
      </main>
      
      <ModalDetalleValidacion
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        tipo={modalDetalleTipo}
        titulo={modalDetalleTitulo}
        datos={modalDetalleDatos}
      />

      {/* Modal de confirmación de validación */}
      {modalConfirmarValidarOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '2rem',
            maxWidth: '540px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>⚠️ Confirmar Validación</h3>

            {/* Advertencias activas */}
            {validacionesDetalle.filter(v => v.estado === 'warning').length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.95rem' }}>Se encontraron las siguientes observaciones:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {validacionesDetalle.filter(v => v.estado === 'warning').map((v, i) => (
                    <div key={i} style={{
                      padding: '0.6rem 0.9rem',
                      borderRadius: '6px',
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      fontSize: '0.88rem'
                    }}>
                      <strong>⚠️ {v.nombre}:</strong>{' '}{v.mensaje}
                      {v.detalle_completo && (
                        <button
                          onClick={() => handleVerDetalle(v)}
                          style={{
                            marginLeft: '0.5rem', fontSize: '0.78rem', padding: '0.1rem 0.5rem',
                            background: '#f0a500', color: '#fff', border: 'none',
                            borderRadius: '4px', cursor: 'pointer'
                          }}
                        >
                          Ver Detalle
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ margin: '0 0 1.5rem', fontSize: '0.95rem' }}>
              ¿Estás seguro que quieres validar la cartera con estas observaciones?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalConfirmarValidarOpen(false)}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: '6px',
                  border: '1px solid #ccc', background: '#f8f9fa',
                  cursor: 'pointer', fontSize: '0.95rem'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setModalConfirmarValidarOpen(false); handleValidarCartera(); }}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: '6px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)',
                  color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold'
                }}
              >
                Sí, Validar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de validación exitosa */}
      {showValidacionExitosa && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '2.5rem 3rem',
            maxWidth: '480px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 1.25rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(76, 175, 80, 0.35)',
              animation: 'scaleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.15s both'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem', color: '#2e7d32' }}>¡Cartera Validada!</h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#555', lineHeight: '1.5' }}>
              La cartera de <strong>{selectedZona ? (zonasNombres[selectedZona] || selectedZona) : 'tu zona'}</strong> ha sido validada exitosamente.
            </p>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#888' }}>
              Fecha de validación: {validacionExitosaFecha}
            </p>
            <button
              onClick={() => setShowValidacionExitosa(false)}
              style={{
                padding: '0.75rem 2.5rem', borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)',
                color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 12px rgba(45,122,62, 0.3)'
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(45,122,62, 0.4)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(45,122,62, 0.3)'; }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modal de validación en progreso */}
      {isValidatingFinal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '2.5rem 3rem',
            maxWidth: '420px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px', height: '56px', margin: '0 auto 1.25rem',
              border: '4px solid rgba(45,122,62,0.15)', borderTopColor: '#2d7a3e',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite'
            }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: '#333' }}>Validando cartera...</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
              Estamos guardando y validando la cartera de <strong>{selectedZona ? (zonasNombres[selectedZona] || selectedZona) : 'tu zona'}</strong>. Por favor no cierres esta página.
            </p>
          </div>
        </div>
      )}

      <InstructivoModal
        isOpen={showInstructivo}
        onClose={() => setShowInstructivo(false)}
        pantalla="carteras"
      />
    </div>
  );
}
