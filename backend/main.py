"""
API principal de OptimizaRutas
Framework: FastAPI
Descripción: API RESTful para gestión de rutas y optimización de distancias
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.routes import auth, users, routes, config, cambios_masivos
from app.config import settings
from app.services.automation_service import automation_service
import asyncio
from pathlib import Path

def _warmup_excel_cache():
    """Pre-carga los archivos Excel más usados en el caché de memoria al arrancar."""
    try:
        from app.utils.excel_cache import excel_cache
        base = Path("data")

        archivos = [
            (base / "usuarios_sistema.xlsx", "Sheet1"),
            (base / "carga_cm" / "EstructuraVenta" / "Respaldo" / "TBL EstructuraVentaCM.xlsx", "Dotacion"),
            (base / "carga_cm" / "Cartera" / "Respaldo" / "TBL_Cartera.xlsx", "Carga Admin"),
        ]
        for path, sheet in archivos:
            if path.exists():
                try:
                    excel_cache.read_excel(path, sheet_name=sheet)
                    print(f"[CACHE] Pre-cargado: {path.name} [{sheet}]")
                except Exception as e:
                    print(f"[CACHE] No se pudo pre-cargar {path.name}: {e}")
    except Exception as e:
        print(f"[CACHE] Error en warmup: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestionar el ciclo de vida de la aplicación"""
    # Startup: pre-calentar caché Excel en background + iniciar automatización
    await automation_service.start()
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _warmup_excel_cache)
    yield
    # Shutdown: Detener servicio de automatización
    await automation_service.stop()

# Crear instancia de la aplicación FastAPI
app = FastAPI(
    title="OptimizaRutas API",
    description="API para optimización de rutas y gestión de distancias",
    version="1.0.0",
    lifespan=lifespan
)

# Compresión GZip para respuestas grandes (Excel → JSON)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configurar CORS para permitir peticiones desde el frontend
# allow_origins=["*"] permite acceso desde cualquier IP de red local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite acceso desde cualquier origen (red local)
    allow_credentials=False,  # Debe ser False cuando allow_origins="*"
    allow_methods=["*"],  # Todos los métodos HTTP
    allow_headers=["*"],  # Todos los headers
    expose_headers=["content-disposition", "Content-Disposition", "content-length", "Content-Length"],
)

# Manejador global de excepciones con CORS headers
# Garantiza que errores no capturados siempre incluyan Access-Control-Allow-Origin
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

# Registrar rutas de la aplicación
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/api/users", tags=["Usuarios"])
app.include_router(routes.router, prefix="/api/routes", tags=["Rutas - Optimiza Rutas"])
app.include_router(config.router, prefix="/api/config", tags=["Configuración"])
app.include_router(cambios_masivos.router, prefix="/api/cambios-masivos", tags=["Cambios Masivos"])

# Importar el router de estructura de ventas (versión simplificada con Excel base)
from app.routes import estructura_venta_simple
app.include_router(estructura_venta_simple.router, prefix="/api/estructura-venta", tags=["Estructura de Venta"])

# Importar el router de carteras
from app.routes import carteras
app.include_router(carteras.router, prefix="/api/carteras", tags=["Carteras"])

# Importar el router de instructivo
from app.routes import instructivo
app.include_router(instructivo.router, prefix="/api/instructivo", tags=["Instructivo"])

# Ruta raíz para verificar estado del servidor
@app.get("/")
async def root():
    """Endpoint de bienvenida"""
    return {
        "message": "OptimizaRutas API",
        "version": "1.0.0",
        "status": "online"
    }

# Endpoint de salud del servidor
@app.get("/health")
async def health_check():
    """Verificar estado del servidor"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    # Ejecutar servidor en modo desarrollo
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
