"""
Caché en memoria para lecturas de Excel con pandas.
Invalida automáticamente cuando el archivo cambia (basado en mtime).
"""

import time
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
import threading

import pandas as pd


class ExcelCache:
    """
    Caché de DataFrames de pandas.
    Clave: (ruta_archivo, sheet_name)
    Invalida si el archivo fue modificado desde la última lectura.
    """

    def __init__(self, ttl_seconds: int = 1800):
        """
        ttl_seconds: tiempo máximo en cache aunque el archivo no cambie.
        Default: 1800s (30 minutos) — los archivos solo cambian al hacer upload.
        """
        self._cache: Dict[Tuple[str, str], Tuple[pd.DataFrame, float, float]] = {}
        # Estructura: key -> (dataframe, mtime_al_leer, timestamp_al_leer)
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    def _cache_key(self, path: Path, sheet_name: str) -> Tuple[str, str]:
        return (str(path.resolve()), sheet_name)

    def read_excel(
        self,
        path: Path,
        sheet_name: str,
        **kwargs
    ) -> pd.DataFrame:
        """
        Devuelve el DataFrame desde caché si el archivo no cambió y el TTL no expiró;
        de lo contrario lee el archivo y lo almacena en caché.
        """
        key = self._cache_key(path, sheet_name)

        with self._lock:
            if key in self._cache:
                cached_df, cached_mtime, cached_time = self._cache[key]
                now = time.time()
                try:
                    current_mtime = path.stat().st_mtime
                except FileNotFoundError:
                    # Si el archivo fue borrado, eliminar de caché
                    del self._cache[key]
                else:
                    # Válido si: mtime no cambió Y TTL no expiró
                    if current_mtime == cached_mtime and (now - cached_time) < self._ttl:
                        return cached_df.copy()
                    # Invalidar entrada obsoleta
                    del self._cache[key]

            # Leer desde disco
            df = pd.read_excel(path, sheet_name=sheet_name, **kwargs)
            try:
                mtime = path.stat().st_mtime
            except FileNotFoundError:
                mtime = 0.0
            self._cache[key] = (df, mtime, time.time())
            return df.copy()

    def invalidate(self, path: Path, sheet_name: Optional[str] = None) -> None:
        """Elimina una entrada (o todas las de un archivo) de la caché."""
        with self._lock:
            if sheet_name is not None:
                key = self._cache_key(path, sheet_name)
                self._cache.pop(key, None)
            else:
                resolved = str(path.resolve())
                keys_to_delete = [k for k in self._cache if k[0] == resolved]
                for k in keys_to_delete:
                    del self._cache[k]

    def invalidate_all(self) -> None:
        """Vacía toda la caché."""
        with self._lock:
            self._cache.clear()


# Instancia global compartida por toda la aplicación
excel_cache = ExcelCache(ttl_seconds=300)
