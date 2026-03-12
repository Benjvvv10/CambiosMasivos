"""
Utilidades para manejo de dependencias de FastAPI
Incluye validación de tokens JWT y obtención de usuario actual
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from app.services.auth_service import auth_service
from app.services.user_service import user_service
from app.models.user import UserInfo
from typing import Optional

# Esquema de autenticación OAuth2 con Bearer Token
# tokenUrl: endpoint donde se obtiene el token (login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def _is_localhost_request(request: Request) -> bool:
    """
    Verificar si la petición viene de localhost
    Verifica tanto la IP del cliente como los headers Origin/Referer
    
    Args:
        request: Request de FastAPI
        
    Returns:
        True si viene de localhost, False en caso contrario
    """
    client_host = request.client.host if request.client else None
    
    # Verificar IP del cliente
    is_localhost_ip = client_host in ["127.0.0.1", "localhost", "::1"]
    
    # Verificar headers X-Forwarded-For
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    is_forwarded_localhost = (
        "127.0.0.1" in forwarded_for or
        "localhost" in forwarded_for.lower()
    )
    
    # Verificar header Origin (envía el navegador automáticamente)
    origin = request.headers.get("Origin", "")
    is_origin_localhost = (
        "localhost" in origin.lower() or
        "127.0.0.1" in origin
    )
    
    # Verificar header Referer (alternativa si no hay Origin)
    referer = request.headers.get("Referer", "")
    is_referer_localhost = (
        "localhost" in referer.lower() or
        "127.0.0.1" in referer
    )
    
    is_localhost = (
        is_localhost_ip or
        is_forwarded_localhost or
        is_origin_localhost or
        is_referer_localhost
    )
    
    return is_localhost

async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme)
) -> UserInfo:
    """
    Obtener usuario actual desde el token JWT o localhost (modo admin)
    
    Args:
        request: Request de FastAPI para verificar origen
        token: Token JWT desde el header Authorization (opcional si es localhost)
        
    Returns:
        UserInfo del usuario autenticado o admin localhost
        
    Raises:
        HTTPException: Si el token es inválido o el usuario no existe
    """
    # Si viene de localhost, retornar usuario admin sin token
    if _is_localhost_request(request):
        return UserInfo(
            usuario="admin_localhost",
            nombre="Administrador",
            cargo="Admin",
            email=None,
            distritos_permitidos=[]  # Admin tiene acceso a todos
        )
    
    # Si no es localhost, requerir token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudieron validar las credenciales",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Excepción a retornar si hay error de autenticación
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decodificar token
        payload = auth_service.decode_token(token)
        
        if payload is None:
            raise credentials_exception
        
        # Obtener usuario desde payload
        username: str = payload.get("sub")
        
        if username is None:
            raise credentials_exception
        
        # Validar que el usuario existe en el sistema
        user_db = user_service.get_user_by_username(username)
        
        if user_db is None:
            raise credentials_exception
        
        # Verificar que no esté bloqueado
        if user_db.bloquear == 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario bloqueado"
            )
        
        # Retornar información del usuario
        return UserInfo(
            usuario=user_db.usuario,
            nombre=user_db.nombre,
            cargo=user_db.cargo,
            email=user_db.email,
            distritos_permitidos=user_service.get_user_allowed_districts(username)
        )
        
    except JWTError:
        raise credentials_exception

async def get_current_admin_user(current_user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """
    Verificar que el usuario actual sea administrador
    Nota: Si viene de localhost, ya se retorna como admin automáticamente
    
    Args:
        current_user: Usuario actual obtenido del token o localhost
        
    Returns:
        UserInfo si es administrador
        
    Raises:
        HTTPException: Si el usuario no tiene permisos de administrador
    """
    # Verificar si el cargo es Admin o Administrador
    # El usuario de localhost ya viene con cargo "Admin"
    if current_user.cargo.lower() not in ['admin', 'administrador']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos de administrador"
        )
    
    return current_user
