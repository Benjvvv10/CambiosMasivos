"""
Servicio de gestión de zonas y archivos por zona
Maneja la distribución de archivos según zonas geográficas
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Set
from app.config import settings
from app.services.user_service import user_service


class ZonaService:
    """Servicio para gestión de zonas y distribución de archivos"""
    
    def __init__(self):
        """Inicializar servicio de zonas"""
        self.metadata_file = Path(settings.DATA_DIR) / "estructura_venta" / "metadata.json"
        self.files_dir = Path(settings.DATA_DIR) / "estructura_venta" / "archivos"
        
        # Crear directorios si no existen
        self.metadata_file.parent.mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)
    
    def get_all_zonas(self) -> List[Dict[str, str]]:
        """
        Obtener todas las zonas disponibles del sistema
        Extrae las zonas desde usuarios_sistema.xlsx
        
        Returns:
            Lista de diccionarios con código y nombre de zona
        """
        try:
            # Obtener todos los usuarios
            users_df = user_service._load_users_from_excel()
            
            print(f"[DEBUG] DataFrame cargado. Shape: {users_df.shape}")
            print(f"[DEBUG] Columnas encontradas: {list(users_df.columns)}")
            
            if users_df.empty:
                print("[ERROR] DataFrame vacío - no se pudo cargar usuarios_sistema.xlsx")
                return []
            
            # Columnas a ignorar (no son zonas)
            columnas_sistema = ['Usuario', 'Cargo', 'Nombre', 'Correo', 'Contraseña', 
                               'Cambiar', 'Bloquear', 'Correo Electrónico']
            
            # Obtener columnas de zonas (todas las que no sean columnas del sistema)
            columnas_zonas = [col for col in users_df.columns if col not in columnas_sistema]
            
            print(f"[DEBUG] Columnas de zonas detectadas: {columnas_zonas}")
            print(f"[DEBUG] Total de zonas: {len(columnas_zonas)}")
            
            # Crear lista de zonas únicas
            zonas = []
            for codigo in sorted(columnas_zonas):
                zonas.append({
                    "codigo": codigo,
                    "nombre": codigo  # Por ahora usamos el código como nombre
                })
            
            return zonas
        
        except Exception as e:
            print(f"[ERROR] Error al obtener zonas: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_usuarios_por_zonas(self, zonas: List[str]) -> List[str]:
        """
        Obtener lista de usuarios que tienen acceso a las zonas especificadas
        
        Args:
            zonas: Lista de códigos de zona
            
        Returns:
            Lista de nombres de usuario
        """
        try:
            users_df = user_service._load_users_from_excel()
            usuarios_con_acceso = set()
            
            for _, user_row in users_df.iterrows():
                # Verificar si el usuario tiene alguna de las zonas
                for zona in zonas:
                    if zona in user_row and user_row[zona] == 1:
                        usuarios_con_acceso.add(user_row['Usuario'])
                        break
            
            return list(usuarios_con_acceso)
        
        except Exception as e:
            print(f"Error al obtener usuarios por zonas: {e}")
            return []
    
    def get_zonas_usuario(self, username: str) -> List[str]:
        """
        Obtener las zonas asignadas a un usuario específico
        
        Args:
            username: Nombre de usuario
            
        Returns:
            Lista de códigos de zona
        """
        try:
            users_df = user_service._load_users_from_excel()
            user_row = users_df[users_df['Usuario'] == username]
            
            if user_row.empty:
                return []
            
            # Columnas a ignorar
            columnas_sistema = ['Usuario', 'Cargo', 'Nombre', 'Correo', 'Contraseña', 
                               'Cambiar', 'Bloquear']
            
            # Obtener zonas donde el valor es 1
            zonas = []
            for col in user_row.columns:
                if col not in columnas_sistema and user_row[col].iloc[0] == 1:
                    zonas.append(col)
            
            return zonas
        
        except Exception as e:
            print(f"Error al obtener zonas del usuario: {e}")
            return []
    
    def _load_metadata(self) -> List[Dict]:
        """Cargar metadatos de archivos"""
        if not self.metadata_file.exists():
            return []
        
        try:
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error al cargar metadatos: {e}")
            return []
    
    def _save_metadata(self, metadata: List[Dict]):
        """Guardar metadatos de archivos"""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error al guardar metadatos: {e}")
            raise
    
    def save_archivo(
        self, 
        filename: str, 
        content: bytes, 
        zonas: List[str], 
        username: str,
        datos_json: Optional[List[Dict]] = None,
        tipo: Optional[str] = None
    ) -> str:
        """
        Guardar archivo y asociarlo con zonas
        
        Args:
            filename: Nombre del archivo
            content: Contenido del archivo en bytes
            zonas: Lista de códigos de zona
            username: Usuario que sube el archivo
            datos_json: Datos del Excel en formato JSON (opcional)
            tipo: Tipo de archivo (Estructura Ventas, Cambio Cartera, Cambio Ruta)
            
        Returns:
            ID del archivo guardado
        """
        try:
            # Generar ID único (timestamp)
            archivo_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            
            # Guardar archivo físico
            file_extension = Path(filename).suffix
            file_path = self.files_dir / f"{archivo_id}{file_extension}"
            with open(file_path, 'wb') as f:
                f.write(content)
            
            # Crear metadata
            metadata_entry = {
                "id": archivo_id,
                "filename": filename,
                "file_path": str(file_path),
                "zonas": zonas,
                "uploaded_by": username,
                "upload_date": datetime.now().isoformat(),
                "estado": "disponible",
                "tipo": tipo,  # Agregar tipo de archivo
                "datos_json": datos_json  # Guardar datos del Excel si se proporcionan
            }
            
            # Cargar metadata existente y agregar nuevo
            all_metadata = self._load_metadata()
            all_metadata.append(metadata_entry)
            self._save_metadata(all_metadata)
            
            return archivo_id
        
        except Exception as e:
            print(f"Error al guardar archivo: {e}")
            raise
    
    def get_archivos_por_usuario(self, username: str) -> List[Dict]:
        """
        Obtener archivos disponibles para un usuario según sus zonas
        
        Args:
            username: Nombre de usuario
            
        Returns:
            Lista de metadatos de archivos disponibles
        """
        try:
            # Obtener zonas del usuario
            zonas_usuario = set(self.get_zonas_usuario(username))
            
            if not zonas_usuario:
                return []
            
            # Cargar todos los archivos
            all_metadata = self._load_metadata()
            
            # Filtrar archivos que tengan al menos una zona en común
            archivos_disponibles = []
            for metadata in all_metadata:
                zonas_archivo = set(metadata.get("zonas", []))
                
                # Si hay intersección entre zonas del usuario y del archivo
                if zonas_usuario & zonas_archivo:
                    # No incluir datos_json en la respuesta (puede ser muy grande)
                    metadata_copy = metadata.copy()
                    if "datos_json" in metadata_copy:
                        del metadata_copy["datos_json"]
                    
                    # Agregar solo las zonas que coinciden
                    metadata_copy["zonas_usuario"] = list(zonas_usuario & zonas_archivo)
                    archivos_disponibles.append(metadata_copy)
            
            # Ordenar por fecha de subida (más recientes primero)
            archivos_disponibles.sort(
                key=lambda x: x.get("upload_date", ""), 
                reverse=True
            )
            
            return archivos_disponibles
        
        except Exception as e:
            print(f"Error al obtener archivos por usuario: {e}")
            return []
    
    def get_all_archivos(self) -> List[Dict]:
        """
        Obtener todos los archivos (para admin)
        
        Returns:
            Lista de todos los metadatos de archivos
        """
        try:
            all_metadata = self._load_metadata()
            
            # No incluir datos_json en la respuesta
            result = []
            for metadata in all_metadata:
                metadata_copy = metadata.copy()
                if "datos_json" in metadata_copy:
                    del metadata_copy["datos_json"]
                result.append(metadata_copy)
            
            # Ordenar por fecha de subida (más recientes primero)
            result.sort(key=lambda x: x.get("upload_date", ""), reverse=True)
            
            return result
        
        except Exception as e:
            print(f"Error al obtener todos los archivos: {e}")
            return []
    
    def get_archivo_metadata(self, archivo_id: str) -> Optional[Dict]:
        """
        Obtener metadata de un archivo específico
        
        Args:
            archivo_id: ID del archivo
            
        Returns:
            Metadata del archivo o None si no existe
        """
        try:
            all_metadata = self._load_metadata()
            
            for metadata in all_metadata:
                if metadata.get("id") == archivo_id:
                    return metadata
            
            return None
        
        except Exception as e:
            print(f"Error al obtener metadata del archivo: {e}")
            return None
    
    def delete_archivo(self, archivo_id: str) -> bool:
        """
        Eliminar un archivo y su metadata
        
        Args:
            archivo_id: ID del archivo a eliminar
            
        Returns:
            True si se eliminó correctamente, False en caso contrario
        """
        try:
            # Cargar metadata
            all_metadata = self._load_metadata()
            
            # Buscar el archivo
            archivo_metadata = None
            for metadata in all_metadata:
                if metadata.get("id") == archivo_id:
                    archivo_metadata = metadata
                    break
            
            if not archivo_metadata:
                return False
            
            # Eliminar archivo físico si existe
            file_path = Path(archivo_metadata.get("file_path", ""))
            if file_path.exists():
                file_path.unlink()
            
            # Eliminar metadata
            all_metadata = [m for m in all_metadata if m.get("id") != archivo_id]
            self._save_metadata(all_metadata)
            
            return True
        
        except Exception as e:
            print(f"Error al eliminar archivo: {e}")
            return False
    
    def update_archivo_datos(self, archivo_id: str, datos_json: List[Dict]) -> bool:
        """
        Actualizar los datos JSON de un archivo existente
        
        Args:
            archivo_id: ID del archivo a actualizar
            datos_json: Nuevos datos en formato JSON
            
        Returns:
            True si se actualizó correctamente
        """
        try:
            # Cargar metadata
            all_metadata = self._load_metadata()
            
            # Buscar el archivo
            updated = False
            for metadata in all_metadata:
                if metadata.get("id") == archivo_id:
                    metadata["datos_json"] = datos_json
                    metadata["upload_date"] = datetime.now().isoformat()
                    updated = True
                    break
            
            if not updated:
                raise Exception(f"Archivo con ID {archivo_id} no encontrado")
            
            # Guardar metadata actualizada
            self._save_metadata(all_metadata)
            
            return True
        
        except Exception as e:
            print(f"Error al actualizar archivo: {e}")
            raise
            return True
        
        except Exception as e:
            print(f"Error al eliminar archivo: {e}")
            return False


# Instancia global del servicio
zona_service = ZonaService()
