"""
Rutas para gestión del Instructivo de Cambios Masivos
Endpoints: /api/instructivo/*
Soporta instructivos por pantalla: estructura-venta, carteras, administrar-dotacion
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import FileResponse
from app.utils.dependencies import get_current_user
from app.models.user import UserInfo
import os
from pathlib import Path
from typing import Optional

router = APIRouter()

# Directorio base donde se almacenan los instructivos
BASE_DATA_DIR = Path(os.path.dirname(os.path.abspath(__file__))).parent.parent / "data" / "carga_cm" / "Instructivo"

# Pantallas válidas
PANTALLAS_VALIDAS = ["estructura-venta", "carteras", "administrar-dotacion"]


def _get_dir_for_pantalla(pantalla: Optional[str]) -> Path:
    """Retorna el directorio del instructivo según la pantalla. Sin pantalla usa el raíz (legacy)."""
    if pantalla and pantalla in PANTALLAS_VALIDAS:
        d = BASE_DATA_DIR / pantalla
        d.mkdir(parents=True, exist_ok=True)
        return d
    return BASE_DATA_DIR


def get_instructivo_path(pantalla: Optional[str] = None) -> Path | None:
    """Obtiene la ruta del instructivo si existe para la pantalla dada"""
    target_dir = _get_dir_for_pantalla(pantalla)
    if not target_dir.exists():
        return None
    for f in target_dir.iterdir():
        if f.is_file() and not f.name.startswith('.'):
            return f
    return None


@router.get("/exists")
async def check_instructivo_exists(
    pantalla: Optional[str] = Query(None, description="Pantalla: estructura-venta, carteras, administrar-dotacion"),
    current_user: UserInfo = Depends(get_current_user)
):
    """Verifica si existe un instructivo disponible para una pantalla"""
    path = get_instructivo_path(pantalla)
    if path:
        return {"exists": True, "filename": path.name, "pantalla": pantalla}
    return {"exists": False, "filename": None, "pantalla": pantalla}


@router.get("/download")
async def download_instructivo(
    pantalla: Optional[str] = Query(None, description="Pantalla: estructura-venta, carteras, administrar-dotacion"),
    current_user: UserInfo = Depends(get_current_user)
):
    """Descarga el instructivo de una pantalla de Cambios Masivos"""
    path = get_instructivo_path(pantalla)
    if not path:
        raise HTTPException(status_code=404, detail="No hay instructivo disponible. Contacte al administrador.")

    # Determinar media type según extensión
    ext = path.suffix.lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    media_type = media_types.get(ext, 'application/octet-stream')

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{path.name}"'}
    )


@router.get("/view")
async def view_instructivo(
    pantalla: Optional[str] = Query(None, description="Pantalla: estructura-venta, carteras, administrar-dotacion"),
    current_user: UserInfo = Depends(get_current_user)
):
    """Devuelve el instructivo para visualizar inline (sin forzar descarga). Solo PDF."""
    path = get_instructivo_path(pantalla)
    if not path:
        raise HTTPException(status_code=404, detail="No hay instructivo disponible. Contacte al administrador.")

    ext = path.suffix.lower()
    if ext != '.pdf':
        raise HTTPException(status_code=400, detail="Solo se puede visualizar archivos PDF. Descargue el archivo.")

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type='application/pdf',
    )


@router.get("/list")
async def list_instructivos(current_user: UserInfo = Depends(get_current_user)):
    """Lista todos los instructivos disponibles por pantalla"""
    result = {}
    for p in PANTALLAS_VALIDAS:
        path = get_instructivo_path(p)
        result[p] = {"exists": path is not None, "filename": path.name if path else None}
    # Legacy (general)
    path_general = get_instructivo_path(None)
    result["general"] = {"exists": path_general is not None, "filename": path_general.name if path_general else None}
    return result


@router.post("/upload")
async def upload_instructivo(
    file: UploadFile = File(...),
    pantalla: Optional[str] = Query(None, description="Pantalla: estructura-venta, carteras, administrar-dotacion"),
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Sube o reemplaza el instructivo para una pantalla de Cambios Masivos.
    Solo accesible para usuarios con cargo ADMIN o Administrador.
    """
    if current_user.cargo.upper() not in ("ADMIN", "ADMINISTRADOR"):
        raise HTTPException(status_code=403, detail="Solo los administradores pueden subir el instructivo")

    target_dir = _get_dir_for_pantalla(pantalla)
    target_dir.mkdir(parents=True, exist_ok=True)

    # Eliminar archivo anterior si existe
    for f in target_dir.iterdir():
        if f.is_file():
            f.unlink()

    # Leer contenido de forma async y guardar
    content = await file.read()
    dest_path = target_dir / file.filename
    dest_path.write_bytes(content)

    return {
        "success": True,
        "message": f"Instructivo subido correctamente para {'pantalla ' + pantalla if pantalla else 'general'}",
        "filename": file.filename,
        "size": len(content),
        "pantalla": pantalla
    }
