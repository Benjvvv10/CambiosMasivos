"""
Servicio de autenticación con JWT
Maneja login, validación de tokens y gestión de sesiones
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.models.user import UserInDB, TokenResponse
from app.services.user_service import user_service
import re

# Contexto para hasheo de contraseñas (usando bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    """Servicio de autenticación"""
    
    def __init__(self):
        """Inicializar servicio de autenticación"""
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verificar si la contraseña coincide con el hash
        
        Args:
            plain_password: Contraseña en texto plano
            hashed_password: Contraseña hasheada
            
        Returns:
            True si coinciden, False en caso contrario
        """
        # Por compatibilidad con sistema antiguo, primero comparar directo
        if plain_password == hashed_password:
            return True
        
        # Verificar con hash bcrypt
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except:
            return False
    
    def get_password_hash(self, password: str) -> str:
        """
        Obtener hash de una contraseña
        
        Args:
            password: Contraseña en texto plano
            
        Returns:
            Contraseña hasheada
        """
        return pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Crear token JWT de acceso
        
        Args:
            data: Datos a incluir en el token
            expires_delta: Tiempo de expiración del token
            
        Returns:
            Token JWT codificado
        """
        to_encode = data.copy()
        
        # Calcular tiempo de expiración
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        
        # Codificar token
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[dict]:
        """
        Decodificar y validar token JWT
        
        Args:
            token: Token JWT a decodificar
            
        Returns:
            Datos del token si es válido, None en caso contrario
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[TokenResponse]:
        """
        Autenticar usuario y generar token
        
        Args:
            username: Nombre de usuario o correo electrónico
            password: Contraseña
            
        Returns:
            TokenResponse si autenticación exitosa, None en caso contrario
        """
        # Intentar obtener usuario por nombre de usuario
        user = user_service.get_user_by_username(username)
        
        # Si no se encuentra, intentar por email
        if not user and '@' in username:
            user = user_service.get_user_by_email(username)
        
        if not user:
            return None
        
        # Verificar si está bloqueado
        if user.bloquear == 1:
            return None  # Usuario bloqueado no puede ingresar
        
        # Verificar contraseña
        if not self.verify_password(password, user.contraseña):
            return None
        
        # Obtener distritos permitidos
        distritos_permitidos = user_service.get_user_allowed_districts(username)
        
        # Crear token JWT
        token_data = {
            "sub": user.usuario,  # Subject: identificador del usuario
            "nombre": user.nombre,
            "cargo": user.cargo,
            "distritos": distritos_permitidos
        }
        
        access_token = self.create_access_token(data=token_data)
        
        # Retornar respuesta con token
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            usuario=user.usuario,
            nombre=user.nombre,
            email=user.email,
            cargo=user.cargo,
            distritos_permitidos=distritos_permitidos,
            cambiar_password=user.cambiar == 1
        )
    
    def validate_password_strength(self, password: str) -> tuple[bool, str]:
        """
        Validar fortaleza de contraseña
        
        Requisitos:
        - Mínimo 8 caracteres
        - Al menos una mayúscula
        - Al menos una minúscula
        - Al menos un número
        - Al menos un símbolo especial
        
        Args:
            password: Contraseña a validar
            
        Returns:
            (es_válida, mensaje_error)
        """
        if len(password) < 8:
            return False, "La contraseña debe tener al menos 8 caracteres"
        
        if not re.search(r'[A-Z]', password):
            return False, "La contraseña debe contener al menos una letra mayúscula"
        
        if not re.search(r'[a-z]', password):
            return False, "La contraseña debe contener al menos una letra minúscula"
        
        if not re.search(r'\d', password):
            return False, "La contraseña debe contener al menos un número"
        
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>/?\\|`~]', password):
            return False, "La contraseña debe contener al menos un símbolo especial"
        
        return True, ""

# Instancia global del servicio de autenticación
auth_service = AuthService()
