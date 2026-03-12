"""
Rutas de gestión de usuarios
Endpoints: /api/users/*
"""

from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import UserInfo, PasswordReset
from app.services.user_service import user_service
from app.services.auth_service import auth_service
from app.utils.dependencies import get_current_user, get_current_admin_user
from typing import List

# Crear router de usuarios
router = APIRouter()

@router.get("/districts")
async def get_user_districts(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener distritos permitidos del usuario actual
    
    Args:
        current_user: Usuario actual
        
    Returns:
        Lista de distritos permitidos
    """
    return {
        "usuario": current_user.usuario,
        "distritos": current_user.distritos_permitidos
    }

@router.post("/reset-password")
async def reset_user_password(
    reset_data: PasswordReset,
    admin_user: UserInfo = Depends(get_current_admin_user)
):
    """
    Resetear contraseña de un usuario (solo administradores)
    
    Args:
        reset_data: Datos de reseteo de contraseña
        admin_user: Usuario administrador actual
        
    Returns:
        Mensaje de éxito
        
    Raises:
        HTTPException: Si el usuario no existe o hay error al actualizar
    """
    # Verificar que el usuario existe
    user_db = user_service.get_user_by_username(reset_data.usuario)
    
    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Validar fortaleza de nueva contraseña
    is_valid, error_msg = auth_service.validate_password_strength(reset_data.password_nueva)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Actualizar contraseña
    success = user_service.update_user_password(
        username=reset_data.usuario,
        new_password=reset_data.password_nueva,
        reset_cambiar=not reset_data.forzar_cambio  # Si forzar_cambio=True, Cambiar=1
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al resetear contraseña"
        )
    
    return {
        "message": f"Contraseña reseteada para usuario {reset_data.usuario}",
        "forzar_cambio": reset_data.forzar_cambio
    }
