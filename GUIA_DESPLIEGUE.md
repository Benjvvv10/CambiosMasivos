# Guía de Despliegue en Otra IP/PC

Esta guía explica qué archivos y configuraciones debes modificar para desplegar la aplicación en otra PC con una IP diferente.

## 📋 Archivos a Modificar

### 1. **Frontend - Variables de Entorno**

#### Archivo: `frontend/.env.local` (crear si no existe, basado en `.env.local.example`)

```env
NEXT_PUBLIC_API_URL=http://TU_IP_AQUI:8000
```

**Ejemplo:**
```env
NEXT_PUBLIC_API_URL=http://192.168.1.100:8000
```

---

### 2. **Backend - Variables de Entorno**

#### Archivo: `backend/.env` (crear si no existe, basado en `.env.example`)

Modificar estas líneas:

```env
# CORS - Dominios permitidos (separados por comas)
CORS_ORIGINS=http://TU_IP_AQUI:3000,http://localhost:3000,http://127.0.0.1:3000

# OSRM Server (si está en la misma máquina, usar localhost)
OSRM_URL=http://localhost:5000
```

**Ejemplo:**
```env
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000,http://127.0.0.1:3000
OSRM_URL=http://localhost:5000
```

---

### 3. **Docker Compose (si usas Docker)**

#### Archivo: `docker-compose.yml`

Modificar estas secciones:

**Backend - CORS_ORIGINS:**
```yaml
environment:
  - CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000,http://TU_IP_AQUI:3000
```

**Frontend - NEXT_PUBLIC_API_URL:**
```yaml
frontend:
  build:
    args:
      NEXT_PUBLIC_API_URL: "http://TU_IP_AQUI:8000"
  environment:
    - NEXT_PUBLIC_API_URL=http://TU_IP_AQUI:8000
```

**Ejemplo completo:**
```yaml
environment:
  - CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000,http://192.168.1.100:3000

frontend:
  build:
    args:
      NEXT_PUBLIC_API_URL: "http://192.168.1.100:8000"
  environment:
    - NEXT_PUBLIC_API_URL=http://192.168.1.100:8000
```

---

### 4. **Backend - Configuración de CORS (código)**

#### Archivo: `backend/app/config.py`

Si necesitas agregar más orígenes CORS, modifica:

```python
CORS_ORIGINS: Union[List[str], str] = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://TU_IP_AQUI:3000",  # Agregar tu IP aquí
]
```

**Nota:** Normalmente esto se maneja con la variable de entorno `CORS_ORIGINS`, pero si necesitas hardcodearlo, modifica este archivo.

---

## 🔧 Pasos para el Despliegue

### Opción 1: Sin Docker (Desarrollo)

1. **Obtener la IP de la nueva PC:**
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   # o
   ip addr
   ```

2. **Modificar `frontend/.env.local`:**
   - Cambiar `NEXT_PUBLIC_API_URL` a la IP del backend

3. **Modificar `backend/.env`:**
   - Cambiar `CORS_ORIGINS` para incluir la IP del frontend

4. **Reiniciar servicios:**
   ```bash
   # Backend
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   
   # Frontend
   cd frontend
   npm run dev
   ```

### Opción 2: Con Docker

1. **Obtener la IP de la nueva PC** (igual que arriba)

2. **Modificar `docker-compose.yml`:**
   - Actualizar `CORS_ORIGINS` en el servicio `backend`
   - Actualizar `NEXT_PUBLIC_API_URL` en el servicio `frontend`

3. **Reconstruir y reiniciar:**
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

---

## 🌐 Acceso desde Otras Máquinas

Una vez configurado, podrás acceder desde otras máquinas en la red:

- **Frontend:** `http://TU_IP:3000`
- **Backend API:** `http://TU_IP:8000`
- **API Docs:** `http://TU_IP:8000/docs`
- **OSRM:** `http://TU_IP:5000`

---

## ⚠️ Consideraciones de Seguridad

1. **Firewall:** Asegúrate de que los puertos 3000, 8000 y 5000 estén abiertos en el firewall de Windows/Linux

2. **CORS:** Solo agrega IPs confiables en `CORS_ORIGINS`. No uses `*` en producción.

3. **HTTPS:** Para producción, considera usar HTTPS con un proxy reverso (nginx, traefik, etc.)

---

## 📝 Resumen de Archivos

| Archivo | Qué Modificar |
|---------|---------------|
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` |
| `backend/.env` | `CORS_ORIGINS`, `OSRM_URL` |
| `docker-compose.yml` | `CORS_ORIGINS` (backend), `NEXT_PUBLIC_API_URL` (frontend) |
| `backend/app/config.py` | Solo si necesitas hardcodear CORS (no recomendado) |

---

## 🆘 Solución de Problemas

### Error: "CORS policy: No 'Access-Control-Allow-Origin'"
- Verifica que la IP del frontend esté en `CORS_ORIGINS` del backend
- Reinicia el backend después de cambiar `.env`

### Error: "Network Error" o "Connection Refused"
- Verifica que el backend esté corriendo en `0.0.0.0` (no solo `localhost`)
- Verifica que el firewall permita conexiones en los puertos
- Verifica que `NEXT_PUBLIC_API_URL` tenga la IP correcta

### El frontend no carga datos
- Verifica que `NEXT_PUBLIC_API_URL` apunte a la IP correcta del backend
- Abre la consola del navegador (F12) para ver errores de red
