"""
Rutas de autenticación (login, logout, cambio de contraseña)
Endpoints: /api/auth/*
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.models.user import UserLogin, TokenResponse, PasswordChange
from app.services.auth_service import auth_service
from app.services.user_service import user_service
from app.services.email_service import email_service
from app.utils.dependencies import get_current_user
from app.models.user import UserInfo

# Crear router de autenticación
router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Endpoint de login
    
    Args:
        credentials: Credenciales del usuario (usuario y password)
        
    Returns:
        TokenResponse con el JWT y datos del usuario
        
    Raises:
        HTTPException 401: Si las credenciales son incorrectas
    """
    # Intentar autenticar usuario
    token_response = auth_service.authenticate_user(
        username=credentials.usuario,
        password=credentials.password
    )
    
    if not token_response:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token_response

@router.get("/me", response_model=UserInfo)
async def get_user_info(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener información del usuario actual
    
    Args:
        current_user: Usuario actual obtenido del token
        
    Returns:
        Información del usuario autenticado
    """
    return current_user

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Cambiar contraseña del usuario actual
    
    Args:
        password_data: Datos de cambio de contraseña
        current_user: Usuario actual del token
        
    Returns:
        Mensaje de éxito
        
    Raises:
        HTTPException: Si la contraseña actual es incorrecta o la nueva no cumple requisitos
    """
    # Obtener usuario completo
    user_db = user_service.get_user_by_username(current_user.usuario)
    
    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Validar fortaleza de nueva contraseña
    is_valid, error_msg = auth_service.validate_password_strength(password_data.password_nueva)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Actualizar contraseña
    success = user_service.update_user_password(
        username=current_user.usuario,
        new_password=password_data.password_nueva,
        reset_cambiar=True
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar contraseña"
        )
    
    return {"message": "Contraseña actualizada correctamente"}

@router.post("/logout")
async def logout(current_user: UserInfo = Depends(get_current_user)):
    """
    Endpoint de logout (cerrar sesión)
    
    Nota: Con JWT no hay logout del lado del servidor.
    El cliente debe eliminar el token.
    
    Args:
        current_user: Usuario actual
        
    Returns:
        Mensaje de confirmación
    """
    return {
        "message": "Sesión cerrada correctamente",
        "detail": "Elimine el token del lado del cliente"
    }

class PasswordRecoveryRequest(BaseModel):
    """Modelo para solicitud de recuperación de contraseña (usuario o email)"""
    usuario: str  # puede ser nombre de usuario o correo electrónico

@router.post("/recover-password")
async def recover_password(request: PasswordRecoveryRequest):
    """
    Recuperar contraseña enviando una temporal por correo.
    Acepta tanto nombre de usuario como correo electrónico.
    
    Args:
        request: Usuario o email que solicita recuperación
        
    Returns:
        Mensaje de confirmación
        
    Raises:
        HTTPException: Si el usuario no existe o no tiene correo
    """
    # Intentar buscar por usuario primero, luego por email
    user = user_service.get_user_by_username(request.usuario)
    if not user:
        # Intentar como email
        user = user_service.get_user_by_email(request.usuario)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró ningún usuario con ese nombre o correo electrónico"
        )
    
    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario no tiene correo electrónico registrado. Contacte al administrador."
        )
    
    # Generar contraseña temporal y actualizar Excel usando el username real del usuario encontrado
    success, password_temporal, email = user_service.recover_password(user.usuario)
    
    if not success or not password_temporal or not email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar contraseña temporal"
        )
    
    # Enviar correo
    email_sent, error_msg = email_service.send_password_recovery_email(
        usuario=user.usuario,
        nombre=user.nombre,
        email=email,
        password_temporal=password_temporal
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al enviar correo: {error_msg}"
        )
    
    return {
        "message": "Contraseña temporal enviada",
        "email": email
    }
