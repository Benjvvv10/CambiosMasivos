/**
 * Página de Administración
 * Solo accesible para usuarios con cargo ADMIN
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import Cookies from 'js-cookie';
import styles from './admin.module.css';
import LoadingDots from '@/components/LoadingDots';
import { getApiUrl } from '@/utils/api-url';

interface EstadoJefeVenta {
  usuario: string;
  nombre: string;
  cargo: string;
  zonas: string[];
  zonas_str: string;
  completado: boolean;
  fecha_ultima_actualizacion: string | null;
  total_vendedores: number;
}

interface EstadoJefeCombinado {
  usuario: string;
  nombre: string;
  cargo: string;
  zonas: string[];
  zonas_codigos: string[];
  zonas_str: string;
  estructura_validada: boolean;
  zonas_estructura_validada?: Record<string, boolean>;
  cartera_validada: boolean;
  zonas_cartera_validada?: Record<string, boolean>;
  ambos_validados: boolean;
}

/**
 * Obtener URL base de la API dinámicamente
 */
const API_BASE_URL = getApiUrl();

export default function AdminPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [umbralPorcentaje, setUmbralPorcentaje] = useState<number>(-25);
  const [factorSemanas, setFactorSemanas] = useState<number>(4.20);
  const [appActiva, setAppActiva] = useState<boolean>(true);
  
  // Estados para consolidados
  const [estadoConsolidados, setEstadoConsolidados] = useState<any>(null);
  const [loadingEstado, setLoadingEstado] = useState(false);

  // Estados para tabs de sistema principal
  const [activeSystem, setActiveSystem] = useState<'optimiza-rutas' | 'cambios-masivos'>('optimiza-rutas');
  
  // Estados para sub-tabs de Optimiza Rutas
  const [activeOptimizaTab, setActiveOptimizaTab] = useState<'config' | 'gestion' | 'estado' | 'reportes' | 'pdf'>('config');
  
  // Estados para sub-tabs de Cambios Masivos
  const [activeCambiosTab, setActiveCambiosTab] = useState<'config' | 'cargar' | 'validacion'>('config');

  // Estados para validación combinada
  const [estadosCombinados, setEstadosCombinados] = useState<EstadoJefeCombinado[]>([]);
  const [loadingCombinados, setLoadingCombinados] = useState(false);

  // Estados para filtros y ordenamiento en tabla de estado
  const [filtroDistrito, setFiltroDistrito] = useState<string>('');
  const [sortBy, setSortBy] = useState<'codigo_distrito' | 'fecha_guardado' | 'km_ruta' | 'km_validado' | 'diferencia_km' | 'tasa_vendedores'>('fecha_guardado');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estados para automatización de Optimiza Rutas
  const [automatizacionActiva, setAutomatizacionActiva] = useState<boolean>(false);
  const [fechaHoraInicio, setFechaHoraInicio] = useState<string>('');
  const [fechaHoraFin, setFechaHoraFin] = useState<string>('');
  const [mensajeAutomatizacion, setMensajeAutomatizacion] = useState<string>('');
  
  // Estados para plantilla PDF
  const [plantillaPDF, setPlantillaPDF] = useState({
    titulo: 'Reporte de Rutas Validadas',
    texto_superior: '',
    texto_inferior: '',
    tamano_fuente_titulo: 16,
    tamano_fuente_contenido: 11,
    firma_izquierda: 'Firma Vendedor',
    firma_derecha: 'Firma Supervisor'
  });
  const [mensajePDF, setMensajePDF] = useState<string>('');
  const [lastFocusedField, setLastFocusedField] = useState<'titulo' | 'texto_superior' | 'texto_inferior' | 'firma_izquierda' | 'firma_derecha'>('texto_superior');
  const [mostrarPreviewModal, setMostrarPreviewModal] = useState(false);
  
  // Estados para Cambios Masivos
  const [appActivaCambios, setAppActivaCambios] = useState<boolean>(true);
  const [automatizacionActivaCambios, setAutomatizacionActivaCambios] = useState<boolean>(false);
  const [fechaHoraInicioCambios, setFechaHoraInicioCambios] = useState<string>('');
  const [fechaHoraFinCambios, setFechaHoraFinCambios] = useState<string>('');
  const [mensajeAutomatizacionCambios, setMensajeAutomatizacionCambios] = useState<string>('');
  
  // Estados para carga de archivo base de Cambios Masivos - Estructura de Ventas
  const [selectedBaseFile, setSelectedBaseFile] = useState<File | null>(null);
  const [isUploadingBase, setIsUploadingBase] = useState(false);
  const [uploadBaseResult, setUploadBaseResult] = useState<any>(null);
  
  // Estados para carga de archivo base de Cambios Masivos - Carteras
  const [selectedCarteraFile, setSelectedCarteraFile] = useState<File | null>(null);
  const [isUploadingCartera, setIsUploadingCartera] = useState(false);
  const [uploadCarteraResult, setUploadCarteraResult] = useState<any>(null);

  // Estados para instructivo de Cambios Masivos
  const [selectedInstructivoFile, setSelectedInstructivoFile] = useState<File | null>(null);
  const [isUploadingInstructivo, setIsUploadingInstructivo] = useState(false);
  const [uploadInstructivoResult, setUploadInstructivoResult] = useState<any>(null);
  const [instructivoPantalla, setInstructivoPantalla] = useState<string>('estructura-venta');
  const [instructivosExistentes, setInstructivosExistentes] = useState<Record<string, {exists: boolean, filename: string | null}>>({});

  // Estados para modales personalizados
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageModalContent, setMessageModalContent] = useState({ title: '', message: '', type: 'info' as 'info' | 'success' | 'error' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '' });
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  // Verificar si estamos en localhost
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname === '::1');

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

  // Cargar configuración desde la API
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const headers: HeadersInit = {};
        
        // Solo agregar token si no es localhost
        if (!isLocalhost) {
          const token = Cookies.get('auth_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        
        // Cargar umbral
        const umbralResponse = await fetch(`${API_BASE_URL}/api/config/umbral-porcentaje`, {
          headers
        });
        if (umbralResponse.ok) {
          const umbralData = await umbralResponse.json();
          setUmbralPorcentaje(umbralData.umbral_porcentaje);
        }

        // Cargar factor semanas
        const factorResponse = await fetch(`${API_BASE_URL}/api/config/factor-semanas`, {
          headers
        });
        if (factorResponse.ok) {
          const factorData = await factorResponse.json();
          setFactorSemanas(factorData.factor_semanas);
        }
        
        // Cargar estado de la aplicación
        const statusResponse = await fetch(`${API_BASE_URL}/api/config/app-status`, {
          headers
        });
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setAppActiva(statusData.app_activa);
        }

        // Cargar configuración de automatización Optimiza Rutas
        const autoResponse = await fetch(`${API_BASE_URL}/api/config/automatizacion`, {
          headers
        });
        if (autoResponse.ok) {
          const autoData = await autoResponse.json();
          setAutomatizacionActiva(autoData.activa);
          setFechaHoraInicio(autoData.fecha_hora_inicio || '');
          setFechaHoraFin(autoData.fecha_hora_fin || '');
        }

        // Cargar configuración de plantilla PDF
        const pdfResponse = await fetch(`${API_BASE_URL}/api/config/plantilla-pdf`, {
          headers
        });
        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          setPlantillaPDF(pdfData);
        }
        
        // Cargar estado de Cambios Masivos
        const statusCambiosResponse = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-status`, {
          headers
        });
        if (statusCambiosResponse.ok) {
          const statusCambiosData = await statusCambiosResponse.json();
          setAppActivaCambios(statusCambiosData.app_activa);
        }
        
        // Cargar automatización de Cambios Masivos
        const autoCambiosResponse = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-automatizacion`, {
          headers
        });
        if (autoCambiosResponse.ok) {
          const autoCambiosData = await autoCambiosResponse.json();
          setAutomatizacionActivaCambios(autoCambiosData.activa);
          setFechaHoraInicioCambios(autoCambiosData.fecha_hora_inicio || '');
          setFechaHoraFinCambios(autoCambiosData.fecha_hora_fin || '');
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    };

    if (user) {
      fetchConfig();
      cargarInstructivosExistentes();
      
      // Verificar estado cada 30 segundos para sincronizar con automatización
      // IMPORTANTE: No incluimos plantilla PDF en el auto-refresh para no interrumpir la edición
      const interval = setInterval(async () => {
        try {
          const headers: HeadersInit = {};
          if (!isLocalhost) {
            const token = Cookies.get('auth_token');
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
          }

          // Solo actualizar umbral, status, factor y automatización, NO plantilla PDF
          const umbralResponse = await fetch(`${API_BASE_URL}/api/config/umbral-porcentaje`, { headers });
          if (umbralResponse.ok) {
            const umbralData = await umbralResponse.json();
            setUmbralPorcentaje(umbralData.umbral_porcentaje);
          }

          const factorResponse = await fetch(`${API_BASE_URL}/api/config/factor-semanas`, { headers });
          if (factorResponse.ok) {
            const factorData = await factorResponse.json();
            setFactorSemanas(factorData.factor_semanas);
          }
          
          const statusResponse = await fetch(`${API_BASE_URL}/api/config/app-status`, { headers });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            setAppActiva(statusData.app_activa);
          }

          const autoResponse = await fetch(`${API_BASE_URL}/api/config/automatizacion`, { headers });
          if (autoResponse.ok) {
            const autoData = await autoResponse.json();
            setAutomatizacionActiva(autoData.activa);
            setFechaHoraInicio(autoData.fecha_hora_inicio || '');
            setFechaHoraFin(autoData.fecha_hora_fin || '');
          }

          const statusCambiosResponse = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-status`, { headers });
          if (statusCambiosResponse.ok) {
            const statusCambiosData = await statusCambiosResponse.json();
            setAppActivaCambios(statusCambiosData.app_activa);
          }

          const autoCambiosResponse = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-automatizacion`, { headers });
          if (autoCambiosResponse.ok) {
            const autoCambiosData = await autoCambiosResponse.json();
            setAutomatizacionActivaCambios(autoCambiosData.activa);
            setFechaHoraInicioCambios(autoCambiosData.fecha_hora_inicio || '');
            setFechaHoraFinCambios(autoCambiosData.fecha_hora_fin || '');
          }
        } catch (error) {
          console.error('Error en auto-refresh:', error);
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user, isLocalhost]);

  // Verificar autenticación y permisos
  useEffect(() => {
    if (!isLoading) {
      // Redirigir si no está autenticado
      if (!user) {
        router.push('/login');
        return;
      }

      // Redirigir si no es admin
      if (user.cargo.toLowerCase() !== 'admin') {
        router.push('/menu');
      }
    }
  }, [user, isLoading, router]);

  // Cargar estado de consolidados
  const cargarEstadoConsolidados = useCallback(async () => {
    setLoadingEstado(true);
    try {
      const headers: HeadersInit = {};
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/routes/estado-consolidados`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setEstadoConsolidados(data);
      }
    } catch (error) {
      console.error('Error cargando estado de consolidados:', error);
    } finally {
      setLoadingEstado(false);
    }
  }, [isLocalhost]);

  // Cargar estado al montar el componente
  useEffect(() => {
    if (user && user.cargo.toLowerCase() === 'admin') {
      cargarEstadoConsolidados();
    }
  }, [user, cargarEstadoConsolidados]);

  // Cargar estados de jefes de venta
  // ==========================================
  // FUNCIONES PARA ESTADOS COMBINADOS (REEMPLAZA FUNCIONES ANTIGUAS)
  // ==========================================

  // ==========================================
  // FUNCIONES PARA ESTADOS COMBINADOS
  // ==========================================

  const cargarEstadosCombinados = useCallback(async () => {
    setLoadingCombinados(true);
    try {
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/estructura-venta/estados-jefes-combinados`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar estados combinados');
      }

      const data = await response.json();
      setEstadosCombinados(data.estados || []);
    } catch (error) {
      console.error('Error al cargar estados combinados:', error);
      showMessage('Error', 'No se pudieron cargar los estados de validación', 'error');
    } finally {
      setLoadingCombinados(false);
    }
  }, [isLocalhost]);

  // Función para consolidar ambos archivos en uno con dos hojas
  const handleConsolidarCombinado = async () => {
    try {
      setLoadingCombinados(true);
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('token');

      const response = await fetch(`${apiUrl}/api/estructura-venta/consolidar-combinado`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al consolidar archivos');
      }

      const result = await response.json();

      showMessage(
        'Consolidación Exitosa',
        `Se consolidaron exitosamente:\n\n` +
        ` Estructura de Venta: ${result.registros_estructura} registros (${result.vendedores_estructura} vendedores)\n` +
        ` Carteras: ${result.registros_carteras} registros (${result.clientes_carteras} clientes)\n\n` +
        `Archivo: ${result.archivo}`,
        'success'
      );

      // Recargar estados
      cargarEstadosCombinados();

      // Descargar automáticamente el archivo consolidado
      try {
        const downloadResponse = await fetch(`${apiUrl}/api/estructura-venta/descargar-consolidado-combinado`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!downloadResponse.ok) {
          throw new Error('Error al obtener el archivo consolidado');
        }

        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Consolidado_Completo_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✓ Archivo descargado exitosamente');
      } catch (downloadError: any) {
        console.error('Error al descargar archivo:', downloadError);
        showMessage('Advertencia', 'El archivo se consolidó correctamente pero hubo un error al descargarlo. Intenta descargarlo manualmente.', 'error');
      }

    } catch (error: any) {
      console.error('Error al consolidar:', error);
      showMessage('Error', error.message || 'No se pudo consolidar los archivos', 'error');
    } finally {
      setLoadingCombinados(false);
    }
  };

  // Función para descargar tabla de estado de validación (Excel)
  const handleDescargarConsolidadoCombinado = () => {
    try {
      if (estadosCombinados.length === 0) {
        showMessage('Sin datos', 'No hay datos de validación para exportar', 'error');
        return;
      }

      // Construir filas de datos
      type RowData = { Nombre: string; Zona: string; 'Estructura de Venta': string; Cartera: string };
      const rows: RowData[] = [];
      estadosCombinados.forEach(jefe => {
        const zonas = jefe.zonas.length > 0 ? jefe.zonas : ['Sin zonas asignadas'];
        zonas.forEach(zona => {
          rows.push({
            'Nombre': jefe.nombre,
            'Zona': zona,
            'Estructura de Venta': jefe.estructura_validada ? 'Validado' : 'Pendiente',
            'Cartera': jefe.cartera_validada ? 'Validado' : 'Pendiente',
          });
        });
      });

      // Crear workbook con SheetJS
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows, {
        header: ['Nombre', 'Zona', 'Estructura de Venta', 'Cartera'],
      });

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 30 },
        { wch: 25 },
        { wch: 22 },
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Estado Validación');

      // Descargar como .xlsx real
      const fecha = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `estado_validacion_jefes_venta_${fecha}.xlsx`);

      showMessage('Descarga Exitosa', 'La tabla de estados de validación se ha descargado correctamente', 'success');
    } catch (error: any) {
      console.error('Error al descargar:', error);
      showMessage('Error', 'No se pudo descargar la tabla de estados', 'error');
    }
  };

  // Función para limpiar validaciones de estructura de venta y carteras (ambas)
  const handleLimpiarValidaciones = async () => {
    showConfirm(
      'ADVERTENCIA',
      'Esta acción eliminará todos los archivos individuales de Estructura de Venta y Carteras de los jefes de venta .\n\nEsto reiniciará el ciclo mensual completo y todos los jefes deberán validar nuevamente ambos sistemas.\n\n¿Estás completamente seguro?',
      async () => {
        try {
          const apiUrl = API_BASE_URL;
          const token = localStorage.getItem('token');

          // Limpiar Estructura de Venta
          const responseEstructura = await fetch(`${apiUrl}/api/estructura-venta/limpiar-validaciones`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          // Limpiar Carteras
          const responseCarteras = await fetch(`${apiUrl}/api/carteras/limpiar-validaciones`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          const resultEstructura = await responseEstructura.json();
          const resultCarteras = await responseCarteras.json();

          if (responseEstructura.ok && responseCarteras.ok) {
            const totalArchivos = (resultEstructura.archivos_eliminados || 0) + (resultCarteras.archivos_eliminados || 0);
            showMessage(
              'Limpieza Exitosa',
              ``
            );
            cargarEstadosCombinados();
          } else {
            throw new Error('Error al limpiar una o ambas validaciones');
          }
        } catch (error: any) {
          console.error('Error al limpiar:', error);
          showMessage('Error', error.message || 'No se pudieron limpiar las validaciones', 'error');
        }
      }
    );
  };

  // Cargar estados combinados cuando se active el tab de validación
  useEffect(() => {
    if (user && user.cargo.toLowerCase() === 'admin' && activeSystem === 'cambios-masivos' && activeCambiosTab === 'validacion') {
      cargarEstadosCombinados();
    }
  }, [user, activeSystem, activeCambiosTab, cargarEstadosCombinados]);

  // Mostrar loading mientras verifica permisos
  if (isLoading || !user) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}><LoadingDots /></p>
      </div>
    );
  }

  // Verificar que sea admin
  if (user.cargo.toLowerCase() !== 'admin') {
    return null;
  }

  // Función para manejar ordenamiento en la tabla de estado
  const handleSort = (column: 'codigo_distrito' | 'fecha_guardado' | 'km_ruta' | 'km_validado' | 'diferencia_km' | 'tasa_vendedores') => {
    if (sortBy === column) {
      // Si ya está ordenado por esta columna, cambiar el orden
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // Si es una columna diferente, ordenar descendente por defecto
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Función para filtrar y ordenar distritos en la tabla
  const getDistritosFiltrados = () => {
    if (!estadoConsolidados || !estadoConsolidados.distritos) return [];

    let distritosConDatos = estadoConsolidados.distritos.map((d: any) => {
      const km_sap = d.km_sap ?? 0;
      const km_ruta = d.km_ruta ?? 0;
      const km_optimizado = d.km_optimizado ?? 0;
      const km_holgura = d.km_holgura ?? 0;
      const km_validado = d.km_validado ?? 0;
      const diferencia_km = d.diferencia_km ?? 0; // Usar valor del backend
      
      // Calcular tasa de vendedores: vendedores_guardados / total_vendedores
      const total_vendedores = d.total_vendedores ?? 0;
      const vendedores_guardados = d.vendedores_guardados ?? 0;
      const tasa_vendedores = total_vendedores > 0 ? (vendedores_guardados / total_vendedores) * 100 : 0;
      
      return {
        ...d,
        km_sap,
        km_ruta,
        km_optimizado,
        km_holgura,
        km_validado,
        diferencia_km,
        total_vendedores,
        vendedores_guardados,
        tasa_vendedores
      };
    });

    // Filtrar por distrito (mantener filtro de texto de SistemaCial)
    if (filtroDistrito.trim() !== '') {
      const filtro = filtroDistrito.toLowerCase();
      distritosConDatos = distritosConDatos.filter((d: any) => 
        d.codigo_distrito.toLowerCase().includes(filtro) ||
        d.nombre_distrito.toLowerCase().includes(filtro)
      );
    }

    // Ordenar
    distritosConDatos.sort((a: any, b: any) => {
      let valueA = 0;
      let valueB = 0;

      switch (sortBy) {
        case 'codigo_distrito':
          return sortOrder === 'desc' 
            ? b.codigo_distrito.localeCompare(a.codigo_distrito)
            : a.codigo_distrito.localeCompare(b.codigo_distrito);
        case 'fecha_guardado':
          valueA = new Date(a.fecha_guardado).getTime();
          valueB = new Date(b.fecha_guardado).getTime();
          break;
        case 'km_ruta':
          valueA = a.km_ruta;
          valueB = b.km_ruta;
          break;
        case 'km_validado':
          valueA = a.km_validado;
          valueB = b.km_validado;
          break;
        case 'diferencia_km':
          valueA = a.diferencia_km;
          valueB = b.diferencia_km;
          break;
        case 'tasa_vendedores':
          valueA = a.tasa_vendedores;
          valueB = b.tasa_vendedores;
          break;
      }

      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });

    return distritosConDatos;
  };

  // Manejar selección de archivo
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Manejar cambio de estado de la aplicación
  const handleAppStatusChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoEstado = e.target.checked;
    
    // Si la automatización está activa, no permitir desactivar manualmente
    if (!nuevoEstado && automatizacionActiva) {
      showMessage('Advertencia', 'No puedes desactivar el guardado de rutas mientras la automatización por horario esté activa. Desactiva primero la automatización.', 'error');
      return;
    }
    
    setAppActiva(nuevoEstado);
    
    // Guardar en la API
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Solo agregar token si no es localhost
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/api/config/app-status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ app_activa: nuevoEstado })
      });
      
      if (!response.ok) {
        // Revertir cambio si hay error
        setAppActiva(!nuevoEstado);
        const errorData = await response.json();
        showMessage('Error', 'Error al actualizar el estado: ' + errorData.detail, 'error');
      }
    } catch (error) {
      // Revertir cambio si hay error
      setAppActiva(!nuevoEstado);
      console.error('Error al actualizar estado:', error);
      showMessage('Error', 'Error al actualizar el estado de la aplicación', 'error');
    }
  };

  // Manejar cambio de umbral de porcentaje
  const handleUmbralChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value);
    if (!isNaN(valor) && valor >= -100 && valor <= 100) {
      setUmbralPorcentaje(valor);
      
      // Guardar en la API
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        // Solo agregar token si no es localhost
        if (!isLocalhost) {
          const token = Cookies.get('auth_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        
        const response = await fetch(`${API_BASE_URL}/api/config/umbral-porcentaje`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ umbral_porcentaje: valor })
        });
        
        if (response.ok) {
          // Disparar evento para que otras páginas se actualicen
          window.dispatchEvent(new Event('umbralPorcentajeChange'));
        } else {
          const errorData = await response.json();
          console.error('Error al guardar umbral:', errorData.detail);
          showMessage('Error', 'Error al guardar la configuración: ' + errorData.detail, 'error');
        }
      } catch (error) {
        console.error('Error al guardar umbral:', error);
        showMessage('Error', 'Error al guardar la configuración', 'error');
      }
    }
  };

  // Manejar cambio de automatización
  const handleAutomatizacionChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoEstado = e.target.checked;
    setAutomatizacionActiva(nuevoEstado);
    
    // Si se desactiva, guardar inmediatamente
    if (!nuevoEstado) {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (!isLocalhost) {
          const token = Cookies.get('auth_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        
        const response = await fetch(`${API_BASE_URL}/api/config/automatizacion`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            activa: false,
            fecha_hora_inicio: fechaHoraInicio || '',
            fecha_hora_fin: fechaHoraFin || ''
          })
        });
        
        if (!response.ok) {
          // Revertir cambio si hay error
          setAutomatizacionActiva(true);
          const errorData = await response.json();
          showMessage('Error', 'Error al actualizar: ' + errorData.detail, 'error');
        }
      } catch (error) {
        // Revertir cambio si hay error
        setAutomatizacionActiva(true);
        console.error('Error al actualizar automatización:', error);
        showMessage('Error', 'Error al actualizar la configuración', 'error');
      }
    }
  };

  // Guardar configuración de automatización
  const handleGuardarAutomatizacion = async () => {
    if (!fechaHoraInicio || !fechaHoraFin) {
      showMessage('Advertencia', 'Por favor selecciona fecha y hora de inicio y fin', 'error');
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/api/config/automatizacion`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          activa: automatizacionActiva,
          fecha_hora_inicio: fechaHoraInicio,
          fecha_hora_fin: fechaHoraFin
        })
      });
      
      if (response.ok) {
        const inicio = new Date(fechaHoraInicio).toLocaleString('es-CL');
        const fin = new Date(fechaHoraFin).toLocaleString('es-CL');
        setMensajeAutomatizacion(`Configuración guardada: ${inicio} hasta ${fin}`);
        setTimeout(() => setMensajeAutomatizacion(''), 5000);
      } else {
        const errorData = await response.json();
        showMessage('Error', 'Error al guardar: ' + errorData.detail, 'error');
      }
    } catch (error) {
      console.error('Error al guardar automatización:', error);
      showMessage('Error', 'Error al guardar la configuración', 'error');
    }
  };

  // Manejar cambio de factor semanas
  const handleFactorSemanasChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value);
    if (!isNaN(valor) && valor > 0 && valor <= 10) {
      setFactorSemanas(valor);
      
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (!isLocalhost) {
          const token = Cookies.get('auth_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        
        const response = await fetch(`${API_BASE_URL}/api/config/factor-semanas`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ factor_semanas: valor })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          showMessage('Error', 'Error al guardar la configuración: ' + errorData.detail, 'error');
        }
      } catch (error) {
        console.error('Error al guardar factor semanas:', error);
        showMessage('Error', 'Error al guardar la configuración', 'error');
      }
    }
  };

  // Guardar configuración de plantilla PDF
  const handleGuardarPlantillaPDF = async () => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/api/config/plantilla-pdf`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(plantillaPDF)
      });
      
      if (response.ok) {
        setMensajePDF('✓ Configuración de PDF guardada correctamente');
        setTimeout(() => setMensajePDF(''), 5000);
      } else {
        const errorData = await response.json();
        showMessage('Error', 'Error al guardar: ' + errorData.detail, 'error');
      }
    } catch (error) {
      console.error('Error al guardar plantilla PDF:', error);
      showMessage('Error', 'Error al guardar la configuración', 'error');
    }
  };

  // Insertar variable de PDF en el textarea activo
  const handleInsertarVariable = (variable: string) => {
    const textoSuperior = document.getElementById('texto-superior') as HTMLTextAreaElement;
    const textoInferior = document.getElementById('texto-inferior') as HTMLTextAreaElement;
    
    let textarea: HTMLTextAreaElement;
    let campo: 'texto_superior' | 'texto_inferior';
    
    const activeId = document.activeElement?.id;
    if (activeId === 'texto-inferior') {
      textarea = textoInferior;
      campo = 'texto_inferior';
    } else if (activeId === 'texto-superior') {
      textarea = textoSuperior;
      campo = 'texto_superior';
    } else {
      if (lastFocusedField === 'texto_inferior') {
        textarea = textoInferior;
        campo = 'texto_inferior';
      } else {
        textarea = textoSuperior;
        campo = 'texto_superior';
      }
    }
    
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const text = plantillaPDF[campo] || '';
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + variable + after;
      
      setPlantillaPDF(prev => ({ ...prev, [campo]: newText }));
      
      setTimeout(() => {
        textarea.focus();
        const newPos = start + variable.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 10);
    }
  };

  // Aplicar formato de texto (negrita, cursiva, subrayado) al campo activo
  const handleAplicarFormato = (formato: 'negrita' | 'cursiva' | 'subrayado') => {
    const mapaCampos: Record<typeof lastFocusedField, { id: string, key: keyof typeof plantillaPDF }> = {
      'titulo': { id: 'pdf-titulo', key: 'titulo' },
      'texto_superior': { id: 'texto-superior', key: 'texto_superior' },
      'texto_inferior': { id: 'texto-inferior', key: 'texto_inferior' },
      'firma_izquierda': { id: 'firma-izquierda', key: 'firma_izquierda' },
      'firma_derecha': { id: 'firma-derecha', key: 'firma_derecha' }
    };
    
    const campoInfo = mapaCampos[lastFocusedField];
    const elemento = document.getElementById(campoInfo.id) as HTMLInputElement | HTMLTextAreaElement;
    
    if (elemento) {
      const start = elemento.selectionStart || 0;
      const end = elemento.selectionEnd || 0;
      const text = (plantillaPDF[campoInfo.key] as string) || '';
      const selectedText = text.substring(start, end);
      
      let wrapper = '';
      let wrapperLength = 0;
      
      switch (formato) {
        case 'negrita':
          wrapper = '**';
          wrapperLength = 2;
          break;
        case 'cursiva':
          wrapper = '*';
          wrapperLength = 1;
          break;
        case 'subrayado':
          wrapper = '__';
          wrapperLength = 2;
          break;
      }
      
      let newText = '';
      let newCursorPos = 0;
      
      if (selectedText) {
        const before = text.substring(0, start);
        const after = text.substring(end);
        newText = before + wrapper + selectedText + wrapper + after;
        newCursorPos = end + (wrapperLength * 2);
      } else {
        const before = text.substring(0, start);
        const after = text.substring(start);
        newText = before + wrapper + wrapper + after;
        newCursorPos = start + wrapperLength;
      }
      
      setPlantillaPDF(prev => ({ ...prev, [campoInfo.key]: newText }));
      
      setTimeout(() => {
        elemento.focus();
        elemento.setSelectionRange(newCursorPos, newCursorPos);
      }, 10);
    }
  };

  // Reemplazar variables con valores de prueba para el preview PDF
  const reemplazarVariablesPreview = (texto: string) => {
    const kmValidado = 210.83;
    const factor = 4.20;
    const kmMes = (kmValidado * factor).toFixed(2);
    
    return texto
      .replace(/\[NOMBRE_VENDEDOR\]/g, 'Juan Pérez González')
      .replace(/\[CODIGO_VENDEDOR\]/g, '12345')
      .replace(/\[JEFE_VENTA\]/g, 'María Rodríguez')
      .replace(/\[DISTRITO\]/g, 'Santiago')
      .replace(/\[FECHA\]/g, '10/02/2026')
      .replace(/\[HORA\]/g, '14:30:00')
      .replace(/\[FECHA_ACTUAL\]/g, '10/02/2026 14:30:00')
      .replace(/\[KM_RUTA\]/g, '182.45')
      .replace(/\[KM_SAP\]/g, '198.50')
      .replace(/\[KM_OPTIMIZADO\]/g, '180.32')
      .replace(/\[KM_VALIDADO\]/g, '210.83')
      .replace(/\[KM_HOLGURA\]/g, '28.38')
      .replace(/\[KM_DIFERENCIA\]/g, '12.33')
      .replace(/\[PORCENTAJE_HOLGURA\]/g, '15%')
      .replace(/\[FACTOR_SEMANAS\]/g, '4.20')
      .replace(/\[KM_MES\]/g, kmMes);
  };

  // Renderizar texto con formato markdown-like para el preview PDF
  const renderizarTextoConFormato = (texto: string): React.ReactNode => {
    if (!texto) return null;
    
    const partes: React.ReactNode[] = [];
    let restante = texto;
    let key = 0;
    
    const preservarEspacios = (str: string) => {
      return str.replace(/ {2,}/g, (espacios) => '\u00A0'.repeat(espacios.length));
    };
    
    while (restante.length > 0) {
      const regexBoldItalic = /\*\*\*([\s\S]+?)\*\*\*/;
      const matchBoldItalic = restante.match(regexBoldItalic);
      const regexBold = /\*\*([\s\S]+?)\*\*/;
      const matchBold = restante.match(regexBold);
      const regexUnderline = /__([\s\S]+?)__/;
      const matchUnderline = restante.match(regexUnderline);
      const regexItalic = /\*([\s\S]+?)\*/;
      const matchItalic = restante.match(regexItalic);
      
      const matches = [
        { match: matchBoldItalic, tipo: 'bold-italic' },
        { match: matchBold, tipo: 'bold' },
        { match: matchUnderline, tipo: 'underline' },
        { match: matchItalic, tipo: 'italic' }
      ].filter(m => m.match !== null);
      
      if (matches.length === 0) {
        const lineas = restante.split('\n');
        lineas.forEach((linea, i) => {
          partes.push(<span key={`text-${key++}`} style={{ whiteSpace: 'pre-wrap' }}>{preservarEspacios(linea)}</span>);
          if (i < lineas.length - 1) partes.push(<br key={`br-${key++}`} />);
        });
        break;
      }
      
      const primerMatch = matches.reduce((prev, curr) => {
        return (curr.match!.index ?? Infinity) < (prev.match!.index ?? Infinity) ? curr : prev;
      });
      
      const match = primerMatch.match!;
      const tipo = primerMatch.tipo;
      
      if (match.index && match.index > 0) {
        const textoAntes = restante.substring(0, match.index);
        textoAntes.split('\n').forEach((linea, i, arr) => {
          partes.push(<span key={`text-${key++}`} style={{ whiteSpace: 'pre-wrap' }}>{preservarEspacios(linea)}</span>);
          if (i < arr.length - 1) partes.push(<br key={`br-${key++}`} />);
        });
      }
      
      const contenido = match[1];
      const lineas = contenido.split('\n');
      
      if (tipo === 'bold-italic') {
        partes.push(
          <strong key={`bi-${key++}`} style={{ whiteSpace: 'pre-wrap' }}>
            <em>{lineas.map((l, i) => <React.Fragment key={i}>{preservarEspacios(l)}{i < lineas.length - 1 && <br />}</React.Fragment>)}</em>
          </strong>
        );
      } else if (tipo === 'bold') {
        partes.push(
          <strong key={`b-${key++}`} style={{ whiteSpace: 'pre-wrap' }}>
            {lineas.map((l, i) => <React.Fragment key={i}>{preservarEspacios(l)}{i < lineas.length - 1 && <br />}</React.Fragment>)}
          </strong>
        );
      } else if (tipo === 'underline') {
        partes.push(
          <span key={`u-${key++}`} style={{ textDecoration: 'underline', whiteSpace: 'pre-wrap' }}>
            {lineas.map((l, i) => <React.Fragment key={i}>{preservarEspacios(l)}{i < lineas.length - 1 && <br />}</React.Fragment>)}
          </span>
        );
      } else if (tipo === 'italic') {
        partes.push(
          <em key={`i-${key++}`} style={{ whiteSpace: 'pre-wrap' }}>
            {lineas.map((l, i) => <React.Fragment key={i}>{preservarEspacios(l)}{i < lineas.length - 1 && <br />}</React.Fragment>)}
          </em>
        );
      }
      
      restante = restante.substring((match.index ?? 0) + match[0].length);
    }
    
    return <span style={{ whiteSpace: 'pre-wrap' }}>{partes}</span>;
  };

  // Descargar CSV Maestro Consolidado (Maestro APP + columnas validadas)
  const handleDescargarMaestroConsolidadoCSV = async () => {
    try {
      const headers: HeadersInit = {};
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/routes/exportar-maestro-consolidado-csv`, { headers });
      
      if (!response.ok) {
        const errorData = await response.json();
        showMessage('Error', 'Error al descargar CSV: ' + errorData.detail, 'error');
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'MaestroConsolidado.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar CSV consolidado:', error);
      showMessage('Error', 'Error al descargar el CSV consolidado', 'error');
    }
  };

  // Descargar XLSX con todos los vendedores y KM
  const handleDescargarXLSXVendedores = async () => {
    try {
      const headers: HeadersInit = {};
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/routes/exportar-vendedores-xlsx`, { headers });
      
      if (!response.ok) {
        const errorData = await response.json();
        showMessage('Error', 'Error al descargar XLSX: ' + errorData.detail, 'error');
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'VendedoresKM.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar XLSX de vendedores:', error);
      showMessage('Error', 'Error al descargar el XLSX de vendedores', 'error');
    }
  };

  // ========== FUNCIONES PARA CAMBIOS MASIVOS ==========
  
  // Manejar cambio de estado de Cambios Masivos
  const handleAppStatusChangeCambios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoEstado = e.target.checked;
    
    // Si la automatización está activa, no permitir desactivar manualmente
    if (!nuevoEstado && automatizacionActivaCambios) {
      showMessage('Advertencia', 'No puedes desactivar Cambios Masivos mientras la automatización por horario esté activa. Desactiva primero la automatización.', 'error');
      return;
    }
    
    setAppActivaCambios(nuevoEstado);
    
    // Guardar en la API
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ app_activa: nuevoEstado })
      });
      
      if (!response.ok) {
        // Revertir cambio si hay error
        setAppActivaCambios(!nuevoEstado);
        const errorData = await response.json();
        showMessage('Error', 'Error al actualizar el estado: ' + errorData.detail, 'error');
      }
    } catch (error) {
      // Revertir cambio si hay error
      setAppActivaCambios(!nuevoEstado);
      console.error('Error al actualizar estado:', error);
      showMessage('Error', 'Error al actualizar el estado de Cambios Masivos', 'error');
    }
  };

  // Manejar cambio de automatización de Cambios Masivos
  const handleAutomatizacionChangeCambios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoEstado = e.target.checked;
    setAutomatizacionActivaCambios(nuevoEstado);
    
    // Si se desactiva, guardar inmediatamente
    if (!nuevoEstado) {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (!isLocalhost) {
          const token = Cookies.get('auth_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        
        const response = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-automatizacion`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            activa: false,
            fecha_hora_inicio: fechaHoraInicioCambios || '',
            fecha_hora_fin: fechaHoraFinCambios || ''
          })
        });
        
        if (!response.ok) {
          // Revertir cambio si hay error
          setAutomatizacionActivaCambios(true);
          const errorData = await response.json();
          showMessage('Error', 'Error al actualizar: ' + errorData.detail, 'error');
        }
      } catch (error) {
        // Revertir cambio si hay error
        setAutomatizacionActivaCambios(true);
        console.error('Error al actualizar automatización:', error);
        showMessage('Error', 'Error al actualizar la configuración', 'error');
      }
    }
  };

  // Guardar configuración de automatización de Cambios Masivos
  const handleGuardarAutomatizacionCambios = async () => {
    if (!fechaHoraInicioCambios || !fechaHoraFinCambios) {
      showMessage('Advertencia', 'Por favor selecciona fecha y hora de inicio y fin', 'error');
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/api/config/cambios-masivos-automatizacion`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          activa: automatizacionActivaCambios,
          fecha_hora_inicio: fechaHoraInicioCambios,
          fecha_hora_fin: fechaHoraFinCambios
        })
      });
      
      if (response.ok) {
        const inicio = new Date(fechaHoraInicioCambios).toLocaleString('es-CL');
        const fin = new Date(fechaHoraFinCambios).toLocaleString('es-CL');
        setMensajeAutomatizacionCambios(`Configuración guardada: ${inicio} hasta ${fin}`);
        setTimeout(() => setMensajeAutomatizacionCambios(''), 5000);
      } else {
        const errorData = await response.json();
        showMessage('Error', 'Error al guardar: ' + errorData.detail, 'error');
      }
    } catch (error) {
      console.error('Error al guardar automatización:', error);
      showMessage('Error', 'Error al guardar la configuración', 'error');
    }
  };

  // Handler para seleccionar archivo base de Cambios Masivos - Estructura de Ventas
  const handleBaseFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar que sea un archivo Excel
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showMessage('Advertencia', 'Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
        return;
      }
      setSelectedBaseFile(file);
      setUploadBaseResult(null);
    }
  };
  
  // Handler para seleccionar archivo base de Cambios Masivos - Carteras
  const handleCarteraFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar que sea un archivo Excel
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showMessage('Advertencia', 'Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
        return;
      }
      setSelectedCarteraFile(file);
      setUploadCarteraResult(null);
    }
  };

  // Handler para subir archivo base de Cambios Masivos - Estructura de Ventas
  const handleUploadBaseFile = async () => {
    if (!selectedBaseFile) {
      showMessage('Advertencia', 'Por favor selecciona un archivo Excel', 'error');
      return;
    }

    setIsUploadingBase(true);
    setUploadBaseResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedBaseFile);

      const headers: HeadersInit = {};
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/estructura-venta/upload-base-file`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadBaseResult({
          success: true,
          message: data.message,
          details: `Archivo: ${data.filename} | Hojas: ${data.sheets.join(', ')} | Tamaño: ${(data.size / 1024).toFixed(2)} KB`
        });
        setSelectedBaseFile(null);
        // Reset input file
        const fileInput = document.getElementById('baseFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const detail = data.detail;
        if (typeof detail === 'object' && detail.mensaje) {
          setUploadBaseResult({
            success: false,
            message: detail.mensaje,
            columnas_faltantes_por_hoja: detail.columnas_faltantes_por_hoja || [],
            sugerencia: detail.sugerencia || ''
          });
        } else {
          setUploadBaseResult({
            success: false,
            message: typeof detail === 'string' ? detail : 'Error al subir archivo'
          });
        }
        // Reset file input para evitar ERR_UPLOAD_FILE_CHANGED en reintentos
        setSelectedBaseFile(null);
        const fileInput = document.getElementById('baseFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      console.error('Error al subir archivo base:', error);
      setUploadBaseResult({
        success: false,
        message: 'El archivo cambió o no se pudo leer. Selecciona el archivo nuevamente.'
      });
      setSelectedBaseFile(null);
      const fileInput = document.getElementById('baseFileInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } finally {
      setIsUploadingBase(false);
    }
  };
  
  // Handler para subir archivo base de Cambios Masivos - Carteras
  const handleUploadCarteraFile = async () => {
    if (!selectedCarteraFile) {
      showMessage('Advertencia', 'Por favor selecciona un archivo Excel', 'error');
      return;
    }

    setIsUploadingCartera(true);
    setUploadCarteraResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedCarteraFile);

      const headers: HeadersInit = {};
      
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/carteras/upload-base-file`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadCarteraResult({
          success: true,
          message: data.message,
          details: `Archivo: ${data.filename} | Hojas: ${data.sheets.join(', ')} | Tamaño: ${(data.size / 1024).toFixed(2)} KB`
        });
        setSelectedCarteraFile(null);
        // Reset input file
        const fileInput = document.getElementById('carteraFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const detail = data.detail;
        if (typeof detail === 'object' && detail.mensaje) {
          setUploadCarteraResult({
            success: false,
            message: detail.mensaje,
            columnas_faltantes: detail.columnas_faltantes || [],
            sugerencia: detail.sugerencia || ''
          });
        } else {
          setUploadCarteraResult({
            success: false,
            message: typeof detail === 'string' ? detail : 'Error al subir archivo'
          });
        }
        // Reset file input para evitar ERR_UPLOAD_FILE_CHANGED en reintentos
        setSelectedCarteraFile(null);
        const fileInput = document.getElementById('carteraFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      console.error('Error al subir archivo de carteras:', error);
      setUploadCarteraResult({
        success: false,
        message: 'El archivo cambió o no se pudo leer. Selecciona el archivo nuevamente.'
      });
      setSelectedCarteraFile(null);
      const fileInput = document.getElementById('carteraFileInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } finally {
      setIsUploadingCartera(false);
    }
  };

  // Handler para seleccionar instructivo
  const handleInstructivoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedInstructivoFile(file);
      setUploadInstructivoResult(null);
    }
  };

  // Cargar lista de instructivos existentes
  const cargarInstructivosExistentes = async () => {
    try {
      const token = Cookies.get('auth_token');
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/api/instructivo/list`, { headers });
      if (response.ok) {
        const data = await response.json();
        setInstructivosExistentes(data);
      }
    } catch (e) {
      console.error('Error al cargar instructivos:', e);
    }
  };

  // Handler para subir instructivo
  const handleUploadInstructivo = async () => {
    if (!selectedInstructivoFile) {
      showMessage('Advertencia', 'Por favor selecciona un archivo', 'error');
      return;
    }

    setIsUploadingInstructivo(true);
    setUploadInstructivoResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedInstructivoFile);

      const headers: HeadersInit = {};
      const token = Cookies.get('auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/instructivo/upload?pantalla=${encodeURIComponent(instructivoPantalla)}`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        const nombresPantalla: Record<string, string> = {
          'estructura-venta': 'Estructura de Venta',
          'carteras': 'Carteras',
          'administrar-dotacion': 'Administrar Dotación'
        };
        setUploadInstructivoResult({
          success: true,
          message: data.message,
          details: `Pantalla: ${nombresPantalla[instructivoPantalla] || instructivoPantalla} | Archivo: ${data.filename} | Tamaño: ${(data.size / 1024).toFixed(2)} KB`
        });
        setSelectedInstructivoFile(null);
        const fileInput = document.getElementById('instructivoFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        cargarInstructivosExistentes();
      } else {
        setUploadInstructivoResult({
          success: false,
          message: data.detail || 'Error al subir el instructivo'
        });
      }
    } catch (error) {
      console.error('Error al subir instructivo:', error);
      setUploadInstructivoResult({
        success: false,
        message: 'Error de conexión al subir el archivo'
      });
    } finally {
      setIsUploadingInstructivo(false);
    }
  };

  // Manejar carga de rutas y calcular automáticamente
  const handleUploadRoutes = async () => {
    if (!selectedFile) {
      showMessage('Advertencia', 'Por favor selecciona un archivo primero.', 'error');
      return;
    }

    setIsCalculating(true);
    setCalculationResult(null);

    try {
      const headers: HeadersInit = {};
      
      // Solo agregar token si no es localhost
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Paso 1: Subir archivo
      const uploadResponse = await fetch(`${API_BASE_URL}/api/routes/upload-routes`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.detail || 'Error al cargar el archivo');
      }

      const uploadResult = await uploadResponse.json();
      
      // Limpiar selección
      setSelectedFile(null);
      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Paso 2: Calcular rutas automáticamente
      const calcHeaders: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Solo agregar token si no es localhost
      if (!isLocalhost) {
        const token = Cookies.get('auth_token');
        if (token) {
          calcHeaders['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const calcResponse = await fetch(`${API_BASE_URL}/api/routes/calculate-routes`, {
        method: 'POST',
        headers: calcHeaders
      });

      if (!calcResponse.ok) {
        throw new Error('Error al calcular rutas');
      }

      // Leer el stream de Server-Sent Events
      const reader = calcResponse.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));

              if (data.type === 'complete') {
                setCalculationResult(data.data);
                // No mostrar alert, los resultados se muestran abajo
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            }
          }
        }
      }
      
    } catch (error: any) {
      showMessage('Error', ` Error: ${error.message}`, 'error');
      console.error('Error al procesar rutas:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Panel de Administración CIAL</h1>
        </div>
      </header>

      {/* Main System Tabs */}
      <div className={styles.mainTabsContainer}>
        <button 
          className={`${styles.mainTab} ${activeSystem === 'optimiza-rutas' ? styles.mainTabActive : ''}`}
          onClick={() => setActiveSystem('optimiza-rutas')}
        >
          Optimiza Rutas
        </button>
        <button 
          className={`${styles.mainTab} ${activeSystem === 'cambios-masivos' ? styles.mainTabActive : ''}`}
          onClick={() => setActiveSystem('cambios-masivos')}
        >
          Cambios Masivos
        </button>
      </div>

      {/* Sub-Tabs Navigation */}
      {activeSystem === 'optimiza-rutas' && (
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tab} ${activeOptimizaTab === 'config' ? styles.tabActive : ''}`}
            onClick={() => setActiveOptimizaTab('config')}
          >
            Configuración
          </button>
          <button 
            className={`${styles.tab} ${activeOptimizaTab === 'gestion' ? styles.tabActive : ''}`}
            onClick={() => setActiveOptimizaTab('gestion')}
          >
            Gestión de Rutas
          </button>
          <button 
            className={`${styles.tab} ${activeOptimizaTab === 'estado' ? styles.tabActive : ''}`}
            onClick={() => setActiveOptimizaTab('estado')}
          >
            Estado de Rutas
          </button>
          <button 
            className={`${styles.tab} ${activeOptimizaTab === 'reportes' ? styles.tabActive : ''}`}
            onClick={() => setActiveOptimizaTab('reportes')}
          >
            Reportes
          </button>
          <button 
            className={`${styles.tab} ${activeOptimizaTab === 'pdf' ? styles.tabActive : ''}`}
            onClick={() => setActiveOptimizaTab('pdf')}
          >
            Configuración PDF
          </button>
        </div>
      )}

      {activeSystem === 'cambios-masivos' && (
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tab} ${activeCambiosTab === 'config' ? styles.tabActive : ''}`}
            onClick={() => setActiveCambiosTab('config')}
          >
            Configuración
          </button>
          <button 
            className={`${styles.tab} ${activeCambiosTab === 'cargar' ? styles.tabActive : ''}`}
            onClick={() => setActiveCambiosTab('cargar')}
          >
            Cargar Archivo
          </button>
          <button 
            className={`${styles.tab} ${activeCambiosTab === 'validacion' ? styles.tabActive : ''}`}
            onClick={() => setActiveCambiosTab('validacion')}
          >
            Estado de Validación
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className={styles.main}>
        {/* OPTIMIZA RUTAS CONTENT */}
        {activeSystem === 'optimiza-rutas' && (
          <>
            {/* TAB 1: CONFIGURACIÓN */}
            {activeOptimizaTab === 'config' && (
          <div className={styles.tabContent}>
            {/* Grid de 3 columnas para la configuración */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, minmax(300px, 1fr))', 
              gap: '28px', 
              alignItems: 'start', 
              width: '100%' 
            }}>
              
              {/* Control de Acceso - columna 1 */}
              <div className={styles.configCard}>
                <h3>Control de Acceso</h3>
                <div className={styles.configSection}>
                  <label htmlFor="appStatus" className={styles.configLabel}>
                    Estado Manual de la Aplicación
                  </label>
                  <p className={styles.configDescription}>
                    Activa o desactiva manualmente el guardado de rutas por los usuarios.
                  </p>
                  {automatizacionActiva && (
                    <div style={{ padding: '8px', background: '#fff3cd', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', color: '#856404' }}>
                      ⚙️ Controlado por automatización de horario
                    </div>
                  )}
                  <div className={styles.switchContainer}>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        id="appStatus"
                        checked={appActiva}
                        onChange={handleAppStatusChange}
                        className={styles.switchInput}
                      />
                      <span className={`${styles.slider} ${appActiva ? styles.sliderActive : ''}`}></span>
                    </label>
                    <span className={styles.switchStatus}>
                      {appActiva ? (
                        <span className={styles.statusActive}>Guardado de Rutas Activo</span>
                      ) : (
                        <span className={styles.statusInactive}>Guardado de Rutas Desactivado</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Automatización de Horario - columna 2 */}
              <div className={styles.configCard}>
                <h3>Automatización por Horario</h3>
                <p className={styles.configDescription} style={{ marginBottom: '16px' }}>
                  Programa la activación automática del sistema en un rango de fecha y hora específico.
                </p>
                <div className={styles.switchContainer}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      id="automatizacion"
                      checked={automatizacionActiva}
                      onChange={handleAutomatizacionChange}
                      className={styles.switchInput}
                    />
                    <span className={`${styles.slider} ${automatizacionActiva ? styles.sliderActive : ''}`}></span>
                  </label>
                  <span className={styles.switchStatus}>
                    {automatizacionActiva ? (
                      <span className={styles.statusActive}>Automatización Activa</span>
                    ) : (
                      <span className={styles.statusInactive}>Automatización Desactivada</span>
                    )}
                  </span>
                </div>

                {automatizacionActiva && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    {/* Fecha y Hora de Inicio */}
                    <div>
                      <label htmlFor="fechaInicio" className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>
                        Fecha y Hora de Inicio
                      </label>
                      <input
                        type="datetime-local"
                        id="fechaInicio"
                        value={fechaHoraInicio}
                        onChange={(e) => setFechaHoraInicio(e.target.value)}
                        className={styles.configInput}
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Fecha y Hora de Fin */}
                    <div>
                      <label htmlFor="fechaFin" className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>
                        Fecha y Hora de Fin
                      </label>
                      <input
                        type="datetime-local"
                        id="fechaFin"
                        value={fechaHoraFin}
                        onChange={(e) => setFechaHoraFin(e.target.value)}
                        className={styles.configInput}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <p className={styles.configDescription} style={{ fontSize: '11px', margin: 0 }}>
                      La aplicación se activará automáticamente desde la fecha/hora de inicio hasta la fecha/hora de fin.
                    </p>
                    
                    {/* Botón Guardar */}
                    <button
                      onClick={handleGuardarAutomatizacion}
                      className={styles.uploadButton}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Guardar Configuración
                    </button>

                    {/* Mensaje de confirmación */}
                    {mensajeAutomatizacion && (
                      <div style={{ padding: '10px', background: '#d4edda', color: '#155724', borderRadius: '6px', fontSize: '12px', marginTop: '8px' }}>
                        {mensajeAutomatizacion}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Porcentaje Holgura - columna 3 (a la derecha de Automatización) */}
              <div className={styles.configCard}>
                <h3>Porcentaje Holgura</h3>
                <div className={styles.configSection}>
                  <label htmlFor="umbralPorcentaje" className={styles.configLabel}>
                    Porcentaje de Holgura para KM Validado (%)
                  </label>
                  <div className={styles.configInputGroup}>
                    <input
                      type="number"
                      id="umbralPorcentaje"
                      value={umbralPorcentaje}
                      onChange={handleUmbralChange}
                      min="-100"
                      max="100"
                      step="1"
                      className={styles.configInput}
                    />
                    <span className={styles.configUnit}>%</span>
                  </div>
                  <p className={styles.configHint}>
                    Este porcentaje se suma a KM Ruta para calcular KM Validado. Actual: <strong>{umbralPorcentaje}%</strong>
                  </p>
                </div>
              </div>

              {/* Factor Semanas - columna 4 */}
              <div className={styles.configCard}>
                <h3>Factor Semanas</h3>
                <div className={styles.configSection}>
                  <label htmlFor="factorSemanas" className={styles.configLabel}>
                    Factor de Semanas por Mes
                  </label>
                  <div className={styles.configInputGroup}>
                    <input
                      type="number"
                      id="factorSemanas"
                      value={factorSemanas}
                      onChange={handleFactorSemanasChange}
                      min="0.1"
                      max="10"
                      step="0.01"
                      className={styles.configInput}
                    />
                  </div>
                  <p className={styles.configHint}>
                    KM Mes = KM Validado × <strong>{factorSemanas}</strong> (semanas por mes)
                  </p>
                  <p className={styles.configHint} style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                    Valor típico: 4.20 (promedio de semanas en un mes)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

            {/* TAB 2: GESTIÓN DE RUTAS */}
            {activeOptimizaTab === 'gestion' && (
          <div className={styles.tabContent}>
            <div className={styles.uploadCard}>
              <h3>Cargar y Procesar Rutas</h3>
              <p className={styles.uploadDescription}>
                Carga el archivo Maestro APP.csv y automáticamente calcula rutas optimizadas por distrito usando OSRM.
              </p>
              <div className={styles.uploadSection}>
                <input
                  type="file"
                  id="fileInput"
                  accept=".csv"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={isCalculating}
                />
                <label htmlFor="fileInput" className={styles.fileLabel}>
                  {selectedFile ? selectedFile.name : 'Seleccionar archivo Maestro APP.csv'}
                </label>
                <button 
                  onClick={handleUploadRoutes} 
                  className={styles.uploadButton}
                  disabled={!selectedFile || isCalculating}
                >
                  {isCalculating ? 'Procesando rutas...' : 'Cargar y Calcular Rutas'}
                </button>
              </div>
              <p className={styles.uploadNote}>
                Formato aceptado: CSV (.csv) | 
                Al cargar, se calculan automáticamente las rutas optimizadas
              </p>
              
              {calculationResult && (
                <div className={styles.resultBox}>
                  <h4>Resultados del Cálculo</h4>
                  <p>Total distritos procesados: <strong>{calculationResult.total_distritos}</strong></p>
                  <p>Distritos exitosos: <strong>{calculationResult.distritos_procesados.length}</strong></p>
                  {calculationResult.distritos_coordenadas_vacias?.length > 0 && (
                    <>
                      <p style={{ color: '#ff9800' }}>
                        Distritos con coordenadas vacías: <strong>{calculationResult.distritos_coordenadas_vacias.length}</strong>
                      </p>
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff8e1', borderRadius: '5px', border: '1px solid #ffb300' }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#e65100' }}>Distritos con clientes sin coordenadas:</h5>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {calculationResult.distritos_coordenadas_vacias.map((distrito: string, idx: number) => (
                            <span key={idx} style={{ background: '#fff3e0', border: '1px solid #ffb300', borderRadius: '4px', padding: '2px 8px', fontSize: '0.85em', color: '#bf360c' }}>
                              {distrito}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {calculationResult.errores.length > 0 && (
                    <>
                      <p style={{ color: '#ff4444' }}>Errores: <strong>{calculationResult.errores.length}</strong></p>
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px' }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#ff4444' }}>Detalles de errores:</h5>
                        {calculationResult.errores.map((error: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '8px', fontSize: '0.9em' }}>
                            <strong>{error.distrito || 'Distrito desconocido'}</strong>
                            {error.dia && ` - ${error.dia}`}
                            {error.vendedor && ` - ${error.vendedor}`}
                            <br />
                            <span style={{ color: '#666' }}>→ {error.error}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

            {/* TAB 3: ESTADO DE RUTAS */}
            {activeOptimizaTab === 'estado' && (
          <div className={styles.tabContent}>
            {loadingEstado ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <LoadingDots />
              </div>
            ) : estadoConsolidados ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Layout Horizontal: Distritos a la izquierda, Tabla a la derecha */}
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', alignItems: 'start' }}>
                  {/* Columna Izquierda: Indicadores + Grid de Distritos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Resumen Compacto */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <div style={{ padding: '8px 16px', background: '#d4edda', borderRadius: '6px', textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>
                          {estadoConsolidados.guardados}
                        </div>
                        <div style={{ fontSize: '11px', color: '#155724' }}>Guardados</div>
                      </div>
                      <div style={{ padding: '8px 16px', background: '#f8d7da', borderRadius: '6px', textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>
                          {estadoConsolidados.pendientes}
                        </div>
                        <div style={{ fontSize: '11px', color: '#721c24' }}>Pendientes</div>
                      </div>
                    </div>
                    
                    {/* Grid de Distritos */}
                    <div className={styles.uploadCard}>
                  <h3>Rutas Guardadas por Distrito</h3>
                  <p className={styles.uploadDescription}>
                    Pasa el cursor sobre cada distrito para ver detalles.
                  </p>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', 
                    gap: '8px',
                    marginTop: '16px'
                  }}>
                    {estadoConsolidados.distritos.map((distrito: any) => {
                      const total = distrito.total_vendedores ?? 0;
                      const guardados = distrito.vendedores_guardados ?? 0;
                      const esVerde = guardados > 0 && guardados >= total;
                      const esAmarillo = guardados > 0 && guardados < total;
                      const bgColor = esVerde ? '#28a745' : esAmarillo ? '#f59e0b' : '#dc3545';
                      const nombreUsuario = distrito.usuario_nombre || distrito.usuario || 'Sin usuario';

                      // Construir lista de vendedores para el tooltip
                      const vendedoresList = (distrito.vendedores_lista || [])
                        .map((v: any) => `${v.guardado ? '\u2713' : '\u2717'} ${v.nombre}`)
                        .join('\n');

                      const tooltipText = `${distrito.nombre_distrito}\nUsuario: ${nombreUsuario}\nTasa de vendedores: ${guardados} de ${total}${vendedoresList ? '\n\n' + vendedoresList : ''}`;

                      return (
                        <div
                          key={distrito.codigo_distrito}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            textAlign: 'center',
                            background: bgColor,
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            cursor: 'default',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                          title={tooltipText}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.08)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                          }}
                        >
                          {distrito.codigo_distrito}
                        </div>
                      );
                    })}
                  </div>
                </div>
                  </div>

                  {/* Columna Derecha: Tabla de Historial */}
                  <div className={styles.uploadCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Historial de Guardados</h3>
                    {/* Filtro por distrito */}
                    <input
                      type="text"
                      placeholder="Buscar distrito..."
                      value={filtroDistrito}
                      onChange={(e) => setFiltroDistrito(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        width: '200px'
                      }}
                    />
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.rankingTable}>
                      <thead>
                        <tr>
                          <th 
                            onClick={() => handleSort('codigo_distrito')}
                            className={styles.sortableColumn}
                            style={{ width: '80px', minWidth: '80px' }}
                          >
                            Distrito<span style={{ opacity: sortBy === 'codigo_distrito' ? 1 : 0, display: 'inline-block', width: '10px', marginLeft: '2px' }}>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                          </th>
                          <th style={{ width: '100px', minWidth: '100px' }}>Nombre</th>
                          <th 
                            onClick={() => handleSort('fecha_guardado')}
                            className={styles.sortableColumn}
                            style={{ width: '90px', minWidth: '90px' }}
                          >
                            Fecha<span style={{ opacity: sortBy === 'fecha_guardado' ? 1 : 0, display: 'inline-block', width: '10px', marginLeft: '2px' }}>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                          </th>
                          <th style={{ width: '70px', minWidth: '70px' }}>KM SAP</th>
                          <th style={{ width: '70px', minWidth: '70px' }}>KM Opt.</th>
                          <th 
                            onClick={() => handleSort('km_ruta')}
                            className={styles.sortableColumn}
                            style={{ width: '75px', minWidth: '75px', color: 'white' }}
                          >
                            KM Ruta<span style={{ opacity: sortBy === 'km_ruta' ? 1 : 0, display: 'inline-block', width: '10px', marginLeft: '2px' }}>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                          </th>
                          <th style={{ width: '90px', minWidth: '90px' }}>KM Holg. <span style={{ fontSize: '9px' }}>(+{umbralPorcentaje}%)</span></th>
                          <th 
                            onClick={() => handleSort('km_validado')}
                            className={styles.sortableColumn}
                            style={{ width: '80px', minWidth: '80px' }}
                          >
                            KM Valid.<span style={{ opacity: sortBy === 'km_validado' ? 1 : 0, display: 'inline-block', width: '10px', marginLeft: '2px' }}>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                          </th>
                          <th 
                            onClick={() => handleSort('diferencia_km')}
                            className={styles.sortableColumn}
                            style={{ width: '75px', minWidth: '75px' }}
                          >
                            KM Dif.<span style={{ opacity: sortBy === 'diferencia_km' ? 1 : 0, display: 'inline-block', width: '10px', marginLeft: '2px' }}>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                          </th>
                          <th 
                            onClick={() => handleSort('tasa_vendedores')}
                            className={styles.sortableColumn}
                            style={{ width: '80px', minWidth: '80px' }}
                          >
                            Tasa Vend.<span style={{ opacity: sortBy === 'tasa_vendedores' ? 1 : 0, display: 'inline-block', width: '10px', marginLeft: '2px' }}>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDistritosFiltrados()
                          .filter((d: any) => d.guardado)
                          .length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                              No hay rutas guardadas
                            </td>
                          </tr>
                        ) : (
                          getDistritosFiltrados()
                            .filter((d: any) => d.guardado)
                            .map((distrito: any, idx: number) => (
                              <tr key={idx}>
                                <td data-label="Distrito" style={{ fontWeight: 'bold', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                  {distrito.nombre_distrito}
                                </td>
                                <td data-label="Nombre" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{distrito.usuario_nombre || distrito.usuario || 'N/A'}</td>
                                <td data-label="Fecha" style={{ whiteSpace: 'normal' }}>
                                  <div>
                                    {new Date(distrito.fecha_guardado).toLocaleDateString('es-CL', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#666' }}>
                                    {new Date(distrito.fecha_guardado).toLocaleTimeString('es-CL', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </td>
                                <td data-label="KM SAP">{(distrito.km_sap ?? 0).toFixed(2)} km</td>
                                <td data-label="KM Optimizado">{(distrito.km_optimizado ?? 0).toFixed(2)} km</td>
                                <td data-label="KM Ruta" style={{ color: '#0e7490', fontWeight: '600' }}>
                                  {(distrito.km_ruta ?? 0).toFixed(2)} km
                                </td>
                                <td data-label="KM Holgura">{(distrito.km_holgura ?? 0).toFixed(2)} km</td>
                                <td data-label="KM Validado" style={{ background: 'rgba(45, 122, 62, 0.08)', color: '#1a4d2e', fontWeight: '600' }}>
                                  {(distrito.km_validado ?? 0).toFixed(2)} km
                                </td>
                                <td data-label="KM Dif." style={{ 
                                  color: (distrito.diferencia_km ?? 0) >= 0 ? '#2d7a3e' : '#dc3545',
                                  fontWeight: '600'
                                }}>
                                  {(distrito.diferencia_km ?? 0).toFixed(2)} km
                                </td>
                                <td data-label="Tasa Vend.">
                                  <span 
                                    className={`${styles.percentageBadge} ${
                                      distrito.tasa_vendedores === 100 
                                        ? styles.percentageGood 
                                        : distrito.tasa_vendedores === 0
                                        ? styles.percentageHigh
                                        : styles.percentageMedium
                                    }`}
                                    title={`${distrito.vendedores_guardados ?? 0} de ${distrito.total_vendedores ?? 0} vendedores`}
                                  >
                                    {(distrito.tasa_vendedores ?? 0).toFixed(0)}%
                                  </span>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                No se pudo cargar el estado de rutas guardadas
              </div>
            )}
          </div>
        )}

            {/* TAB 4: REPORTES */}
            {activeOptimizaTab === 'reportes' && (
              <div className={styles.tabContent}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: '24px', width: '100%' }}>
                  
                  {/* Card 2: Descargar XLSX Vendedores */}
                  <div className={styles.uploadCard}>
                    <h3>Descargar XLSX Vendedores</h3>
                    <p className={styles.uploadDescription}>
                      Descarga un archivo Excel con todos los vendedores, KM Semana (KM Validado) y KM Mes (KM Validado × Factor Semanas).
                    </p>
                    <div className={styles.uploadSection}>
                      <button 
                        onClick={handleDescargarXLSXVendedores}
                        className={styles.uploadButton}
                      >
                        Descargar XLSX Vendedores
                      </button>
                    </div>
                    <p className={styles.uploadNote}>
                      Formato: Excel (.xlsx)
                    </p>
                  </div>

                  {/* Card 3: Descargar Maestro Consolidado */}
                  <div className={styles.uploadCard}>
                    <h3>Descargar Maestro Consolidado</h3>
                    <p className={styles.uploadDescription}>
                      Descarga el Maestro APP con las columnas de coordenadas validadas (ValidadaLatitud, ValidadaLongitud, ValidadaSec.Visita) incorporadas.
                    </p>
                    <div className={styles.uploadSection}>
                      <button 
                        onClick={handleDescargarMaestroConsolidadoCSV}
                        className={styles.uploadButton}
                      >
                        Descargar Maestro Consolidado
                      </button>
                    </div>
                    <p className={styles.uploadNote}>
                      Formato: CSV (.csv)
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 5: CONFIGURACIÓN PDF */}
            {activeOptimizaTab === 'pdf' && (
              <div className={styles.tabContent}>
                
                {/* Grid principal: Config (izq grande) | Variables + Botones (der) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'minmax(600px, 2.5fr) 450px',
                  gap: '20px'
                }}>
                
                {/* Área 1: Editor de Configuración (izquierda) */}
                <div className={styles.uploadCard}>
                  <h3 style={{ marginBottom: '12px' }}>Configuración del PDF</h3>
                  
                  {/* TOOLBAR GLOBAL DE FORMATO */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '12px', background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)', borderRadius: '8px', border: '2px solid #d0d0d0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#333', marginRight: '8px' }}>Formato de Texto:</div>
                    {(['negrita', 'cursiva', 'subrayado'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleAplicarFormato(fmt)}
                        title={`${fmt.charAt(0).toUpperCase() + fmt.slice(1)} — selecciona texto y haz clic`}
                        style={{ padding: '8px 16px', background: 'white', border: '2px solid #2d7a3e', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontWeight: fmt === 'negrita' ? 'bold' : 'normal', fontStyle: fmt === 'cursiva' ? 'italic' : 'normal', textDecoration: fmt === 'subrayado' ? 'underline' : 'none' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#2d7a3e'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'black'; }}
                      >
                        {fmt === 'negrita' ? 'B' : fmt === 'cursiva' ? 'I' : 'U'}
                      </button>
                    ))}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Título del Documento</label>
                        <input id="pdf-titulo" type="text" value={plantillaPDF.titulo} onChange={(e) => setPlantillaPDF({ ...plantillaPDF, titulo: e.target.value })} onFocus={() => setLastFocusedField('titulo')} className={styles.configInput} style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Tamaño Fuente Título: {plantillaPDF.tamano_fuente_titulo}px</label>
                        <input type="range" min="10" max="24" value={plantillaPDF.tamano_fuente_titulo} onChange={(e) => setPlantillaPDF({ ...plantillaPDF, tamano_fuente_titulo: parseInt(e.target.value) })} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Tamaño Fuente Contenido: {plantillaPDF.tamano_fuente_contenido}px</label>
                        <input type="range" min="8" max="16" value={plantillaPDF.tamano_fuente_contenido} onChange={(e) => setPlantillaPDF({ ...plantillaPDF, tamano_fuente_contenido: parseInt(e.target.value) })} style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Texto Superior (antes de la tabla)</label>
                    <textarea id="texto-superior" value={plantillaPDF.texto_superior} onChange={(e) => setPlantillaPDF(prev => ({ ...prev, texto_superior: e.target.value }))} onFocus={() => setLastFocusedField('texto_superior')} className={styles.configInput} placeholder="Ej: Estimado(a) **[NOMBRE_VENDEDOR]**..." style={{ width: '100%', minHeight: '180px', height: '180px', fontFamily: 'monospace', fontSize: '13px', padding: '12px', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Texto Inferior (después de la tabla)</label>
                    <textarea id="texto-inferior" value={plantillaPDF.texto_inferior} onChange={(e) => setPlantillaPDF(prev => ({ ...prev, texto_inferior: e.target.value }))} onFocus={() => setLastFocusedField('texto_inferior')} className={styles.configInput} placeholder="Texto adicional después de la tabla (opcional)..." style={{ width: '100%', minHeight: '120px', height: '120px', fontFamily: 'monospace', fontSize: '13px', padding: '12px', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#333' }}>Líneas de Firma</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Texto Firma Izquierda</label>
                        <textarea id="firma-izquierda" value={plantillaPDF.firma_izquierda} onChange={(e) => setPlantillaPDF(prev => ({ ...prev, firma_izquierda: e.target.value }))} onFocus={() => setLastFocusedField('firma_izquierda')} className={styles.configInput} placeholder="Ej: Firma Vendedor" style={{ width: '100%', minHeight: '80px', height: '80px', fontFamily: 'sans-serif', fontSize: '13px', padding: '8px', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>Texto Firma Derecha</label>
                        <textarea id="firma-derecha" value={plantillaPDF.firma_derecha} onChange={(e) => setPlantillaPDF(prev => ({ ...prev, firma_derecha: e.target.value }))} onFocus={() => setLastFocusedField('firma_derecha')} className={styles.configInput} placeholder="Ej: Firma Supervisor" style={{ width: '100%', minHeight: '80px', height: '80px', fontFamily: 'sans-serif', fontSize: '13px', padding: '8px', resize: 'vertical' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Área 2: Variables + Botones (derecha) */}
                <div>
                  <div className={styles.uploadCard} style={{ marginBottom: '0' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '16px', color: '#2d7a3e' }}>Variables Disponibles</h3>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px', lineHeight: '1.4' }}>Haz clic para insertar en el campo activo</p>
                    
                    <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                      {[
                        [
                          { name: 'NOMBRE_VENDEDOR', desc: 'Nombre del vendedor' },
                          { name: 'CODIGO_VENDEDOR', desc: 'Código del vendedor' },
                          { name: 'JEFE_VENTA', desc: 'Jefe de venta del distrito' },
                          { name: 'DISTRITO', desc: 'Nombre del distrito' }
                        ],
                        [
                          { name: 'FECHA', desc: 'Fecha actual (dd/mm/aaaa)' },
                          { name: 'HORA', desc: 'Hora actual (hh:mm:ss)' },
                          { name: 'FECHA_ACTUAL', desc: 'Fecha y hora completa' }
                        ],
                        [
                          { name: 'KM_SAP', desc: 'Total kilómetros SAP' },
                          { name: 'KM_OPTIMIZADO', desc: 'Total kilómetros optimizados' }
                        ],
                        [
                          { name: 'KM_RUTA', desc: 'Total KM de ruta del vendedor' },
                          { name: 'KM_VALIDADO', desc: 'Total kilómetros validados' },
                          { name: 'KM_HOLGURA', desc: 'Total kilómetros de holgura' },
                          { name: 'KM_DIFERENCIA', desc: 'Diferencia total (Validado - SAP)' },
                          { name: 'KM_MES', desc: 'KM por mes (KM Validado × Factor Semanas)' }
                        ],
                        [
                          { name: 'PORCENTAJE_HOLGURA', desc: 'Porcentaje de holgura configurado' },
                          { name: 'FACTOR_SEMANAS', desc: 'Factor de semanas por mes configurado' }
                        ]
                      ].map((grupo, gi) => (
                        <div key={gi} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {grupo.map((v, vi) => (
                              <div
                                key={vi}
                                onClick={() => handleInsertarVariable(`[${v.name}]`)}
                                style={{ background: 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)', color: 'white', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', userSelect: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flex: '0 0 auto' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(45,122,62,0.4)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                                title={v.desc}
                              >
                                <div style={{ fontWeight: '600', fontSize: '11px', textAlign: 'center' }}>[{v.name}]</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '16px', padding: '10px', background: '#e3f2fd', borderRadius: '6px', fontSize: '11px', color: '#1976d2' }}>
                      <strong>Nota:</strong> Las variables se reemplazarán con datos reales al generar el PDF.
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button 
                      onClick={() => setMostrarPreviewModal(true)}
                      style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(25,118,210,0.3)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      Vista Previa
                    </button>
                    <button 
                      onClick={handleGuardarPlantillaPDF}
                      style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(45,122,62,0.3)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      Guardar Configuración
                    </button>
                    {mensajePDF && (
                      <div style={{ padding: '10px', background: '#e8f5e9', borderRadius: '6px', color: '#2d7a3e', fontWeight: '600', fontSize: '13px', textAlign: 'center' }}>
                        {mensajePDF}
                      </div>
                    )}
                  </div>
                </div>

                </div> {/* Fin grid principal */}

                {/* Modal de Vista Previa */}
                {mostrarPreviewModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px', animation: 'modalOverlayIn 0.2s ease' }} onClick={() => setMostrarPreviewModal(false)}>
                    <div style={{ background: 'white', borderRadius: '12px', width: '660px', maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative', padding: '40px 30px 30px 30px', animation: 'modalContentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setMostrarPreviewModal(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#666', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 100 }}>×</button>
                      
                      <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '30px', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
                          <h2 style={{ fontSize: `${plantillaPDF.tamano_fuente_titulo}px`, fontWeight: '700', marginBottom: '12px', color: '#333', textAlign: 'left' }}>
                            {renderizarTextoConFormato(reemplazarVariablesPreview(plantillaPDF.titulo || ''))}
                          </h2>
                          {plantillaPDF.texto_superior && (
                            <div style={{ fontSize: `${plantillaPDF.tamano_fuente_contenido}px`, color: '#666', marginBottom: '20px' }}>
                              {renderizarTextoConFormato(reemplazarVariablesPreview(plantillaPDF.texto_superior))}
                            </div>
                          )}
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '16px' }}>
                            <thead>
                              <tr style={{ background: '#2d7a3e', color: 'white' }}>
                                <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Día</th>
                                <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Clientes</th>
                                <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>KM Ruta</th>
                                <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>KM Holgura (+15%)</th>
                                <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>KM Validado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ['LU', 44, 36.00, 5.40, 41.40],
                                ['MA', 38, 32.50, 4.88, 37.38],
                                ['MI', 42, 38.00, 5.70, 43.70],
                                ['JU', 40, 35.50, 5.33, 40.83],
                                ['VI', 39, 40.00, 6.00, 46.00]
                              ].map(([dia, cl, kr, kh, kv], i) => (
                                <tr key={i}>
                                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{dia}</td>
                                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{cl}</td>
                                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{kr}</td>
                                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{kh}</td>
                                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{kv}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {plantillaPDF.texto_inferior && (
                            <div style={{ fontSize: `${plantillaPDF.tamano_fuente_contenido}px`, color: '#666', marginTop: '20px' }}>
                              {renderizarTextoConFormato(reemplazarVariablesPreview(plantillaPDF.texto_inferior))}
                            </div>
                          )}
                          {(plantillaPDF.firma_izquierda || plantillaPDF.firma_derecha) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '60px', paddingTop: '20px' }}>
                              {plantillaPDF.firma_izquierda && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ borderTop: '1px solid #333', marginBottom: '8px', width: '80%', margin: '0 auto' }}></div>
                                  <div style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>{renderizarTextoConFormato(reemplazarVariablesPreview(plantillaPDF.firma_izquierda))}</div>
                                </div>
                              )}
                              {plantillaPDF.firma_derecha && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ borderTop: '1px solid #333', marginBottom: '8px', width: '80%', margin: '0 auto' }}></div>
                                  <div style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>{renderizarTextoConFormato(reemplazarVariablesPreview(plantillaPDF.firma_derecha))}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* CAMBIOS MASIVOS CONTENT */}
        {activeSystem === 'cambios-masivos' && (
          <>
            {/* TAB 1: CONFIGURACIÓN */}
            {activeCambiosTab === 'config' && (
              <div className={styles.tabContent}>
                {/* Grid de 2 columnas para la configuración */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, minmax(400px, 1fr))', 
                  gap: '28px', 
                  alignItems: 'start', 
                  width: '100%' 
                }}>
                  
                  {/* Control de Acceso - columna 1 */}
                  <div className={styles.configCard}>
                    <h3>Control de Acceso</h3>
                    <div className={styles.configSection}>
                      <label htmlFor="appStatusCambios" className={styles.configLabel}>
                        Estado Manual de Cambios Masivos
                      </label>
                      <p className={styles.configDescription}>
                        Activa o desactiva manualmente el acceso al módulo de Cambios Masivos.
                      </p>
                      {automatizacionActivaCambios && (
                        <div style={{ padding: '8px', background: '#fff3cd', borderRadius: '6px', marginBottom: '8px', fontSize: '12px', color: '#856404' }}>
                          ⚙️ Controlado por automatización de horario
                        </div>
                      )}
                      <div className={styles.switchContainer}>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            id="appStatusCambios"
                            checked={appActivaCambios}
                            onChange={handleAppStatusChangeCambios}
                            className={styles.switchInput}
                          />
                          <span className={`${styles.slider} ${appActivaCambios ? styles.sliderActive : ''}`}></span>
                        </label>
                        <span className={styles.switchStatus}>
                          {appActivaCambios ? (
                            <span className={styles.statusActive}>Cambios Masivos Activo</span>
                          ) : (
                            <span className={styles.statusInactive}>Cambios Masivos Desactivado</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Automatización de Horario - columna 2 */}
                  <div className={styles.configCard}>
                    <h3>Automatización por Horario</h3>
                    <p className={styles.configDescription} style={{ marginBottom: '16px' }}>
                      Programa la activación automática del módulo en un rango de fecha y hora específico.
                    </p>
                    <div className={styles.switchContainer}>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          id="automatizacionCambios"
                          checked={automatizacionActivaCambios}
                          onChange={handleAutomatizacionChangeCambios}
                          className={styles.switchInput}
                        />
                        <span className={`${styles.slider} ${automatizacionActivaCambios ? styles.sliderActive : ''}`}></span>
                      </label>
                      <span className={styles.switchStatus}>
                        {automatizacionActivaCambios ? (
                          <span className={styles.statusActive}>Automatización Activa</span>
                        ) : (
                          <span className={styles.statusInactive}>Automatización Desactivada</span>
                        )}
                      </span>
                    </div>

                    {automatizacionActivaCambios && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                        {/* Fecha y Hora de Inicio */}
                        <div>
                          <label htmlFor="fechaInicioCambios" className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>
                            Fecha y Hora de Inicio
                          </label>
                          <input
                            type="datetime-local"
                            id="fechaInicioCambios"
                            value={fechaHoraInicioCambios}
                            onChange={(e) => setFechaHoraInicioCambios(e.target.value)}
                            className={styles.configInput}
                            style={{ width: '100%' }}
                          />
                        </div>

                        {/* Fecha y Hora de Fin */}
                        <div>
                          <label htmlFor="fechaFinCambios" className={styles.configLabel} style={{ display: 'block', marginBottom: '8px' }}>
                            Fecha y Hora de Fin
                          </label>
                          <input
                            type="datetime-local"
                            id="fechaFinCambios"
                            value={fechaHoraFinCambios}
                            onChange={(e) => setFechaHoraFinCambios(e.target.value)}
                            className={styles.configInput}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <p className={styles.configDescription} style={{ fontSize: '11px', margin: 0 }}>
                          El módulo se activará automáticamente desde la fecha/hora de inicio hasta la fecha/hora de fin.
                        </p>
                        
                        {/* Botón Guardar */}
                        <button
                          onClick={handleGuardarAutomatizacionCambios}
                          className={styles.uploadButton}
                          style={{ width: '100%', marginTop: '8px' }}
                        >
                          Guardar Configuración
                        </button>

                        {/* Mensaje de confirmación */}
                        {mensajeAutomatizacionCambios && (
                          <div style={{ padding: '10px', background: '#d4edda', color: '#155724', borderRadius: '6px', fontSize: '12px', marginTop: '8px' }}>
                            {mensajeAutomatizacionCambios}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CARGAR ARCHIVO */}
            {activeCambiosTab === 'cargar' && (
              <div className={styles.tabContent}>
                {/* Grid de 3 columnas para los tres tipos de archivos */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '24px',
                  maxWidth: '1400px',
                  margin: '0 auto'
                }}>
                  
                  {/* ESTRUCTURA DE VENTAS */}
                  <div className={styles.uploadCard}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #219653 0%, #1a7a42 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(33, 150, 83, 0.3)'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3v18h18"/>
                          <path d="M18 17V9"/>
                          <path d="M13 17V5"/>
                          <path d="M8 17v-3"/>
                        </svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Estructura de Ventas</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Dotación mensual de vendedores</p>
                      </div>
                    </div>
                    
                    <p className={styles.uploadDescription}>
                      Este archivo define la <strong>dotación de vendedores</strong> de cada zona. Al subirlo, los Jefes de Venta podrán ver y editar su equipo desde las pantallas <em>"Estructura de Venta"</em> y <em>"Administrar Dotación"</em> dentro de Cambios Masivos. Debe actualizarse cada mes con la información vigente.
                    </p>
                    
                    <div className={styles.uploadSection}>
                      <input
                        id="baseFileInput"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleBaseFileChange}
                        className={styles.fileInput}
                        disabled={isUploadingBase}
                      />
                      <label htmlFor="baseFileInput" className={styles.fileLabel}>
                        {selectedBaseFile ? selectedBaseFile.name : 'Seleccionar archivo Excel (.xlsx, .xls)'}
                      </label>
                      <button
                        onClick={handleUploadBaseFile}
                        disabled={!selectedBaseFile || isUploadingBase}
                        className={`${styles.uploadButton} ${isUploadingBase ? styles.uploading : ''}`}
                      >
                        {isUploadingBase ? <><span className={styles.spinner} />Subiendo...</> : 'Subir Archivo Base'}
                      </button>
                    </div>
                    
                    <div className={styles.uploadNote}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Requisitos del archivo:</strong>
                      <ul style={{ margin: '0', paddingLeft: '18px', lineHeight: '1.6' }}>
                        <li>Formato: <strong>Excel (.xlsx o .xls)</strong></li>
                        <li>Debe contener <strong>al menos una hoja</strong> (el nombre no importa, se detecta automáticamente)</li>
                        <li>Columnas obligatorias: <strong>Año, Mes, CodDistrito, DesDistrito, CodOficina, DesOficina, CodVenta, Cargo, Rut, Nombre, APaterno, AMaterno, Telefono, Correo, ZonaEstival, Genero, TallaPantalon, TallaCamisa</strong></li>
                      </ul>
                    </div>

                    {uploadBaseResult && (
                      <div className={uploadBaseResult.success ? styles.resultBox : styles.resultBoxError}>
                        <h4>{uploadBaseResult.success ? '✓ Éxito' : '✗ Error'}</h4>
                        <p><strong>{uploadBaseResult.message}</strong></p>
                        {uploadBaseResult.details && (
                          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>{uploadBaseResult.details}</p>
                        )}
                        {uploadBaseResult.columnas_faltantes_por_hoja && uploadBaseResult.columnas_faltantes_por_hoja.length > 0 && (
                          <div style={{ marginTop: '10px', fontSize: '0.85em' }}>
                            {uploadBaseResult.columnas_faltantes_por_hoja.map((detalle: string, idx: number) => (
                              <p key={idx} style={{ margin: '4px 0', padding: '6px 8px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}>{detalle}</p>
                            ))}
                          </div>
                        )}
                        {uploadBaseResult.sugerencia && (
                          <p style={{ marginTop: '10px', fontSize: '0.85em', color: '#555', fontStyle: 'italic' }}>💡 {uploadBaseResult.sugerencia}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CARTERAS */}
                  <div className={styles.uploadCard}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Carteras</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Asignación de clientes por vendedor</p>
                      </div>
                    </div>
                    
                    <p className={styles.uploadDescription}>
                      Este archivo contiene la <strong>cartera de clientes asignada a cada vendedor</strong>. Al subirlo, los Jefes de Venta podrán gestionar las carteras desde la pantalla <em>"Gestión de Carteras"</em> de Cambios Masivos. Cada fila representa un cliente vinculado a un vendedor específico.
                    </p>
                    
                    <div className={styles.uploadSection}>
                      <input
                        id="carteraFileInput"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleCarteraFileChange}
                        className={styles.fileInput}
                        disabled={isUploadingCartera}
                      />
                      <label htmlFor="carteraFileInput" className={styles.fileLabel}>
                        {selectedCarteraFile ? selectedCarteraFile.name : 'Seleccionar archivo Excel (.xlsx, .xls)'}
                      </label>
                      <button
                        onClick={handleUploadCarteraFile}
                        disabled={!selectedCarteraFile || isUploadingCartera}
                        className={`${styles.uploadButton} ${isUploadingCartera ? styles.uploading : ''}`}
                      >
                        {isUploadingCartera ? <><span className={styles.spinner} />Subiendo...</> : 'Subir Archivo Base'}
                      </button>
                    </div>
                    
                    <div className={styles.uploadNote}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Requisitos del archivo:</strong>
                      <ul style={{ margin: '0', paddingLeft: '18px', lineHeight: '1.6' }}>
                        <li>Formato: <strong>Excel (.xlsx o .xls)</strong></li>
                        <li>Cada fila = un cliente asignado a un vendedor</li>
                        <li>Columnas obligatorias: <strong>CodDistrito, DesDistrito, CodVend, NombreVend, CodCliente, RutCliente, RazonSocial, TipoNeg, Relev, NivPrecio, Direccion, Comuna</strong></li>
                      </ul>
                    </div>

                    {uploadCarteraResult && (
                      <div className={uploadCarteraResult.success ? styles.resultBox : styles.resultBoxError}>
                        <h4>{uploadCarteraResult.success ? '✓ Éxito' : '✗ Error'}</h4>
                        <p><strong>{uploadCarteraResult.message}</strong></p>
                        {uploadCarteraResult.details && (
                          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>{uploadCarteraResult.details}</p>
                        )}
                        {uploadCarteraResult.columnas_faltantes && uploadCarteraResult.columnas_faltantes.length > 0 && (
                          <div style={{ marginTop: '10px', fontSize: '0.85em' }}>
                            <p style={{ marginBottom: '4px' }}><strong>Columnas faltantes:</strong></p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {uploadCarteraResult.columnas_faltantes.map((col: string, idx: number) => (
                                <span key={idx} style={{ background: '#ffcdd2', color: '#b71c1c', borderRadius: '4px', padding: '2px 8px', fontSize: '0.9em' }}>{col}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {uploadCarteraResult.sugerencia && (
                          <p style={{ marginTop: '10px', fontSize: '0.85em', color: '#555', fontStyle: 'italic' }}>💡 {uploadCarteraResult.sugerencia}</p>
                        )}
                      </div>
                    )}
                  </div>
                  {/* INSTRUCTIVO */}
                  <div className={styles.uploadCard}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10 9 9 9 8 9"/>
                        </svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Instructivo</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Guías PDF para los Jefes de Venta</p>
                      </div>
                    </div>

                    <p className={styles.uploadDescription}>
                      Sube un <strong>documento PDF de ayuda</strong> para cada pantalla de Cambios Masivos. Los Jefes de Venta podrán consultarlo directamente desde el botón <em>"Instructivo"</em> que aparece en cada pantalla. Puedes subir un instructivo distinto para cada sección.
                    </p>

                    {/* Selector de pantalla */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '6px' }}>Pantalla destino:</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                          { value: 'estructura-venta', label: 'Estructura de Venta' },
                          { value: 'carteras', label: 'Carteras' },
                          { value: 'administrar-dotacion', label: 'Administrar Dotación' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => { setInstructivoPantalla(opt.value); setUploadInstructivoResult(null); }}
                            style={{
                              padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                              border: instructivoPantalla === opt.value ? '2px solid #2d7a3e' : '2px solid #ddd',
                              background: instructivoPantalla === opt.value ? '#2d7a3e' : '#fff',
                              color: instructivoPantalla === opt.value ? '#fff' : '#555',
                              cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            {opt.label}
                            {instructivosExistentes[opt.value]?.exists && (
                              <span style={{ marginLeft: '6px', fontSize: '0.75rem' }}>✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                      {instructivosExistentes[instructivoPantalla]?.exists && (
                        <p style={{ fontSize: '0.82rem', color: '#2d7a3e', marginTop: '6px', fontWeight: 500 }}>
                          Archivo actual: {instructivosExistentes[instructivoPantalla]?.filename}
                        </p>
                      )}
                    </div>

                    <div className={styles.uploadSection}>
                      <input
                        id="instructivoFileInput"
                        type="file"
                        accept=".pdf"
                        onChange={handleInstructivoFileChange}
                        className={styles.fileInput}
                        disabled={isUploadingInstructivo}
                      />
                      <label htmlFor="instructivoFileInput" className={styles.fileLabel}>
                        {selectedInstructivoFile ? selectedInstructivoFile.name : 'Seleccionar archivo PDF'}
                      </label>
                      <button
                        onClick={handleUploadInstructivo}
                        disabled={!selectedInstructivoFile || isUploadingInstructivo}
                        className={`${styles.uploadButton} ${isUploadingInstructivo ? styles.uploading : ''}`}
                      >
                        {isUploadingInstructivo ? <><span className={styles.spinner} />Subiendo...</> : 'Subir Instructivo'}
                      </button>
                    </div>

                    <div className={styles.uploadNote}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Requisitos del archivo:</strong>
                      <ul style={{ margin: '0', paddingLeft: '18px', lineHeight: '1.6' }}>
                        <li>Formato: <strong>PDF</strong></li>
                        <li>Selecciona primero la <strong>pantalla destino</strong> y luego sube el archivo</li>
                        <li>Si ya existe un instructivo para esa pantalla, será <strong>reemplazado</strong> por el nuevo</li>
                      </ul>
                    </div>

                    {uploadInstructivoResult && (
                      <div className={uploadInstructivoResult.success ? styles.resultBox : styles.resultBoxError}>
                        <h4>{uploadInstructivoResult.success ? '✓ Éxito' : '✗ Error'}</h4>
                        <p><strong>{uploadInstructivoResult.message}</strong></p>
                        {uploadInstructivoResult.details && (
                          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>{uploadInstructivoResult.details}</p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* TAB 3: ESTADO DE VALIDACIÓN (COMBINADO) */}
            {activeCambiosTab === 'validacion' && (
              <div className={styles.tabContent}>
                {loadingCombinados ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <LoadingDots />
                    <p style={{ marginTop: '1rem', color: '#666' }}>Cargando estados de validación...</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Resumen Compacto en Cards - 4 cards */}
                    {(() => {
                      // Contar estados por zona (una fila por zona en la tabla)
                      let estructuraValidadaZonas = 0;
                      let estructuraPendienteZonas = 0;
                      let carteraValidadaZonas = 0;
                      let carteraPendienteZonas = 0;
                      estadosCombinados.forEach((jefe: any) => {
                        if (jefe.zonas_codigos && jefe.zonas_codigos.length > 0) {
                          jefe.zonas_codigos.forEach((cod: string) => {
                            if (jefe.zonas_estructura_validada?.[cod]) estructuraValidadaZonas++;
                            else estructuraPendienteZonas++;
                            if (jefe.zonas_cartera_validada?.[cod]) carteraValidadaZonas++;
                            else carteraPendienteZonas++;
                          });
                        } else {
                          if (jefe.estructura_validada) estructuraValidadaZonas++;
                          else estructuraPendienteZonas++;
                          if (jefe.cartera_validada) carteraValidadaZonas++;
                          else carteraPendienteZonas++;
                        }
                      });
                      return (
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <div style={{ padding: '12px 24px', background: '#d4edda', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>
                              {estructuraValidadaZonas}
                            </div>
                            <div style={{ fontSize: '11px', color: '#155724', marginTop: '4px' }}>Estructura Validada</div>
                          </div>
                          <div style={{ padding: '12px 24px', background: '#f8d7da', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>
                              {estructuraPendienteZonas}
                            </div>
                            <div style={{ fontSize: '11px', color: '#721c24', marginTop: '4px' }}>Estructura Pendiente</div>
                          </div>
                          <div style={{ padding: '12px 24px', background: '#d4edda', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>
                              {carteraValidadaZonas}
                            </div>
                            <div style={{ fontSize: '11px', color: '#155724', marginTop: '4px' }}>Cartera Validada</div>
                          </div>
                          <div style={{ padding: '12px 24px', background: '#f8d7da', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>
                              {carteraPendienteZonas}
                            </div>
                            <div style={{ fontSize: '11px', color: '#721c24', marginTop: '4px' }}>Cartera Pendiente</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tabla Principal */}
                    <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>Estado de Validación - Jefes de Venta</h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={cargarEstadosCombinados}
                            style={{
                              padding: '8px 16px',
                              background: '#2d7a3e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1a5027'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#2d7a3e'}
                          >
                             Actualizar
                          </button>
                          <button
                            onClick={() => {
                              // Verificar si hay validaciones pendientes
                              let estructuraPendiente = 0;
                              let carteraPendiente = 0;
                              estadosCombinados.forEach((jefe: any) => {
                                if (jefe.zonas_codigos && jefe.zonas_codigos.length > 0) {
                                  jefe.zonas_codigos.forEach((cod: string) => {
                                    if (!jefe.zonas_estructura_validada?.[cod]) estructuraPendiente++;
                                    if (!jefe.zonas_cartera_validada?.[cod]) carteraPendiente++;
                                  });
                                } else {
                                  if (!jefe.estructura_validada) estructuraPendiente++;
                                  if (!jefe.cartera_validada) carteraPendiente++;
                                }
                              });
                              if (estructuraPendiente > 0 || carteraPendiente > 0) {
                                showConfirm(
                                  'Validaciones pendientes',
                                  `Aún no está todo validado.\n\n` +
                                  `• Estructuras pendientes: ${estructuraPendiente}\n` +
                                  `• Carteras pendientes: ${carteraPendiente}\n\n` +
                                  `¿Estás seguro de que quieres consolidar los datos de todas formas?`,
                                  handleConsolidarCombinado
                                );
                              } else {
                                handleConsolidarCombinado();
                              }
                            }}
                            disabled={loadingCombinados}
                            style={{
                              padding: '8px 16px',
                              background: loadingCombinados ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loadingCombinados ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!loadingCombinados) e.currentTarget.style.background = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                              if (!loadingCombinados) e.currentTarget.style.background = '#3b82f6';
                            }}
                          >
                            Consolidar
                          </button>
                          <button
                            onClick={handleLimpiarValidaciones}
                            style={{
                              padding: '8px 16px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                          >
                             Limpiar
                          </button>
                          <button
                            onClick={handleDescargarConsolidadoCombinado}
                            disabled={estadosCombinados.length === 0}
                            style={{
                              padding: '8px 16px',
                              background: estadosCombinados.length === 0 ? '#9ca3af' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: estadosCombinados.length === 0 ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              transition: 'background 0.2s',
                              opacity: estadosCombinados.length === 0 ? 0.5 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (estadosCombinados.length > 0) {
                                e.currentTarget.style.background = '#059669';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (estadosCombinados.length > 0) {
                                e.currentTarget.style.background = '#10b981';
                              }
                            }}
                          >
                             Descargar Estado de Validación
                          </button>
                        </div>
                      </div>

                      {/* Tabla estilo Excel con 4 columnas */}
                      <div style={{ 
                        background: 'white', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}>
                        <table style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse',
                          fontSize: '0.95rem'
                        }}>
                          <thead>
                            <tr style={{ background: '#2d7a3e', color: 'white' }}>
                              <th style={{ 
                                padding: '14px 20px', 
                                textAlign: 'left',
                                fontWeight: '600',
                                borderRight: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                Nombre
                              </th>
                              <th style={{ 
                                padding: '14px 20px', 
                                textAlign: 'left',
                                fontWeight: '600',
                                borderRight: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                Zona
                              </th>
                              <th style={{ 
                                padding: '14px 20px', 
                                textAlign: 'center',
                                fontWeight: '600',
                                borderRight: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                Estructura de Venta
                              </th>
                              <th style={{ 
                                padding: '14px 20px', 
                                textAlign: 'center',
                                fontWeight: '600'
                              }}>
                                Cartera
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {estadosCombinados.flatMap((jefe, jefeIndex) => {
                              // Si tiene zonas, crear una fila por cada zona
                              if (jefe.zonas.length > 0) {
                                return jefe.zonas.map((zona: string, zonaIndex: number) => {
                                  // Estado de estructura de venta por zona específica
                                  const codigoZona = jefe.zonas_codigos?.[zonaIndex];
                                  const zonaEstructuraValidada = codigoZona && jefe.zonas_estructura_validada
                                    ? jefe.zonas_estructura_validada[codigoZona] === true
                                    : jefe.estructura_validada;
                                  const zonaCarteraValidada = codigoZona && jefe.zonas_cartera_validada
                                    ? jefe.zonas_cartera_validada[codigoZona] === true
                                    : jefe.cartera_validada;
                                  
                                  return (
                                  <tr key={`${jefeIndex}-${zonaIndex}`}
                                    style={{ 
                                      background: (jefeIndex * jefe.zonas.length + zonaIndex) % 2 === 0 ? 'white' : '#f9fafb',
                                      borderBottom: '1px solid #e5e7eb'
                                    }}
                                  >
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      color: '#374151',
                                      borderRight: '1px solid #e5e7eb'
                                    }}>
                                      {jefe.nombre}
                                    </td>
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      color: '#374151',
                                      borderRight: '1px solid #e5e7eb'
                                    }}>
                                      {zona}
                                    </td>
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      textAlign: 'center',
                                      borderRight: '1px solid #e5e7eb'
                                    }}>
                                      <span style={{
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        background: zonaEstructuraValidada ? '#d4edda' : '#fff3cd',
                                        color: zonaEstructuraValidada ? '#155724' : '#856404',
                                        border: `1px solid ${zonaEstructuraValidada ? '#c3e6cb' : '#ffeeba'}`,
                                        display: 'inline-block'
                                      }}>
                                        {zonaEstructuraValidada ? 'Validado' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      textAlign: 'center'
                                    }}>
                                      <span style={{
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        background: zonaCarteraValidada ? '#d4edda' : '#fff3cd',
                                        color: zonaCarteraValidada ? '#155724' : '#856404',
                                        border: `1px solid ${zonaCarteraValidada ? '#c3e6cb' : '#ffeeba'}`,
                                        display: 'inline-block'
                                      }}>
                                        {zonaCarteraValidada ? 'Validado' : 'Pendiente'}
                                      </span>
                                    </td>
                                  </tr>
                                  );
                                });
                              } else {
                                // Si no tiene zonas, mostrar una sola fila
                                return (
                                  <tr key={jefeIndex}
                                    style={{ 
                                      background: jefeIndex % 2 === 0 ? 'white' : '#f9fafb',
                                      borderBottom: '1px solid #e5e7eb'
                                    }}
                                  >
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      color: '#374151',
                                      borderRight: '1px solid #e5e7eb'
                                    }}>
                                      {jefe.nombre}
                                    </td>
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      color: '#9ca3af',
                                      fontStyle: 'italic',
                                      borderRight: '1px solid #e5e7eb'
                                    }}>
                                      Sin zonas asignadas
                                    </td>
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      textAlign: 'center',
                                      borderRight: '1px solid #e5e7eb'
                                    }}>
                                      <span style={{
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        background: jefe.estructura_validada ? '#d4edda' : '#fff3cd',
                                        color: jefe.estructura_validada ? '#155724' : '#856404',
                                        border: `1px solid ${jefe.estructura_validada ? '#c3e6cb' : '#ffeeba'}`,
                                        display: 'inline-block'
                                      }}>
                                        {jefe.estructura_validada ? 'Validado' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td style={{ 
                                      padding: '12px 20px', 
                                      textAlign: 'center'
                                    }}>
                                      <span style={{
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        background: jefe.cartera_validada ? '#d4edda' : '#fff3cd',
                                        color: jefe.cartera_validada ? '#155724' : '#856404',
                                        border: `1px solid ${jefe.cartera_validada ? '#c3e6cb' : '#ffeeba'}`,
                                        display: 'inline-block'
                                      }}>
                                        {jefe.cartera_validada ? 'Validado' : 'Pendiente'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              }
                            })}
                            {estadosCombinados.length === 0 && (
                              <tr>
                                <td colSpan={4} style={{ 
                                  padding: '3rem', 
                                  textAlign: 'center', 
                                  color: '#9ca3af',
                                  fontSize: '1rem'
                                }}>
                                   No hay jefes de venta registrados en el sistema
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </>
        )}

      </main>

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
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {messageModalContent.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setShowMessageModal(false)}
                style={{
                  backgroundColor: '#2196f3',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
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
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {confirmModalContent.message}
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={handleConfirmNo}
                style={{
                  backgroundColor: '#757575',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#616161'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#757575'}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmYes}
                style={{
                  backgroundColor: '#2196f3',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
