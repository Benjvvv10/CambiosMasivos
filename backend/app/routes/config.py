"""
Rutas de Configuración del Sistema
Endpoints para gestionar configuraciones globales como el umbral de porcentaje
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any
from app.utils.dependencies import get_current_user
from app.models.user import UserInfo
from app.services.automation_service import automation_service
import json
import os

router = APIRouter()

# Ruta del archivo de configuración (ruta absoluta para evitar problemas de directorio de trabajo)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_FILE = os.path.join(BASE_DIR, "data", "config.json")

# ==================== MODELOS PYDANTIC ====================

class UmbralPorcentajeUpdate(BaseModel):
    """Modelo para actualizar el umbral de porcentaje"""
    umbral_porcentaje: float = Field(..., ge=-100, le=100, description="Umbral de porcentaje entre -100 y 100")

class ConfigResponse(BaseModel):
    """Modelo de respuesta de configuración"""
    umbral_porcentaje: float

class FactorSemanasUpdate(BaseModel):
    """Modelo para actualizar el factor de semanas"""
    factor_semanas: float = Field(..., gt=0, le=10, description="Factor de semanas por mes entre 0.1 y 10")

class FactorSemanasResponse(BaseModel):
    """Modelo de respuesta del factor de semanas"""
    factor_semanas: float

class AppStatusUpdate(BaseModel):
    """Modelo para actualizar el estado de la aplicación"""
    app_activa: bool = Field(..., description="Estado de la aplicación (True=activada, False=desactivada)")

class AppStatusResponse(BaseModel):
    """Modelo de respuesta del estado de la aplicación"""
    app_activa: bool

class AutomatizacionUpdate(BaseModel):
    """Modelo para actualizar la configuración de automatización"""
    activa: bool = Field(..., description="Estado de la automatización")
    fecha_hora_inicio: str = Field(..., description="Fecha y hora de inicio (formato ISO 8601)")
    fecha_hora_fin: str = Field(..., description="Fecha y hora de fin (formato ISO 8601)")

class AutomatizacionResponse(BaseModel):
    """Modelo de respuesta de la configuración de automatización"""
    activa: bool
    fecha_hora_inicio: str
    fecha_hora_fin: str

class PlantillaPDFUpdate(BaseModel):
    """Modelo para actualizar la plantilla del PDF"""
    titulo: str = Field(..., description="Título del documento")
    texto_superior: str = Field(default="", description="Texto personalizado antes de la tabla")
    texto_inferior: str = Field(default="", description="Texto personalizado después de la tabla")
    tamano_fuente_titulo: int = Field(default=16, ge=10, le=24, description="Tamaño de fuente del título")
    tamano_fuente_contenido: int = Field(default=11, ge=8, le=16, description="Tamaño de fuente del contenido")
    firma_izquierda: str = Field(default="", description="Texto para la línea de firma izquierda")
    firma_derecha: str = Field(default="", description="Texto para la línea de firma derecha")

class PlantillaPDFResponse(BaseModel):
    """Modelo de respuesta de la plantilla PDF"""
    titulo: str
    texto_superior: str
    texto_inferior: str
    tamano_fuente_titulo: int
    tamano_fuente_contenido: int
    firma_izquierda: str
    firma_derecha: str

class CorreosCopiaUpdate(BaseModel):
    """Modelo para actualizar los correos de copia"""
    recuperacion_password: list[str] = Field(default=[], description="Correos para copia en recuperación de contraseña")
    validacion_pdf: list[str] = Field(default=[], description="Correos para copia en validación de PDF")

class CorreosCopiaResponse(BaseModel):
    """Modelo de respuesta de correos de copia"""
    recuperacion_password: list[str]
    validacion_pdf: list[str]


# ==================== FUNCIONES AUXILIARES ====================

def load_config() -> Dict[str, Any]:
    """Cargar configuración desde archivo JSON"""
    if not os.path.exists(CONFIG_FILE):
        # Crear archivo con valores por defecto completos
        default_config = {
            "umbral_porcentaje": 10.0,
            "factor_semanas": 4.2,
            "app_activa": True,
            "correos_copia": {
                "recuperacion_password": [],
                "validacion_pdf": []
            },
            "automatizacion": {
                "activa": False,
                "fecha_hora_inicio": "",
                "fecha_hora_fin": ""
            },
            "cambios_masivos": {
                "app_activa": True,
                "automatizacion": {
                    "activa": False,
                    "fecha_hora_inicio": "",
                    "fecha_hora_fin": ""
                }
            },
            "plantilla_pdf": {
                "titulo": "VALIDACION RUTAS VISITA CLIENTES",
                "texto_superior": "",
                "texto_inferior": "",
                "tamano_fuente_titulo": 16,
                "tamano_fuente_contenido": 11,
                "firma_izquierda": "",
                "firma_derecha": ""
            }
        }
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=2)
        return default_config

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)

            # --- Compatibilidad: asegurar que todos los campos existen ---

            if "app_activa" not in config:
                config["app_activa"] = True

            if "factor_semanas" not in config:
                config["factor_semanas"] = 4.2

            if "correos_copia" not in config:
                config["correos_copia"] = {
                    "recuperacion_password": [],
                    "validacion_pdf": []
                }

            if "automatizacion" not in config:
                config["automatizacion"] = {
                    "activa": False,
                    "fecha_hora_inicio": "",
                    "fecha_hora_fin": ""
                }

            # Sección Cambios Masivos
            if "cambios_masivos" not in config:
                config["cambios_masivos"] = {
                    "app_activa": True,
                    "automatizacion": {
                        "activa": False,
                        "fecha_hora_inicio": "",
                        "fecha_hora_fin": ""
                    }
                }
            elif "automatizacion" not in config["cambios_masivos"]:
                config["cambios_masivos"]["automatizacion"] = {
                    "activa": False,
                    "fecha_hora_inicio": "",
                    "fecha_hora_fin": ""
                }

            # Sección Plantilla PDF
            if "plantilla_pdf" not in config:
                config["plantilla_pdf"] = {
                    "titulo": "VALIDACION RUTAS VISITA CLIENTES",
                    "texto_superior": "",
                    "texto_inferior": "",
                    "tamano_fuente_titulo": 16,
                    "tamano_fuente_contenido": 11,
                    "firma_izquierda": "",
                    "firma_derecha": ""
                }
            elif "incluir_vendedor" in config["plantilla_pdf"]:
                # Migrar formato antiguo al nuevo formato de texto libre
                old_pdf = config["plantilla_pdf"]
                texto_sup = ""
                if old_pdf.get("incluir_vendedor", False):
                    texto_sup += "Vendedor: [NOMBRE_VENDEDOR]\n"
                if old_pdf.get("incluir_codigo", False):
                    texto_sup += "Código: [CODIGO_VENDEDOR]\n"
                if old_pdf.get("incluir_km_total", False):
                    texto_sup += "KM Validado Total: [KM_VALIDADO_TOTAL] km\n"
                if old_pdf.get("texto_personalizado", ""):
                    texto_sup += old_pdf["texto_personalizado"]

                config["plantilla_pdf"] = {
                    "titulo": old_pdf.get("titulo", "VALIDACION RUTAS VISITA CLIENTES"),
                    "texto_superior": texto_sup.strip(),
                    "texto_inferior": "",
                    "tamano_fuente_titulo": old_pdf.get("tamano_fuente_titulo", 16),
                    "tamano_fuente_contenido": old_pdf.get("tamano_fuente_contenido", 11),
                    "firma_izquierda": old_pdf.get("firma_izquierda", ""),
                    "firma_derecha": old_pdf.get("firma_derecha", "")
                }

            return config
    except Exception as e:
        print(f"Error al cargar configuración: {e}")
        return {"umbral_porcentaje": 10.0, "app_activa": True}


def save_config(config: Dict[str, Any]) -> bool:
    """Guardar configuración en archivo JSON"""
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error al guardar configuración: {e}")
        return False


# ==================== ENDPOINTS - OPTIMIZA RUTAS ====================

@router.get("/umbral-porcentaje", response_model=ConfigResponse)
async def get_umbral_porcentaje(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener el umbral de porcentaje configurado.
    Disponible para todos los usuarios autenticados.
    """
    config = load_config()
    return ConfigResponse(umbral_porcentaje=config.get("umbral_porcentaje", 10.0))

@router.put("/umbral-porcentaje", response_model=ConfigResponse)
async def update_umbral_porcentaje(
    data: UmbralPorcentajeUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar el umbral de porcentaje.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["umbral_porcentaje"] = data.umbral_porcentaje

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    return ConfigResponse(umbral_porcentaje=data.umbral_porcentaje)

@router.get("/factor-semanas", response_model=FactorSemanasResponse)
async def get_factor_semanas(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener el factor de semanas configurado.
    Disponible para todos los usuarios autenticados.
    """
    config = load_config()
    return FactorSemanasResponse(factor_semanas=config.get("factor_semanas", 4.20))

@router.put("/factor-semanas", response_model=FactorSemanasResponse)
async def update_factor_semanas(
    data: FactorSemanasUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar el factor de semanas.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["factor_semanas"] = data.factor_semanas

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    return FactorSemanasResponse(factor_semanas=data.factor_semanas)

@router.get("/app-status", response_model=AppStatusResponse)
async def get_app_status(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener el estado de la aplicación Optimiza Rutas (activada/desactivada).
    Disponible para todos los usuarios autenticados.
    """
    config = load_config()
    return AppStatusResponse(app_activa=config.get("app_activa", True))

@router.put("/app-status", response_model=AppStatusResponse)
async def update_app_status(
    data: AppStatusUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar el estado de la aplicación Optimiza Rutas (activar/desactivar).
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["app_activa"] = data.app_activa

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    return AppStatusResponse(app_activa=data.app_activa)

@router.get("/automatizacion", response_model=AutomatizacionResponse)
async def get_automatizacion(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener la configuración de automatización de Optimiza Rutas.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta configuración")

    config = load_config()
    auto_config = config.get("automatizacion", {
        "activa": False,
        "fecha_hora_inicio": "",
        "fecha_hora_fin": ""
    })
    return AutomatizacionResponse(**auto_config)

@router.put("/automatizacion", response_model=AutomatizacionResponse)
async def update_automatizacion(
    data: AutomatizacionUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar la configuración de automatización de Optimiza Rutas.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["automatizacion"] = {
        "activa": data.activa,
        "fecha_hora_inicio": data.fecha_hora_inicio,
        "fecha_hora_fin": data.fecha_hora_fin
    }

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    # Iniciar o detener el servicio de automatización
    if data.activa:
        if not automation_service.running:
            await automation_service.start()
    else:
        # Solo detener si AMBAS automatizaciones están desactivadas
        cm_activa = config.get("cambios_masivos", {}).get("automatizacion", {}).get("activa", False)
        if not cm_activa and automation_service.running:
            await automation_service.stop()

    return AutomatizacionResponse(
        activa=data.activa,
        fecha_hora_inicio=data.fecha_hora_inicio,
        fecha_hora_fin=data.fecha_hora_fin
    )

@router.get("/plantilla-pdf", response_model=PlantillaPDFResponse)
async def get_plantilla_pdf(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener la configuración de la plantilla PDF.
    Disponible para administradores.
    """
    config = load_config()
    plantilla = config.get("plantilla_pdf", {
        "titulo": "VALIDACION RUTAS VISITA CLIENTES",
        "texto_superior": "",
        "texto_inferior": "",
        "tamano_fuente_titulo": 16,
        "tamano_fuente_contenido": 11,
        "firma_izquierda": "",
        "firma_derecha": ""
    })
    return PlantillaPDFResponse(**plantilla)

@router.put("/plantilla-pdf", response_model=PlantillaPDFResponse)
async def update_plantilla_pdf(
    data: PlantillaPDFUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar la configuración de la plantilla PDF.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["plantilla_pdf"] = {
        "titulo": data.titulo,
        "texto_superior": data.texto_superior,
        "texto_inferior": data.texto_inferior,
        "tamano_fuente_titulo": data.tamano_fuente_titulo,
        "tamano_fuente_contenido": data.tamano_fuente_contenido,
        "firma_izquierda": data.firma_izquierda,
        "firma_derecha": data.firma_derecha
    }

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    return PlantillaPDFResponse(**config["plantilla_pdf"])


# ==================== CORREOS DE COPIA ====================

@router.get("/correos-copia", response_model=CorreosCopiaResponse)
async def get_correos_copia(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener la configuración de correos de copia.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para consultar esta configuración")

    config = load_config()
    correos_copia = config.get("correos_copia", {
        "recuperacion_password": [],
        "validacion_pdf": []
    })
    return CorreosCopiaResponse(
        recuperacion_password=correos_copia.get("recuperacion_password", []),
        validacion_pdf=correos_copia.get("validacion_pdf", [])
    )

@router.put("/correos-copia", response_model=CorreosCopiaResponse)
async def update_correos_copia(
    data: CorreosCopiaUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar la configuración de correos de copia.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    # Validar formato de correos
    all_emails = data.recuperacion_password + data.validacion_pdf
    for email in all_emails:
        if email and '@' not in email:
            raise HTTPException(status_code=400, detail=f"Formato de correo inválido: {email}")

    config = load_config()
    config["correos_copia"] = {
        "recuperacion_password": data.recuperacion_password,
        "validacion_pdf": data.validacion_pdf
    }

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    return CorreosCopiaResponse(**config["correos_copia"])


# ==================== ENDPOINTS - CAMBIOS MASIVOS ====================

@router.get("/cambios-masivos-status", response_model=AppStatusResponse)
async def get_cambios_masivos_status(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener el estado actual de Cambios Masivos (activado/desactivado).
    """
    config = load_config()
    return AppStatusResponse(app_activa=config["cambios_masivos"].get("app_activa", True))


@router.put("/cambios-masivos-status", response_model=AppStatusResponse)
async def update_cambios_masivos_status(
    data: AppStatusUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Activar o desactivar el módulo de Cambios Masivos.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["cambios_masivos"]["app_activa"] = data.app_activa

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    return AppStatusResponse(app_activa=data.app_activa)


@router.get("/cambios-masivos-automatizacion", response_model=AutomatizacionResponse)
async def get_cambios_masivos_automatizacion(current_user: UserInfo = Depends(get_current_user)):
    """
    Obtener la configuración de automatización de Cambios Masivos.
    """
    config = load_config()
    auto_config = config["cambios_masivos"]["automatizacion"]
    return AutomatizacionResponse(
        activa=auto_config.get("activa", False),
        fecha_hora_inicio=auto_config.get("fecha_hora_inicio", ""),
        fecha_hora_fin=auto_config.get("fecha_hora_fin", "")
    )


@router.put("/cambios-masivos-automatizacion", response_model=AutomatizacionResponse)
async def update_cambios_masivos_automatizacion(
    data: AutomatizacionUpdate,
    current_user: UserInfo = Depends(get_current_user)
):
    """
    Actualizar la configuración de automatización de Cambios Masivos.
    Solo disponible para administradores.
    """
    if current_user.cargo.lower() != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración")

    config = load_config()
    config["cambios_masivos"]["automatizacion"] = {
        "activa": data.activa,
        "fecha_hora_inicio": data.fecha_hora_inicio,
        "fecha_hora_fin": data.fecha_hora_fin
    }

    if not save_config(config):
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")

    # Iniciar o mantener el servicio de automatización
    if data.activa:
        if not automation_service.running:
            await automation_service.start()
    else:
        # Solo detener si AMBAS automatizaciones están desactivadas
        auto_optimiza = config.get("automatizacion", {})
        if not auto_optimiza.get("activa", False) and automation_service.running:
            await automation_service.stop()

    return AutomatizacionResponse(
        activa=data.activa,
        fecha_hora_inicio=data.fecha_hora_inicio,
        fecha_hora_fin=data.fecha_hora_fin
    )

