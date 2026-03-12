"""
Servicio para calcular rutas con OSRM
"""

import pandas as pd
import requests
import json
import time
import polyline
import logging
from pathlib import Path
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# URL del servicio OSRM
OSRM_URL = "http://osrm:5000"

# Directorio para guardar los JSONs de rutas
ROUTES_OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "routes_json"


def read_csv_auto_encoding(file_path: Path, sep: str = ';') -> pd.DataFrame:
    """
    Lee un CSV intentando automáticamente múltiples codificaciones
    """
    encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252', 'windows-1252']
    
    for encoding in encodings:
        try:
            df = pd.read_csv(file_path, sep=sep, encoding=encoding)
            logger.info(f"CSV leído exitosamente con codificación: {encoding}")
            return df
        except (UnicodeDecodeError, UnicodeError):
            continue
        except Exception as e:
            raise e
    
    raise ValueError(f"No se pudo leer el archivo CSV con ninguna codificación estándar")


def is_valid_coordinate(lat: float, lon: float) -> bool:
    """
    Validar que las coordenadas no sean vacías o 0
    """
    import math
    # Verificar que no sean NaN, infinito o 0
    if math.isnan(lat) or math.isnan(lon):
        return False
    if math.isinf(lat) or math.isinf(lon):
        return False
    if lat == 0.0 and lon == 0.0:
        return False
    return True


def parse_coordinate(coord_str: str) -> float:
    """
    Parsear coordenada individual reemplazando comas por puntos
    Retorna None si la coordenada es inválida
    """
    try:
        import math
        valor = float(str(coord_str).replace(',', '.'))
        # Verificar si es NaN o infinito
        if math.isnan(valor) or math.isinf(valor):
            return None
        return valor
    except (ValueError, TypeError):
        return None


def calculate_route_original_osrm(coordinates: List[tuple[float, float]], puntos_info: List[Dict] = None) -> Dict[str, Any]:
    """
    Calcular ruta ORIGINAL siguiendo el orden del Excel usando OSRM Route (sin optimizar)
    
    Args:
        coordinates: Lista de tuplas (lat, lon) en el orden del Excel
        puntos_info: Lista de información de puntos
    
    Returns:
        Diccionario con información de la ruta original (distancia, duración, geometría)
    """
    if len(coordinates) < 2:
        raise ValueError("Se necesitan al menos 2 coordenadas para calcular una ruta")
    
    # Usar endpoint /route para seguir el orden exacto sin optimizar
    coords_str = ";".join([f"{lon},{lat}" for lat, lon in coordinates])
    url = f"{OSRM_URL}/route/v1/driving/{coords_str}?overview=full"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if data.get("code") != "Ok":
            raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")
        
        route = data["routes"][0]
        
        # Decodificar polyline y convertir a GeoJSON para consistencia
        geometry_decoded = polyline.decode(route["geometry"])
        geometry_geojson = {
            "type": "LineString",
            "coordinates": [[lon, lat] for lat, lon in geometry_decoded]
        }
        
        return {
            "distance_meters": route["distance"],
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_seconds": route["duration"],
            "duration_minutes": round(route["duration"] / 60, 2),
            "geometry": geometry_geojson,
            "legs": route.get("legs", []),
            "puntos": puntos_info  # Mantener el orden original
        }
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error al conectar con OSRM: {e}")


def calculate_route_osrm(coordinates: List[tuple[float, float]], puntos_info: List[Dict] = None,
                         coord_inicio: tuple[float, float] = None, coord_fin: tuple[float, float] = None,
                         info_inicio: Dict = None, info_fin: Dict = None) -> Dict[str, Any]:
    """
    Calcular ruta OPTIMIZADA usando matriz de distancias OSRM + algoritmo Greedy Nearest Neighbor
    
    ESTRATEGIA (3 pasos):
    1. OSRM /table: Obtener matriz completa de distancias entre todos los puntos
    2. Nearest Neighbor: Construir ruta visitando siempre el cliente más cercano
       - Inicio fijo en oficina, fin fijo en oficina
       - En cada paso: desde posición actual, elegir el cliente no visitado más cercano
    3. OSRM /route: Obtener geometría (líneas en calles) de la ruta optimizada
    
    Args:
        coordinates: Lista de tuplas (lat, lon) - SOLO CLIENTES INTERMEDIOS
        puntos_info: Lista de información de puntos intermedios
        coord_inicio: Coordenadas del punto de inicio (oficina) - OBLIGATORIO
        coord_fin: Coordenadas del punto de fin (oficina) - OBLIGATORIO
        info_inicio: Información del punto de inicio
        info_fin: Información del punto de fin
    
    Returns:
        Diccionario con información de la ruta optimizada:
        - distance_km: Distancia total en kilómetros
        - duration_minutes: Duración estimada en minutos
        - geometry: GeoJSON LineString para dibujar en mapa
        - puntos_optimizados: Lista de puntos en orden de visita
        - waypoint_order: Índices originales en orden optimizado
    """
    # Validación: necesitamos inicio y fin
    if coord_inicio is None or coord_fin is None:
        raise ValueError("Se requieren coord_inicio y coord_fin para optimización")
    
    if len(coordinates) < 1:
        # Si no hay clientes intermedios, solo calculamos distancia inicio -> fin
        
        # Si inicio y fin son exactamente el mismo punto, retornar distancia 0
        if coord_inicio == coord_fin:
            puntos_optimizados = [info_inicio] if info_inicio else None
            
            return {
                "distance_meters": 0,
                "distance_km": 0.0,
                "duration_seconds": 0,
                "duration_minutes": 0.0,
                "geometry": {"type": "LineString", "coordinates": [[coord_inicio[1], coord_inicio[0]]]},
                "legs": [],
                "waypoint_order": [0],
                "puntos_optimizados": puntos_optimizados
            }
        
        coords_str = f"{coord_inicio[1]},{coord_inicio[0]};{coord_fin[1]},{coord_fin[0]}"
        url = f"{OSRM_URL}/route/v1/driving/{coords_str}?overview=full"
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") != "Ok":
                raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")
            
            route = data["routes"][0]
            puntos_optimizados = [info_inicio, info_fin] if info_inicio and info_fin else None
            
            # Decodificar polyline y convertir a GeoJSON
            geometry_decoded = polyline.decode(route["geometry"])
            geometry_geojson = {
                "type": "LineString",
                "coordinates": [[lon, lat] for lat, lon in geometry_decoded]
            }
            
            return {
                "distance_meters": route["distance"],
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_seconds": route["duration"],
                "duration_minutes": round(route["duration"] / 60, 2),
                "geometry": geometry_geojson,
                "legs": route.get("legs", []),
                "waypoint_order": [0, 1],
                "puntos_optimizados": puntos_optimizados
            }
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error al conectar con OSRM: {e}")
    
    # Construir lista completa: [inicio] + [clientes] + [fin]
    coordinates_full = [coord_inicio] + coordinates + [coord_fin]
    puntos_info_full = ([info_inicio] if info_inicio else []) + \
                       (puntos_info if puntos_info else []) + \
                       ([info_fin] if info_fin else [])
    
    # PASO 1: Obtener MATRIZ DE DISTANCIAS usando OSRM /table
    # Input: [Oficina, Cliente_A, ..., Cliente_N, Oficina]
    # Output: Matriz NxN con distancias reales por calles entre todos los puntos
    # Esto permite consultas instantáneas sin llamar a OSRM en cada iteración
    
    coords_str = ";".join([f"{lon},{lat}" for lat, lon in coordinates_full])
    table_url = f"{OSRM_URL}/table/v1/driving/{coords_str}?annotations=distance,duration"
    
    try:
        response = requests.get(table_url, timeout=30)
        response.raise_for_status()
        table_data = response.json()
        
        if table_data.get("code") != "Ok":
            raise Exception(f"OSRM Table error: {table_data.get('message', 'Unknown error')}")
        
        # Matriz de distancias (en metros) y duraciones (en segundos)
        distance_matrix = table_data["distances"]
        duration_matrix = table_data["durations"]
        
        # PASO 2: Algoritmo GREEDY NEAREST NEIGHBOR (Vecino Más Cercano)
        # Construye la ruta visitando siempre el cliente no visitado más cercano
        # Ventajas: rápido, garantiza inicio/fin en oficina, usa distancias reales
        # Usa la matriz del Paso 1 para consultas instantáneas (no llama a OSRM)
        
        # Preparar índices: [inicio] + [clientes intermedios] + [fin]
        n_total = len(coordinates_full)
        inicio_idx = 0
        fin_idx = n_total - 1
        clientes_indices = list(range(1, n_total - 1))
        
        # Inicialización del algoritmo
        ruta_optimizada = [inicio_idx]
        visitados = {inicio_idx}
        current_idx = inicio_idx
        
        # BUCLE PRINCIPAL: Visitar clientes eligiendo siempre el más cercano
        iteracion = 1
        while clientes_indices:
            min_dist = float('inf')
            next_idx = None
            candidatos_distancias = []
            
            # Buscar cliente no visitado más cercano usando la matriz
            for cliente_idx in clientes_indices:
                if cliente_idx not in visitados:
                    dist = distance_matrix[current_idx][cliente_idx]
                    candidatos_distancias.append((cliente_idx, dist))
                    
                    # ¿Es este cliente el más cercano que hemos visto hasta ahora?
                    if dist < min_dist:
                        min_dist = dist         # Actualizar distancia mínima
                        next_idx = cliente_idx  # Actualizar próximo destino
            
            # Si no encontramos ningún cliente (no debería pasar), salir
            if next_idx is None:
                break
            
            # Mover al cliente elegido
            ruta_optimizada.append(next_idx)
            visitados.add(next_idx)
            clientes_indices.remove(next_idx)
            current_idx = next_idx
            
            iteracion += 1
        
        # Finalizar: regresar a la oficina
        ruta_optimizada.append(fin_idx)
        
        # PASO 3: Calcular distancia y duración total sumando tramos consecutivos
        
        total_distance = 0.0
        total_duration = 0.0
        for i in range(len(ruta_optimizada) - 1):
            from_idx = ruta_optimizada[i]       # Punto de origen (ej: Cliente_3)
            to_idx = ruta_optimizada[i + 1]     # Punto de destino (ej: Cliente_1)
            
            # Sumar distancia y duración del tramo usando la matriz
            total_distance += distance_matrix[from_idx][to_idx]
            total_duration += duration_matrix[from_idx][to_idx]
        
        # PASO 4: Obtener geometría (líneas en calles) usando OSRM /route
        ruta_coords_ordenados = [coordinates_full[idx] for idx in ruta_optimizada]
        coords_route_str = ";".join([f"{lon},{lat}" for lat, lon in ruta_coords_ordenados])
        route_url = f"{OSRM_URL}/route/v1/driving/{coords_route_str}?overview=full"
        
        route_response = requests.get(route_url, timeout=30)
        route_response.raise_for_status()
        route_data = route_response.json()
        
        if route_data.get("code") != "Ok":
            raise Exception(f"OSRM Route error: {route_data.get('message', 'Unknown error')}")
        
        route = route_data["routes"][0]
        
        # Decodificar polyline
        geometry_decoded = polyline.decode(route["geometry"])
        geometry_geojson = {
            "type": "LineString",
            "coordinates": [[lon, lat] for lat, lon in geometry_decoded]
        }
        
        # PASO 5: Construir lista de puntos en orden optimizado
        puntos_optimizados = None
        if puntos_info_full:
            puntos_optimizados = []
            for pos_visita, idx_original in enumerate(ruta_optimizada):
                punto = puntos_info_full[idx_original].copy()
                
                # Asignar secuencia optimizada
                if pos_visita == 0:
                    punto["secuencia_optimizada"] = 0  # Inicio
                elif pos_visita == len(ruta_optimizada) - 1:
                    punto["secuencia_optimizada"] = 1000  # Fin
                else:
                    punto["secuencia_optimizada"] = pos_visita * 5  # Clientes
                
                puntos_optimizados.append(punto)
        
        return {
            "distance_meters": route["distance"],
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_seconds": route["duration"],
            "duration_minutes": round(route["duration"] / 60, 2),
            "geometry": geometry_geojson,
            "legs": route.get("legs", []),
            "waypoint_order": ruta_optimizada,
            "puntos_optimizados": puntos_optimizados
        }
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error al conectar con OSRM: {e}")


def process_maestro_csv(progress_callback=None) -> Dict[str, Any]:
    """
    Procesar el archivo Maestro APP (CSV o Excel) y calcular rutas por distrito
    Genera un JSON por distrito con todas sus rutas organizadas por día
    
    Args:
        progress_callback: Función opcional para reportar progreso
    
    Returns:
        Diccionario con resultados del procesamiento
    """
    # Buscar archivo Maestro APP.csv
    rutas_dir = Path(__file__).parent.parent.parent / "data" / "rutas"
    csv_path = rutas_dir / "Maestro APP.csv"
    
    if not csv_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo 'Maestro APP.csv' en: {rutas_dir}")
    
    # Leer CSV con detección automática de codificación
    df = read_csv_auto_encoding(csv_path, sep=';')
    
    # Crear directorio de salida si no existe
    ROUTES_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # ELIMINAR TODOS LOS JSON DE TODOS LOS DISTRITOS antes de recalcular
    # Esto previene inconsistencias cuando se sube un nuevo Maestro APP
    if ROUTES_OUTPUT_DIR.exists():
        import shutil
        for distrito_dir in ROUTES_OUTPUT_DIR.iterdir():
            if distrito_dir.is_dir():
                try:
                    shutil.rmtree(distrito_dir)
                    logger.info(f"Eliminado directorio completo del distrito: {distrito_dir.name}")
                except Exception as e:
                    logger.warning(f"No se pudo eliminar {distrito_dir}: {e}")
    
    # Obtener códigos de distrito únicos
    codigos_distrito = df['CodDistrito'].unique()
    total_distritos = len(codigos_distrito)
    
    # Orden de días de la semana
    ORDEN_DIAS = {'LU': 1, 'MA': 2, 'MI': 3, 'JU': 4, 'VI': 5, 'SA': 6, 'DO': 7}
    
    results = {
        "total_distritos": total_distritos,
        "distritos_procesados": [],
        "errores": [],
        "distritos_coordenadas_vacias": []  # Lista de códigos de distritos con coordenadas vacías
    }
    
    for idx_distrito, codigo_distrito in enumerate(codigos_distrito, 1):
        try:
            # Filtrar todos los datos de este distrito
            df_distrito = df[df['CodDistrito'] == codigo_distrito].copy()
            
            # Obtener días únicos para este distrito y ordenarlos
            dias_distrito = df_distrito['DiaVisita'].unique()
            dias_ordenados = sorted(dias_distrito, key=lambda x: ORDEN_DIAS.get(x, 99))
            
            # Obtener nombre del distrito (primera fila)
            nombre_distrito = df_distrito.iloc[0]['Distrito'] if len(df_distrito) > 0 else codigo_distrito
            
            # Estructura base para ambos JSONs
            distrito_json_original = {
                "distrito": nombre_distrito,
                "codigo_distrito": codigo_distrito,
                "total_dias": len(dias_ordenados),
                "tipo_ruta": "original",
                "rutas_por_dia": []
            }
            
            distrito_json_optimizada = {
                "distrito": nombre_distrito,
                "codigo_distrito": codigo_distrito,
                "total_dias": len(dias_ordenados),
                "tipo_ruta": "optimizada",
                "rutas_por_dia": []
            }
            
            total_puntos_distrito = 0
            distrito_tiene_coordenadas_vacias = False  # Flag para este distrito
            
            # Procesar cada día del distrito
            for dia in dias_ordenados:
                # Filtrar datos del distrito y día
                df_dia = df_distrito[df_distrito['DiaVisita'] == dia].copy()
                
                # Obtener vendedores únicos para este día
                vendedores_dia = df_dia['CodVend'].unique()
                
                # Procesar cada vendedor del día
                for cod_vendedor in vendedores_dia:
                    # Filtrar datos del vendedor
                    df_ruta = df_dia[df_dia['CodVend'] == cod_vendedor].copy()
                    
                    # Obtener nombre del vendedor para progreso
                    vendedor_nombre = df_ruta.iloc[0]['NombreVend'] if len(df_ruta) > 0 else "Desconocido"
                    
                    # Reportar progreso
                    if progress_callback:
                        progress_callback({
                            "current": idx_distrito,
                            "total": total_distritos,
                            "distrito": f"{nombre_distrito} - {dia}",
                            "vendedor": vendedor_nombre
                        })
                    
                    # Ordenar por secuencia de visita
                    df_ruta = df_ruta.sort_values('Sec.Visita')
                    
                    # Separar inicio, clientes, y fin según secuencia
                    punto_inicio = None
                    punto_fin = None
                    clientes = []
                    puntos_invalidos = []  # Para trackear puntos con coordenadas inválidas
                    
                    for idx_row, row in df_ruta.iterrows():
                        try:
                            lat = parse_coordinate(row['Latitud'])
                            lon = parse_coordinate(row['Longitud'])
                            secuencia = int(row['Sec.Visita'])
                            
                            # Validar coordenadas
                            if lat is None or lon is None or not is_valid_coordinate(lat, lon):
                                puntos_invalidos.append(row['RazonSocial'])
                                continue
                            
                            punto_info = {
                                "secuencia_original": secuencia,
                                "cod_cliente": str(row['CodCliente']),
                                "razon_social": row['RazonSocial'],
                                "coordenadas": {
                                    "lat": lat,
                                    "lon": lon
                                },
                                "tipo_negocio": row['TipoNeg'],
                                "relev": str(row.get('Relev', '') or '').strip(),
                                "frec_visita": str(row.get('FrecVisita', '') or '').strip(),
                                "ritmo_vis": str(row.get('RitmoVis', '') or '').strip()
                            }
                            
                            if secuencia == 0:
                                # Punto de inicio (Oficina)
                                punto_inicio = ((lat, lon), punto_info)
                            elif secuencia == 1000:
                                # Punto de término (Oficina)
                                punto_fin = ((lat, lon), punto_info)
                            else:
                                # Cliente intermedio
                                clientes.append(((lat, lon), punto_info))
                                
                        except Exception as e:
                            puntos_invalidos.append(row['RazonSocial'])
                            continue
                    
                    # Si hay puntos inválidos, marcar el distrito y saltar este vendedor
                    if puntos_invalidos:
                        distrito_tiene_coordenadas_vacias = True
                        logger.warning(f"Vendedor {vendedor_nombre} en distrito {codigo_distrito} tiene coordenadas inválidas")
                        continue
                    
                    # Validar que tenemos todos los puntos necesarios
                    if not punto_inicio or not punto_fin or len(clientes) == 0:
                        distrito_tiene_coordenadas_vacias = True
                        continue
                    
                    # Para RUTA ORIGINAL: inicio + clientes + fin (en orden del Excel)
                    coordinates_original = [punto_inicio[0]] + [c[0] for c in clientes] + [punto_fin[0]]
                    puntos_original = [punto_inicio[1]] + [c[1] for c in clientes] + [punto_fin[1]]
                    
                    if len(coordinates_original) < 2:
                        results["errores"].append({
                            "distrito": codigo_distrito,
                            "dia": dia,
                            "vendedor": vendedor_nombre,
                            "error": "Menos de 2 coordenadas válidas"
                        })
                        continue
                    
                    # Calcular ruta ORIGINAL con OSRM (siguiendo orden del Excel)
                    route_info_original = calculate_route_original_osrm(coordinates_original, puntos_original)
                    
                    # Para RUTA OPTIMIZADA: pasar SOLO clientes intermedios, inicio y fin por separado
                    coordinates_clientes = [c[0] for c in clientes]
                    puntos_clientes = [c[1] for c in clientes]
                    
                    # Calcular ruta OPTIMIZADA con OSRM (TSP solo en clientes, inicio/fin fijos)
                    route_info_optimizada = calculate_route_osrm(
                        coordinates_clientes, 
                        puntos_clientes,
                        coord_inicio=punto_inicio[0],
                        coord_fin=punto_fin[0],
                        info_inicio=punto_inicio[1],
                        info_fin=punto_fin[1]
                    )
                    
                    # Usar puntos optimizados si están disponibles
                    puntos_optimizados = route_info_optimizada.get("puntos_optimizados", puntos_original)
                    
                    # Calcular distancias usando legs de OSRM en lugar de Haversine
                    def agregar_distancias_osrm(puntos, legs_osrm):
                        """Agregar distancia_desde_anterior y distancia_acumulada usando legs de OSRM"""
                        distancia_acumulada = 0
                        puntos_con_distancias = []
                        
                        for idx, punto in enumerate(puntos):
                            punto_con_distancia = punto.copy()
                            distancia_desde_anterior = 0
                            
                            if idx > 0 and legs_osrm and len(legs_osrm) > idx - 1:
                                # Usar distancia del leg de OSRM (distancia real por carretera)
                                leg = legs_osrm[idx - 1]
                                distancia_desde_anterior = leg.get('distance', 0) / 1000  # metros a km
                                distancia_acumulada += distancia_desde_anterior
                            
                            punto_con_distancia['distancia_desde_anterior'] = round(distancia_desde_anterior, 2)
                            punto_con_distancia['distancia_acumulada'] = round(distancia_acumulada, 2)
                            puntos_con_distancias.append(punto_con_distancia)
                        
                        return puntos_con_distancias
                    
                    legs_original = route_info_original.get("legs", [])
                    legs_optimizada = route_info_optimizada.get("legs", [])
                    
                    puntos_original_con_dist = agregar_distancias_osrm(puntos_original, legs_original)
                    puntos_optimizados_con_dist = agregar_distancias_osrm(puntos_optimizados, legs_optimizada)
                    
                    # Agregar ruta del día a ambos JSONs del distrito
                    ruta_base = {
                        "dia": dia,
                        "fecha": df_ruta.iloc[0]['Fecha'],
                        "vendedor": {
                            "codigo": int(df_ruta.iloc[0]['CodVend']),
                            "nombre": df_ruta.iloc[0]['NombreVend']
                        },
                        "jefe_venta": df_ruta.iloc[0]['NombreJV'],
                        "total_puntos": len(puntos_original)
                    }
                    
                    # Ruta original completa
                    ruta_original = {
                        **ruta_base,
                        "distancia_km": route_info_original["distance_km"],
                        "duracion_minutos": route_info_original["duration_minutes"],
                        "geometria": route_info_original["geometry"],
                        "legs": legs_original,
                        "puntos": puntos_original_con_dist
                    }
                    
                    # Ruta optimizada completa
                    ruta_optimizada = {
                        **ruta_base,
                        "distancia_km": route_info_optimizada["distance_km"],
                        "duracion_minutos": route_info_optimizada["duration_minutes"],
                        "geometria": route_info_optimizada["geometry"],
                        "legs": legs_optimizada,
                        "puntos": puntos_optimizados_con_dist
                    }
                    
                    distrito_json_original["rutas_por_dia"].append(ruta_original)
                    distrito_json_optimizada["rutas_por_dia"].append(ruta_optimizada)
                    total_puntos_distrito += len(puntos_original)
            
            # Agregar totales a ambos JSONs
            distrito_json_original["total_puntos"] = total_puntos_distrito
            distrito_json_optimizada["total_puntos"] = total_puntos_distrito
            
            # Si el distrito tiene coordenadas vacías, no guardarlo
            if distrito_tiene_coordenadas_vacias:
                if codigo_distrito not in results["distritos_coordenadas_vacias"]:
                    results["distritos_coordenadas_vacias"].append(codigo_distrito)
                logger.warning(f"Distrito {codigo_distrito} omitido por coordenadas vacías")
                continue
            
            # Verificar que el distrito tenga al menos una ruta válida
            if len(distrito_json_original["rutas_por_dia"]) == 0:
                if codigo_distrito not in results["distritos_coordenadas_vacias"]:
                    results["distritos_coordenadas_vacias"].append(codigo_distrito)
                logger.warning(f"Distrito {codigo_distrito} sin rutas válidas")
                continue
            
            # Crear carpeta del distrito
            distrito_dir = ROUTES_OUTPUT_DIR / f"{codigo_distrito}"
            distrito_dir.mkdir(parents=True, exist_ok=True)
            
            # Guardar JSON de ruta original
            output_file_original = distrito_dir / "ruta_original.json"
            with open(output_file_original, 'w', encoding='utf-8') as f:
                json.dump(distrito_json_original, f, ensure_ascii=False, indent=2)
            
            # Guardar JSON de ruta optimizada
            output_file_optimizada = distrito_dir / "ruta_optimizada.json"
            with open(output_file_optimizada, 'w', encoding='utf-8') as f:
                json.dump(distrito_json_optimizada, f, ensure_ascii=False, indent=2)
            
            # Guardar JSON de ruta validada (copia de ruta optimizada)
            distrito_json_validada = distrito_json_optimizada.copy()
            distrito_json_validada["tipo_ruta"] = "validada"
            output_file_validada = distrito_dir / "ruta_validada.json"
            with open(output_file_validada, 'w', encoding='utf-8') as f:
                json.dump(distrito_json_validada, f, ensure_ascii=False, indent=2)
            
            results["distritos_procesados"].append({
                "distrito": nombre_distrito,
                "codigo": codigo_distrito,
                "dias": len(dias_ordenados),
                "puntos_totales": total_puntos_distrito,
                "carpeta": str(distrito_dir.name)
            })
            
            # Pequeño delay entre distritos para no sobrecargar OSRM
            if idx_distrito < total_distritos:
                time.sleep(0.5)
            
        except Exception as e:
            results["errores"].append({
                "distrito": codigo_distrito,
                "error": str(e)
            })
    
    # Log final de distritos con coordenadas vacías
    if results["distritos_coordenadas_vacias"]:
        logger.info(f"RESUMEN FINAL: {len(results['distritos_coordenadas_vacias'])} distritos con coordenadas vacías: {results['distritos_coordenadas_vacias']}")
    
    return results
