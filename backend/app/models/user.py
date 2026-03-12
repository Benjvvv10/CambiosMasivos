"""
Modelos de datos de usuario
Define las estructuras de datos para manejo de usuarios
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Modelo para login (entrada)
class UserLogin(BaseModel):
    """Datos requeridos para iniciar sesión"""
    usuario: str = Field(..., min_length=3, description="Nombre de usuario")
    password: str = Field(..., min_length=4, description="Contraseña del usuario")

# Modelo de respuesta de login
class TokenResponse(BaseModel):
    """Respuesta al login exitoso con token JWT"""
    access_token: str = Field(..., description="Token JWT de acceso")
    token_type: str = Field(default="bearer", description="Tipo de token")
    usuario: str = Field(..., description="Nombre de usuario")
    nombre: str = Field(..., description="Nombre completo")
    email: Optional[str] = Field(None, description="Correo electrónico")
    cargo: str = Field(..., description="Cargo del usuario")
    distritos_permitidos: List[str] = Field(default=[], description="Distritos a los que tiene acceso")
    cambiar_password: bool = Field(default=False, description="Indica si debe cambiar la contraseña")

# Modelo de usuario en el sistema (desde Excel)
class UserInDB(BaseModel):
    """Representación de usuario almacenado en el sistema"""
    usuario: str
    nombre: str
    contraseña: str  # Hash de la contraseña
    cargo: str
    email: str
    bloquear: int = 0  # 0=activo, 1=bloqueado
    cambiar: int = 0  # 0=no cambiar, 1=debe cambiar password
    distritos: dict = {}  # Códigos de distrito: {AR: 1, IQ: 0, ...}

# Modelo para información de usuario (sin contraseña)
class UserInfo(BaseModel):
    """Información pública del usuario"""
    usuario: str
    nombre: str
    cargo: str
    email: Optional[str] = None
    distritos_permitidos: List[str] = []

# Modelo para cambio de contraseña
class PasswordChange(BaseModel):
    """Datos para cambiar contraseña"""
    password_nueva: str = Field(..., min_length=8, description="Mínimo 8 caracteres")
    
# Modelo para reseteo de contraseña (admin)
class PasswordReset(BaseModel):
    """Datos para resetear contraseña (solo admin)"""
    usuario: str
    password_nueva: str = Field(..., min_length=8)
    forzar_cambio: bool = True  # Usuario debe cambiar en próximo login
