"""
Rutas de Cambios Masivos
Endpoints: /api/cambios-masivos/*
"""

from fastapi import APIRouter, Depends
from app.models.user import UserInfo
from app.utils.dependencies import get_current_user

# Crear router de cambios masivos
router = APIRouter()

@router.get("/")
async def get_cambios_masivos(current_user: UserInfo = Depends(get_current_user)):
    """
    Endpoint base de cambios masivos
    
    Args:
        current_user: Usuario actual
        
    Returns:
        Información del módulo
    """
    return {
        "message": "Módulo de Cambios Masivos",
        "usuario": current_user.usuario,
        "submódulos": [
            "estructura-venta",
            "cambios-cartera",
            "cambios-ruta"
        ]
    }
