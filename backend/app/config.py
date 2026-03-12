"""
Configuración global de la aplicación
Maneja variables de entorno y configuraciones del sistema
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import os

class Settings(BaseSettings):
    """Configuraciones de la aplicación desde variables de entorno"""
    
    # Configuración general
    APP_NAME: str = "OptimizaRutas"
    DEBUG: bool = True
    
    # Seguridad JWT
    SECRET_KEY: str = "your-secret-key-change-this-in-production"  # Cambiar en producción
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Duración del token (60 minutos)
    
    # CORS - Dominios permitidos
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",  # Frontend Next.js en desarrollo
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Convertir string separado por comas a lista"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # Base de datos (rutas de archivos)
    DATA_DIR: str = "data"  # Carpeta de datos
    USERS_FILE: str = "usuarios_sistema.xlsx"  # Archivo de usuarios
    MAESTRO_FILE: str = "Maestro APP.csv"  # Archivo maestro de rutas
    
    # OSRM Server
    OSRM_URL: str = "http://localhost:5000"
    OSRM_DELAY_SECONDS: float = 0.1
    
    # Email Configuration
    EMAIL_SENDER: str = ""  # Correo desde donde se envía
    EMAIL_PASSWORD: str = ""  # Contraseña de aplicación de Gmail
    EMAIL_ADMIN: str = ""  # Correo del administrador (opcional)
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    
    class Config:
        # Archivo de variables de entorno
        env_file = ".env"
        case_sensitive = True

# Instancia global de configuración
settings = Settings()

# Crear carpeta de datos si no existe
os.makedirs(settings.DATA_DIR, exist_ok=True)
