/**
 * Página de Detalles del Vendedor
 * Muestra todas las rutas del vendedor con métricas individuales y totales
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './vendedor.module.css';
import apiClient from '@/services/api';
import Header from '@/components/Header';
import { Modal, SuccessModal, ConfirmModal, ErrorModal } from '@/components/Modal';
import LoadingDots from '@/components/LoadingDots';
import { useUmbralConfig } from '@/hooks/useUmbralConfig';

interface RutaDetalle {
  distrito: string;
  codigo_distrito: string;
  dia: string;
  fecha: string;
  km_sap: number;
  km_optimizado: number;
  km_ruta: number;
  km_holgura: number;
  km_validado: number;
  km_ruta_validada?: number;
  diferencia_km: number;
  porcentaje_diferencia: number;
  total_puntos: number;
}

interface VendedorInfo {
  codigo: string;
  nombre: string;
}

interface Totales {
  total_km_sap: number;
  total_km_optimizado: number;
  total_km_ruta: number;
  total_km_holgura?: number;
  total_km_validado?: number;
  ahorro_potencial: number;
  ahorro_porcentaje: number;
  total_rutas: number;
}

interface VendedorDetalles {
  vendedor: VendedorInfo;
  rutas: RutaDetalle[];
  estado: string;  // Agregar estado del vendedor
  totales: Totales;
}

export default function VendedorDetallePage() {
  const [detalles, setDetalles] = useState<VendedorDetalles | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sortBy, setSortBy] = useState<'diferencia_km' | 'porcentaje_diferencia' | 'dia' | 'km_ruta' | 'km_validado' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'default'>('desc');
  const [originalRutas, setOriginalRutas] = useState<RutaDetalle[]>([]);
  const [estadoVendedor, setEstadoVendedor] = useState<string>('sin_validar');  // Estado del vendedor
  const [appActiva, setAppActiva] = useState<boolean>(true);  // Estado del sistema
  
  // Umbral de porcentaje configurable (usando hook personalizado)
  const umbralPorcentaje = useUmbralConfig(10);
  
  // Estados para los modales de guardar rutas
  const [modalGuardarRutasVisible, setModalGuardarRutasVisible] = useState(false);
  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [modalExitoVisible, setModalExitoVisible] = useState(false);
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalInfoConsolidadoVisible, setModalInfoConsolidadoVisible] = useState(false);

  // Estados para el modal de exportar PDF
  const [modalExportarVisible, setModalExportarVisible] = useState(false);
  const [exportarLoading, setExportarLoading] = useState(false);
  const [modalExportarExitoVisible, setModalExportarExitoVisible] = useState(false);
  
  // Estados para guardado previo
  const [infoGuardadoPrevio, setInfoGuardadoPrevio] = useState<{
    fecha: string;
    km_validado: number;
    rutas_detalle?: Array<{ dia: string; km_ruta: number; km_validado: number }>;
  } | null>(null);
  
  // Estado para rastrear modificaciones
  const [hasModifications, setHasModifications] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const codigoVendedor = params.codigo as string;
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Proteger ruta - redirigir a login si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Cargar estado del sistema
  useEffect(() => {
    const fetchAppStatus = async () => {
      try {
        const response = await apiClient.getClient().get('/api/config/app-status');
        setAppActiva(response.data.app_activa);
      } catch (error) {
        // Por defecto activada si hay error
        setAppActiva(true);
      }
    };

    if (!isLoading && user) {
      fetchAppStatus();
      // Recargar cada 5 segundos para mantener sincronizado con el admin
      const interval = setInterval(fetchAppStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoading, user]);

  // Cargar detalles del vendedor
  useEffect(() => {
    if (!isLoading && user && codigoVendedor) {
      fetchVendedorDetalles();
    }
  }, [isLoading, user, codigoVendedor]);

  const fetchVendedorDetalles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getClient().get<VendedorDetalles>(
        `/api/routes/vendedor/${codigoVendedor}`
      );
      setDetalles(response.data);
      setOriginalRutas(response.data.rutas);
      setEstadoVendedor(response.data.estado || 'sin_validar');  // Guardar estado
      
      // Verificar si hay modificaciones comparando con guardado previo
      let tieneModificaciones = false;
      if (response.data.estado === 'guardado') {
        // Si está guardado, verificar si hay diferencias con el estado actual
        const codigoDistrito = response.data.rutas[0]?.codigo_distrito;
        if (codigoDistrito) {
          try {
            const guardadoResponse = await apiClient.getClient().get(`/api/routes/info-guardado/${codigoDistrito}/${codigoVendedor}`);
            if (guardadoResponse.data && guardadoResponse.data.tiene_guardado) {
              // Comparar KM Validado de cada día individualmente para detectar cambios
              // incluso si el total es el mismo (ej: reordenamiento de clientes)
              const rutasGuardadas = guardadoResponse.data.rutas_detalle || [];
              for (const rutaActual of response.data.rutas) {
                const rutaGuardada = rutasGuardadas.find((r: any) => r.dia === rutaActual.dia);
                if (rutaGuardada) {
                  // Comparar KM Validado y KM Ruta de cada día
                  const diffValidado = Math.abs((rutaActual.km_validado || 0) - (rutaGuardada.km_validado || 0));
                  const diffRuta = Math.abs((rutaActual.km_ruta || 0) - (rutaGuardada.km_ruta || 0));
                  if (diffValidado > 0.01 || diffRuta > 0.01) {
                    tieneModificaciones = true;
                    break;
                  }
                } else {
                  // Día nuevo que no existía en guardado
                  tieneModificaciones = true;
                  break;
                }
              }
            }
          } catch (err) {
            console.log('Error verificando modificaciones');
          }
        }
      }
      setHasModifications(tieneModificaciones);
      
      // Verificar si hay guardado previo
      if (response.data.rutas && response.data.rutas.length > 0) {
        const codigoDistrito = response.data.rutas[0].codigo_distrito;
        try {
          const guardadoResponse = await apiClient.getClient().get(`/api/routes/info-guardado/${codigoDistrito}/${codigoVendedor}`);
          if (guardadoResponse.data && guardadoResponse.data.tiene_guardado) {
            setInfoGuardadoPrevio({
              fecha: guardadoResponse.data.fecha_guardado,
              km_validado: guardadoResponse.data.km_validado_total,
              rutas_detalle: guardadoResponse.data.rutas_detalle || []
            });
          }
        } catch (err) {
          // No hay guardado previo o error al obtenerlo
          console.log('No hay guardado previo');
        }
      }
    } catch (error: any) {
      console.error('Error cargando detalles del vendedor:', error);
      setErrorMessage(error.response?.data?.detail || 'Error al cargar datos del vendedor');
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    router.push('/optimiza-rutas/dashboard');
  };

  const handleSort = (column: 'diferencia_km' | 'porcentaje_diferencia' | 'dia' | 'km_ruta' | 'km_validado') => {
    if (column === 'dia') {
      setSortBy(null);
      setSortOrder('default');
      return;
    }
    if (sortBy === column) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        setSortOrder('default');
        setSortBy(null);
      }
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortedRutas = () => {
    if (!detalles) return [];
    if (sortOrder === 'default' || !sortBy) {
      return originalRutas;
    }
    const sorted = [...detalles.rutas].sort((a, b) => {
      const valueA = a[sortBy as keyof RutaDetalle];
      const valueB = b[sortBy as keyof RutaDetalle];
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
      } else {
        // Para strings (por ejemplo, dia)
        return sortOrder === 'desc'
          ? String(valueB).localeCompare(String(valueA))
          : String(valueA).localeCompare(String(valueB));
      }
    });
    return sorted;
  };

  // Función para descargar CSV del vendedor
  const descargarExcelVendedor = () => {
    if (!detalles) return;

    // Crear CSV con punto y coma como separador para Excel
    const headers = ['CodVend', 'NombreVend', 'Distrito', 'Dia', 'Clientes', 'KM SAP', 'KM Optimizado', 'KM Ruta', 'KM Holgura', 'KM Validado', 'KM Diferencia', '% Diferencia'];
    const csvRows = [headers.join(';')];

    // Agregar datos de cada ruta
    getSortedRutas().forEach((ruta) => {
      const row = [
        detalles.vendedor.codigo,
        detalles.vendedor.nombre,
        ruta.distrito,
        ruta.dia,
        ruta.total_puntos - 2,
        ruta.km_sap.toFixed(2),
        ruta.km_optimizado.toFixed(2),
        ruta.km_ruta.toFixed(2),
        ruta.km_holgura.toFixed(2),
        ruta.km_validado.toFixed(2),
        ruta.diferencia_km.toFixed(2),
        (ruta.porcentaje_diferencia * -1).toFixed(2)
      ];
      csvRows.push(row.join(';'));
    });

    // Agregar BOM para UTF-8 y crear blob
    const csvContent = '\ufeff' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Vendedor_${detalles.vendedor.codigo}_${detalles.vendedor.nombre}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para convertir código de día a nombre completo
  const obtenerNombreDia = (diaAbreviado: string): string => {
    const dias: { [key: string]: string } = {
      'LU': 'Lunes',
      'MA': 'Martes',
      'MI': 'Miércoles',
      'JU': 'Jueves',
      'VI': 'Viernes',
      'SA': 'Sábado',
      'DO': 'Domingo'
    };
    return dias[diaAbreviado] || diaAbreviado;
  };

  // Función para verificar si hay rutas con porcentaje mayor al umbral que NO están validadas
  const tieneRutasConPorcentajeAltoSinValidar = (): boolean => {
    if (!detalles) return false;
    // Solo bloquear rutas con >umbral o negativas que NO han sido validadas manualmente
    // Si están validadas (km_ruta_validada > 0), significa que el usuario ya las revisó
    return detalles.rutas.some(ruta => {
      const noValidada = !ruta.km_ruta_validada || ruta.km_ruta_validada === 0;
      const valorMostrado = ruta.porcentaje_diferencia * -1;
      const porcentajeProblematico = valorMostrado > umbralPorcentaje;
      return noValidada && porcentajeProblematico;
    });
  };

  // Función para obtener rutas problemáticas (>umbral o negativas) que NO están validadas
  const obtenerRutasSobreUmbralSinValidar = (): RutaDetalle[] => {
    if (!detalles) return [];
    return detalles.rutas.filter(ruta => {
      const noValidada = !ruta.km_ruta_validada || ruta.km_ruta_validada === 0;
      const valorMostrado = ruta.porcentaje_diferencia * -1;
      const porcentajeProblematico = valorMostrado > umbralPorcentaje;
      return noValidada && porcentajeProblematico;
    });
  };

  // Función para verificar si todas las rutas están validadas
  const todasRutasValidadas = (): boolean => {
    if (!detalles) return false;
    return detalles.rutas.every(ruta => ruta.km_ruta_validada && ruta.km_ruta_validada > 0);
  };

  // Función para obtener rutas sin validar (solo las bajo el umbral - verdes)
  const obtenerRutasSinValidar = (): RutaDetalle[] => {
    if (!detalles) return [];
    return detalles.rutas.filter(ruta => {
      const noValidada = !ruta.km_ruta_validada || ruta.km_ruta_validada === 0;
      const valorMostrado = ruta.porcentaje_diferencia * -1;
      const bajoUmbral = valorMostrado <= umbralPorcentaje;
      return noValidada && bajoUmbral;
    });
  };

  // Función para manejar el clic en el botón Consolidar Rutas
  const handleGuardarRutas = () => {
    if (!detalles) return;
    
    // Si el sistema está desactivado, no hacer nada (no mostrar modal)
    if (!appActiva) {
      return;
    }
    
    // Si el vendedor ya está guardado y no hay modificaciones, no hacer nada
    if (estadoVendedor === 'guardado' && !hasModifications) {
      return;
    }
    
    // Primero verificar si todas las rutas están validadas
    if (!todasRutasValidadas()) {
      // Hay rutas sin validar, mostrar error
      setMensajeError('Debe validar todas las rutas antes de consolidar');
      setModalErrorVisible(true);
      return;
    }
    
    // Verificar si hay rutas con >umbral que NO están validadas
    // Si todas las rutas problemáticas ya fueron validadas, se puede guardar
    if (!tieneRutasConPorcentajeAltoSinValidar()) {
      // Puede guardar: todas las rutas problemáticas ya fueron validadas manualmente
      setModalGuardarRutasVisible(true);
    } else {
      // No puede guardar: hay rutas con alto % sin validar, necesitan revisión manual
      setMensajeError('Rutas con alto potencial requieren validación');
      setModalErrorVisible(true);
    }
  };

  // Función para confirmar guardar rutas
  const confirmarGuardarRutas = async () => {
    if (!detalles) return;
    
    // Cerrar modal de confirmación
    setModalGuardarRutasVisible(false);
    
    // Verificar nuevamente si todas las rutas problemáticas están validadas
    if (!tieneRutasConPorcentajeAltoSinValidar()) {
      try {
        // Preparar datos para enviar al backend
        const datosVendedor = {
          vendedor_codigo: codigoVendedor,
          vendedor_nombre: detalles.vendedor.nombre,
          rutas: detalles.rutas.map(ruta => ({
            codigo_distrito: ruta.codigo_distrito,
            distrito: ruta.distrito,
            dia: ruta.dia,
            fecha: ruta.fecha,
            km_sap: ruta.km_sap,
            km_optimizado: ruta.km_optimizado,
            km_ruta_validada: ruta.km_ruta_validada || 0
          }))
        };
        
        // Llamar al endpoint de guardar rutas
        const response = await apiClient.getClient().post('/api/routes/guardar-rutas-vendedor', datosVendedor);
        
        if (response.data) {
          // Actualizar estado a guardado
          setEstadoVendedor('guardado');
          // Reset modifications
          setHasModifications(false);
          // Actualizar info de guardado previo con los datos actuales
          setInfoGuardadoPrevio({
            fecha: new Date().toISOString(),
            km_validado: detalles.totales.total_km_validado || 0,
            rutas_detalle: detalles.rutas.map(r => ({
              dia: r.dia,
              km_ruta: r.km_ruta,
              km_validado: r.km_validado
            }))
          });
          // Mostrar modal de éxito
          setModalExitoVisible(true);
        }
      } catch (error: any) {
        console.error('Error guardando rutas:', error);
        setMensajeError(error.response?.data?.detail || 'Error al guardar rutas');
        setModalErrorVisible(true);
      }
    } else {
      // No cumple: hay rutas con porcentaje mayor al umbral, mostrar error
      setModalErrorVisible(true);
    }
  };

  // Función para abrir modal de confirmación de exportar PDF
  const handleExportarPDF = () => {
    setModalExportarVisible(true);
  };

  // Función para confirmar y ejecutar la exportación del PDF
  const confirmarExportarPDF = async () => {
    if (!detalles) return;

    try {
      setExportarLoading(true);
      const codigoDistrito = detalles.rutas[0]?.codigo_distrito;
      if (!codigoDistrito) {
        alert('No se pudo determinar el distrito');
        return;
      }

      const response = await apiClient.getClient().get(
        `/api/routes/exportar-pdf-vendedor/${codigoDistrito}/${codigoVendedor}`,
        { responseType: 'blob' }
      );

      // Crear URL del blob y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${codigoVendedor}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setModalExportarVisible(false);
      setModalExportarExitoVisible(true);
    } catch (error: any) {
      console.error('Error exportando PDF:', error);
      setModalExportarVisible(false);
      alert('Error al generar el PDF');
    } finally {
      setExportarLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className={styles.loading}>
        <p><LoadingDots /></p>
      </div>
    );
  }

  // No mostrar nada si no está autenticado (se redirigirá)
  if (!isAuthenticated || !user) {
    return null;
  }

  if (errorMessage) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <strong>Error:</strong> {errorMessage}
          <button onClick={handleVolver} className={styles.volverButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!detalles) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <Header 
        subtitleCode={String(detalles.vendedor.codigo)}
        subtitleName={detalles.vendedor.nombre}
        showBackButton={true}
        onBackClick={handleVolver}
        userName={user.nombre}
        userEmail={user.email || user.usuario}
        userRole={user.cargo}
        onLogout={logout}
      />

      {/* Main Content */}
      <main className={styles.main}>
        {/* Métricas Totales - Estilo Dashboard */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{detalles.totales.total_km_sap.toFixed(2)} km</div>
            <div className={styles.metricLabel}>KM SAP</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{detalles.totales.total_km_optimizado.toFixed(2)} km</div>
            <div className={styles.metricLabel}>KM Optimizado</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: '3px solid #0e7490' }}>
            <div className={styles.metricValue}>{detalles.totales.total_km_ruta.toFixed(2)} km</div>
            <div className={styles.metricLabel}>KM Ruta</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{(detalles.totales.total_km_holgura || 0).toFixed(2)} km</div>
            <div className={styles.metricLabel}>KM Holgura <span style={{ fontSize: '10px' }}>(+{umbralPorcentaje}%)</span></div>
          </div>
          
          <div className={styles.metricCard} style={{ background: 'rgba(45, 122, 62, 0.08)', borderLeft: '3px solid #2d7a3e' }}>
            <div className={styles.metricValue} style={{ color: '#1a4d2e', fontWeight: '700' }}>{(detalles.totales.total_km_validado || 0).toFixed(2)} km</div>
            <div className={styles.metricLabel} style={{ color: '#1a4d2e' }}>KM Validado</div>
          </div>
          
          <div 
            className={styles.metricCard} 
            style={{ 
              background: 'white',
              borderLeft: `3px solid ${detalles.totales.ahorro_potencial >= 0 ? '#2d7a3e' : '#dc3545'}` 
            }}
          >
            <div className={styles.metricValue} style={{ color: detalles.totales.ahorro_potencial >= 0 ? '#2d7a3e' : '#dc3545' }}>
              {detalles.totales.ahorro_potencial.toFixed(2)} km
            </div>
            <div className={styles.metricLabel}>KM Diferencia</div>
          </div>
        </div>

        {/* Tabla de Rutas */}
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('dia')} className={styles.sortableColumn} title="Haz clic para ordenar por día">Día</th>
              <th>Clientes</th>
              <th>KM SAP</th>
              <th>KM Optimizado</th>
              <th 
                onClick={() => handleSort('km_ruta')}
                className={styles.sortableColumn}
                title="Haz clic para ordenar"
              >
                KM Ruta
                <span className={styles.sortIndicator} style={{ opacity: sortBy === 'km_ruta' ? 1 : 0 }}>
                  {sortBy === 'km_ruta' ? (sortOrder === 'desc' ? ' ▼' : ' ▲') : ' ▼'}
                </span>
              </th>
              <th>KM Holgura <span style={{ fontSize: '10px' }}>(+{umbralPorcentaje}%)</span></th>
              <th 
                onClick={() => handleSort('km_validado')}
                className={styles.sortableColumn}
                title="Haz clic para ordenar"
              >
                KM Validado
                <span className={styles.sortIndicator} style={{ opacity: sortBy === 'km_validado' ? 1 : 0 }}>
                  {sortBy === 'km_validado' ? (sortOrder === 'desc' ? ' ▼' : ' ▲') : ' ▼'}
                </span>
              </th>
              <th 
                onClick={() => handleSort('diferencia_km')}
                className={styles.sortableColumn}
                title="Haz clic para ordenar"
              >
                KM Diferencia
                <span className={styles.sortIndicator} style={{ opacity: sortBy === 'diferencia_km' ? 1 : 0 }}>
                  {sortBy === 'diferencia_km' ? (sortOrder === 'desc' ? ' ▼' : ' ▲') : ' ▼'}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {detalles.rutas.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.noData}>
                  No hay rutas disponibles para este vendedor
                </td>
              </tr>
            ) : (
              getSortedRutas().map((ruta, index) => {
                // Determinar color de barra lateral basado en diferencia_km
                const barraColor = ruta.diferencia_km < 0 ? '#dc3545' : '#2d7a3e';
                
                return (
                  <tr 
                    key={index}
                    className={styles.clickableRow}
                    onClick={() => router.push(`/optimiza-rutas/ruta/${codigoVendedor}/${ruta.codigo_distrito}/${ruta.dia}`)}
                    title="Click para ver mapa de la ruta"
                    style={{
                      borderLeft: `4px solid transparent`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderLeft = `4px solid ${barraColor}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderLeft = '4px solid transparent';
                    }}
                  >
                  <td data-label="Día">{ruta.dia}</td>
                  <td data-label="Clientes">{ruta.total_puntos - 2}</td>
                  <td data-label="KM SAP">{ruta.km_sap.toFixed(2)} km</td>
                  <td data-label="KM Optimizado">{ruta.km_optimizado.toFixed(2)} km</td>
                  <td data-label="KM Ruta" style={{ color: '#0e7490', fontWeight: '600' }}>
                    {ruta.km_ruta.toFixed(2)} km
                  </td>
                  <td data-label="KM Holgura">
                    {ruta.km_holgura.toFixed(2)} km
                  </td>
                  <td data-label="KM Validado" style={{ background: 'rgba(45, 122, 62, 0.08)', fontWeight: '700', color: '#1a4d2e' }}>
                    {ruta.km_validado.toFixed(2)} km
                  </td>
                  <td data-label="KM Diferencia">
                    <strong style={{ color: ruta.diferencia_km < 0 ? '#dc3545' : '#2d7a3e' }}>
                      {ruta.diferencia_km.toFixed(2)} km
                    </strong>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
          </div>

          {/* Botones de acción */}
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {!appActiva && (
              <div style={{
                padding: '8px 16px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                color: '#92400e',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                Sistema desactivado - Las validaciones están bloqueadas
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                className={styles.validarButton}
                onClick={(e) => {
                  // Prevenir cualquier acción si el sistema está desactivado
                  if (!appActiva) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  handleGuardarRutas();
                }}
                disabled={!appActiva || (estadoVendedor === 'guardado' && !hasModifications)}
                title={
                  !appActiva 
                    ? 'Sistema desactivado - No se pueden validar rutas' 
                    : (estadoVendedor === 'guardado' && !hasModifications) 
                      ? 'No hay modificaciones para guardar' 
                      : 'Validar rutas del vendedor'
                }
                style={{
                  pointerEvents: !appActiva || (estadoVendedor === 'guardado' && !hasModifications) ? 'none' : 'auto',
                  background: !appActiva || (estadoVendedor === 'guardado' && !hasModifications) ? '#9ca3af' : 'linear-gradient(135deg, #2d7a3e 0%, #1a4d2e 100%)',
                  cursor: !appActiva || (estadoVendedor === 'guardado' && !hasModifications) ? 'not-allowed' : 'pointer',
                  opacity: !appActiva || (estadoVendedor === 'guardado' && !hasModifications) ? 0.5 : 1,
                  boxShadow: !appActiva || (estadoVendedor === 'guardado' && !hasModifications) ? 'none' : '0 4px 12px rgba(45, 122, 62, 0.3)'
                }}
              >
                {estadoVendedor === 'guardado' && !hasModifications ? 'Rutas Validadas' : 'Validar Rutas'}
              </button>
              
              <button 
                className={styles.exportarButton}
                onClick={handleExportarPDF}
                disabled={estadoVendedor !== 'guardado'}
                title={estadoVendedor !== 'guardado' ? 'Primero debe validar las rutas' : 'Exportar documento PDF'}
              >
                Exportar Documento
              </button>
            </div>
          </div>
        </div>

        {/* Modales */}
        <ConfirmModal
          isOpen={modalGuardarRutasVisible}
          onClose={() => setModalGuardarRutasVisible(false)}
          onConfirm={confirmarGuardarRutas}
          title="Confirmar Validación de Rutas"
          message={
            infoGuardadoPrevio && hasModifications ? (
              <div style={{ padding: '10px' }}>
                <p style={{ marginBottom: '20px', fontWeight: '600', fontSize: '15px', textAlign: 'center' }}>¿Está seguro que desea actualizar las rutas de {detalles?.vendedor.nombre}?</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'center' }}>
                  {/* Tabla anterior */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: '#0c4a6e', textAlign: 'center' }}>Guardado Anterior</div>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                          <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>Día</th>
                          <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>KM Validado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rutasGuardadas = infoGuardadoPrevio.rutas_detalle || [];
                          return detalles?.rutas.map((rutaActual, idx) => {
                            const rutaPrevia = rutasGuardadas.find((r: any) => r.dia === rutaActual.dia);
                            const kmPrevio = rutaPrevia ? rutaPrevia.km_validado : rutaActual.km_validado;
                            const cambio = rutaPrevia && Math.abs(rutaActual.km_validado - rutaPrevia.km_validado) > 0.01;
                            return (
                              <tr key={idx}>
                                <td style={{ padding: '4px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{rutaActual.dia}</td>
                                <td style={{ padding: '4px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{kmPrevio.toFixed(2)}</td>
                              </tr>
                            );
                          });
                        })()}
                        <tr style={{ backgroundColor: '#f8fafc', fontWeight: '600' }}>
                          <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>TOTAL</td>
                          <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{infoGuardadoPrevio.km_validado.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Flecha */}
                  <div style={{ fontSize: '28px', color: '#0ea5e9', fontWeight: 'bold' }}>→</div>
                  
                  {/* Tabla nueva */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: '#15803d', textAlign: 'center' }}>Nuevo Guardado</div>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f0fdf4' }}>
                          <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>Día</th>
                          <th style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>KM Validado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rutasGuardadas = infoGuardadoPrevio.rutas_detalle || [];
                          return detalles?.rutas.map((ruta, idx) => {
                            const rutaPrevia = rutasGuardadas.find((r: any) => r.dia === ruta.dia);
                            const cambio = rutaPrevia && Math.abs(ruta.km_validado - rutaPrevia.km_validado) > 0.01;
                            return (
                              <tr key={idx} style={{ backgroundColor: cambio ? '#fef9c3' : 'transparent' }}>
                                <td style={{ padding: '4px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{ruta.dia}</td>
                                <td style={{ padding: '4px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{ruta.km_validado.toFixed(2)}</td>
                              </tr>
                            );
                          });
                        })()}
                        <tr style={{ backgroundColor: '#f0fdf4', fontWeight: '600' }}>
                          <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>TOTAL</td>
                          <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{(detalles?.totales.total_km_validado || 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              `¿Está seguro que desea validar las rutas de ${detalles?.vendedor.nombre}?`
            )
          }
        />

        <SuccessModal
          isOpen={modalExitoVisible}
          onClose={() => setModalExitoVisible(false)}
          title="Rutas Validadas"
          message="Las rutas han sido validadas correctamente."
        />

        {/* Modal de confirmación de exportar PDF */}
        <ConfirmModal
          isOpen={modalExportarVisible}
          onClose={() => !exportarLoading && setModalExportarVisible(false)}
          onConfirm={confirmarExportarPDF}
          title="Exportar Documento"
          confirmText="Exportar y Enviar"
          cancelText="Cancelar"
          variant="success"
          isLoading={exportarLoading}
          message={
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <p style={{ marginBottom: '12px', fontSize: '15px' }}>
                Se descargará el documento PDF de su última validación y se enviará una copia a su correo:
              </p>
              <p style={{ fontWeight: '700', fontSize: '15px', color: '#1a4d2e', marginBottom: '0' }}>
                {user?.email || user?.usuario}
              </p>
            </div>
          }
        />

        {/* Modal de éxito al exportar */}
        <SuccessModal
          isOpen={modalExportarExitoVisible}
          onClose={() => setModalExportarExitoVisible(false)}
          title="Documento Enviado"
          message={`El documento fue exportado correctamente y se envió una copia a ${user?.email || user?.usuario}.`}
        />

        <ErrorModal
          isOpen={modalErrorVisible}
          onClose={() => setModalErrorVisible(false)}
          title="Error al Guardar"
          message={mensajeError || 'Ocurrió un error al guardar las rutas.'}
        />

        <Modal
          isOpen={modalInfoConsolidadoVisible}
          onClose={() => setModalInfoConsolidadoVisible(false)}
          title="Rutas Ya Guardadas"
          size="small"
          type="default"
          buttons={[
            {
              text: 'Aceptar',
              onClick: () => setModalInfoConsolidadoVisible(false),
              variant: 'primary'
            }
          ]}
        >
          <div style={{ textAlign: 'center', padding: '8px 10px' }}>
            <p style={{ fontSize: '15px', margin: 0, fontWeight: '500' }}>
              Las rutas de este vendedor ya han sido guardadas.
            </p>
          </div>
        </Modal>
      </main>
    </div>
  );
}
