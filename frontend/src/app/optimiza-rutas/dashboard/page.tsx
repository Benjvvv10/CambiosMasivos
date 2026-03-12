/**
 * Página de Dashboard
 * Ranking de Optimización de Rutas - Vendedores ordenados por mayor oportunidad de mejora
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './dashboard.module.css';
import apiClient from '@/services/api';
import Header from '@/components/Header';
import LoadingDots from '@/components/LoadingDots';
import { Modal } from '@/components/Modal';
import { useUmbralConfig } from '@/hooks/useUmbralConfig';

interface VendedorRanking {
  distrito: string;
  codigo_distrito: string;
  cod_vend: string;
  vendedor: string;
  km_sap: number;
  km_optimizado: number;
  km_ruta: number;
  km_holgura: number;
  km_validado: number;
  diferencia_km: number;
  porcentaje_diferencia: number;
  dias: number;
  todas_rutas_bajo_umbral: boolean;
  tiene_guardado?: boolean;
  tiene_cambios_pendientes?: boolean;
}

interface MetricasTotales {
  total_vendedores: number;
  km_sap_total: number;
  km_optimizado_total: number;
  km_ruta_total: number;
  km_holgura_total?: number;
  km_validado_total?: number;
  ahorro_km: number;
  ahorro_porcentaje: number;
}

interface RankingResponse {
  vendedores: VendedorRanking[];
  metricas_totales: MetricasTotales;
}

export default function DashboardPage() {
  const [rankingData, setRankingData] = useState<RankingResponse | null>(null);
  const [filteredData, setFilteredData] = useState<VendedorRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Estados para guardar rutas
  const [mensajeGuardado, setMensajeGuardado] = useState<string>('');
  const [mostrarModalExito, setMostrarModalExito] = useState(false);
  const [vendedorGuardando, setVendedorGuardando] = useState<string | null>(null);
  
  // Umbral de porcentaje configurable (usando hook personalizado)
  const umbralPorcentaje = useUmbralConfig(10);
  
  // Filtros
  const [selectedDistrito, setSelectedDistrito] = useState<string>('todos');
  const [distritosDisponibles, setDistritosDisponibles] = useState<string[]>([]);
  
  // Ordenamiento
  const [sortBy, setSortBy] = useState<'diferencia_km' | 'porcentaje_diferencia' | 'km_ruta' | 'km_validado'>('diferencia_km');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Proteger ruta - redirigir a login si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Cargar ranking de vendedores
  useEffect(() => {
    if (!isLoading && user) {
      fetchRankingData();
    }
  }, [isLoading, user]);

  const fetchRankingData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getClient().get<RankingResponse>('/api/routes/ranking-vendedores');
      setRankingData(response.data);
      setFilteredData(response.data.vendedores);
      
      // Extraer distritos únicos
      const distritos = Array.from(new Set(response.data.vendedores.map(v => v.codigo_distrito)));
      setDistritosDisponibles(distritos);
      
    } catch (error: any) {
      console.error('Error cargando ranking:', error);
      setErrorMessage(error.response?.data?.detail || 'Error al cargar datos del ranking');
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros y ordenamiento
  useEffect(() => {
    if (!rankingData) return;
    
    let filtered = [...rankingData.vendedores];
    
    // Filtrar por distrito
    if (selectedDistrito !== 'todos') {
      filtered = filtered.filter(v => v.codigo_distrito === selectedDistrito);
    }
    
    // Ordenar según criterio seleccionado
    filtered.sort((a, b) => {
      const valueA = a[sortBy];
      const valueB = b[sortBy];
      
      if (sortOrder === 'desc') {
        return valueB - valueA; // Mayor a menor
      } else {
        return valueA - valueB; // Menor a mayor
      }
    });
    
    setFilteredData(filtered);
  }, [selectedDistrito, rankingData, sortBy, sortOrder]);

  // Función para manejar click en columnas ordenables
  const handleSort = (column: 'diferencia_km' | 'porcentaje_diferencia' | 'km_ruta' | 'km_validado') => {
    if (sortBy === column) {
      // Si ya está ordenado por esta columna, cambiar el orden o volver a default
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        // Volver al orden por defecto (por diferencia_km desc)
        setSortBy('diferencia_km');
        setSortOrder('desc');
      } else {
        setSortOrder('desc');
      }
    } else {
      // Si es una columna diferente, ordenar descendente por defecto
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Calcular métricas filtradas
  const metricasFiltradas = (): MetricasTotales => {
    if (filteredData.length === 0) {
      return {
        total_vendedores: 0,
        km_sap_total: 0,
        km_optimizado_total: 0,
        km_ruta_total: 0,
        ahorro_km: 0,
        ahorro_porcentaje: 0
      };
    }
    
    const km_sap = filteredData.reduce((sum, v) => sum + v.km_sap, 0);
    const km_opt = filteredData.reduce((sum, v) => sum + v.km_optimizado, 0);
    const km_ruta = filteredData.reduce((sum, v) => sum + v.km_ruta, 0);
    const km_holgura = filteredData.reduce((sum, v) => sum + v.km_holgura, 0);
    const km_validado = filteredData.reduce((sum, v) => sum + v.km_validado, 0);
    // Diferencia: sumar las diferencias individuales ya calculadas en el backend
    const diferencia = filteredData.reduce((sum, v) => sum + v.diferencia_km, 0);
    
    return {
      total_vendedores: filteredData.length,
      km_sap_total: Math.round(km_sap * 100) / 100,
      km_optimizado_total: Math.round(km_opt * 100) / 100,
      km_ruta_total: Math.round(km_ruta * 100) / 100,
      km_holgura_total: Math.round(km_holgura * 100) / 100,
      km_validado_total: Math.round(km_validado * 100) / 100,
      ahorro_km: Math.round(diferencia * 100) / 100,
      ahorro_porcentaje: km_sap > 0 ? Math.round((diferencia / km_sap * 100) * 100) / 100 : 0
    };
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

  const handleLogout = async () => {
    await logout();
  };

  const metricas = metricasFiltradas();

  // Función para guardar rutas de un vendedor individual
  const guardarVendedor = async (vendedor: VendedorRanking, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que se dispare el click de la fila
    
    if (!user) return;

    // Si es admin, no puede guardar
    if (user.cargo.toLowerCase() === 'admin') {
      setMensajeGuardado('Los administradores no pueden guardar rutas.');
      setMostrarModalExito(true);
      setTimeout(() => {
        setMostrarModalExito(false);
        setMensajeGuardado('');
      }, 3000);
      return;
    }

    setVendedorGuardando(vendedor.cod_vend);

    try {
      const response = await apiClient.getClient().post('/api/routes/guardar-ruta-vendedor', {
        distrito: vendedor.codigo_distrito,
        cod_vendedor: vendedor.cod_vend
      });

      setMensajeGuardado(`Rutas de ${vendedor.vendedor} guardadas exitosamente`);
      setMostrarModalExito(true);
      
      // Actualizar el estado de guardado del vendedor y resetear cambios pendientes
      setFilteredData(prev => prev.map(v => 
        v.cod_vend === vendedor.cod_vend && v.codigo_distrito === vendedor.codigo_distrito
          ? { ...v, tiene_guardado: true, tiene_cambios_pendientes: false }
          : v
      ));
      
      if (rankingData) {
        setRankingData({
          ...rankingData,
          vendedores: rankingData.vendedores.map(v => 
            v.cod_vend === vendedor.cod_vend && v.codigo_distrito === vendedor.codigo_distrito
              ? { ...v, tiene_guardado: true, tiene_cambios_pendientes: false }
              : v
          )
        });
      }

      setTimeout(() => {
        setMostrarModalExito(false);
        setMensajeGuardado('');
      }, 3000);
    } catch (error: any) {
      console.error('Error guardando rutas:', error);
      if (error.response?.status === 403) {
        setMensajeGuardado('El guardado de rutas está temporalmente desactivado.');
      } else {
        setMensajeGuardado(error.response?.data?.detail || 'No se pudieron guardar las rutas');
      }
      setMostrarModalExito(true);
      setTimeout(() => {
        setMostrarModalExito(false);
        setMensajeGuardado('');
      }, 5000);
    } finally {
      setVendedorGuardando(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <Header 
        userName={user.nombre}
        userEmail={user.email || user.usuario}
        userRole={user.cargo}
        onLogout={handleLogout}
        showBackButton={true}
        onBackClick={() => router.push('/menu')}
      />

      {/* Main Content */}
      <main className={styles.main}>
        {errorMessage && (
          <div className={styles.errorCard}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* Métricas Totales */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{metricas.total_vendedores}</div>
            <div className={styles.metricLabel}>Vendedores</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{metricas.km_sap_total.toLocaleString()} km</div>
            <div className={styles.metricLabel}>KM SAP</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{metricas.km_optimizado_total.toLocaleString()} km</div>
            <div className={styles.metricLabel}>KM Optimizado</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: '3px solid #0e7490' }}>
            <div className={styles.metricValue}>{metricas.km_ruta_total.toLocaleString()} km</div>
            <div className={styles.metricLabel}>KM Ruta</div>
          </div>
          
          <div className={styles.metricCard} style={{ borderLeft: 'none' }}>
            <div className={styles.metricValue}>{(metricas.km_holgura_total || 0).toLocaleString()} km</div>
            <div className={styles.metricLabel}>KM Holgura <span style={{ fontSize: '10px' }}>(+{umbralPorcentaje}%)</span></div>
          </div>
          
          <div className={styles.metricCard} style={{ background: 'rgba(45, 122, 62, 0.08)', borderLeft: '3px solid #2d7a3e' }}>
            <div className={styles.metricValue} style={{ color: '#1a4d2e', fontWeight: '700' }}>{(metricas.km_validado_total || 0).toLocaleString()} km</div>
            <div className={styles.metricLabel} style={{ color: '#1a4d2e' }}>KM Validado</div>
          </div>
          
          <div 
            className={styles.metricCard} 
            style={{ 
              background: 'white',
              borderLeft: `3px solid ${metricas.ahorro_km >= 0 ? '#2d7a3e' : '#dc3545'}` 
            }}
          >
            <div className={styles.metricValue} style={{ color: metricas.ahorro_km >= 0 ? '#2d7a3e' : '#dc3545' }}>
              {metricas.ahorro_km.toLocaleString()} km
            </div>
            <div className={styles.metricLabel}>KM Diferencia</div>
          </div>
        </div>

        {/* Filtros */}
        {distritosDisponibles.length > 1 && (
          <div className={styles.filtersCard}>
            <div className={styles.filtersGrid}>
              {/* Filtro de Distrito - solo mostrar si hay más de 1 distrito */}
              <div className={styles.filterGroup}>
                <label htmlFor="distritoFilter">Distrito</label>
                <select 
                  id="distritoFilter"
                  value={selectedDistrito} 
                  onChange={(e) => setSelectedDistrito(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="todos">Todos</option>
                  {distritosDisponibles.map(distrito => (
                    <option key={distrito} value={distrito}>{distrito}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Ranking */}
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.rankingTable}>
              <thead>
                <tr>
                  <th>Distrito</th>
                  <th>Cód Vend</th>
                  <th>Vendedor</th>
                  <th>KM SAP</th>
                  <th>KM Optimizado</th>
                  <th 
                    onClick={() => handleSort('km_ruta')}
                    className={styles.sortableColumn}
                    title="Haz clic para ordenar"
                    style={{ color: 'white' }}
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
                  <th 
                    style={{ textAlign: 'center', width: '60px' }}
                    title="Estado de rutas del vendedor"
                  >
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={styles.noData}>
                      No hay datos disponibles
                    </td>
                  </tr>
                ) : (
                  filteredData.map((vendedor, index) => {
                    // Determinar color de barra lateral basado en diferencia_km
                    const barraColor = vendedor.diferencia_km < 0 ? '#dc3545' : '#2d7a3e';
                    
                    return (
                      <tr 
                        key={`${vendedor.cod_vend}-${vendedor.codigo_distrito}`}
                        onClick={() => router.push(`/optimiza-rutas/vendedor/${vendedor.cod_vend}`)}
                        className={styles.clickableRow}
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
                        <td data-label="Distrito">{vendedor.distrito}</td>
                        <td data-label="Cód. Vendedor">{vendedor.cod_vend}</td>
                        <td data-label="Vendedor" style={{ fontWeight: 'bold' }}>{vendedor.vendedor}</td>
                        <td data-label="KM SAP">{vendedor.km_sap.toFixed(2)} km</td>
                        <td data-label="KM Optimizado">{vendedor.km_optimizado.toFixed(2)} km</td>
                        <td data-label="KM Ruta" style={{ color: '#0e7490', fontWeight: '600' }}>{vendedor.km_ruta.toFixed(2)} km</td>
                        <td data-label="KM Holgura">{vendedor.km_holgura.toFixed(2)} km</td>
                        <td data-label="KM Validado" style={{ background: 'rgba(45, 122, 62, 0.08)', fontWeight: '700', color: '#1a4d2e' }}>
                          {vendedor.km_validado.toFixed(2)} km
                        </td>
                        <td data-label="KM Diferencia">
                          <strong style={{ color: vendedor.diferencia_km < 0 ? '#dc3545' : '#2d7a3e' }}>
                            {vendedor.diferencia_km.toFixed(2)} km
                          </strong>
                        </td>
                        <td data-label="Estado" style={{ textAlign: 'right', paddingRight: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {vendedor.tiene_guardado && (
                                <div
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'default',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: 1,
                                    transition: 'transform 0.2s ease',
                                    transform: 'scale(1)'
                                  }}
                                  title={
                                    vendedor.tiene_cambios_pendientes
                                      ? 'Ruta guardada con cambios pendientes'
                                      : !vendedor.todas_rutas_bajo_umbral
                                      ? 'Ruta guardada'
                                      : 'Rutas guardadas'
                                  }
                                >
                                  <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#000000"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Éxito/Error */}
        <Modal
          isOpen={mostrarModalExito}
          onClose={() => {
            setMostrarModalExito(false);
            setMensajeGuardado('');
          }}
          title={mensajeGuardado.includes('desactivado') ? 'Guardado desactivado' : ''}
          size="small"
          type={mensajeGuardado.includes('Error') || mensajeGuardado.includes('desactivado') ? 'error' : 'success'}
          buttons={[
            {
              text: 'Aceptar',
              onClick: () => {
                setMostrarModalExito(false);
                setMensajeGuardado('');
              },
              variant: mensajeGuardado.includes('Error') || mensajeGuardado.includes('desactivado') ? 'danger' : 'success'
            }
          ]}
        >
          <div style={{ textAlign: 'center', padding: '8px 10px' }}>
            <p style={{ fontSize: '15px', margin: 0, fontWeight: '500' }}>
              {mensajeGuardado}
            </p>
          </div>
        </Modal>
      </main>
    </div>
  );
}
