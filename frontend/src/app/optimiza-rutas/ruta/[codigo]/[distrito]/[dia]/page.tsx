/**
 * Página de Visualización de Ruta en Mapa
 * Muestra comparación lado a lado de Ruta SAP vs Ruta Optimizada
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { Modal, SuccessModal, ConfirmModal, ErrorModal } from '@/components/Modal';
import LoadingDots from '@/components/LoadingDots';
import dynamic from 'next/dynamic';
import styles from './mapa.module.css';
import apiClient from '@/services/api';
import { useUmbralConfig } from '@/hooks/useUmbralConfig';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  CollisionDetection,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

// Importar React-Leaflet dinámicamente (solo en cliente)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then(mod => mod.Tooltip), { ssr: false });

interface Punto {
  secuencia_original?: number;
  secuencia_optimizada?: number;
  cod_cliente: string;
  razon_social: string;
  coordenadas: {
    lat: number;
    lon: number;
  };
  tipo_negocio: string;
  relev?: string;
  frec_visita?: string;
  ritmo_vis?: string;
}

interface RutaData {
  distrito: string;
  codigo_distrito: string;
  dia: string;
  fecha: string;
  vendedor: {
    codigo: number;
    nombre: string;
  };
  distancia_km: number;
  ruta_validada_km?: number;
  duracion_minutos: number;
  total_puntos: number;
  geometria: {
    type: string;
    coordinates: number[][];
  };
  puntos: Punto[];
  legs?: Array<{
    distance: number;
    duration: number;
  }>;
}

interface RutasComparacion {
  ruta_original: RutaData;
  ruta_optimizada: RutaData;
  ahorro_km: number;
  ahorro_porcentaje: number;
}

interface RutaResumen {
  distrito: string;
  codigo_distrito: string;
  dia: string;
  fecha: string;
  km_sap: number;
  km_optimizado: number;
  km_ruta_validada?: number;
  diferencia_km: number;
  porcentaje_diferencia: number;
  total_puntos: number;
}

// Componente de fila sortable para drag & drop
interface SortableRowProps {
  punto: Punto;
  index: number;
  esOficina: boolean;
  fueModificado: boolean;
  isHighlighted: boolean;
  actualizarCoordenadas: (index: number, lat: number, lon: number) => void;
  restablecerPuntoIndividual: (index: number) => void;
  handleEditRowClick: (index: number) => void;
}

function SortableRow({
  punto,
  index,
  esOficina,
  fueModificado,
  isHighlighted,
  actualizarCoordenadas,
  restablecerPuntoIndividual,
  handleEditRowClick
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `punto-${punto.cod_cliente}`, disabled: esOficina });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: fueModificado ? '#fef3c7' : isHighlighted ? '#e0f2fe' : 'transparent',
    cursor: esOficina ? 'default' : 'pointer',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={esOficina ? styles.oficinaRow : ''}
      onClick={() => !esOficina && handleEditRowClick(index)}
    >
      <td>
        {!esOficina && (
          <span {...attributes} {...listeners} className={styles.dragHandle} title="Arrastra para reordenar">
            ⋮⋮
          </span>
        )}
      </td>
      <td>{esOficina ? (index === 0 ? 'Inicio' : 'Fin') : index}</td>
      <td>{esOficina ? '-' : punto.cod_cliente}</td>
      <td>{punto.razon_social}</td>
      <td>
        {esOficina ? (
          <span>{punto.coordenadas.lat.toFixed(6)}</span>
        ) : (
          <input
            type="number"
            step="0.000001"
            value={punto.coordenadas.lat}
            onChange={(e) => actualizarCoordenadas(index, parseFloat(e.target.value) || punto.coordenadas.lat, punto.coordenadas.lon)}
            className={styles.coordInput}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </td>
      <td>
        {esOficina ? (
          <span>{punto.coordenadas.lon.toFixed(6)}</span>
        ) : (
          <input
            type="number"
            step="0.000001"
            value={punto.coordenadas.lon}
            onChange={(e) => actualizarCoordenadas(index, punto.coordenadas.lat, parseFloat(e.target.value) || punto.coordenadas.lon)}
            className={styles.coordInput}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </td>
      <td>
        {fueModificado && (
          <button
            className={styles.btnRestablecerIndividual}
            onClick={(e) => {
              e.stopPropagation();
              restablecerPuntoIndividual(index);
            }}
            title="Restablecer coordenadas originales"
          >
            ↺
          </button>
        )}
      </td>
    </tr>
  );
}

export default function RutaMapaPage() {
  const [rutas, setRutas] = useState<RutasComparacion | null>(null);
  const [rutasVendedor, setRutasVendedor] = useState<RutaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [showQuickNav, setShowQuickNav] = useState(false);
  const [highlightedSapIndex, setHighlightedSapIndex] = useState<number | null>(null);
  const [highlightedOptIndex, setHighlightedOptIndex] = useState<number | null>(null);
  const [highlightedEditIndex, setHighlightedEditIndex] = useState<number | null>(null);
  
  // Referencias para los mapas
  const [mapRefSap, setMapRefSap] = useState<any>(null);
  const [mapRefOpt, setMapRefOpt] = useState<any>(null);
  
  // Umbral de porcentaje configurable (usando hook personalizado)
  const umbralPorcentaje = useUmbralConfig(10);
  
  // Estados para modal de edición
  const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
  const [puntosEditados, setPuntosEditados] = useState<Punto[]>([]);
  const [puntosOriginales, setPuntosOriginales] = useState<Punto[]>([]);
  const [puntosModificadosPorUsuario, setPuntosModificadosPorUsuario] = useState<Set<string>>(new Set());
  const [rutaRecalculada, setRutaRecalculada] = useState<RutaData | null>(null);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [mapRefEdicion, setMapRefEdicion] = useState<any>(null);
  
  // Estados para modal de confirmación de guardado
  const [modalConfirmacionVisible, setModalConfirmacionVisible] = useState(false);
  const [guardandoRuta, setGuardandoRuta] = useState(false);
  
  // Estados para modales de éxito y confirmación de restablecer
  const [modalExitoVisible, setModalExitoVisible] = useState(false);
  const [modalRestablecerVisible, setModalRestablecerVisible] = useState(false);
  const [tipoExito, setTipoExito] = useState<'guardado' | 'restablecido' | 'validado'>('guardado');
  
  // Estado para indicar si es ruta editada
  const [esRutaEditada, setEsRutaEditada] = useState(false);
  const [kmOptimizadaOriginal, setKmOptimizadaOriginal] = useState<number>(0);
  
  // Estados para validación de ruta
  const [modalValidacionVisible, setModalValidacionVisible] = useState(false);
  const [modalErrorValidacionVisible, setModalErrorValidacionVisible] = useState(false);
  const [errorValidacionMsg, setErrorValidacionMsg] = useState('');
  const [validandoRuta, setValidandoRuta] = useState(false);
  const [rutaYaValidada, setRutaYaValidada] = useState(false);
  const [kmRutaValidada, setKmRutaValidada] = useState<number>(0);
  const [estadoVendedor, setEstadoVendedor] = useState<string>('sin_validar');  // Estado del vendedor
  const [appActiva, setAppActiva] = useState<boolean>(true);  // Estado del sistema
  
  // Estados para modal de error general (guardado/restablecer)
  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const router = useRouter();
  const params = useParams();
  const codigoVendedor = params.codigo as string;
  const codigoDistrito = params.distrito as string;
  const dia = params.dia as string;
  
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Proteger ruta
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
      // Recargar cada 5 segundos para mantener sincronizado
      const interval = setInterval(fetchAppStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoading, user]);

  // Cargar datos de rutas en paralelo
  useEffect(() => {
    if (!isLoading && user && codigoVendedor && codigoDistrito && dia) {
      Promise.all([
        fetchRutasComparacion(),
        fetchRutasVendedor()
      ]);
    }
  }, [isLoading, user, codigoVendedor, codigoDistrito, dia]);

  // Cargar leaflet solo en el cliente
  useEffect(() => {
    setMapReady(true);
  }, []);

  // Detectar scroll para mostrar menú flotante
  useEffect(() => {
    const handleScroll = () => {
      // Mostrar menú flotante cuando el scroll pasa los 200px (aprox cuando desaparece el header)
      setShowQuickNav(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchRutasComparacion = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getClient().get<RutasComparacion & { es_ruta_editada?: boolean; ruta_validada_km?: number; km_optimizada_original?: number }>(
        `/api/routes/ruta/${codigoVendedor}/${codigoDistrito}/${dia}`
      );
      setRutas(response.data);
      setEsRutaEditada(response.data.es_ruta_editada || false);
      setKmOptimizadaOriginal(response.data.km_optimizada_original || response.data.ruta_optimizada.distancia_km);
      
      // Verificar si ya existe una ruta validada
      if (response.data.ruta_validada_km && response.data.ruta_validada_km > 0) {
        setRutaYaValidada(true);
        setKmRutaValidada(response.data.ruta_validada_km);
      }
    } catch (error: any) {
      console.error('Error cargando rutas:', error);
      setErrorMessage(error.response?.data?.detail || 'Error al cargar datos de la ruta');
    } finally {
      setLoading(false);
    }
  };

  const fetchRutasVendedor = async () => {
    try {
      const response = await apiClient.getClient().get<{ rutas: RutaResumen[]; estado: string }>(
        `/api/routes/vendedor/${codigoVendedor}`
      );
      setRutasVendedor(response.data.rutas);
      setEstadoVendedor(response.data.estado || 'sin_validar');  // Guardar estado
    } catch (error: any) {
      console.error('Error cargando rutas del vendedor:', error);
    }
  };

  const handleVolver = () => {
    router.push(`/optimiza-rutas/vendedor/${codigoVendedor}`);
  };

  // Convertir día abreviado a nombre completo
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

  // Navegar a sección específica
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -20; // offset para no quedar pegado al borde
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Centrar mapa para mostrar todos los puntos
  const centrarMapaEnPuntos = (mapRef: any, puntos: Punto[]) => {
    if (!mapRef || !puntos || puntos.length === 0) return;
    
    try {
      const L = require('leaflet');
      const bounds = L.latLngBounds(
        puntos.map(p => [p.coordenadas.lat, p.coordenadas.lon])
      );
      mapRef.fitBounds(bounds, { padding: [50, 50] });
    } catch (error) {
      console.error('Error al centrar mapa:', error);
    }
  };

  // Convertir geometría GeoJSON a formato Leaflet (lat, lon)
  const convertirCoordenadas = (geometria: { coordinates: number[][] }): [number, number][] => {
    return geometria.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
  };

  // Crear icono personalizado
  const crearIcono = (numero: number | string, color: string, isHighlighted: boolean = false) => {
    if (typeof window === 'undefined') return null;
    
    const L = require('leaflet');
    const size = isHighlighted ? 40 : 28;
    const fontSize = isHighlighted ? 16 : 12;
    const pulseAnimation = isHighlighted ? 'animation: pulse 0.5s ease-in-out infinite alternate;' : '';
    
    return L.divIcon({
      html: `
        <style>
          @keyframes pulse {
            from { transform: scale(1); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
            to { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.5); }
          }
        </style>
        <div style="background-color:${color};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${fontSize}px;border:${isHighlighted ? '3px' : '2px'} solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);${pulseAnimation}">${numero}</div>
      `,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Icono de oficina
  const crearIconoOficina = () => {
    if (typeof window === 'undefined') return null;
    
    const L = require('leaflet');
    return L.divIcon({
      html: `<div style="background-color:#6B7280;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏢</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  // Componente para capturar referencia del mapa y añadir botón de centrar
  const MapControl = ({ setMapRef, puntos }: { setMapRef: (map: any) => void, puntos: Punto[] }) => {
    const { useMap } = require('react-leaflet');
    const map = useMap();
    
    useEffect(() => {
      if (map) {
        setMapRef(map);
      }
    }, [map, setMapRef]);

    return null;
  };

  // Calcular distancias entre puntos consecutivos
  const calcularDistanciasAcumuladas = (puntos: Punto[], legs: any[]) => {
    const distancias: { desde_anterior: number; acumulada: number }[] = [];
    let acumulada = 0;

    puntos.forEach((punto, index) => {
      if (index === 0) {
        distancias.push({ desde_anterior: 0, acumulada: 0 });
      } else {
        const leg = legs[index - 1];
        const desde_anterior = leg ? leg.distance / 1000 : 0; // convertir a km
        acumulada += desde_anterior;
        distancias.push({ desde_anterior, acumulada });
      }
    });

    return distancias;
  };

  // Handler para highlight de punto
  const handleRowClick = (index: number, tipo: 'sap' | 'optimizada') => {
    if (tipo === 'sap') {
      setHighlightedSapIndex(index);
      setTimeout(() => setHighlightedSapIndex(null), 3000);
    } else {
      setHighlightedOptIndex(index);
      setTimeout(() => setHighlightedOptIndex(null), 3000);
    }
  };

  // Handler para highlight de punto en modal de edición
  const handleEditRowClick = (index: number) => {
    setHighlightedEditIndex(index);
    setTimeout(() => setHighlightedEditIndex(null), 3000);
  };

  // Función para descargar Excel con orden optimizado
  const descargarExcelOptimizado = () => {
    if (!rutas) return;

    // Calcular distancias para incluir en el Excel
    const distancias = calcularDistanciasAcumuladas(
      rutaOptimizada.puntos,
      rutaOptimizada.legs || []
    );

    // Preparar datos en formato CSV con las columnas especificadas
    const headers = 'CodVend;NombreVend;Ruta;CodCliente;RazonSocial;TipoNeg;Relev;Sec.Visita;RitmoVis;DistanciaDesdeAnterior;DistanciaAcumulada;Latitud;Longitud';
    
    const rows = rutaOptimizada.puntos.map((punto, index) => {
      // Para oficina usa secuencia 0 o 1000, para clientes usa el índice multiplicado por 5
      let secuenciaVisita = 0;
      if (punto.secuencia_optimizada === 0) {
        secuenciaVisita = 0;
      } else if (punto.secuencia_optimizada === 1000) {
        secuenciaVisita = 1000;
      } else {
        secuenciaVisita = index * 5;
      }

      const distancia = distancias[index];

      return [
        rutaOptimizada.vendedor.codigo,
        rutaOptimizada.vendedor.nombre,
        rutaOptimizada.dia,
        punto.cod_cliente,
        punto.razon_social,
        punto.tipo_negocio,
        punto.relev ?? '',
        secuenciaVisita,
        punto.ritmo_vis ?? '',
        distancia.desde_anterior.toFixed(2).replace('.', ','),
        distancia.acumulada.toFixed(2).replace('.', ','),
        punto.coordenadas.lat.toString().replace('.', ','),
        punto.coordenadas.lon.toString().replace('.', ',')
      ].join(';');
    });

    const csvContent = [headers, ...rows].join('\n');
    
    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `KM_Ruta_${codigoVendedor}_${codigoDistrito}_${dia}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir modal de edición
  const abrirModalEdicion = () => {
    if (!rutas) return;
    // Copiar puntos de la ruta optimizada para editar
    const copiaPuntos = JSON.parse(JSON.stringify(rutaOptimizada.puntos));
    setPuntosEditados(copiaPuntos);
    setPuntosOriginales(JSON.parse(JSON.stringify(rutaOptimizada.puntos)));
    setPuntosModificadosPorUsuario(new Set());
    setRutaRecalculada(null);
    setModalEdicionVisible(true);
  };

  // Restablecer a valores originales
  const restablecerPuntos = () => {
    setPuntosEditados(JSON.parse(JSON.stringify(puntosOriginales)));
    setPuntosModificadosPorUsuario(new Set());
    setRutaRecalculada(null);
  };

  // Actualizar coordenadas de un punto desde la tabla o mapa
  const actualizarCoordenadas = (index: number, lat: number, lon: number) => {
    const nuevosPuntos = [...puntosEditados];
    const puntoOriginal = puntosOriginales[index];
    
    // Verificar si las coordenadas cambiaron respecto al original
    const coordsCambiaron = 
      Math.abs(puntoOriginal.coordenadas.lat - lat) > 0.000001 ||
      Math.abs(puntoOriginal.coordenadas.lon - lon) > 0.000001;
    
    nuevosPuntos[index].coordenadas = { lat, lon };
    setPuntosEditados(nuevosPuntos);
    
    // Marcar como modificado por usuario si cambió
    if (coordsCambiaron) {
      const nuevosModificados = new Set(puntosModificadosPorUsuario);
      nuevosModificados.add(nuevosPuntos[index].cod_cliente);
      setPuntosModificadosPorUsuario(nuevosModificados);
    }
  };

  // Detectar si un punto fue modificado manualmente por el usuario
  const puntoModificadoPorUsuario = (punto: Punto): boolean => {
    return puntosModificadosPorUsuario.has(punto.cod_cliente);
  };

  // Restablecer un punto individual a sus coordenadas originales
  const restablecerPuntoIndividual = async (index: number) => {
    const puntoOriginal = puntosOriginales[index];
    const nuevosPuntos = [...puntosEditados];
    nuevosPuntos[index].coordenadas = { ...puntoOriginal.coordenadas };
    setPuntosEditados(nuevosPuntos);
    
    // Quitar de la lista de modificados
    const nuevosModificados = new Set(puntosModificadosPorUsuario);
    nuevosModificados.delete(nuevosPuntos[index].cod_cliente);
    setPuntosModificadosPorUsuario(nuevosModificados);
    
    // Recalcular ruta automáticamente con las coordenadas actualizadas
    setTimeout(() => {
      recalcularRutaConOSRM();
    }, 100);
  };

  // Recalcular ruta con OSRM
  const recalcularRutaConOSRM = async () => {
    try {
      setCalculandoRuta(true);
      
      // Preparar coordenadas para OSRM (lon,lat)
      const coordenadas = puntosEditados.map(p => [p.coordenadas.lon, p.coordenadas.lat]);
      
      // Verificar si hay puntos modificados manualmente
      const hayModificaciones = puntosModificadosPorUsuario.size > 0;
      
      // Llamar a OSRM para obtener ruta optimizada
      // Si hay modificaciones manuales, MANTENER el orden optimizado y solo recalcular geometría
      // Si no hay modificaciones, mantener también (ya viene optimizado)
      const response = await apiClient.getClient().post('/api/routes/recalcular-temporal', {
        coordenadas: coordenadas,
        vendedor: rutaOptimizada.vendedor,
        distrito: rutaOptimizada.distrito,
        codigo_distrito: rutaOptimizada.codigo_distrito,
        dia: rutaOptimizada.dia,
        fecha: rutaOptimizada.fecha,
        puntos: puntosEditados,
        mantener_orden: true  // Mantener orden optimizado, solo recalcular geometría
      });
      
      setRutaRecalculada(response.data);
      
      // Actualizar la tabla con el nuevo orden de puntos optimizado
      if (response.data.puntos) {
        setPuntosEditados(response.data.puntos);
      }
    } catch (error) {
      console.error('Error recalculando ruta:', error);
      alert('Error al recalcular la ruta. Por favor intenta de nuevo.');
    } finally {
      setCalculandoRuta(false);
    }
  };

  // Descargar Excel de la ruta editada
  const descargarExcelEditado = () => {
    if (!rutaRecalculada) return;

    // Calcular distancias para incluir en el Excel
    const distancias = calcularDistanciasAcumuladas(
      rutaRecalculada.puntos,
      rutaRecalculada.legs || []
    );

    const headers = 'Fecha;DiaVisita;CodVend;CodCliente;Sec.Visita;Distrito;CodDistrito;RazonSocial;NombreVend;NombreJV;CodJV;Latitud;Longitud;TipoNeg;Relev;FrecVisita;RitmoVis;DistanciaDesdeAnterior;DistanciaAcumulada';
    
    const rows = rutaRecalculada.puntos.map((punto, index) => {
      let secuenciaVisita = 0;
      if (punto.secuencia_optimizada === 0) {
        secuenciaVisita = 0;
      } else if (punto.secuencia_optimizada === 1000) {
        secuenciaVisita = 1000;
      } else {
        secuenciaVisita = index * 5;
      }

      const distancia = distancias[index];

      return [
        rutaRecalculada.fecha,
        rutaRecalculada.dia,
        rutaRecalculada.vendedor.codigo,
        punto.cod_cliente,
        secuenciaVisita,
        rutaRecalculada.distrito,
        rutaRecalculada.codigo_distrito,
        punto.razon_social,
        rutaRecalculada.vendedor.nombre,
        '',
        '',
        punto.coordenadas.lat.toString().replace('.', ','),
        punto.coordenadas.lon.toString().replace('.', ','),
        punto.tipo_negocio,
        '',
        '',
        '',
        distancia.desde_anterior.toFixed(2).replace('.', ','),
        distancia.acumulada.toFixed(2).replace('.', ',')
      ].join(';');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Ruta_Editada_${codigoVendedor}_${codigoDistrito}_${dia}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir modal de confirmación para guardar ruta
  const abrirModalConfirmacion = () => {
    setModalConfirmacionVisible(true);
  };

  // Guardar ruta editada como nueva ruta 
  const guardarRutaEditada = async () => {
    if (!rutaRecalculada) return;

    try {
      setGuardandoRuta(true);
      
      // Preparar datos de la ruta editada
      const datosRuta = {
        vendedor: rutaRecalculada.vendedor,
        distrito: rutaRecalculada.distrito,
        codigo_distrito: rutaRecalculada.codigo_distrito,
        dia: rutaRecalculada.dia,
        fecha: rutaRecalculada.fecha,
        puntos: rutaRecalculada.puntos,
        distancia_km: rutaRecalculada.distancia_km,
        duracion_minutos: rutaRecalculada.duracion_minutos,
        geometria: rutaRecalculada.geometria,
        legs: rutaRecalculada.legs
      };

      // Llamar al endpoint para guardar la ruta
      await apiClient.getClient().post('/api/routes/guardar-ruta-editada', datosRuta);

      // Cerrar modales
      setModalConfirmacionVisible(false);
      setModalEdicionVisible(false);

      // Mostrar modal de éxito
      setTipoExito('guardado');
      setModalExitoVisible(true);

      // Recargar datos de la página después de cerrar el modal
      // No recargar inmediatamente para evitar el "F5"

    } catch (error: any) {
      console.error('Error guardando ruta:', error);
      
      // Cerrar modal de confirmación
      setModalConfirmacionVisible(false);
      
      // Mostrar modal de error
      setErrorMsg(error.response?.data?.detail || 'Error al guardar la ruta. Por favor intenta de nuevo.');
      setModalErrorVisible(true);
    } finally {
      setGuardandoRuta(false);
    }
  };

  // Abrir modal de confirmación para restablecer
  const abrirModalRestablecer = () => {
    setModalRestablecerVisible(true);
  };

  // Restablecer ruta editada (eliminar y volver a ruta optimizada original)
  const restablecerRutaEditada = async () => {
    setModalRestablecerVisible(false);

    try {
      await apiClient.getClient().delete(
        `/api/routes/restablecer-ruta-editada/${codigoDistrito}/${codigoVendedor}/${dia}`
      );

      // Cerrar el modal de edición
      setModalEdicionVisible(false);

      // Resetear estados relacionados con ruta editada
      setEsRutaEditada(false);
      setRutaRecalculada(null);
      setPuntosEditados([]);
      setPuntosModificadosPorUsuario(new Set());

      // Recargar datos para mostrar la ruta optimizada original
      await Promise.all([
        fetchRutasComparacion(),
        fetchRutasVendedor()
      ]);

      // Mostrar modal de éxito
      setTipoExito('restablecido');
      setModalExitoVisible(true);
    } catch (error: any) {
      console.error('Error restableciendo ruta:', error);
      
      // Mostrar modal de error
      setErrorMsg(error.response?.data?.detail || 'Error al restablecer la ruta. Por favor intenta de nuevo.');
      setModalErrorVisible(true);
    }
  };

  // Verificar si se puede validar la ruta (máximo 10% más que la optimizada original)
  const verificarLimiteValidacion = (): { valido: boolean; porcentaje: number; mensaje: string } => {
    if (!rutas) return { valido: false, porcentaje: 0, mensaje: 'No hay datos de ruta' };
    
    const kmOptimizadoOriginal = kmOptimizadaOriginal;
    const kmActual = esRutaEditada && rutaRecalculada 
      ? rutaRecalculada.distancia_km 
      : rutas.ruta_optimizada.distancia_km;
    
    const diferencia = kmActual - kmOptimizadoOriginal;
    const porcentaje = (diferencia / kmOptimizadoOriginal) * 100;
    
    if (porcentaje > 10) {
      return {
        valido: false,
        porcentaje: porcentaje,
        mensaje: `La ruta a validar (${kmActual.toFixed(2)} km) excede el 10% permitido respecto a la ruta optimizada original (${kmOptimizadoOriginal.toFixed(2)} km). Diferencia: +${porcentaje.toFixed(2)}%`
      };
    }
    
    return { valido: true, porcentaje: porcentaje, mensaje: '' };
  };

  // Abrir modal de confirmación de validación
  const abrirModalValidacion = () => {
    const verificacion = verificarLimiteValidacion();
    if (!verificacion.valido) {
      setErrorValidacionMsg(verificacion.mensaje);
      setModalErrorValidacionVisible(true);
      return;
    }

    setModalValidacionVisible(true);
  };

  // Confirmar y guardar ruta validada
  const confirmarValidarRuta = async () => {
    if (!rutas) return;

    try {
      setValidandoRuta(true);
      
      // Determinar qué ruta se está validando
      const rutaAValidar = esRutaEditada && rutaRecalculada 
        ? rutaRecalculada 
        : rutas.ruta_optimizada;

      // Solo enviar la información necesaria para el registro
      const datosValidacion = {
        vendedor_codigo: rutaAValidar.vendedor.codigo,
        vendedor_nombre: rutaAValidar.vendedor.nombre,
        codigo_distrito: rutaAValidar.codigo_distrito,
        distrito: rutaAValidar.distrito,
        dia: rutaAValidar.dia,
        km_ruta: rutaAValidar.distancia_km,
        km_sap: rutas.ruta_original.distancia_km,
        tipo_ruta: esRutaEditada ? 'editada' : 'optimizada',
        fecha: rutaAValidar.fecha
      };

      // Guardar validación (solo registra el número y metadata)
      await apiClient.getClient().post('/api/routes/validar-ruta', datosValidacion);

      // Actualizar estado
      setKmRutaValidada(rutaAValidar.distancia_km);
      setRutaYaValidada(true);

      // Cerrar modal de confirmación
      setModalValidacionVisible(false);

      // Mostrar modal de éxito
      setTipoExito('validado');
      setModalExitoVisible(true);

    } catch (error: any) {
      console.error('Error validando ruta:', error);
      alert(error.response?.data?.detail || 'Error al validar la ruta. Por favor intenta de nuevo.');
    } finally {
      setValidandoRuta(false);
    }
  };

  // Configurar sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px de movimiento antes de activar drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Función de colisión personalizada que respeta las restricciones de oficina
  const customCollisionDetection: CollisionDetection = (args) => {
    // Primero obtener las colisiones usando el algoritmo por defecto
    const pointerCollisions = pointerWithin(args);
    const intersectionCollisions = rectIntersection(args);
    
    // Usar las colisiones del puntero si están disponibles, sino usar las intersecciones
    let collisions = pointerCollisions.length > 0 ? pointerCollisions : intersectionCollisions;
    
    // Filtrar colisiones para evitar que se coloque antes de la primera oficina o después de la última
    if (args.active && collisions.length > 0) {
      const activeId = args.active.id;
      const activeIndex = puntosEditados.findIndex(p => `punto-${p.cod_cliente}` === activeId);
      
      // Si el elemento arrastrado es una oficina, no permitir ninguna colisión
      if (activeIndex === 0 || activeIndex === puntosEditados.length - 1) {
        return [];
      }
      
      // Filtrar colisiones que serían con la primera o última posición (oficinas)
      collisions = collisions.filter(collision => {
        const overId = collision.id;
        const overIndex = puntosEditados.findIndex(p => `punto-${p.cod_cliente}` === overId);
        
        // No permitir colisión con la primera oficina (índice 0) o la última (índice length-1)
        return overIndex !== 0 && overIndex !== puntosEditados.length - 1;
      });
    }
    
    return collisions;
  };

  // Manejar el fin del drag & drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = puntosEditados.findIndex(p => `punto-${p.cod_cliente}` === active.id);
    const newIndex = puntosEditados.findIndex(p => `punto-${p.cod_cliente}` === over.id);

    // No permitir mover oficinas (primer y último elemento)
    if (oldIndex === 0 || oldIndex === puntosEditados.length - 1 ||
        newIndex === 0 || newIndex === puntosEditados.length - 1) {
      return;
    }

    // Reordenar puntos
    const nuevosPuntos = arrayMove(puntosEditados, oldIndex, newIndex);
    setPuntosEditados(nuevosPuntos);

    // Recalcular ruta con los nuevos puntos reordenados
    recalcularRutaConPuntosEspecificos(nuevosPuntos);
  };

  // Recalcular ruta con OSRM usando puntos específicos
  const recalcularRutaConPuntosEspecificos = async (puntosAUsar: Punto[]) => {
    try {
      setCalculandoRuta(true);
      
      // Preparar coordenadas para OSRM (lon,lat)
      const coordenadas = puntosAUsar.map(p => [p.coordenadas.lon, p.coordenadas.lat]);
      
      // Llamar a OSRM para obtener ruta con el orden recibido
      const response = await apiClient.getClient().post('/api/routes/recalcular-temporal', {
        coordenadas: coordenadas,
        vendedor: rutaOptimizada.vendedor,
        distrito: rutaOptimizada.distrito,
        codigo_distrito: rutaOptimizada.codigo_distrito,
        dia: rutaOptimizada.dia,
        fecha: rutaOptimizada.fecha,
        puntos: puntosAUsar,
        mantener_orden: true  // Mantener orden, solo recalcular geometría
      });
      
      setRutaRecalculada(response.data);
      
      // Actualizar la tabla con el nuevo orden de puntos
      if (response.data.puntos) {
        setPuntosEditados(response.data.puntos);
      }
    } catch (error) {
      console.error('Error recalculando ruta:', error);
      alert('Error al recalcular la ruta. Por favor intenta de nuevo.');
    } finally {
      setCalculandoRuta(false);
    }
  };

  // Calcular centro del mapa (promedio de todos los puntos)
  const calcularCentro = (): [number, number] => {
    if (!rutas) return [-33.45, -70.65];
    const puntos = [...rutas.ruta_original.puntos];
    if (puntos.length === 0) return [-33.45, -70.65]; // Santiago por defecto
    
    const latSum = puntos.reduce((sum, p) => sum + p.coordenadas.lat, 0);
    const lonSum = puntos.reduce((sum, p) => sum + p.coordenadas.lon, 0);
    
    return [latSum / puntos.length, lonSum / puntos.length];
  };

  if (isLoading || loading || !mapReady) {
    return (
      <div className={styles.loading}>
        <p><LoadingDots /></p>
      </div>
    );
  }

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

  if (!rutas) {
    return null;
  }

  const rutaOriginal = rutas.ruta_original;
  const rutaOptimizada = rutas.ruta_optimizada;

  // Calcular centro del mapa
  const centro = calcularCentro();

  // Calcular distancias para las tablas
  const distanciasOriginal = calcularDistanciasAcumuladas(
    rutaOriginal.puntos,
    rutaOriginal.legs || []
  );
  const distanciasOptimizada = calcularDistanciasAcumuladas(
    rutaOptimizada.puntos,
    rutaOptimizada.legs || []
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <Header 
        subtitleCode={String(rutaOriginal.vendedor.codigo)}
        subtitleName={rutaOriginal.vendedor.nombre}
        subtitleDay={obtenerNombreDia(dia).toUpperCase()}
        showBackButton={true}
        onBackClick={handleVolver}
        userName={user.nombre}
        userEmail={user.email || user.usuario}
        userRole={user.cargo}
        onLogout={logout}
      />

      {/* Contenido principal con blur cuando el modal está abierto */}
      <div className={modalEdicionVisible ? styles.contentBlurred : ''}>
        {/* Menú flotante de navegación rápida */}
        <div className={`${styles.quickNavMenu} ${showQuickNav ? styles.visible : ''}`}>
          <button 
            onClick={() => scrollToSection('ruta-sap')}
            className={`${styles.quickNavButton} ${styles.quickNavButtonSap}`}
          >
            KM SAP
          </button>
          <button 
            onClick={() => scrollToSection('ruta-optimizada')}
            className={`${styles.quickNavButton} ${styles.quickNavButtonOpt}`}
          >
            Ruta Optimizada
          </button>
        </div>

      {/* Métricas de Rutas del Vendedor */}
      <div className={styles.rutasGrid}>
        {rutasVendedor.map((ruta) => {
          const esRutaActual = ruta.codigo_distrito === codigoDistrito && ruta.dia === dia;
          const kmValidado = ruta.km_ruta_validada || ruta.km_optimizado;
          // Corregido: Ruta - SAP (no SAP - Ruta)
          const diferenciaCalculada = kmValidado - ruta.km_sap;
          const porcentajeCalculado = (diferenciaCalculada / ruta.km_sap * 100);
          const colorDiferencia = '#000000';
          
          return (
            <div 
              key={`${ruta.codigo_distrito}-${ruta.dia}`}
              className={`${styles.rutaCard} ${esRutaActual ? styles.rutaCardActive : ''}`}
              onClick={() => !esRutaActual && router.push(`/optimiza-rutas/ruta/${codigoVendedor}/${ruta.codigo_distrito}/${ruta.dia}`)}
              style={{ cursor: esRutaActual ? 'default' : 'pointer' }}
            >
              <div className={styles.rutaCardHeader}>
                <span className={styles.rutaDia}>{obtenerNombreDia(ruta.dia)}</span>
              </div>
              <div className={styles.rutaCardBody}>
                <div className={styles.rutaMetric} style={{ borderLeft: 'none' }}>
                  <span className={styles.rutaMetricLabel}>SAP</span>
                  <span className={styles.rutaMetricValue}>{ruta.km_sap.toFixed(2)} km</span>
                </div>
                <div className={styles.rutaMetric} style={{ borderLeft: 'none' }}>
                  <span className={styles.rutaMetricLabel}>Optimizado</span>
                  <span className={styles.rutaMetricValue}>{ruta.km_optimizado.toFixed(2)} km</span>
                </div>
                <div className={styles.rutaMetric} style={{ borderLeft: '3px solid #0e7490' }}>
                  <span className={styles.rutaMetricLabel}>Ruta</span>
                  <span className={styles.rutaMetricValue}>{ruta.km_ruta_validada ? ruta.km_ruta_validada.toFixed(2) : ruta.km_optimizado.toFixed(2)} km</span>
                </div>
              </div>
              <div className={styles.rutaCardFooter}>
                <span style={{ color: colorDiferencia, fontWeight: 600 }}>
                  {diferenciaCalculada.toFixed(2)} km ({porcentajeCalculado.toFixed(1)}%)
                </span>
                <span className={styles.rutaClientes}>{ruta.total_puntos - 2} Clientes</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mapas Lado a Lado */}
      <div className={styles.mapsContainer}>
        {/* Mapa Ruta SAP */}
        <div className={styles.mapWrapper} id="ruta-sap">
          <h3 className={styles.mapTitle}>KM SAP {rutaOriginal.distancia_km.toFixed(2)} km</h3>
          <div className={styles.mapContainer}>
            <MapContainer
              center={centro}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              
              {/* Línea de la ruta */}
              {rutaOriginal.geometria && (
                <Polyline
                  positions={convertirCoordenadas(rutaOriginal.geometria)}
                  color="#DC2626"
                  weight={4}
                  opacity={0.7}
                />
              )}
              
              {/* Marcadores de puntos */}
              {rutaOriginal.puntos.map((punto, index) => {
                const esOficina = punto.secuencia_original === 0 || punto.secuencia_original === 1000;
                const isHighlighted = highlightedSapIndex === index;
                const icon = esOficina ? crearIconoOficina() : crearIcono(index === 0 ? 'I' : index === rutaOriginal.puntos.length - 1 ? 'F' : index, '#DC2626', isHighlighted);
                
                return (
                  <Marker
                    key={`sap-${index}`}
                    position={[punto.coordenadas.lat, punto.coordenadas.lon]}
                    icon={icon}
                    zIndexOffset={isHighlighted ? 1000 : 0}
                  >
                    <Popup>
                      <strong>{punto.razon_social}</strong><br />
                      Cliente: {punto.cod_cliente}<br />
                      Secuencia: {punto.secuencia_original}<br />
                      Tipo: {punto.tipo_negocio}<br />
                      Coord: {punto.coordenadas.lat.toFixed(5)}, {punto.coordenadas.lon.toFixed(5)}
                    </Popup>
                    <Tooltip direction="top" offset={[0, -10]}>
                      {esOficina ? punto.razon_social : `${index}. ${punto.cod_cliente}`}
                    </Tooltip>
                  </Marker>
                );
              })}
              
              {/* Control para capturar referencia del mapa */}
              <MapControl setMapRef={setMapRefSap} puntos={rutaOriginal.puntos} />
            </MapContainer>
            
            {/* Botón para centrar vista */}
            <button 
              className={styles.centerButton}
              onClick={() => centrarMapaEnPuntos(mapRefSap, rutaOriginal.puntos)}
              title="Centrar mapa para ver todos los puntos"
            >
              🗺️
            </button>
          </div>

          {/* Tabla de distancias SAP */}
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <h4 className={styles.tableTitle}>Secuencia SAP</h4>
              {/* Placeholder para alinear con los botones de la tabla optimizada */}
              <div style={{ width: '230px' }}></div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.distanceTable}>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Razón Social</th>
                    <th className={styles.distanceCol}>Dist. anterior (km)</th>
                    <th className={styles.distanceCol}>Dist. acumulada (km)</th>
                    <th>Lat</th>
                    <th>Lon</th>
                  </tr>
                </thead>
                <tbody>
                  {rutaOriginal.puntos.map((punto, index) => {
                    const distancia = distanciasOriginal[index];
                    const esOficina = punto.secuencia_original === 0 || punto.secuencia_original === 1000;
                    const isHighlighted = highlightedSapIndex === index;
                    return (
                      <tr 
                        key={`tabla-sap-${index}`} 
                        className={`${esOficina ? styles.oficinaRow : ''} ${isHighlighted ? styles.highlightedRow : ''}`}
                        onClick={() => handleRowClick(index, 'sap')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{esOficina ? (index === 0 ? '0' : '') : index}</td>
                        <td>{punto.cod_cliente}</td>
                        <td>{punto.razon_social}</td>
                        <td className={styles.distanceCol}>{distancia.desde_anterior.toFixed(2)}</td>
                        <td className={styles.distanceCol}>{distancia.acumulada.toFixed(2)}</td>
                        <td>{punto.coordenadas.lat.toFixed(5)}</td>
                        <td>{punto.coordenadas.lon.toFixed(5)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Mapa Ruta Optimizada */}
        <div className={styles.mapWrapper} id="ruta-optimizada">
          <div style={{ position: 'relative' }}>
            <h3 className={styles.mapTitle} style={{ color: '#0e7490' }}>
              KM Ruta{' '}
              {rutaOptimizada.distancia_km.toFixed(2)} km{' '}
              ({rutas.ahorro_km.toFixed(2)} km, {rutas.ahorro_porcentaje.toFixed(1)}%)
            </h3>
          </div>
          <div className={styles.mapContainer}>
            <MapContainer
              center={centro}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              
              {/* Línea de la ruta */}
              {rutaOptimizada.geometria && (
                <Polyline
                  positions={convertirCoordenadas(rutaOptimizada.geometria)}
                  color="#0e7490"
                  weight={4}
                  opacity={0.7}
                />
              )}
              
              {/* Marcadores de puntos */}
              {rutaOptimizada.puntos.map((punto, index) => {
                const esOficina = punto.secuencia_optimizada === 0 || punto.secuencia_optimizada === 1000;
                const isHighlighted = highlightedOptIndex === index;
                const colorMarcador = '#0e7490';
                const icon = esOficina ? crearIconoOficina() : crearIcono(index === 0 ? 'I' : index === rutaOptimizada.puntos.length - 1 ? 'F' : index, colorMarcador, isHighlighted);
                
                return (
                  <Marker
                    key={`opt-${index}`}
                    position={[punto.coordenadas.lat, punto.coordenadas.lon]}
                    icon={icon}
                    zIndexOffset={isHighlighted ? 1000 : 0}
                  >
                    <Popup>
                      <strong>{punto.razon_social}</strong><br />
                      Cliente: {punto.cod_cliente}<br />
                      Secuencia Optimizada: {punto.secuencia_optimizada}<br />
                      Secuencia Original: {punto.secuencia_original}<br />
                      Tipo: {punto.tipo_negocio}<br />
                      Coord: {punto.coordenadas.lat.toFixed(5)}, {punto.coordenadas.lon.toFixed(5)}
                    </Popup>
                    <Tooltip direction="top" offset={[0, -10]}>
                      {esOficina ? punto.razon_social : `${index}. ${punto.cod_cliente}`}
                    </Tooltip>
                  </Marker>
                );
              })}
              
              {/* Control para capturar referencia del mapa */}
              <MapControl setMapRef={setMapRefOpt} puntos={rutaOptimizada.puntos} />
            </MapContainer>
            
            {/* Botón para centrar vista */}
            <button 
              className={styles.centerButton}
              onClick={() => centrarMapaEnPuntos(mapRefOpt, rutaOptimizada.puntos)}
              title="Centrar mapa para ver todos los puntos"
            >
              🗺️
            </button>
          </div>

          {/* Tabla de distancias Optimizada */}
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <h4 className={styles.tableTitle}>
                Secuencia Ruta
              </h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={abrirModalEdicion}
                  className={styles.editButton}
                  disabled={!appActiva}
                  title={!appActiva ? 'Sistema desactivado - No se puede editar' : 'Editar ruta'}
                  style={{
                    opacity: !appActiva ? 0.5 : 1,
                    cursor: !appActiva ? 'not-allowed' : 'pointer',
                    pointerEvents: !appActiva ? 'none' : 'auto'
                  }}
                >
                  Editar
                </button>
                <button 
                  onClick={descargarExcelOptimizado}
                  className={styles.excelButton}
                >
                  Exportar
                </button>
              </div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.distanceTable}>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Razón Social</th>
                    <th className={styles.distanceCol}>Dist. anterior (km)</th>
                    <th className={styles.distanceCol}>Dist. acumulada (km)</th>
                    <th>Lat</th>
                    <th>Lon</th>
                  </tr>
                </thead>
                <tbody>
                  {rutaOptimizada.puntos.map((punto, index) => {
                    const distancia = distanciasOptimizada[index];
                    const esOficina = punto.secuencia_optimizada === 0 || punto.secuencia_optimizada === 1000;
                    const isHighlighted = highlightedOptIndex === index;
                    return (
                      <tr 
                        key={`tabla-opt-${index}`} 
                        className={`${esOficina ? styles.oficinaRow : ''} ${isHighlighted ? styles.highlightedRow : ''}`}
                        onClick={() => handleRowClick(index, 'optimizada')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{esOficina ? (index === 0 ? '0' : '') : index}</td>
                        <td>{punto.cod_cliente}</td>
                        <td>{punto.razon_social}</td>
                        <td className={styles.distanceCol}>{distancia.desde_anterior.toFixed(2)}</td>
                        <td className={styles.distanceCol}>{distancia.acumulada.toFixed(2)}</td>
                        <td>{punto.coordenadas.lat.toFixed(5)}</td>
                        <td>{punto.coordenadas.lon.toFixed(5)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Cerrar div de contenido con blur */}
      </div>

      {/* Modal de Edición */}
      {modalEdicionVisible && mapReady && (
        <div className={styles.modalOverlay} onClick={() => setModalEdicionVisible(false)}>
          <div className={styles.modalEdicion} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>KM Ruta</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setModalEdicionVisible(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              {/* Mapa Editable */}
              <div className={styles.modalMapSection}>
                <div className={styles.modalMapContainer}>
                  {/* Botón para centrar vista */}
                  <button 
                    className={styles.centerButton}
                    onClick={() => centrarMapaEnPuntos(mapRefEdicion, puntosEditados)}
                    title="Centrar mapa para ver todos los puntos"
                  >
                    🗺️
                  </button>
                  
                  <MapContainer
                    center={calcularCentro()}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    
                    {/* Línea de la ruta recalculada */}
                    {rutaRecalculada && rutaRecalculada.geometria && (
                      <Polyline
                        positions={convertirCoordenadas(rutaRecalculada.geometria)}
                        color="#0e7490"
                        weight={4}
                        opacity={0.8}
                      />
                    )}
                    
                    {/* Marcadores editables */}
                    {puntosEditados.map((punto, index) => {
                      const esOficina = punto.secuencia_optimizada === 0 || punto.secuencia_optimizada === 1000;
                      const isHighlighted = highlightedEditIndex === index;
                      const icon = esOficina ? crearIconoOficina() : crearIcono(index, '#0e7490', isHighlighted);
                      
                      return (
                        <Marker
                          key={`edit-${index}`}
                          position={[punto.coordenadas.lat, punto.coordenadas.lon]}
                          icon={icon}
                          draggable={!esOficina}
                          zIndexOffset={isHighlighted ? 1000 : 0}
                          eventHandlers={{
                            dragend: (e: any) => {
                              const marker = e.target;
                              const position = marker.getLatLng();
                              actualizarCoordenadas(index, position.lat, position.lng);
                            }
                          }}
                        >
                          <Popup>
                            <strong>{punto.razon_social}</strong><br />
                            Cliente: {punto.cod_cliente}<br />
                            Secuencia: {punto.secuencia_optimizada}<br />
                            Tipo: {punto.tipo_negocio}<br />
                            Coord: {punto.coordenadas.lat.toFixed(5)}, {punto.coordenadas.lon.toFixed(5)}
                          </Popup>
                          <Tooltip direction="top" offset={[0, -10]}>
                            {esOficina ? punto.razon_social : `${index}. ${punto.cod_cliente}`}
                          </Tooltip>
                        </Marker>
                      );
                    })}
                    
                    <MapControl setMapRef={setMapRefEdicion} puntos={puntosEditados} />
                  </MapContainer>
                </div>
              </div>

              {/* Tabla Editable */}
              <div className={styles.modalTableSection}>
                <div className={styles.modalTableWrapper}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={customCollisionDetection}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  >
                    <table className={styles.editTable}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}></th>
                          <th>Orden</th>
                          <th>Cliente</th>
                          <th>Razón Social</th>
                          <th>Latitud</th>
                          <th>Longitud</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <SortableContext
                        items={puntosEditados.map(p => `punto-${p.cod_cliente}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <tbody>
                          {puntosEditados.map((punto, index) => {
                            const esOficina = punto.secuencia_optimizada === 0 || punto.secuencia_optimizada === 1000;
                            const fueModificado = !esOficina && puntoModificadoPorUsuario(punto);
                            const isHighlighted = highlightedEditIndex === index;
                            
                            return (
                              <SortableRow
                                key={`edit-tabla-${punto.cod_cliente}`}
                                punto={punto}
                                index={index}
                                esOficina={esOficina}
                                fueModificado={fueModificado}
                                isHighlighted={isHighlighted}
                                actualizarCoordenadas={actualizarCoordenadas}
                                restablecerPuntoIndividual={restablecerPuntoIndividual}
                                handleEditRowClick={handleEditRowClick}
                              />
                            );
                          })}
                        </tbody>
                      </SortableContext>
                    </table>
                  </DndContext>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className={styles.modalFooter}>
              <div className={styles.botonesIzquierda}>
                {esRutaEditada && (
                  <button 
                    className={styles.btnRestablecerOriginal}
                    onClick={abrirModalRestablecer}
                    disabled={calculandoRuta}
                  >
                    Restablecer
                  </button>
                )}
                <button 
                  className={styles.btnCancelar}
                  onClick={() => setModalEdicionVisible(false)}
                >
                  Cerrar
                </button>
              </div>
              <div className={styles.botonesDerecha}>
                {rutaRecalculada && (
                  <>
                    <button 
                      className={styles.btnGuardarRutaEdicion}
                      onClick={abrirModalConfirmacion}
                    >
                      Guardar Ruta
                    </button>
                  </>
                )}
                <button 
                  className={styles.btnAplicar}
                  onClick={recalcularRutaConOSRM}
                  disabled={calculandoRuta}
                >
                  {calculandoRuta ? 'Calculando...' : 'Calcular Ruta'}
                </button>
              </div>
            </div>
            
            {/* Resultados */}
            {rutaRecalculada && (
              <div className={styles.resultadoBanner}>
                <h4>Ruta Recalculada</h4>
                <div className={styles.metricas}>
                  <div className={styles.metrica}>
                    <span className={styles.label}>Distancia:</span>
                    <span className={styles.valor}>{rutaRecalculada.distancia_km.toFixed(2)} km</span>
                  </div>
                  <div className={styles.metrica}>
                    <span className={styles.label}>vs SAP:</span>
                    <span className={`${styles.valor} ${rutaRecalculada.distancia_km < rutaOriginal.distancia_km ? styles.mejor : styles.peor}`}>
                      {(rutaRecalculada.distancia_km - rutaOriginal.distancia_km).toFixed(2)} km ({((rutaRecalculada.distancia_km - rutaOriginal.distancia_km) / rutaOriginal.distancia_km * 100).toFixed(1)}%)
                    </span>
                    <div style={{ fontSize: '0.8em', color: '#333', marginTop: '2px' }}>
                      <span className={styles.label}>SAP:</span> <span className={styles.valor}>{rutaOriginal.distancia_km.toFixed(2)} km</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Guardar Ruta */}
      <ConfirmModal
        isOpen={modalConfirmacionVisible}
        onClose={() => !guardandoRuta && setModalConfirmacionVisible(false)}
        onConfirm={guardarRutaEditada}
        title="¿Guardar Ruta Editada?"
        message="Al confirmar, se guardará la ruta editada y los cambios se reflejarán en el sistema"
        confirmText="Sí, Guardar Ruta"
        cancelText="Cancelar"
        variant="success"
        isLoading={guardandoRuta}
      />

      {/* Modal de Confirmación para Restablecer */}
      <ConfirmModal
        isOpen={modalRestablecerVisible}
        onClose={() => setModalRestablecerVisible(false)}
        onConfirm={restablecerRutaEditada}
        title="¿Restablecer Ruta?"
        message="¿Estás seguro de que quieres restablecer a la ruta optimizada original? Se perderán los cambios guardados."
        confirmText="Sí, Restablecer"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal de Confirmación de Validación */}
      <Modal
        isOpen={modalValidacionVisible}
        onClose={() => setModalValidacionVisible(false)}
        title="Confirmar Validación de Ruta"
        size="medium"
        buttons={[
          {
            text: 'Cancelar',
            onClick: () => setModalValidacionVisible(false),
            variant: 'secondary'
          },
          {
            text: validandoRuta ? 'Validando...' : 'Validar',
            onClick: confirmarValidarRuta,
            variant: 'primary',
            disabled: validandoRuta
          }
        ]}
      >
        <p style={{ fontSize: '15px', color: '#666', marginBottom: '16px', textAlign: 'center' }}>
          ¿Estás seguro de que deseas validar esta ruta?
        </p>
        <div className={styles.infoValidacion}>
          <p><strong>Ruta a validar:</strong> {esRutaEditada ? 'Ruta Editada' : 'Ruta Optimizada'}</p>
          <p><strong>Distancia:</strong> {(esRutaEditada && rutaRecalculada ? rutaRecalculada.distancia_km : rutas?.ruta_optimizada.distancia_km || 0).toFixed(2)} km</p>
          <p><strong>Ruta optimizada original:</strong> {kmOptimizadaOriginal.toFixed(2)} km</p>
          <p><strong>KM Diferencia:</strong> {(() => {
            const kmActual = esRutaEditada && rutaRecalculada ? rutaRecalculada.distancia_km : rutas?.ruta_optimizada.distancia_km || 0;
            const diferencia = kmActual - kmOptimizadaOriginal;
            return `${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)} km`;
          })()}</p>
          <p><strong>% Diferencia:</strong> {(() => {
            const kmActual = esRutaEditada && rutaRecalculada ? rutaRecalculada.distancia_km : rutas?.ruta_optimizada.distancia_km || 0;
            const diferencia = kmActual - kmOptimizadaOriginal;
            const porcentaje = kmOptimizadaOriginal > 0 ? (diferencia / kmOptimizadaOriginal) * 100 : 0;
            return `${porcentaje >= 0 ? '+' : ''}${porcentaje.toFixed(2)}%`;
          })()}</p>
        </div>
      </Modal>

      {/* Modal de Error de Validación */}
      <ErrorModal
        isOpen={modalErrorValidacionVisible}
        onClose={() => setModalErrorValidacionVisible(false)}
        title="No se puede validar la ruta"
        message={errorValidacionMsg}
        buttonText="Cerrar"
      />

      {/* Modal de Error General (Guardar/Restablecer) */}
      <ErrorModal
        isOpen={modalErrorVisible}
        onClose={() => setModalErrorVisible(false)}
        title="Error al Guardar"
        message={errorMsg}
        buttonText="Cerrar"
      />

      {/* Modal de Éxito */}
      <SuccessModal
        isOpen={modalExitoVisible}
        onClose={() => {
          setModalExitoVisible(false);
          // Recargar datos después de cerrar el modal
          fetchRutasComparacion();
          fetchRutasVendedor();
        }}
        title={
          tipoExito === 'guardado' ? 'Ruta guardada exitosamente' : 
          tipoExito === 'restablecido' ? 'Ruta restablecida exitosamente' : 
          'Ruta validada exitosamente'
        }
        message={
          tipoExito === 'guardado' 
            ? 'Los cambios se verán reflejados en el sistema'
            : tipoExito === 'restablecido'
            ? 'La ruta ha sido restablecida a la versión optimizada original'
            : 'La ruta ha sido validada y registrada en el sistema'
        }
        buttonText="Aceptar"
      />
    </div>
  );
}
