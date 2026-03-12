/**
 * Estructura de Venta - Cambios Masivos
 * Tabla Vendedor Titular simplificada
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './estructura-venta.module.css';
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
    es_pendiente_validacion?: boolean;
  };
}

interface HistorialValidacion {
  usuario: string;
  nombre: string;
  zonas: string;
  estado: string;
  fecha_validacion: string | null;
}

export default function EstructuraVentaPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  
  const [estructuraData, setEstructuraData] = useState<EstructuraData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string>('');
  const [esPendienteValidacion, setEsPendienteValidacion] = useState(false);
  const [historialValidacion, setHistorialValidacion] = useState<HistorialValidacion[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showInstructivo, setShowInstructivo] = useState(false);
  
  // Estado para zona seleccionada
  const [selectedZona, setSelectedZona] = useState<string>('');
  
  // Estado para validación de zonas
  const [zonasValidadas, setZonasValidadas] = useState<Record<string, { validado: boolean; fecha_validacion: string | null }>>({});
  
  // Estados para el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [vendedorEditando, setVendedorEditando] = useState<VendedorTitular | null>(null);
  const [datosEditados, setDatosEditados] = useState<Partial<VendedorTitular>>({});
  
  // Estados para el modal de agregar
  const [showAgregarModal, setShowAgregarModal] = useState(false);
  const [nuevoVendedor, setNuevoVendedor] = useState<Partial<VendedorTitular>>({
    Año: new Date().getFullYear(),
    Mes: new Date().getMonth() + 1,
    CodDistrito: selectedZona || '',
    ZonaEstival: 'INTERIOR'
    // Cargo no tiene valor inicial para forzar selección explícita
  });
  
  // Estados para modales de mensajes
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageModalContent, setMessageModalContent] = useState({ title: '', message: '', type: 'info' as 'info' | 'success' | 'error' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '' });
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  
  // Estado para modal de resumen de cambios
  const [showResumenModal, setShowResumenModal] = useState(false);
  
  // Estado para modal de advertencia de datos faltantes
  const [showAdvertenciaModal, setShowAdvertenciaModal] = useState(false);
  const [vendedoresIncompletos, setVendedoresIncompletos] = useState<Array<{vendedor: VendedorTitular, datosFaltantes: string[]}>>([]);
  
  // Estados para modal de opciones (Editar/Mover)
  const [showOpcionesModal, setShowOpcionesModal] = useState(false);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<VendedorTitular | null>(null);
  
  // Estados para modal de mover
  const [showMoverModal, setShowMoverModal] = useState(false);
  const [tablaDestino, setTablaDestino] = useState<string>('');
  
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

  // Estado de carga para validación/guardado
  const [isGuardando, setIsGuardando] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Estados para ordenamiento de tablas
  const [sortConfig, setSortConfig] = useState<{
    titular: { column: 'oficina' | 'nombre' | null; direction: 'asc' | 'desc' };
    residente: { column: 'oficina' | 'nombre' | null; direction: 'asc' | 'desc' };
    gestor: { column: 'oficina' | 'nombre' | null; direction: 'asc' | 'desc' };
    reemplazo: { column: 'oficina' | 'nombre' | null; direction: 'asc' | 'desc' };
    eliminados: { column: 'oficina' | 'nombre' | null; direction: 'asc' | 'desc' };
  }>({
    titular: { column: null, direction: 'asc' },
    residente: { column: null, direction: 'asc' },
    gestor: { column: null, direction: 'asc' },
    reemplazo: { column: null, direction: 'asc' },
    eliminados: { column: null, direction: 'asc' }
  });
  
  // Referencia para la tabla de eliminados
  const tablaEliminadosRef = useRef<HTMLDivElement>(null);

  // Proteger ruta
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
  
  // Funciones para mostrar modales personalizados
  const showMessage = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setMessageModalContent({ title, message, type });
    setShowMessageModal(true);
  };
  
  const showConfirm = (title: string, message: string, callback: () => void) => {
    setConfirmModalContent({ title, message });
    setConfirmCallback(() => callback);
    setShowConfirmModal(true);
  };
  
  const handleConfirmYes = () => {
    setShowConfirmModal(false);
    if (confirmCallback) {
      confirmCallback();
    }
  };
  
  const handleConfirmNo = () => {
    setShowConfirmModal(false);
    setConfirmCallback(null);
  };

  // Función para manejar el ordenamiento de las tablas
  const handleSort = (tabla: 'titular' | 'residente' | 'gestor' | 'reemplazo' | 'eliminados', column: 'oficina' | 'nombre') => {
    setSortConfig(prev => {
      const currentConfig = prev[tabla];
      const newDirection = currentConfig.column === column && currentConfig.direction === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        [tabla]: { column, direction: newDirection }
      };
    });
  };
  
  // Función para ordenar vendedores
  const sortVendedores = (vendedores: VendedorTitular[], config: { column: 'oficina' | 'nombre' | null; direction: 'asc' | 'desc' }) => {
    if (!config.column) return vendedores;
    
    return [...vendedores].sort((a, b) => {
      const direction = config.direction === 'asc' ? 1 : -1;
      
      if (config.column === 'oficina') {
        return direction * (a.DesOficina || '').localeCompare(b.DesOficina || '');
      } else if (config.column === 'nombre') {
        return direction * (a.NombreCompleto || '').localeCompare(b.NombreCompleto || '');
      }
      
      return 0;
    });
  };

  // Helper para obtener el nombre completo de una zona dado su código
  const getNombreZona = (codigo: string): string => {
    if (!estructuraData) return codigo;
    for (const sheet of estructuraData.sheets) {
      const v = sheet.data.find((row: any) => row.CodDistrito === codigo);
      if (v?.DesDistrito) return v.DesDistrito;
    }
    return codigo;
  };

  // Cargar datos del Excel base al montar el componente
  useEffect(() => {
    if (isAuthenticated && user) {
      cargarEstructuraVenta();
      cargarEstadoValidacionZonas();
      // Si es admin, cargar historial
      if (user.cargo?.toUpperCase() === 'ADMIN') {
        cargarHistorialValidacion();
      }
    }
  }, [isAuthenticated, user]);

  // Establecer la primera zona como seleccionada por defecto
  useEffect(() => {
    if (estructuraData?.metadata.user_distritos && estructuraData.metadata.user_distritos.length > 0) {
      if (!selectedZona || !estructuraData.metadata.user_distritos.includes(selectedZona)) {
        setSelectedZona(estructuraData.metadata.user_distritos[0]);
      }
    }
  }, [estructuraData]);

  const cargarHistorialValidacion = async () => {
    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      const response = await fetch(`${API_URL}/api/estructura-venta/historial-validacion`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistorialValidacion(data.historial || []);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const cargarEstadoValidacionZonas = async () => {
    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      const response = await fetch(`${API_URL}/api/estructura-venta/estado-validacion-zonas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setZonasValidadas(data.estados || {});
        
        // Actualizar estado general de pendiente validación
        // Si alguna zona no está validada, entonces hay pendientes
        const hayPendientes = Object.values(data.estados || {}).some(
          (estado: any) => !estado.validado
        );
        setEsPendienteValidacion(hayPendientes);
      }
    } catch (error) {
      console.error('Error al cargar estado de validación de zonas:', error);
    }
  };

  const cargarEstructuraVenta = async (reintentos = 2) => {
    try {
      setIsLoadingData(true);
      setError('');
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      
      let response: Response | null = null;
      let lastError: Error | null = null;
      
      for (let intento = 0; intento <= reintentos; intento++) {
        try {
          if (intento > 0) {
            // Esperar antes de reintentar (el archivo puede estar procesándose)
            await new Promise(r => setTimeout(r, 1000 * intento));
          }
          response = await fetch(`${API_URL}/api/estructura-venta/cargar`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) break;
          lastError = new Error('Error al cargar estructura de ventas');
        } catch (err: any) {
          lastError = err;
          response = null;
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('Error al cargar estructura de ventas');
      }
      
      const data = await response.json();
      
      setEstructuraData(data);
      setEsPendienteValidacion(data.metadata?.es_pendiente_validacion || false);
      
      // Detectar si es un archivo nuevo comparando con el guardado en localStorage
      const archivoActual = data.metadata?.filename || '';
      const archivoGuardado = localStorage.getItem('estructura_venta_archivo_actual');
      
      if (archivoGuardado && archivoGuardado !== archivoActual) {
        // Es un archivo nuevo (nuevo mes), limpiar el estado de cambios guardados
        localStorage.removeItem('estructura_venta_cambios_guardados');
      }
      
      // Guardar el nombre del archivo actual
      localStorage.setItem('estructura_venta_archivo_actual', archivoActual);
      
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

  // Manejar doble clic en vendedor para editar
  const handleDoubleClickVendedor = (vendedor: VendedorTitular) => {
    setVendedorSeleccionado(vendedor);
    setShowOpcionesModal(true);
  };
  
  // Manejar selección de Editar
  const handleSeleccionarEditar = () => {
    if (vendedorSeleccionado) {
      setShowOpcionesModal(false);
      setVendedorEditando(vendedorSeleccionado);
      setDatosEditados(vendedorSeleccionado);
      setShowEditModal(true);
    }
  };
  
  // Manejar selección de Mover
  const handleSeleccionarMover = () => {
    if (vendedorSeleccionado) {
      setShowOpcionesModal(false);
      setShowMoverModal(true);
      setTablaDestino('');
    }
  };
  
  // Manejar selección de Eliminar
  const handleSeleccionarEliminar = () => {
    if (vendedorSeleccionado) {
      setShowOpcionesModal(false);
      showConfirm(
        'Confirmar Eliminación',
        `¿Estás seguro que quieres eliminar a ${vendedorSeleccionado.NombreCompleto}?`,
        () => handleConfirmarEliminar()
      );
    }
  };
  
  // Confirmar eliminación de vendedor
  const handleConfirmarEliminar = () => {
    if (!vendedorSeleccionado) return;
    
    const vendedorEliminado = { ...vendedorSeleccionado, Estatus: 'Eliminado' };
    
    // Agregar a la lista de eliminados
    setCambiosPendientes(prev => ({
      ...prev,
      eliminados: [...prev.eliminados, vendedorEliminado]
    }));
    setHayCambiosPendientes(true);
    
    // Marcar como eliminado en la vista local (moverlo a tabla Eliminados)
    setEstructuraData(prevData => {
      if (!prevData) return prevData;
      
      const newSheets = prevData.sheets.map(sheet => ({
        ...sheet,
        data: sheet.data.map(v => 
          v.CodVenta === vendedorSeleccionado.CodVenta && v.Rut === vendedorSeleccionado.Rut
            ? { ...v, Estatus: 'Eliminado' }
            : v
        )
      }));
      
      return {
        ...prevData,
        sheets: newSheets
      };
    });
    
    setVendedorSeleccionado(null);
    showMessage('Éxito', `Vendedor movido a Dotación Eliminada (cambio pendiente de guardar)`, 'success');
  };
  
  // Manejar confirmación de mover vendedor
  const handleConfirmarMover = () => {
    if (!vendedorSeleccionado || !tablaDestino) {
      showMessage('Error', 'Por favor seleccione una tabla de destino', 'error');
      return;
    }
    
    const vendedorActualizado = { ...vendedorSeleccionado };
    
    // Actualizar Cargo y DesOficina según la tabla destino
    switch (tablaDestino) {
      case 'Vendedor Titular':
        vendedorActualizado.Cargo = 'TITULAR';
        vendedorActualizado.DesOficina = vendedorActualizado.DesDistrito;
        vendedorActualizado.CodOficina = vendedorActualizado.CodDistrito;
        break;
      case 'Gestor Supermercado (Titular)':
        vendedorActualizado.Cargo = 'GESTOR';
        vendedorActualizado.DesOficina = vendedorActualizado.DesDistrito;
        vendedorActualizado.CodOficina = vendedorActualizado.CodDistrito;
        break;
      case 'Vendedor Titular - Residentes':
        vendedorActualizado.Cargo = 'TITULAR';
        // Si DesOficina es igual a DesDistrito, cambiarla para forzar que sea diferente
        if (vendedorActualizado.DesOficina === vendedorActualizado.DesDistrito) {
          // Poner una oficina temporal diferente (el usuario puede editarla después)
          vendedorActualizado.DesOficina = vendedorActualizado.DesOficina + ' (RESIDENTE)';
        }
        break;
      case 'Vendedor Reemplazo':
        vendedorActualizado.Cargo = 'REEMPLAZO';
        break;
    }
    
    // Actualizar NombreCompleto
    vendedorActualizado.NombreCompleto = `${vendedorActualizado.Nombre || ''} ${vendedorActualizado.APaterno || ''} ${vendedorActualizado.AMaterno || ''}`.trim();
    
    // Actualizar Estatus: mantener 'Nuevo' si ya era nuevo, sino 'Modificado'
    vendedorActualizado.Estatus = vendedorActualizado.Estatus === 'Nuevo' ? 'Nuevo' : 'Modificado';
    
    // Crear clave única
    const key = `${vendedorActualizado.CodVenta}_${vendedorActualizado.Rut}`;
    
    // Guardar en cambios pendientes
    setCambiosPendientes(prev => {
      const nuevosEditados = new Map(prev.editados);
      nuevosEditados.set(key, vendedorActualizado);
      return {
        ...prev,
        editados: nuevosEditados
      };
    });
    setHayCambiosPendientes(true);
    
    // Actualizar los datos localmente en TODAS las sheets
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
    
    setShowMoverModal(false);
    setVendedorSeleccionado(null);
    showMessage('Éxito', `Vendedor movido a "${tablaDestino}" (cambio pendiente de guardar)`, 'success');
  };

  // Restaurar vendedor eliminado
  const handleRestaurarEliminado = (vendedor: VendedorTitular) => {
    showConfirm(
      'Restaurar Vendedor',
      `¿Desea restaurar a ${vendedor.NombreCompleto} a su tabla original?`,
      () => {
        const vendedorRestaurado = { ...vendedor, Estatus: 'Antiguo' };
        
        // Crear clave única
        const key = `${vendedorRestaurado.CodVenta}_${vendedorRestaurado.Rut}`;
        
        // Guardar en cambios pendientes
        setCambiosPendientes(prev => {
          const nuevosEditados = new Map(prev.editados);
          nuevosEditados.set(key, vendedorRestaurado);
          
          // Remover de la lista de eliminados si estaba ahí
          const nuevosEliminados = prev.eliminados.filter(
            v => !(v.CodVenta === vendedor.CodVenta && v.Rut === vendedor.Rut)
          );
          
          return {
            ...prev,
            editados: nuevosEditados,
            eliminados: nuevosEliminados
          };
        });
        setHayCambiosPendientes(true);
        
        // Actualizar los datos localmente en TODAS las sheets
        setEstructuraData(prevData => {
          if (!prevData) return prevData;
          
          const newSheets = prevData.sheets.map(sheet => ({
            ...sheet,
            data: sheet.data.map(v => 
              v.CodVenta === vendedorRestaurado.CodVenta && v.Rut === vendedorRestaurado.Rut
                ? { ...v, Estatus: 'Antiguo' }
                : v
            )
          }));
          
          return {
            ...prevData,
            sheets: newSheets
          };
        });
        
        showMessage('Éxito', `${vendedor.NombreCompleto} ha sido restaurado (cambio pendiente de guardar)`, 'success');
      }
    );
  };

  // Manejar cambio de campo en el modal
  const handleCampoChange = (campo: keyof VendedorTitular, valor: any) => {
    setDatosEditados(prev => {
      const updated = {
        ...prev,
        [campo]: valor
      };
      
      // Si se cambia DesOficina, actualizar también el distrito correspondiente
      if (campo === 'DesOficina' && estructuraData) {
        // Buscar el CodOficina, CodDistrito y DesDistrito correspondiente a esta oficina
        const vendedorConOficina = estructuraData.sheets
          .flatMap((s: any) => s.data)
          .find((v: any) => v.DesOficina === valor);
        
        if (vendedorConOficina) {
          updated.CodOficina = vendedorConOficina.CodOficina;
          updated.CodDistrito = vendedorConOficina.CodDistrito;
          updated.DesDistrito = vendedorConOficina.DesDistrito;
        }
      }
      
      return updated;
    });
  };

  // Guardar cambios del vendedor en memoria (no en backend aún)
  const handleGuardarEdicion = async () => {
    if (!vendedorEditando) return;
    
    try {
      // Combinar datos originales con los editados
      const vendedorActualizado = {
        ...vendedorEditando,
        ...datosEditados,
        // Establecer estatus: mantener 'Nuevo' si ya era nuevo, sino 'Modificado'
        Estatus: vendedorEditando.Estatus === 'Nuevo' ? 'Nuevo' : 'Modificado'
      };
      
      // Validar campos obligatorios
      const camposVacios = [];
      if (!vendedorActualizado.DesOficina) camposVacios.push('Oficina');
      if (!vendedorActualizado.CodVenta) camposVacios.push('Cod. Venta');
      if (!vendedorActualizado.Rut) camposVacios.push('RUT');
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
      
      // Actualizar NombreCompleto si se modificaron nombre o apellidos
      if (datosEditados.Nombre || datosEditados.APaterno || datosEditados.AMaterno) {
        vendedorActualizado.NombreCompleto = `${vendedorActualizado.Nombre || ''} ${vendedorActualizado.APaterno || ''} ${vendedorActualizado.AMaterno || ''}`.trim();
      }
      
      // Crear clave única para el vendedor
      const key = `${vendedorActualizado.CodVenta}_${vendedorActualizado.Rut}`;
      
      // Guardar en cambios pendientes
      setCambiosPendientes(prev => {
        const nuevosEditados = new Map(prev.editados);
        nuevosEditados.set(key, vendedorActualizado);
        return {
          ...prev,
          editados: nuevosEditados
        };
      });
      setHayCambiosPendientes(true);
      
      // Actualizar los datos localmente para visualización inmediata
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
      
      // Cerrar modal
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

  // Abrir modal de agregar
  const handleAbrirAgregar = () => {
    const vendedorZona = estructuraData?.sheets[0]?.data.find((v: any) => v.CodDistrito === selectedZona);
    const zonaNombre = vendedorZona?.DesDistrito || '';
    const zonaCodOficina = vendedorZona?.CodOficina || selectedZona || '';
    setNuevoVendedor({
      Año: new Date().getFullYear(),
      Mes: new Date().getMonth() + 1,
      CodDistrito: selectedZona || '',
      DesDistrito: zonaNombre,
      CodOficina: zonaCodOficina,
      DesOficina: zonaNombre,
      CodVenta: '',
      Cargo: '', // Vacío para forzar selección explícita
      Rut: '',
      Nombre: '',
      APaterno: '',
      AMaterno: '',
      Telefono: '',
      Correo: '',
      ZonaEstival: 'INTERIOR',
      Genero: '',
      TallaPantalon: undefined,
      TallaCamisa: ''
    });
    setShowAgregarModal(true);
  };

  // Manejar cambio de campo en el modal de agregar
  const handleCampoAgregarChange = (campo: keyof VendedorTitular, valor: any) => {
    setNuevoVendedor(prev => {
      const updated = {
        ...prev,
        [campo]: valor
      };
      
      // Si se cambia DesOficina, actualizar también el distrito correspondiente
      if (campo === 'DesOficina' && estructuraData) {
        // Buscar el CodOficina, CodDistrito y DesDistrito correspondiente a esta oficina
        const vendedorConOficina = estructuraData.sheets
          .flatMap((s: any) => s.data)
          .find((v: any) => v.DesOficina === valor);
        
        if (vendedorConOficina) {
          updated.CodOficina = vendedorConOficina.CodOficina;
          updated.CodDistrito = vendedorConOficina.CodDistrito;
          updated.DesDistrito = vendedorConOficina.DesDistrito;
        }
      }
      
      return updated;
    });
  };

  // Validar que todos los campos requeridos estén llenos
  const validarCamposCompletos = (datos: Partial<VendedorTitular>): boolean => {
    const camposRequeridos: (keyof VendedorTitular)[] = [
      'DesOficina', 'Cargo', 'CodVenta', 'Rut', 'Nombre', 'APaterno', 'AMaterno',
      'Telefono', 'Correo', 'Genero', 'TallaPantalon', 'TallaCamisa'
    ];
    
    // Verificar que todos los campos tengan valor
    for (const campo of camposRequeridos) {
      const valor = datos[campo];
      if (valor === undefined || valor === null || valor === '') {
        return false;
      }
    }
    
    // Validar formato de correo: debe terminar en @cial.cl
    if (datos.Correo && !datos.Correo.endsWith('@cial.cl')) {
      return false;
    }
    
    // Validar formato de teléfono: debe comenzar con 9 y tener 9 dígitos
    if (datos.Telefono) {
      const telefono = datos.Telefono.toString();
      if (!/^9\d{8}$/.test(telefono)) {
        return false;
      }
    }
    
    return true;
  };

  // Guardar nuevo vendedor en memoria (no en backend aún)
  const handleGuardarNuevo = async () => {
    // Validar campos obligatorios
    const camposVacios = [];
    if (!nuevoVendedor.DesOficina) camposVacios.push('Oficina');
    if (!nuevoVendedor.Cargo) camposVacios.push('Cargo');
    if (!nuevoVendedor.CodVenta) camposVacios.push('Cod. Venta');
    if (!nuevoVendedor.Rut) camposVacios.push('RUT');
    if (!nuevoVendedor.Nombre) camposVacios.push('Nombre');
    if (!nuevoVendedor.APaterno) camposVacios.push('Apellido Paterno');
    if (!nuevoVendedor.AMaterno) camposVacios.push('Apellido Materno');
    if (!nuevoVendedor.Telefono) camposVacios.push('Teléfono');
    if (!nuevoVendedor.Correo) camposVacios.push('Correo');
    if (!nuevoVendedor.Genero) camposVacios.push('Género');
    if (!nuevoVendedor.TallaPantalon) camposVacios.push('Talla Pantalón');
    if (!nuevoVendedor.TallaCamisa) camposVacios.push('Talla Camisa');
    
    if (camposVacios.length > 0) {
      showMessage('Campos Incompletos', `Por favor complete los siguientes campos: ${camposVacios.join(', ')}`, 'error');
      return;
    }
    
    // Validar formato de RUT (permitir 0-0 como caso especial)
    if (nuevoVendedor.Rut && nuevoVendedor.Rut !== '0-0') {
      const rutRegex = /^\d{1,8}-[0-9Kk]$/;
      if (!rutRegex.test(nuevoVendedor.Rut)) {
        showMessage('RUT Inválido', 'El RUT debe tener el formato 12345678-9 o 12345678-K', 'error');
        return;
      }
    }
    
    // Validar formato de correo
    if (nuevoVendedor.Correo && !nuevoVendedor.Correo.endsWith('@cial.cl')) {
      showMessage('Correo Inválido', 'El correo debe terminar en @cial.cl', 'error');
      return;
    }
    
    // Validar formato de teléfono (debe ser 9XXXXXXXX)
    if (nuevoVendedor.Telefono) {
      const telefonoStr = nuevoVendedor.Telefono.toString();
      if (!/^9\d{8}$/.test(telefonoStr)) {
        showMessage('Teléfono Inválido', 'El teléfono debe comenzar con 9 y tener 9 dígitos (ej: 912345678)', 'error');
        return;
      }
    }
    
    try {
      // Normalizar Cargo al formato del sistema
      let cargoNormalizado = nuevoVendedor.Cargo;
      if (nuevoVendedor.Cargo === 'VENDEDOR TITULAR') cargoNormalizado = 'TITULAR';
      if (nuevoVendedor.Cargo === 'VENDEDOR RESIDENTE') cargoNormalizado = 'TITULAR'; // Residente es también TITULAR
      if (nuevoVendedor.Cargo === 'GESTOR SUPERMERCADO') cargoNormalizado = 'GESTOR';
      if (nuevoVendedor.Cargo === 'VENDEDOR REEMPLAZO') cargoNormalizado = 'REEMPLAZO';
      
      // Crear NombreCompleto
      const vendedorConNombre = {
        ...nuevoVendedor,
        Cargo: cargoNormalizado,
        NombreCompleto: `${nuevoVendedor.Nombre || ''} ${nuevoVendedor.APaterno || ''} ${nuevoVendedor.AMaterno || ''}`.trim(),
        TieneDatosFaltantes: false,
        Estatus: 'Nuevo'
      };
      
      // Agregar a cambios pendientes
      setCambiosPendientes(prev => ({
        ...prev,
        nuevos: [...prev.nuevos, vendedorConNombre as VendedorTitular]
      }));
      setHayCambiosPendientes(true);
      
      // Agregar a datos locales para visualización inmediata
      setEstructuraData(prevData => {
        if (!prevData) return prevData;
        
        // Agregar a TODAS las hojas (sheet 0 por defecto) - luego getTablasPorZona lo filtrará correctamente
        const newSheets = prevData.sheets.map((sheet, idx) => {
          if (idx === 0) { // Agregar solo a la primera hoja
            return {
              ...sheet,
              data: [...sheet.data, vendedorConNombre as VendedorTitular],
              rows: sheet.rows + 1
            };
          }
          return sheet;
        });
        
        return {
          ...prevData,
          sheets: newSheets
        };
      });
      
      // Cerrar modal y resetear formulario
      setShowAgregarModal(false);
      setNuevoVendedor({
        Año: new Date().getFullYear(),
        Mes: new Date().getMonth() + 1,
        CodDistrito: selectedZona || '',
        ZonaEstival: 'INTERIOR'
        // Cargo no tiene valor inicial para forzar selección explícita
      });
      
      showMessage('Vendedor Agregado', 'Vendedor agregado en memoria. Presione "Guardar" para aplicar al archivo.', 'success');
    } catch (error) {
      console.error('Error al agregar:', error);
      showMessage('Error', `Error al agregar el vendedor: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    }
  };

  // Cerrar modal de agregar
  const handleCerrarAgregar = () => {
    setShowAgregarModal(false);
    setNuevoVendedor({
      Año: new Date().getFullYear(),
      Mes: new Date().getMonth() + 1,
      CodDistrito: selectedZona || '',
      Cargo: 'TITULAR',
      ZonaEstival: 'INTERIOR'
    });
  };

  // Restablecer archivo desde respaldo
  const handleRestablecer = async () => {
    const zonaTexto = selectedZona ? ` de la zona ${selectedZona}` : '';
    showConfirm(
      'Confirmar Restablecer',
      `¿Está seguro de restablecer los datos${zonaTexto} desde el respaldo? Esto eliminará todos los cambios realizados en esta zona.`,
      async () => {
        setIsRestoring(true);
        try {
          const token = Cookies.get('auth_token');
          
          const response = await fetch(`${getApiUrl()}/api/estructura-venta/restablecer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ zona: selectedZona || undefined })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error al restablecer archivo');
          }
          
          // Recargar datos después de restablecer
          await cargarEstructuraVenta();
          
          // Resetear estados de la zona actual
          localStorage.removeItem('estructura_venta_cambios_guardados');
          setCambiosPendientes({
            editados: new Map(),
            nuevos: [],
            eliminados: []
          });
          setHayCambiosPendientes(false);
          
          // IMPORTANTE: Al restablecer, volver a estado pendiente de validación
          setEsPendienteValidacion(true);
          
          showMessage('Éxito', `Datos${zonaTexto} restaurados exitosamente desde el respaldo`, 'success');
        } catch (error) {
          console.error('Error al restablecer:', error);
          showMessage('Error', `Error al restablecer el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
        } finally {
          setIsRestoring(false);
        }
      }
    );
  };
  
  // Guardar todos los cambios acumulados al archivo
  const handleGuardarTodo = async () => {
    // Verificar si hay vendedores con datos faltantes en la zona seleccionada
    const incompletos: Array<{vendedor: VendedorTitular, datosFaltantes: string[]}> = [];
    
    // Obtener solo los vendedores de la zona actualmente seleccionada
    const todosLosVendedores = estructuraData ? estructuraData.sheets.flatMap((s: any) => s.data).filter((v: any) => v.Estatus !== 'Eliminado' && v.CodDistrito === selectedZona) : [];
    
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
    
    // Si no hay cambios pendientes en la zona actual, ejecutar validación directamente
    const editadosZona = Array.from(cambiosPendientes.editados.values()).filter((v: any) => v.CodDistrito === selectedZona);
    const nuevosZona = cambiosPendientes.nuevos.filter((v: any) => v.CodDistrito === selectedZona);
    const eliminadosZona = cambiosPendientes.eliminados.filter((v: any) => v.CodDistrito === selectedZona);
    const hayCambiosEnZona = editadosZona.length > 0 || nuevosZona.length > 0 || eliminadosZona.length > 0;
    if (!hayCambiosEnZona) {
      await handleValidarSinCambios();
      return;
    }
    
    // Si no hay incompletos y hay cambios, mostrar modal de resumen
    setShowResumenModal(true);
  };
  
  // Confirmar y ejecutar el guardado después de ver el resumen
  const handleConfirmarGuardado = async () => {
    setShowResumenModal(false);
    setIsGuardando(true);
    setStepMessage('Guardando cambios en el servidor...');
    
    try {
      const token = Cookies.get('auth_token');
      
      if (!selectedZona) {
        showMessage('Error', 'Debe seleccionar una zona para validar', 'error');
        return;
      }
      
      // Convertir el Map a array, filtrando solo la zona seleccionada
      const editados = Array.from(cambiosPendientes.editados.values()).filter((v: any) => v.CodDistrito === selectedZona);
      const nuevos = cambiosPendientes.nuevos.filter((v: any) => v.CodDistrito === selectedZona);
      const eliminados = cambiosPendientes.eliminados.filter((v: any) => v.CodDistrito === selectedZona);
      
      const response = await fetch(`${getApiUrl()}/api/estructura-venta/guardar-todos-cambios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          editados: editados,
          nuevos: nuevos,
          eliminados: eliminados,
          marcar_validado: true,  // Indicar que debe marcar como validado (solo desde Estructura de Venta)
          zona: selectedZona  // Enviar zona seleccionada
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al guardar cambios');
      }
      
      const result = await response.json();
      setStepMessage('Validando zona...');
      
      // Guardar referencia de si había eliminados en la zona actual ANTES de limpiar
      const habiaEliminados = cambiosPendientes.eliminados.filter((v: any) => v.CodDistrito === selectedZona).length > 0;
      
      // Limpiar solo los cambios pendientes de la zona actual
      setCambiosPendientes(prev => {
        const nuevosEditados = new Map(prev.editados);
        Array.from(prev.editados.entries()).forEach(([key, v]) => {
          if ((v as any).CodDistrito === selectedZona) nuevosEditados.delete(key);
        });
        return {
          editados: nuevosEditados,
          nuevos: prev.nuevos.filter((v: any) => v.CodDistrito !== selectedZona),
          eliminados: prev.eliminados.filter((v: any) => v.CodDistrito !== selectedZona)
        };
      });
      // Actualizar hayCambiosPendientes después del estado (se resolverá en el próximo render)
      setHayCambiosPendientes(false);
      localStorage.setItem('estructura_venta_cambios_guardados', 'true');
      
      setStepMessage('Recargando datos actualizados...');
      // Recargar datos desde el servidor
      await cargarEstructuraVenta();
      
      // Recargar estado de validación de zonas
      await cargarEstadoValidacionZonas();
      
      // Si es admin, recargar historial
      if (user && user.cargo?.toUpperCase() === 'ADMIN') {
        await cargarHistorialValidacion();
      }
      
      showMessage('Éxito', `Zona ${getNombreZona(selectedZona)} validada exitosamente con ${result.total_cambios} cambios.`, 'success');
      
      // Si había eliminados, hacer scroll hacia la tabla de eliminados después de un breve delay
      if (habiaEliminados) {
        setTimeout(() => {
          tablaEliminadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 800);
      }
    } catch (error) {
      console.error('Error al guardar todos los cambios:', error);
      showMessage('Error', `Error al guardar los cambios: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    } finally {
      setIsGuardando(false);
      setStepMessage('');
    }
  };

  // Validar estructura sin cambios
  const handleValidarSinCambios = async () => {
    setIsGuardando(true);
    setStepMessage('Validando zona...');
    try {
      const token = Cookies.get('auth_token');
      
      if (!selectedZona) {
        showMessage('Error', 'Debe seleccionar una zona para validar', 'error');
        return;
      }
      
      const response = await fetch(`${getApiUrl()}/api/estructura-venta/validar-sin-cambios`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zona: selectedZona
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al validar estructura');
      }

      const result = await response.json();
      
      setStepMessage('Recargando estado de zonas...');
      // Recargar estado de validación de zonas
      await cargarEstadoValidacionZonas();
      
      showMessage('Éxito', `Zona ${getNombreZona(selectedZona)} validada exitosamente`, 'success');
    } catch (error) {
      console.error('Error al validar estructura:', error);
      showMessage('Error', `Error al validar: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    } finally {
      setIsGuardando(false);
      setStepMessage('');
    }
  };
  
  // Verificar si un vendedor ha sido editado
  const esVendedorEditado = (vendedor: VendedorTitular): boolean => {
    const key = `${vendedor.CodVenta}_${vendedor.Rut}`;
    return cambiosPendientes.editados.has(key);
  };

  // Verificar si un vendedor es nuevo (recién agregado)
  const esVendedorNuevo = (vendedor: VendedorTitular): boolean => {
    return cambiosPendientes.nuevos.some(
      v => v.CodVenta === vendedor.CodVenta && v.Rut === vendedor.Rut
    );
  };

  // Obtener vendedores de cada tabla filtrados por zona
  const getTablasPorZona = () => {
    if (!estructuraData) return {
      vendedorTitular: [],
      gestorSupermercado: [],
      vendedorResidentes: [],
      vendedorReemplazo: [],
      eliminados: []
    };
    
    // Obtener todos los datos de todas las hojas
    const allData = estructuraData.sheets.flatMap(s => s.data);
    
    // Filtrar por eliminados
    const eliminados = allData.filter(v => v.Estatus === 'Eliminado');
    
    // Filtrar por Cargo y DesOficina (lógica dinámica basada en datos actuales)
    const vendedorTitular = allData.filter(v => 
      v.Estatus !== 'Eliminado' && 
      v.Cargo === 'TITULAR' && 
      v.DesOficina === v.DesDistrito
    );
    
    const gestorSupermercado = allData.filter(v => 
      v.Estatus !== 'Eliminado' && 
      v.Cargo === 'GESTOR' && 
      v.DesOficina === v.DesDistrito
    );
    
    const vendedorResidentes = allData.filter(v => 
      v.Estatus !== 'Eliminado' && 
      v.Cargo === 'TITULAR' && 
      v.DesOficina !== v.DesDistrito
    );
    
    const vendedorReemplazo = allData.filter(v => 
      v.Estatus !== 'Eliminado' && 
      v.Cargo === 'REEMPLAZO'
    );
    
    // Si no hay zona seleccionada, retornar todos
    if (!selectedZona) {
      return {
        vendedorTitular,
        gestorSupermercado,
        vendedorResidentes,
        vendedorReemplazo,
        eliminados
      };
    }
    
    // Filtrar por zona seleccionada
    return {
      vendedorTitular: vendedorTitular.filter((v: any) => v.CodDistrito === selectedZona),
      gestorSupermercado: gestorSupermercado.filter((v: any) => v.CodDistrito === selectedZona),
      vendedorResidentes: vendedorResidentes.filter((v: any) => v.CodDistrito === selectedZona),
      vendedorReemplazo: vendedorReemplazo.filter((v: any) => v.CodDistrito === selectedZona),
      eliminados: eliminados.filter((v: any) => v.CodDistrito === selectedZona)
    };
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

  const tablas = getTablasPorZona();

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button onClick={handleBackToMenu} className={styles.backButton}>
              ← Volver
            </button>
            <h1>Gestión de Estructura de Ventas</h1>
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
              userName={user?.nombre || ''}
              userEmail={user?.email || ''}
              userRole={user?.cargo || ''}
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
            {/* Pestañas de Zonas (si el usuario tiene más de una zona) */}
            {estructuraData.metadata.user_distritos && estructuraData.metadata.user_distritos.length > 1 && (
              <div className={styles.zonasContainer}>
                 <p className={styles.zonasLabel}>Zona activa:</p>
                   <div className={styles.zonasTabs}></div>
                     <div className={styles.zonaTabs} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {estructuraData.metadata.user_distritos.map((zona: string) => {
                    // Buscar el nombre completo de la zona en todos los sheets
                    let nombreZona = zona;
                    for (const sheet of estructuraData.sheets) {
                      const vendedorDeZona = sheet.data.find((v: any) => v.CodDistrito === zona);
                      if (vendedorDeZona?.DesDistrito) {
                        nombreZona = vendedorDeZona.DesDistrito;
                        break;
                      }
                    }
                    
                    // Verificar si esta zona está validada
                    const zonaValidada = zonasValidadas[zona]?.validado || false;
                    const esSeleccionada = selectedZona === zona;
                    
                    // Siempre partir de la clase base zonaTab para mantener border-radius y estilos comunes
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
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        title={zonaValidada
                          ? `Validado el ${zonasValidadas[zona]?.fecha_validacion || ''}`
                          : 'Esta zona aún no ha sido validada'
                        }
                      >
                        <span>{nombreZona}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* Alerta de Estado de Validación para la zona actual */}
            {selectedZona && zonasValidadas[selectedZona]?.validado && (
              <div style={{
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div>
                  <strong style={{ color: '#155724' }}>Zona {getNombreZona(selectedZona)} Validada</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#155724', fontSize: '0.9rem' }}>
                    Validada el {zonasValidadas[selectedZona]?.fecha_validacion || 'recientemente'}
                  </p>
                </div>
              </div>
            )}

            {/* Alerta de validación pendiente para la zona actual */}
            {selectedZona && !zonasValidadas[selectedZona]?.validado && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div>
                  <strong style={{ color: '#856404' }}>Zona {getNombreZona(selectedZona)} - Validación Pendiente</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#856404', fontSize: '0.9rem' }}>
                    Esta zona requiere validación. Por favor, revisa los datos y presiona "Guardar y Validar".
                  </p>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={handleAbrirAgregar}
                className={styles.agregarButton}
              >
                + Agregar
              </button>
              
              {user && user.cargo?.toUpperCase() === 'ADMIN' && (
                <button
                  onClick={async () => {
                    await cargarHistorialValidacion();
                    setShowHistorial(true);
                  }}
                  className={styles.historialButton}
                >
                  Ver Historial de Validación
                </button>
              )}
              
              <button
                onClick={handleRestablecer}
                className={styles.restablecerButton}
                disabled={isGuardando || isRestoring}
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
                  disabled={isGuardando || isRestoring}
                >
                   Cancelar Cambios
                </button>
              )}
              
              <button
                onClick={handleGuardarTodo}
                disabled={isGuardando || isRestoring}
                className={styles.guardarPrincipalButton}
              >
                {isGuardando ? (
                  <><span className={styles.buttonSpinner} />{stepMessage}</>
                ) : (
                   `Guardar y Validar Zona ${getNombreZona(selectedZona || '')} ${hayCambiosPendientes ? `(${cambiosPendientes.editados.size + cambiosPendientes.nuevos.length + cambiosPendientes.eliminados.length})` : ''}`
                )}
              </button>
              
              {hayCambiosPendientes && (
                <span style={{ color: '#ff9800', fontWeight: 'bold', fontSize: '0.9rem' }}>
                   Hay cambios sin guardar
                </span>
              )}
            </div>

            {/* TABLAS DE VENDEDORES - Vista normal por zona */}
            <div>
              {/* TABLA 1: VENDEDOR TITULAR */}
              {tablas.vendedorTitular.length > 0 && (
                <div className={`${styles.estructuraCard} ${styles.cardTitular}`}>
                  <div className={`${styles.estructuraHeader} ${styles.headerTitular}`}>
                    VENDEDOR TITULAR
                  </div>
                  <div className={styles.estructuraContent}>
                    <div className={styles.tableScrollContainer}>
                      <table className={styles.estructuraTable}>
                        <thead>
                          <tr>
                            <th 
                              onClick={() => handleSort('titular', 'oficina')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.titular.column === 'oficina' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Oficina</span>
                                {sortConfig.titular.column === 'oficina' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.titular.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th>Cod. Venta</th>
                            <th>Rut</th>
                            <th 
                              onClick={() => handleSort('titular', 'nombre')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.titular.column === 'nombre' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Nombre</span>
                                {sortConfig.titular.column === 'nombre' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.titular.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortVendedores(tablas.vendedorTitular, sortConfig.titular).map((vendedor, idx) => {
                            const isNuevo = esVendedorNuevo(vendedor);
                            const isEditado = esVendedorEditado(vendedor);
                            return (
                              <tr 
                                key={idx}
                                onDoubleClick={() => handleDoubleClickVendedor(vendedor)}
                                style={{
                                  backgroundColor: isNuevo ? '#e8f5e9' : (isEditado ? '#e3f2fd' : (vendedor.TieneDatosFaltantes ? '#ffebee' : undefined)),
                                  color: isNuevo ? '#2e7d32' : (isEditado ? '#1565c0' : (vendedor.TieneDatosFaltantes ? '#c62828' : undefined)),
                                  cursor: 'pointer',
                                  fontWeight: (isNuevo || isEditado) ? 'bold' : 'normal'
                                }}
                              >
                                <td>{vendedor.DesOficina}</td>
                                <td>{vendedor.CodVenta}</td>
                                <td>{vendedor.Rut}</td>
                                <td>{vendedor.NombreCompleto}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLA 2: VENDEDOR RESIDENTES */}
              {tablas.vendedorResidentes.length > 0 && (
                <div className={`${styles.estructuraCard} ${styles.cardResidente}`}>
                  <div className={`${styles.estructuraHeader} ${styles.headerResidente}`}>
                    VENDEDOR RESIDENTE
                  </div>
                  <div className={styles.estructuraContent}>
                    <div className={styles.tableScrollContainer}>
                      <table className={styles.estructuraTable}>
                        <thead>
                          <tr>
                            <th 
                              onClick={() => handleSort('residente', 'oficina')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.residente.column === 'oficina' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Oficina</span>
                                {sortConfig.residente.column === 'oficina' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.residente.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th>Cod. Venta</th>
                            <th>Rut</th>
                            <th 
                              onClick={() => handleSort('residente', 'nombre')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.residente.column === 'nombre' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Nombre</span>
                                {sortConfig.residente.column === 'nombre' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.residente.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortVendedores(tablas.vendedorResidentes, sortConfig.residente).map((vendedor, idx) => {
                            const isNuevo = esVendedorNuevo(vendedor);
                            const isEditado = esVendedorEditado(vendedor);
                            return (
                              <tr 
                                key={idx}
                                onDoubleClick={() => handleDoubleClickVendedor(vendedor)}
                                style={{
                                  backgroundColor: isNuevo ? '#e8f5e9' : (isEditado ? '#e3f2fd' : (vendedor.TieneDatosFaltantes ? '#ffebee' : undefined)),
                                  color: isNuevo ? '#04cf0e' : (isEditado ? '#1565c0' : (vendedor.TieneDatosFaltantes ? '#c62828' : undefined)),
                                  cursor: 'pointer',
                                  fontWeight: (isNuevo || isEditado) ? 'bold' : 'normal'
                                }}
                              >
                                <td>{vendedor.DesOficina}</td>
                                <td>{vendedor.CodVenta}</td>
                                <td>{vendedor.Rut}</td>
                                <td>{vendedor.NombreCompleto}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLA 3: GESTOR SUPERMERCADO */}
              {tablas.gestorSupermercado.length > 0 && (
                <div className={`${styles.estructuraCard} ${styles.cardSupermercado}`}>
                  <div className={`${styles.estructuraHeader} ${styles.headerSupermercado}`}>
                    GESTOR SUPERMERCADO
                  </div>
                  <div className={styles.estructuraContent}>
                    <div className={styles.tableScrollContainer}>
                      <table className={styles.estructuraTable}>
                        <thead>
                          <tr>
                            <th 
                              onClick={() => handleSort('gestor', 'oficina')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.gestor.column === 'oficina' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Oficina</span>
                                {sortConfig.gestor.column === 'oficina' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.gestor.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th>Cod. Venta</th>
                            <th>Rut</th>
                            <th 
                              onClick={() => handleSort('gestor', 'nombre')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.gestor.column === 'nombre' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Nombre</span>
                                {sortConfig.gestor.column === 'nombre' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.gestor.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortVendedores(tablas.gestorSupermercado, sortConfig.gestor).map((vendedor, idx) => {
                            const isNuevo = esVendedorNuevo(vendedor);
                            const isEditado = esVendedorEditado(vendedor);
                            return (
                              <tr 
                                key={idx}
                                onDoubleClick={() => handleDoubleClickVendedor(vendedor)}
                                style={{
                                  backgroundColor: isNuevo ? '#e8f5e9' : (isEditado ? '#e3f2fd' : (vendedor.TieneDatosFaltantes ? '#ffebee' : undefined)),
                                  color: isNuevo ? '#2e477d' : (isEditado ? '#1565c0' : (vendedor.TieneDatosFaltantes ? '#c62828' : undefined)),
                                  cursor: 'pointer',
                                  fontWeight: (isNuevo || isEditado) ? 'bold' : 'normal'
                                }}
                              >
                                <td>{vendedor.DesOficina}</td>                  
                                <td>{vendedor.CodVenta}</td>
                                <td>{vendedor.Rut}</td>
                                <td>{vendedor.NombreCompleto}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLA 4: VENDEDOR REEMPLAZO */}
              {tablas.vendedorReemplazo.length > 0 && (
                <div className={`${styles.estructuraCard} ${styles.cardReemplazo}`}>
                  <div className={`${styles.estructuraHeader} ${styles.headerReemplazo}`}>
                    VENDEDOR REEMPLAZO
                  </div>
                  <div className={styles.estructuraContent}>
                    <div className={styles.tableScrollContainer}>
                      <table className={styles.estructuraTable}>
                        <thead>
                          <tr>
                            <th 
                              onClick={() => handleSort('reemplazo', 'oficina')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.reemplazo.column === 'oficina' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Oficina</span>
                                {sortConfig.reemplazo.column === 'oficina' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.reemplazo.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th>Cod. Venta</th>
                            <th>Rut</th>
                            <th 
                              onClick={() => handleSort('reemplazo', 'nombre')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.reemplazo.column === 'nombre' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Nombre</span>
                                {sortConfig.reemplazo.column === 'nombre' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.reemplazo.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortVendedores(tablas.vendedorReemplazo, sortConfig.reemplazo).map((vendedor, idx) => {
                            const isNuevo = esVendedorNuevo(vendedor);
                            const isEditado = esVendedorEditado(vendedor);
                            return (
                              <tr 
                                key={idx}
                                onDoubleClick={() => handleDoubleClickVendedor(vendedor)}
                                style={{
                                  backgroundColor: isNuevo ? '#e8f5e9' : (isEditado ? '#e3f2fd' : (vendedor.TieneDatosFaltantes ? '#ffebee' : undefined)),
                                  color: isNuevo ? '#0168a3' : (isEditado ? '#1565c0' : (vendedor.TieneDatosFaltantes ? '#c62828' : undefined)),
                                  cursor: 'pointer',
                                  fontWeight: (isNuevo || isEditado) ? 'bold' : 'normal'
                                }}
                              >
                                <td>{vendedor.DesOficina}</td>
                                <td>{vendedor.CodVenta}</td>
                                <td>{vendedor.Rut}</td>
                                <td>{vendedor.NombreCompleto}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLA 5: DOTACION ELIMINADA */}
              {tablas.eliminados.length > 0 && (
                <div className={`${styles.estructuraCard} ${styles.cardEliminada}`} ref={tablaEliminadosRef}>
                  <div className={`${styles.estructuraHeader} ${styles.headerEliminada}`}>
                    DOTACION ELIMINADA
                  </div>
                  <div className={styles.estructuraContent}>
                    <div className={styles.tableScrollContainer}>
                      <table className={styles.estructuraTable}>
                        <thead>
                          <tr>
                            <th 
                              onClick={() => handleSort('eliminados', 'oficina')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.eliminados.column === 'oficina' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Oficina</span>
                                {sortConfig.eliminados.column === 'oficina' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.eliminados.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th>Cod. Venta</th>
                            <th>Rut</th>
                            <th 
                              onClick={() => handleSort('eliminados', 'nombre')}
                              style={{ 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                background: sortConfig.eliminados.column === 'nombre' ? '#e3f2fd' : 'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Nombre</span>
                                {sortConfig.eliminados.column === 'nombre' && (
                                  <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.7 }}>
                                    {sortConfig.eliminados.direction === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortVendedores(tablas.eliminados, sortConfig.eliminados).map((vendedor, idx) => (
                            <tr 
                              key={idx}
                              onDoubleClick={() => handleRestaurarEliminado(vendedor)}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: 'white'
                              }}
                              title="Doble clic para restaurar"
                            >
                              <td>{vendedor.DesOficina}</td>
                              <td>{vendedor.CodVenta}</td>
                              <td>{vendedor.Rut}</td>
                              <td>{vendedor.NombreCompleto}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
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

              {/* Telefono */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Telefono</label>
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
                  placeholder="ejemplo@cial.cl"
                />
                {datosEditados.Correo && !datosEditados.Correo.endsWith('@cial.cl') && (
                  <span style={{ color: '#f44336', fontSize: '0.85rem' }}>Debe terminar en @cial.cl</span>
                )}
              </div>

              {/* Genero */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Genero</label>
                <select
                  value={datosEditados.Genero ?? ''}
                  onChange={(e) => handleCampoChange('Genero', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">Seleccione</option>
                  <option value="H">H</option>
                  <option value="M">M</option>
                </select>
              </div>

              {/* Talla Pant */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Talla Pantalón</label>
                <input
                  type="number"
                  value={datosEditados.TallaPantalon ?? ''}
                  onChange={(e) => handleCampoChange('TallaPantalon', e.target.value ? parseFloat(e.target.value) : undefined)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
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
                  <option value="">Seleccione</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                  <option value="XXXL">XXXL</option>
                  <option value="4L">4L</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                onClick={handleCerrarModal}
                className={styles.modalCancelarGris}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                className={styles.modalGuardarVerde}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agregar Vendedor */}
      {showAgregarModal && (
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
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#4caf50', fontSize: '1.5rem' }}>
              Agregar
            </h2>
            
            <p style={{ marginBottom: '1rem', color: '#f44336', fontWeight: 'bold' }}>
              * Todos los campos son obligatorios
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Oficina */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Oficina *</label>
                <input
                  type="text"
                  value={nuevoVendedor.DesOficina ?? ''}
                  onChange={(e) => handleCampoAgregarChange('DesOficina', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  placeholder="Zona actual o escriba una nueva"
                  required
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Por defecto: zona actual. Puede editar para ingresar otra oficina
                </small>
              </div>

              {/* Cod. Venta */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Cod. Venta *</label>
                <input
                  type="text"
                  value={nuevoVendedor.CodVenta ?? ''}
                  onChange={(e) => handleCampoAgregarChange('CodVenta', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>

              {/* Cargo */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Cargo *</label>
                <select
                  value={nuevoVendedor.Cargo ?? ''}
                  onChange={(e) => handleCampoAgregarChange('Cargo', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                >
                  <option value="">Seleccione</option>
                  <option value="VENDEDOR TITULAR">VENDEDOR TITULAR</option>
                  <option value="VENDEDOR RESIDENTE">VENDEDOR RESIDENTE</option>
                  <option value="GESTOR SUPERMERCADO">GESTOR SUPERMERCADO</option>
                  <option value="VENDEDOR REEMPLAZO">VENDEDOR REEMPLAZO</option>
                </select>
              </div>

              {/* Rut */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>RUT *</label>
                <input
                  type="text"
                  value={nuevoVendedor.Rut ?? ''}
                  onChange={(e) => handleCampoAgregarChange('Rut', e.target.value.toUpperCase())}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    borderRadius: '4px', 
                    border: nuevoVendedor.Rut && !/^\d{7,8}-[0-9Kk]$/.test(nuevoVendedor.Rut) ? '2px solid #f44336' : '1px solid #ddd' 
                  }}
                  placeholder="12345678-5"
                  required
                />
                {nuevoVendedor.Rut && !/^\d{7,8}-[0-9Kk]$/.test(nuevoVendedor.Rut) && (
                  <span style={{ color: '#f44336', fontSize: '0.85rem' }}>Formato: 12345678-5 (dígito verificador: 0-9 o K)</span>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nombre *</label>
                <input
                  type="text"
                  value={nuevoVendedor.Nombre ?? ''}
                  onChange={(e) => handleCampoAgregarChange('Nombre', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>

              {/* A.Paterno */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>A.Paterno *</label>
                <input
                  type="text"
                  value={nuevoVendedor.APaterno ?? ''}
                  onChange={(e) => handleCampoAgregarChange('APaterno', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>

              {/* A.Materno */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>A.Materno *</label>
                <input
                  type="text"
                  value={nuevoVendedor.AMaterno ?? ''}
                  onChange={(e) => handleCampoAgregarChange('AMaterno', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>

              {/* Telef */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Telef *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ padding: '0.5rem', background: '#e0e0e0', borderRadius: '4px', fontWeight: 'bold' }}>+569</span>
                  <input
                    type="text"
                    value={(nuevoVendedor.Telefono ?? '').toString().replace(/^9/, '')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                      handleCampoAgregarChange('Telefono', '9' + value);
                    }}
                    style={{ 
                      flex: 1,
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      border: nuevoVendedor.Telefono && nuevoVendedor.Telefono.toString().replace(/^9/, '').length !== 8 ? '2px solid #f44336' : '1px solid #ddd' 
                    }}
                    placeholder="12345678"
                    maxLength={8}
                    required
                  />
                </div>
                {nuevoVendedor.Telefono && nuevoVendedor.Telefono.toString().replace(/^9/, '').length !== 8 && (
                  <span style={{ color: '#f44336', fontSize: '0.85rem' }}>Debe tener 8 dígitos</span>
                )}
              </div>

              {/* Correo */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Correo *</label>
                <input
                  type="email"
                  value={nuevoVendedor.Correo ?? ''}
                  onChange={(e) => handleCampoAgregarChange('Correo', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    borderRadius: '4px', 
                    border: nuevoVendedor.Correo && !nuevoVendedor.Correo.endsWith('@cial.cl') ? '2px solid #f44336' : '1px solid #ddd' 
                  }}
                  placeholder="ejemplo@cial.cl"
                  required
                />
                {nuevoVendedor.Correo && !nuevoVendedor.Correo.endsWith('@cial.cl') && (
                  <span style={{ color: '#f44336', fontSize: '0.85rem' }}>Debe terminar en @cial.cl</span>
                )}
              </div>

              {/* Genero */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Genero *</label>
                <select
                  value={nuevoVendedor.Genero ?? ''}
                  onChange={(e) => handleCampoAgregarChange('Genero', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                >
                  <option value="">Seleccione</option>
                  <option value="H">H</option>
                  <option value="M">M</option>
                </select>
              </div>

              {/* Talla Pantalón */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Talla Pantalón *</label>
                <input
                  type="number"
                  value={nuevoVendedor.TallaPantalon ?? ''}
                  onChange={(e) => handleCampoAgregarChange('TallaPantalon', e.target.value ? parseFloat(e.target.value) : undefined)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>

              {/* Talla Camisa */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Talla Camisa *</label>
                <select
                  value={nuevoVendedor.TallaCamisa ?? ''}
                  onChange={(e) => handleCampoAgregarChange('TallaCamisa', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                >
                  <option value="">Seleccione</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                  <option value="XXXL">XXXL</option>
                  <option value="4L">4L</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                onClick={handleCerrarAgregar}
                className={styles.modalCancelarGris}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarNuevo}
                disabled={!validarCamposCompletos(nuevoVendedor)}
                className={styles.modalAgregarVerdeClaroConEstados}
              >
                Agregar Vendedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mensaje */}
      {showMessageModal && (
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
              <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem' }}>
                {messageModalContent.title}
              </h2>
            </div>
            
            <p style={{ 
              margin: '0 0 2rem 0', 
              color: '#666',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}>
              {messageModalContent.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
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
            minWidth: '450px',
            maxWidth: '550px',
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
                {confirmModalContent.title}
              </h2>
            </div>
            
            <p style={{ 
              margin: '0 0 2rem 0', 
              color: '#666',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}>
              {confirmModalContent.message}
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={handleConfirmNo}
                className={styles.modalCancelarGrisMediano}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmYes}
                className={styles.modalAceptarAzulMediano}
              >
                Aceptar
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
                Las siguientes personas tienen datos faltantes. ¿Está seguro que desea continuar?
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
                   Total de personas con datos faltantes: {vendedoresIncompletos.length}
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
              <p style={{ color: '#666', marginBottom: '1rem' }}>
                Se guardarán los siguientes cambios en un nuevo archivo:
              </p>
              
              {/* Vendedores Editados */}
              {(() => { const editadosZona = Array.from(cambiosPendientes.editados.values()).filter((v: any) => v.CodDistrito === selectedZona); return editadosZona.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#1565c0', 
                    fontSize: '1.1rem', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                     Personas Editadas ({editadosZona.length})
                  </h3>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #e3f2fd',
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}>
                    {editadosZona.map((vendedor, idx) => (
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
              ); })()}
              
              {/* Vendedores Eliminados */}
              {(() => { const eliminadosZona = cambiosPendientes.eliminados.filter((v: any) => v.CodDistrito === selectedZona); return eliminadosZona.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#d32f2f', 
                    fontSize: '1.1rem', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                     Personas Eliminadas ({eliminadosZona.length})
                  </h3>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #ffebee',
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}>
                    {eliminadosZona.map((vendedor, idx) => (
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
              ); })()}
              
              {/* Personas Nuevas */}
              {(() => { const nuevosZona = cambiosPendientes.nuevos.filter((v: any) => v.CodDistrito === selectedZona); return nuevosZona.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    color: '#4caf50', 
                    fontSize: '1.1rem', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    Personas Nuevas ({nuevosZona.length})
                  </h3>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #e8f5e9',
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}>
                    {nuevosZona.map((vendedor, idx) => (
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
              ); })()}
              
              <div style={{
                padding: '1rem',
                background: '#fff3e0',
                borderRadius: '6px',
                borderLeft: '4px solid #ff9800',
                marginTop: '1.5rem'
              }}>
                <p style={{ margin: 0, color: '#e65100', fontWeight: 'bold' }}>
                   Total de cambios: {Array.from(cambiosPendientes.editados.values()).filter((v: any) => v.CodDistrito === selectedZona).length + cambiosPendientes.nuevos.filter((v: any) => v.CodDistrito === selectedZona).length + cambiosPendientes.eliminados.filter((v: any) => v.CodDistrito === selectedZona).length}
                </p>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  Se creará un nuevo archivo en la carpeta Cambios con estos registros.
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
                onClick={() => setShowResumenModal(false)}
                className={styles.modalCancelarGrisMediano}
                disabled={isGuardando}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarGuardado}
                className={styles.modalAceptarAzulMediano}
                disabled={isGuardando}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  justifyContent: 'center'
                }}
              >
                {isGuardando ? <><span className={styles.buttonSpinner} />Guardando...</> : ' Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Opciones (Editar/Mover) */}
      {showOpcionesModal && vendedorSeleccionado && (
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
              <div>
                <h2 style={{ margin: 0, color: '#333', fontSize: '1.3rem' }}>
                  Seleccione una acción
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  {vendedorSeleccionado.NombreCompleto}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={handleSeleccionarEditar}
                className={styles.modalEditarAzul}
              >
                Editar
              </button>
              
              <button
                onClick={handleSeleccionarMover}
                className={styles.modalMoverNaranja}
              >
                Mover
              </button>
              
              <button
                onClick={handleSeleccionarEliminar}
                className={styles.modalEliminarRojo}
              >
                 Eliminar
              </button>
              
              <button
                onClick={() => {
                  setShowOpcionesModal(false);
                  setVendedorSeleccionado(null);
                }}
                className={styles.modalCancelarGrisPequeno}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mover Vendedor */}
      {showMoverModal && vendedorSeleccionado && (
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
          overflowY: 'auto',
          padding: '2rem',
          animation: 'modalOverlayIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            minWidth: '500px',
            maxWidth: '700px',
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
              <div>
                <h2 style={{ margin: 0, color: '#333', fontSize: '1.3rem' }}>
                  Mover 
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  {vendedorSeleccionado.NombreCompleto}
                </p>
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#666' }}>Seleccione la tabla de destino:</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Opción 1: VENDEDOR TITULAR */}
                <label style={{
                  padding: '1rem',
                  border: tablaDestino === 'Vendedor Titular' ? '3px solid #4caf50' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: tablaDestino === 'Vendedor Titular' ? '#e8f5e9' : 'white'
                }}>
                  <input
                    type="radio"
                    name="tablaDestino"
                    value="Vendedor Titular"
                    checked={tablaDestino === 'Vendedor Titular'}
                    onChange={(e) => setTablaDestino(e.target.value)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>VENDEDOR TITULAR</div>
                  </div>
                </label>
                
                {/* Opción 2: VENDEDOR RESIDENTE */}
                <label style={{
                  padding: '1rem',
                  border: tablaDestino === 'Vendedor Titular - Residentes' ? '3px solid #4caf50' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: tablaDestino === 'Vendedor Titular - Residentes' ? '#e8f5e9' : 'white'
                }}>
                  <input
                    type="radio"
                    name="tablaDestino"
                    value="Vendedor Titular - Residentes"
                    checked={tablaDestino === 'Vendedor Titular - Residentes'}
                    onChange={(e) => setTablaDestino(e.target.value)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>VENDEDOR RESIDENTE</div>
                  </div>
                </label>
                
                {/* Opción 3: GESTOR SUPERMERCADO */}
                <label style={{
                  padding: '1rem',
                  border: tablaDestino === 'Gestor Supermercado (Titular)' ? '3px solid #4caf50' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: tablaDestino === 'Gestor Supermercado (Titular)' ? '#e8f5e9' : 'white'
                }}>
                  <input
                    type="radio"
                    name="tablaDestino"
                    value="Gestor Supermercado (Titular)"
                    checked={tablaDestino === 'Gestor Supermercado (Titular)'}
                    onChange={(e) => setTablaDestino(e.target.value)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>GESTOR SUPERMERCADO</div>
                  </div>
                </label>
                
                {/* Opción 4: VENDEDOR REEMPLAZO */}
                <label style={{
                  padding: '1rem',
                  border: tablaDestino === 'Vendedor Reemplazo' ? '3px solid #4caf50' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: tablaDestino === 'Vendedor Reemplazo' ? '#e8f5e9' : 'white'
                }}>
                  <input
                    type="radio"
                    name="tablaDestino"
                    value="Vendedor Reemplazo"
                    checked={tablaDestino === 'Vendedor Reemplazo'}
                    onChange={(e) => setTablaDestino(e.target.value)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>VENDEDOR REEMPLAZO</div>
                  </div>
                </label>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowMoverModal(false);
                  setVendedorSeleccionado(null);
                  setTablaDestino('');
                }}
                className={styles.modalCancelarGrisMediano}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarMover}
                disabled={!tablaDestino}
                className={styles.modalConfirmarMovimientoVerde}
              >
                Confirmar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Validación */}
      {showHistorial && (
        <div className={styles.modalOverlay} onClick={() => setShowHistorial(false)}>
          <div className={styles.modalContainerLarge} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#2d7a3e', fontSize: '1.5rem' }}>
               Historial de Validación - Jefes de Venta
            </h2>
            
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #2196f3' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#333' }}>
                <strong>Total de Jefes de Venta:</strong> {new Set(historialValidacion.map(h => h.usuario)).size}
                {' — '}
                <strong>Zonas pendientes:</strong> {historialValidacion.filter(h => h.estado !== 'Completado').length}
                {' / '}
                {historialValidacion.length} zonas
              </p>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#2d7a3e', color: 'white' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #1a4d2e' }}>Usuario</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #1a4d2e' }}>Nombre</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #1a4d2e' }}>Zonas Asignadas</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #1a4d2e' }}>Estado</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #1a4d2e' }}>Fecha Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {historialValidacion.map((item, index) => (
                    <tr 
                      key={index}
                      style={{ 
                        background: 'white',
                        borderBottom: '1px solid #e0e0e0'
                      }}
                    >
                      <td style={{ padding: '12px' }}>{item.usuario}</td>
                      <td style={{ padding: '12px' }}>{item.nombre}</td>
                      <td style={{ padding: '12px' }}>{item.zonas}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          background: item.estado === 'Completado' ? '#e8f5e9' : '#fff3e0',
                          color: item.estado === 'Completado' ? '#2e7d32' : '#f57c00'
                        }}>
                          {item.estado === 'Completado' ? 'Completado' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                        {item.fecha_validacion || '-'}
                      </td>
                    </tr>
                  ))}
                  {historialValidacion.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                        No hay jefes de venta registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setShowHistorial(false)}
                className={styles.modalCancelarGris}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <InstructivoModal
        isOpen={showInstructivo}
        onClose={() => setShowInstructivo(false)}
        pantalla="estructura-venta"
      />
    </div>
  );
}
