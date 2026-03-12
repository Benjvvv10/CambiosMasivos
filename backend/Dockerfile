# Dockerfile para Backend FastAPI
FROM python:3.12-slim

# Crear usuario no-root
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar requirements y instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

# Crear carpetas necesarias con permisos correctos
RUN mkdir -p /app/data/rutas /app/data/routes_json \
    && chmod -R 777 /app/data

# NO cambiar a usuario no-root (ejecutar como root para evitar problemas de permisos en Windows)
# USER appuser

# Exponer puerto de FastAPI
EXPOSE 8000

# Comando para iniciar la aplicación
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
