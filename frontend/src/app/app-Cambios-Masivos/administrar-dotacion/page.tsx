/**
 * Administrar Dotación - Gestión completa de vendedores
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './administrar-dotacion.module.css';
import Cookies from 'js-cookie';
import UserMenu from '@/components/UserMenu';
import InstructivoModal from '@/components/InstructivoModal';
import { getApiUrl } from '@/utils/api-url';

interface VendedorTitular {
  Año: number;
  Mes: number;
  CodDistrito: string;
  DesDistrito: string;
  CodOficina: string;
  DesOficina: string;
  CodVenta: string;
  Cargo: string;
  Rut: string;
  Nombre: string;
  APaterno: string;
  AMaterno: string;
  Telefono: string;
  Correo: string;
  ZonaEstival: string;
  Genero: string;
  TallaPantalon?: number;
  TallaCamisa?: string;
  NombreCompleto: string;
  TieneDatosFaltantes?: boolean;
  Estatus?: string;
}

interface SheetData {
  name: string;
  rows: number;
  columns: string[];
  data: VendedorTitular[];
}

interface EstructuraData {
  sheets: SheetData[];
  metadata: {
    filename: string;
    last_update: string;
    total_vendedores: number;
    total_distritos: number;
    total_oficinas: number;
    user_role?: string;
    user_distritos?: string[];
  };
}

export default function AdminstrarDotacionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  
  const [estructuraData, setEstructuraData] = useState<EstructuraData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string>('');
  const [showInstructivo, setShowInstructivo] = useState(false);
  
  // Estados para el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [vendedorEditando, setVendedorEditando] = useState<VendedorTitular | null>(null);
  const [datosEditados, setDatosEditados] = useState<Partial<VendedorTitular>>({});
  
  // Estados para modales de mensajes
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageModalContent, setMessageModalContent] = useState({ title: '', message: '', type: 'info' as 'info' | 'success' | 'error' });
  
  // Estados para modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '', onConfirm: () => {} });
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);
  
  // Estado para modal de resumen de cambios
  const [showResumenModal, setShowResumenModal] = useState(false);
  
  // Estado para modal de advertencia de datos faltantes
  const [showAdvertenciaModal, setShowAdvertenciaModal] = useState(false);
  const [vendedoresIncompletos, setVendedoresIncompletos] = useState<Array<{vendedor: VendedorTitular, datosFaltantes: string[]}>>([]);
  
  // Estados para cambios pendientes
  const [cambiosPendientes, setCambiosPendientes] = useState<{
    editados: Map<string, Partial<VendedorTitular>>;
    nuevos: Partial<VendedorTitular>[];
    eliminados: VendedorTitular[];
  }>({
    editados: new Map(),
    nuevos: [],
    eliminados: []
  });
  const [hayCambiosPendientes, setHayCambiosPendientes] = useState(false);
  
  // Estados para operaciones en curso
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Estados para ordenamiento de tabla
  const [sortColumn, setSortColumn] = useState<'oficina' | 'cargo' | 'nombre' | 'apaterno' | 'amaterno' | null>('oficina');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Proteger ruta
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Funciones para mostrar modales personalizados
  const showMessage = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setMessageModalContent({ title, message, type });
    setShowMessageModal(true);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalContent({ title, message, onConfirm });
    setShowConfirmModal(true);
  };

  // Cargar datos del Excel base al montar el componente
  useEffect(() => {
    if (isAuthenticated && user) {
      cargarEstructuraVenta();
    }
  }, [isAuthenticated, user]);

  const cargarEstructuraVenta = async () => {
    try {
      setIsLoadingData(true);
      setError('');
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      const response = await fetch(`${API_URL}/api/estructura-venta/cargar`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar estructura de ventas');
      }
      
      const data = await response.json();
      setEstructuraData(data);
      
      // Detectar si es un archivo nuevo comparando con el guardado en localStorage
      const archivoActual = data.metadata?.filename || '';
      const archivoGuardado = localStorage.getItem('administrar_dotacion_archivo_actual');
      
      if (archivoGuardado && archivoGuardado !== archivoActual) {
        // Es un archivo nuevo (nuevo mes), limpiar el estado de cambios guardados
        localStorage.removeItem('administrar_dotacion_cambios_guardados');
      }
      
      // Guardar el nombre del archivo actual
      localStorage.setItem('administrar_dotacion_archivo_actual', archivoActual);
      
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Error al cargar la estructura de ventas');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleBackToMenu = () => {
    router.push('/app-Cambios-Masivos');
  };

  const handleLogout = async () => {
    await logout();
  };

  // Manejar cambio de ordenamiento
  const handleSort = (column: 'oficina' | 'cargo' | 'nombre' | 'apaterno' | 'amaterno') => {
    if (sortColumn === column) {
      // Si ya está ordenado por esta columna, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es una columna nueva, ordenar ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Manejar doble clic en vendedor para editar
  const handleDoubleClickVendedor = (vendedor: VendedorTitular) => {
    setVendedorEditando(vendedor);
    setDatosEditados(vendedor);
    setShowEditModal(true);
  };

  // Manejar cambio de campo en el modal
  const handleCampoChange = (campo: keyof VendedorTitular, valor: any) => {
    setDatosEditados(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Guardar cambios del vendedor en memoria
  const handleGuardarEdicion = async () => {
    if (!vendedorEditando) return;
    
    try {
      const vendedorActualizado = {
        ...vendedorEditando,
        ...datosEditados
      };
      
      // Validar campos obligatorios
      const camposVacios = [];
      if (!vendedorActualizado.Nombre) camposVacios.push('Nombre');
      if (!vendedorActualizado.APaterno) camposVacios.push('Apellido Paterno');
      if (!vendedorActualizado.AMaterno) camposVacios.push('Apellido Materno');
      if (!vendedorActualizado.Telefono) camposVacios.push('Teléfono');
      if (!vendedorActualizado.Correo) camposVacios.push('Correo');
      if (!vendedorActualizado.Genero) camposVacios.push('Género');
      if (!vendedorActualizado.TallaPantalon) camposVacios.push('Talla Pantalón');
      if (!vendedorActualizado.TallaCamisa) camposVacios.push('Talla Camisa');
      
      if (camposVacios.length > 0) {
        showMessage('Campos Incompletos', `Por favor complete los siguientes campos: ${camposVacios.join(', ')}`, 'error');
        return;
      }
      
      // Validar formato de RUT (permitir 0-0 como caso especial)
      if (vendedorActualizado.Rut && vendedorActualizado.Rut !== '0-0') {
        const rutRegex = /^\d{1,8}-[0-9Kk]$/;
        if (!rutRegex.test(vendedorActualizado.Rut)) {
          showMessage('RUT Inválido', 'El RUT debe tener el formato 12345678-9 o 12345678-K', 'error');
          return;
        }
      }
      
      // Validar formato de correo
      if (vendedorActualizado.Correo && !vendedorActualizado.Correo.endsWith('@cial.cl')) {
        showMessage('Correo Inválido', 'El correo debe terminar en @cial.cl', 'error');
        return;
      }
      
      // Validar formato de teléfono (debe ser 9XXXXXXXX)
      if (vendedorActualizado.Telefono) {
        const telefonoStr = vendedorActualizado.Telefono.toString();
        if (!/^9\d{8}$/.test(telefonoStr)) {
          showMessage('Teléfono Inválido', 'El teléfono debe comenzar con 9 y tener 9 dígitos (ej: 912345678)', 'error');
          return;
        }
      }
      
      if (datosEditados.Nombre || datosEditados.APaterno || datosEditados.AMaterno) {
        vendedorActualizado.NombreCompleto = `${vendedorActualizado.Nombre || ''} ${vendedorActualizado.APaterno || ''} ${vendedorActualizado.AMaterno || ''}`.trim();
      }
      
      const key = `${vendedorActualizado.CodVenta}_${vendedorActualizado.Rut}`;
      
      setCambiosPendientes(prev => {
        const nuevosEditados = new Map(prev.editados);
        nuevosEditados.set(key, vendedorActualizado);
        return {
          ...prev,
          editados: nuevosEditados
        };
      });
      setHayCambiosPendientes(true);
      
      setEstructuraData(prevData => {
        if (!prevData) return prevData;
        
        const newSheets = prevData.sheets.map(sheet => ({
          ...sheet,
          data: sheet.data.map(v => 
            v.CodVenta === vendedorActualizado.CodVenta && v.Rut === vendedorActualizado.Rut
              ? { ...v, ...vendedorActualizado }
              : v
          )
        }));
        
        return {
          ...prevData,
          sheets: newSheets
        };
      });
      
      setShowEditModal(false);
      setVendedorEditando(null);
      setDatosEditados({});
      
      showMessage('Cambio Registrado', 'Cambios guardados en memoria. Presione "Guardar" para aplicar al archivo.', 'success');
    } catch (error) {
      console.error('Error al guardar:', error);
      showMessage('Error', `Error al guardar los cambios: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    }
  };

  // Cerrar modal sin guardar
  const handleCerrarModal = () => {
    setShowEditModal(false);
    setVendedorEditando(null);
    setDatosEditados({});
  };
  
  // Guardar todos los cambios acumulados al archivo
  const handleGuardarTodo = async () => {
    // Verificar si hay vendedores con datos faltantes en TODA la tabla
    const incompletos: Array<{vendedor: VendedorTitular, datosFaltantes: string[]}> = [];
    
    // Obtener todos los vendedores de la tabla
    const todosLosVendedores = estructuraData ? estructuraData.sheets.flatMap((s: any) => s.data).filter((v: any) => v.Estatus !== 'Eliminado') : [];
    
    // Revisar TODOS los vendedores de la tabla
    todosLosVendedores.forEach((vendedor: VendedorTitular) => {
      const faltantes = [];
      if (!vendedor.Nombre) faltantes.push('Nombre');
      if (!vendedor.APaterno) faltantes.push('Apellido Paterno');
      if (!vendedor.AMaterno) faltantes.push('Apellido Materno');
      if (!vendedor.Telefono) faltantes.push('Teléfono');
      if (!vendedor.Correo) faltantes.push('Correo');
      if (!vendedor.Genero) faltantes.push('Género');
      if (!vendedor.TallaPantalon) faltantes.push('Talla Pantalón');
      if (!vendedor.TallaCamisa) faltantes.push('Talla Camisa');
      
      if (faltantes.length > 0) {
        incompletos.push({ vendedor: vendedor as VendedorTitular, datosFaltantes: faltantes });
      }
    });
    
    // Si hay incompletos, mostrar advertencia
    if (incompletos.length > 0) {
      setVendedoresIncompletos(incompletos);
      setShowAdvertenciaModal(true);
      return;
    }
    
    // Si no hay incompletos, mostrar modal de resumen (incluso sin cambios para revalidar)
    setShowResumenModal(true);
  };
  
  // Confirmar y ejecutar el guardado
  const handleConfirmarGuardado = async () => {
    setIsSaving(true);
    
    try {
      const token = Cookies.get('auth_token');
      const editados = Array.from(cambiosPendientes.editados.values());
      
      const response = await fetch(`${getApiUrl()}/api/estructura-venta/guardar-todos-cambios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          editados: editados,
          nuevos: cambiosPendientes.nuevos,
          eliminados: cambiosPendientes.eliminados,
          marcar_validado: false  // NO marcar como validado desde Administrar Dotación
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al guardar cambios');
      }
      
      const result = await response.json();
      
      setCambiosPendientes({
        editados: new Map(),
        nuevos: [],
        eliminados: []
      });
      setHayCambiosPendientes(false);
      localStorage.setItem('administrar_dotacion_cambios_guardados', 'true');
      
      await cargarEstructuraVenta();
      
      showMessage('Éxito', `Cambios guardados exitosamente.`);
    } catch (error) {
      console.error('Error al guardar todos los cambios:', error);
      showMessage('Error', `Error al guardar los cambios: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    } finally {
      setIsSaving(false);
      setShowResumenModal(false);
    }
  };
  
  // Verificar si un vendedor ha sido editado
  const esVendedorEditado = (vendedor: VendedorTitular): boolean => {
    const key = `${vendedor.CodVenta}_${vendedor.Rut}`;
    return cambiosPendientes.editados.has(key);
  };

  // Verificar si un vendedor es nuevo
  const esVendedorNuevo = (vendedor: VendedorTitular): boolean => {
    return cambiosPendientes.nuevos.some(
      v => v.CodVenta === vendedor.CodVenta && v.Rut === vendedor.Rut
    );
  };

  // Restablecer archivo desde respaldo
  const handleRestablecer = async () => {
    showConfirm(
      'Confirmar Restablecer',
      '¿Está seguro de restablecer el archivo desde el respaldo? Esto eliminará todos los cambios realizados.',
      async () => {
        setIsRestoring(true);
        try {
          const token = Cookies.get('auth_token');
          
          const response = await fetch(`${getApiUrl()}/api/estructura-venta/restablecer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error al restablecer archivo');
          }
          
          // Recargar datos después de restablecer
          await cargarEstructuraVenta();
          
          // Resetear estados
          localStorage.removeItem('administrar_dotacion_cambios_guardados');
          setCambiosPendientes({
            editados: new Map(),
            nuevos: [],
            eliminados: []
          });
          setHayCambiosPendientes(false);
          
          showMessage('Éxito', 'Archivo restaurado exitosamente desde el respaldo', 'success');
        } catch (error) {
          console.error('Error al restablecer:', error);
          showMessage('Error', `Error al restablecer el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
        } finally {
          setIsRestoring(false);
        }
      }
    );
  };

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

  const todaLaDotacion = estructuraData ? estructuraData.sheets.flatMap((s: any) => s.data).filter((v: any) => v.Estatus !== 'Eliminado') : [];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button onClick={handleBackToMenu} className={styles.backButton}>
              ← Volver
            </button>
            <h1>Administrar Dotación</h1>
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
        {/* Error */}
        {error && (
          <div style={{ 
            background: '#fee', 
            border: '1px solid #fcc', 
            padding: '1rem', 
            borderRadius: '8px',
            color: '#c33',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoadingData && (
          <div className={styles.loadingCard}>
            <p>Cargando estructura de ventas...</p>
          </div>
        )}

        {/* Datos cargados */}
        {estructuraData && !isLoadingData && (
          <>
            {/* Botones de acción */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={handleRestablecer}
                className={styles.restablecerButton}
                disabled={isSaving || isRestoring}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                {isRestoring ? <><span className={styles.buttonSpinner} />Restableciendo...</> : '↻ Restablecer'}
              </button>
              
              {hayCambiosPendientes && (
                <button
                  onClick={async () => {
                    showConfirm(
                      'Cancelar Cambios',
                      '¿Está seguro que desea cancelar todos los cambios pendientes? Esta acción no se puede deshacer.',
                      async () => {
                        // Limpiar cambios pendientes
                        setCambiosPendientes({
                          editados: new Map(),
                          nuevos: [],
                          eliminados: []
                        });
                        setHayCambiosPendientes(false);
                        
                        // Recargar datos desde el servidor
                        await cargarEstructuraVenta();
                        
                        showMessage('Cambios Cancelados', 'Todos los cambios pendientes han sido descartados.', 'info');
                      }
                    );
                  }}
                  className={styles.cancelarButton}
                  disabled={isSaving || isRestoring}
                >
                   Cancelar Cambios
                </button>
              )}
              
              <button
                onClick={handleGuardarTodo}
                className={styles.guardarPrincipalButton}
                disabled={isSaving || isRestoring}
              >
                {isSaving ? <><span className={styles.buttonSpinner} />Guardando...</> : <> Guardar {hayCambiosPendientes && `(${cambiosPendientes.editados.size + cambiosPendientes.nuevos.length + cambiosPendientes.eliminados.length})`}</>}
              </button>
              
              {hayCambiosPendientes && (
                <span style={{ color: '#ff9800', fontWeight: 'bold', fontSize: '0.9rem' }}>
                   Hay cambios sin guardar
                </span>
              )}
            </div>

            {/* TABLA DE ADMINISTRACIÓN */}
            <div className={styles.estructuraCard}>
              <div className={styles.estructuraHeader}>
                 ADMINISTRAR DOTACIÓN COMPLETA
              </div>
              <div className={styles.estructuraContent}>
                <div className={styles.tableScrollContainer}>
                  <table className={styles.estructuraTable}>
                    <thead>
                      <tr>
                        <th 
                          onClick={() => handleSort('oficina')}
                          style={{ 
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: sortColumn === 'oficina' ? '#e3f2fd' : 'transparent',
                            minWidth: '120px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Oficina</span>
                            {sortColumn === 'oficina' && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('cargo')}
                          style={{ 
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: sortColumn === 'cargo' ? '#e3f2fd' : 'transparent',
                            minWidth: '100px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Cargo</span>
                            {sortColumn === 'cargo' && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th style={{ minWidth: '90px' }}>Cod. Venta</th>
                        <th style={{ minWidth: '110px' }}>RUT</th>
                        <th 
                          onClick={() => handleSort('nombre')}
                          style={{ 
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: sortColumn === 'nombre' ? '#e3f2fd' : 'transparent',
                            minWidth: '100px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Nombre</span>
                            {sortColumn === 'nombre' && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('apaterno')}
                          style={{ 
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: sortColumn === 'apaterno' ? '#e3f2fd' : 'transparent',
                            minWidth: '110px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>A. Paterno</span>
                            {sortColumn === 'apaterno' && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('amaterno')}
                          style={{ 
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: sortColumn === 'amaterno' ? '#e3f2fd' : 'transparent',
                            minWidth: '110px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>A. Materno</span>
                            {sortColumn === 'amaterno' && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th style={{ minWidth: '100px' }}>Teléfono</th>
                        <th style={{ minWidth: '200px' }}>Correo</th>
                        <th style={{ minWidth: '70px', textAlign: 'center' }}>Género</th>
                        <th style={{ minWidth: '70px', textAlign: 'center' }}>T.Pant</th>
                        <th style={{ minWidth: '70px', textAlign: 'center' }}>T.Cam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaLaDotacion
                        .sort((a: any, b: any) => {
                          const direction = sortDirection === 'asc' ? 1 : -1;
                          
                          if (sortColumn === 'oficina') {
                            // Ordenar por Oficina
                            if (a.DesOficina !== b.DesOficina) {
                              return direction * (a.DesOficina || '').localeCompare(b.DesOficina || '');
                            }
                            // Luego por Cargo
                            if (a.Cargo !== b.Cargo) {
                              return (a.Cargo || '').localeCompare(b.Cargo || '');
                            }
                          } else if (sortColumn === 'cargo') {
                            // Ordenar por Cargo
                            if (a.Cargo !== b.Cargo) {
                              return direction * (a.Cargo || '').localeCompare(b.Cargo || '');
                            }
                            // Luego por Oficina
                            if (a.DesOficina !== b.DesOficina) {
                              return (a.DesOficina || '').localeCompare(b.DesOficina || '');
                            }
                          } else if (sortColumn === 'nombre') {
                            // Ordenar por Nombre
                            return direction * (a.Nombre || '').localeCompare(b.Nombre || '');
                          } else if (sortColumn === 'apaterno') {
                            // Ordenar por Apellido Paterno
                            return direction * (a.APaterno || '').localeCompare(b.APaterno || '');
                          } else if (sortColumn === 'amaterno') {
                            // Ordenar por Apellido Materno
                            return direction * (a.AMaterno || '').localeCompare(b.AMaterno || '');
                          }
                          
                          // Finalmente por Nombre Completo
                          return (a.NombreCompleto || '').localeCompare(b.NombreCompleto || '');
                        })
                        .map((vendedor: VendedorTitular, index: number) => {
                          const isIncomplete = !vendedor.Nombre || !vendedor.APaterno || !vendedor.AMaterno || 
                                             !vendedor.Telefono || !vendedor.Genero || !vendedor.TallaPantalon || 
                                             !vendedor.TallaCamisa || !vendedor.Correo;
                          const isEdited = esVendedorEditado(vendedor);
                          const isNew = esVendedorNuevo(vendedor);
                          
                          return (
                            <tr
                              key={`${vendedor.CodVenta}_${vendedor.Rut}_${index}`}
                              onDoubleClick={() => handleDoubleClickVendedor(vendedor)}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: isNew 
                                  ? '#e8f5e9' 
                                  : isEdited 
                                  ? '#e3f2fd' 
                                  : isIncomplete 
                                  ? '#ffebee' 
                                  : undefined,
                                color: isNew ? '#2e7d32' : (isEdited ? '#1565c0' : (isIncomplete ? '#c62828' : undefined)),
                                fontWeight: (isNew || isEdited) ? 'bold' : 'normal'
                              }}
                            >
                              <td>{vendedor.DesOficina || '-'}</td>
                              <td>{vendedor.Cargo || '-'}</td>
                              <td>{vendedor.CodVenta || '-'}</td>
                              <td>{vendedor.Rut || '-'}</td>
                              <td>{vendedor.Nombre || '-'}</td>
                              <td>{vendedor.APaterno || '-'}</td>
                              <td>{vendedor.AMaterno || '-'}</td>
                              <td>{vendedor.Telefono || '-'}</td>
                              <td>{vendedor.Correo || '-'}</td>
                              <td>{vendedor.Genero || '-'}</td>
                              <td>{vendedor.TallaPantalon || '-'}</td>
                              <td>{vendedor.TallaCamisa || '-'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal de Edición de Vendedor */}
      {showEditModal && vendedorEditando && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '800px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#2d7a3e', fontSize: '1.5rem' }}>
              Editar Vendedor - {vendedorEditando.NombreCompleto}
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Oficina - Deshabilitado */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Oficina</label>
                <select
                  value={datosEditados.DesOficina ?? ''}
                  disabled
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'not-allowed' }}
                >
                  {estructuraData && Array.from(new Set(estructuraData.sheets.flatMap((s: any) => s.data.map((v: any) => v.DesOficina)).filter((o: string) => o))).sort().map((oficina: string) => (
                    <option key={oficina} value={oficina}>{oficina}</option>
                  ))}
                </select>
              </div>

              {/* Cod. Venta - Deshabilitado */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Cod. Venta</label>
                <input
                  type="text"
                  value={datosEditados.CodVenta ?? ''}
                  disabled
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'not-allowed' }}
                />
              </div>

              {/* Rut - Editable solo si es 0-0 */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>RUT</label>
                <input
                  type="text"
                  value={datosEditados.Rut ?? ''}
                  disabled={vendedorEditando.Rut !== '0-0'}
                  onChange={(e) => handleCampoChange('Rut', e.target.value)}
                  placeholder="12345678-9"
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    borderRadius: '4px', 
                    border: '1px solid #ddd', 
                    background: vendedorEditando.Rut === '0-0' ? 'white' : '#f5f5f5', 
                    cursor: vendedorEditando.Rut === '0-0' ? 'text' : 'not-allowed' 
                  }}
                />
                {vendedorEditando.Rut === '0-0' && (
                  <small style={{ color: '#666', fontSize: '0.85rem' }}>Este vendedor no tiene RUT asignado. Puede ingresar uno ahora.</small>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nombre</label>
                <input
                  type="text"
                  value={datosEditados.Nombre ?? ''}
                  onChange={(e) => handleCampoChange('Nombre', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              {/* A.Paterno */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>A.Paterno</label>
                <input
                  type="text"
                  value={datosEditados.APaterno ?? ''}
                  onChange={(e) => handleCampoChange('APaterno', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              {/* A.Materno */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>A.Materno</label>
                <input
                  type="text"
                  value={datosEditados.AMaterno ?? ''}
                  onChange={(e) => handleCampoChange('AMaterno', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              {/* Telef */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Telef</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ padding: '0.5rem', background: '#e0e0e0', borderRadius: '4px', fontWeight: 'bold' }}>+569</span>
                  <input
                    type="text"
                    value={(datosEditados.Telefono ?? '').toString().replace(/^9/, '')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                      handleCampoChange('Telefono', '9' + value);
                    }}
                    style={{ 
                      flex: 1,
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      border: datosEditados.Telefono && datosEditados.Telefono.toString().replace(/^9/, '').length !== 8 ? '2px solid #f44336' : '1px solid #ddd' 
                    }}
                    placeholder="12345678"
                    maxLength={8}
                  />
                </div>
                {datosEditados.Telefono && datosEditados.Telefono.toString().replace(/^9/, '').length !== 8 && (
                  <span style={{ color: '#f44336', fontSize: '0.85rem' }}>Debe tener 8 dígitos</span>
                )}
              </div>

              {/* Correo */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Correo</label>
                <input
                  type="email"
                  value={datosEditados.Correo ?? ''}
                  onChange={(e) => handleCampoChange('Correo', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    borderRadius: '4px', 
                    border: datosEditados.Correo && !datosEditados.Correo.endsWith('@cial.cl') ? '2px solid #f44336' : '1px solid #ddd' 
                  }}
                  placeholder="nombre@cial.cl"
                />
                {datosEditados.Correo && !datosEditados.Correo.endsWith('@cial.cl') && (
                  <span style={{ color: '#f44336', fontSize: '0.85rem' }}>Debe terminar en @cial.cl</span>
                )}
              </div>

              {/* Género */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Género</label>
                <select
                  value={datosEditados.Genero ?? ''}
                  onChange={(e) => handleCampoChange('Genero', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">Seleccione...</option>
                  <option value="H">H</option>
                  <option value="M">M</option>
                </select>
              </div>

              {/* Talla Pantalón */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Talla Pantalón</label>
                <input
                  type="number"
                  value={datosEditados.TallaPantalon ?? ''}
                  onChange={(e) => handleCampoChange('TallaPantalon', e.target.value ? Number(e.target.value) : undefined)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  placeholder="36-48"
                />
              </div>

              {/* Talla Camisa */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Talla Camisa</label>
                <select
                  value={datosEditados.TallaCamisa ?? ''}
                  onChange={(e) => handleCampoChange('TallaCamisa', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">Seleccione...</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center' }}>
              <button
                onClick={handleCerrarModal}
                className={styles.modalCancelarGris}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                className={styles.modalAgregarVerdeClaroConEstados}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mensajes */}
      {showMessageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <h3 style={{
              margin: '0 0 1rem 0',
              color: messageModalContent.type === 'error' ? '#d32f2f' : messageModalContent.type === 'success' ? '#2e7d32' : '#1976d2'
            }}>
              {messageModalContent.title}
            </h3>
            <p style={{ whiteSpace: 'pre-line', margin: '1rem 0' }}>{messageModalContent.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowMessageModal(false)}
                className={styles.modalAceptarAzul}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <h3 style={{
              margin: '0 0 1rem 0',
              color: '#ff9800'
            }}>
              {confirmModalContent.title}
            </h3>
            <p style={{ whiteSpace: 'pre-line', margin: '1rem 0' }}>{confirmModalContent.message}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className={styles.modalCancelarGris}
                disabled={isConfirmProcessing}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setIsConfirmProcessing(true);
                  try {
                    await confirmModalContent.onConfirm();
                  } finally {
                    setIsConfirmProcessing(false);
                    setShowConfirmModal(false);
                  }
                }}
                className={styles.modalConfirmarRojo}
                disabled={isConfirmProcessing}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                {isConfirmProcessing ? <><span className={styles.buttonSpinner} />Procesando...</> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Advertencia de Datos Faltantes */}
      {showAdvertenciaModal && (
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
          zIndex: 10001,
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            minWidth: '600px',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #ffebee'
            }}>
              <h2 style={{ margin: 0, color: '#e65100', fontSize: '1.5rem' }}>
                Advertencia: Datos Faltantes
              </h2>
            </div>
            
            <div style={{ 
              flex: '1',
              overflowY: 'auto',
              marginBottom: '1.5rem',
              paddingRight: '0.5rem'
            }}>
              <p style={{ color: '#666', marginBottom: '1rem', fontWeight: 'bold' }}>
                Los siguientes vendedores tienen datos faltantes. ¿Está seguro que desea continuar?
              </p>
              
              <div style={{ 
                border: '1px solid #ffebee',
                borderRadius: '6px',
                padding: '0.75rem',
                background: '#fff3e0'
              }}>
                {vendedoresIncompletos.map((item, idx) => (
                  <div key={idx} style={{
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #ff9800',
                    borderLeft: '4px solid #ff9800'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: '0.5rem', fontSize: '1.05rem' }}>
                      {item.vendedor.NombreCompleto || `${item.vendedor.Nombre || ''} ${item.vendedor.APaterno || ''} ${item.vendedor.AMaterno || ''}`.trim() || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                      RUT: {item.vendedor.Rut || '-'} | Cod. Venta: {item.vendedor.CodVenta || '-'}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#d84315',
                      background: '#ffebee',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      marginTop: '0.5rem'
                    }}>
                      <strong>Datos faltantes:</strong> {item.datosFaltantes.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{
                padding: '1rem',
                background: '#ffebee',
                borderRadius: '6px',
                borderLeft: '4px solid #d32f2f',
                marginTop: '1.5rem'
              }}>
                <p style={{ margin: 0, color: '#c62828', fontWeight: 'bold' }}>
                   Total de vendedores con datos faltantes: {vendedoresIncompletos.length}
                </p>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'center',
              paddingTop: '1rem',
              borderTop: '1px solid #eee'
            }}>
              <button
                onClick={() => {
                  setShowAdvertenciaModal(false);
                  setVendedoresIncompletos([]);
                }}
                className={styles.modalCancelarGrisMediano}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowAdvertenciaModal(false);
                  setShowResumenModal(true);
                }}
                className={styles.modalContinuarNaranja}
              >
                Continuar de Todas Formas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resumen de Cambios */}
      {showResumenModal && (
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
            minWidth: '600px',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
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
              <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem' }}>
                Resumen de Cambios
              </h2>
            </div>
            
            <div style={{ 
              flex: '1',
              overflowY: 'auto',
              marginBottom: '1.5rem',
              paddingRight: '0.5rem'
            }}>
              {hayCambiosPendientes ? (
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  Se guardarán los siguientes cambios en un nuevo archivo:
                </p>
              ) : (
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  Se validará y guardará la dotación actual sin cambios.
                </p>
              )}
              
              {/* Vendedores Editados */}
              {cambiosPendientes.editados.size > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#1565c0', 
                    fontSize: '1.1rem', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                     Vendedores Editados ({cambiosPendientes.editados.size})
                  </h3>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #e3f2fd',
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}>
                    {Array.from(cambiosPendientes.editados.values()).map((vendedor, idx) => (
                      <div key={idx} style={{
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        borderLeft: '4px solid #1565c0'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#1565c0', marginBottom: '0.25rem' }}>
                          {vendedor.NombreCompleto || `${vendedor.Nombre} ${vendedor.APaterno} ${vendedor.AMaterno}`}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                          RUT: {vendedor.Rut} | Cod. Venta: {vendedor.CodVenta} | Oficina: {vendedor.DesOficina}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Vendedores Eliminados */}
              {cambiosPendientes.eliminados.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#d32f2f', 
                    fontSize: '1.1rem', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                     Vendedores Eliminados ({cambiosPendientes.eliminados.length})
                  </h3>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #ffebee',
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}>
                    {cambiosPendientes.eliminados.map((vendedor, idx) => (
                      <div key={idx} style={{
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: '#ffebee',
                        borderRadius: '4px',
                        borderLeft: '4px solid #d32f2f'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#c62828', marginBottom: '0.25rem' }}>
                          {vendedor.NombreCompleto || `${vendedor.Nombre} ${vendedor.APaterno} ${vendedor.AMaterno}`}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                          RUT: {vendedor.Rut} | Cod. Venta: {vendedor.CodVenta} | Oficina: {vendedor.DesOficina}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Vendedores Nuevos */}
              {cambiosPendientes.nuevos.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#4caf50', 
                    fontSize: '1.1rem', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                     Vendedores Nuevos ({cambiosPendientes.nuevos.length})
                  </h3>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #e8f5e9',
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}>
                    {cambiosPendientes.nuevos.map((vendedor, idx) => (
                      <div key={idx} style={{
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: '#e8f5e9',
                        borderRadius: '4px',
                        borderLeft: '4px solid #4caf50'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#2e7d32', marginBottom: '0.25rem' }}>
                          {vendedor.NombreCompleto || `${vendedor.Nombre} ${vendedor.APaterno} ${vendedor.AMaterno}`}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                          RUT: {vendedor.Rut} | Cod. Venta: {vendedor.CodVenta} | Cargo: {vendedor.Cargo}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {hayCambiosPendientes ? (
                <div style={{
                  padding: '1rem',
                  background: '#fff3e0',
                  borderRadius: '6px',
                  borderLeft: '4px solid #ff9800',
                  marginTop: '1.5rem'
                }}>
                  <p style={{ margin: 0, color: '#e65100', fontWeight: 'bold' }}>
                     Total de cambios: {cambiosPendientes.editados.size + cambiosPendientes.nuevos.length + cambiosPendientes.eliminados.length}
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                    Se creará un nuevo archivo en la carpeta Cambios con estos registros.
                  </p>
                </div>
              ) : (
                <div style={{
                  padding: '1rem',
                  background: '#e8f5e9',
                  borderRadius: '6px',
                  borderLeft: '4px solid #4caf50',
                  marginTop: '1.5rem'
                }}>
                  <p style={{ margin: 0, color: '#2e7d32', fontWeight: 'bold' }}>
                     No hay cambios pendientes
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                    Se validará la dotación actual y se generará el archivo.
                  </p>
                </div>
              )}
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'center',
              paddingTop: '1rem',
              borderTop: '1px solid #eee'
            }}>
              <button
                onClick={() => setShowResumenModal(false)}
                className={styles.modalCancelarGrisMediano}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarGuardado}
                className={styles.modalAceptarAzulMediano}
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  justifyContent: 'center'
                }}
              >
                {isSaving ? <><span className={styles.buttonSpinner} />Guardando...</> : ' Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <InstructivoModal
        isOpen={showInstructivo}
        onClose={() => setShowInstructivo(false)}
        pantalla="administrar-dotacion"
      />
    </div>
  );
}
