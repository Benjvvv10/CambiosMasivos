# SistemaCial - Plataforma de Gestión Comercial CIAL

Sistema web integral para la gestión comercial de CIAL Alimentos. Incluye dos módulos principales: **Optimiza Rutas** (optimización de rutas de distribución con OSRM) y **Cambios Masivos** (gestión de estructura de venta, carteras y dotación). Desarrollado con Next.js 14, FastAPI y Docker.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://www.docker.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-green)](https://leafletjs.com/)

---

## Tabla de Contenidos

- [Módulos del Sistema](#-módulos-del-sistema)
- [Características](#-características)
- [Arquitectura del Sistema](#️-arquitectura-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Cómo Funciona el Cálculo de Rutas](#-cómo-funciona-el-cálculo-de-rutas)
- [Desarrollo](#️-desarrollo)
- [Troubleshooting](#-troubleshooting)
- [Contribución](#-contribución)

---

## Módulos del Sistema

SistemaCial está compuesto por dos módulos independientes que se activan/desactivan desde el panel de administración:

### 1. Optimiza Rutas
Gestión y optimización de rutas de distribución. Compara rutas SAP originales contra rutas optimizadas por TSP (OSRM), genera PDFs de validación y permite edición interactiva con Drag & Drop.

### 2. Cambios Masivos
Gestión del ciclo de cambios comerciales con tres sub-módulos:
- **Estructura de Venta**: Edición de la estructura del equipo de ventas por zonas
- **Carteras**: Gestión de carteras de clientes por jefe de venta
- **Administrar Dotación**: Gestión de dotación del personal

Ambos módulos comparten autenticación JWT, sistema de usuarios basado en Excel y permisos por zona/distrito.

---

## Características

### Autenticación y Seguridad
- **Login JWT** con tokens de 60 minutos (HS256)
- **Gestión de usuarios** desde Excel (`usuarios_sistema.xlsx`) con permisos por zona/distrito
- **Roles**: Administrador (acceso total) y Jefe de Venta (zonas asignadas)
- **Cambio de contraseña** obligatorio en primer ingreso
- **Recuperación por email** con contraseña temporal vía SMTP (Gmail)
- **Validación de contraseñas**: 8+ caracteres, mayúscula, minúscula, número, carácter especial
- **Bloqueo de usuarios** desde el Excel

### Módulo Optimiza Rutas
- **Ranking de vendedores** ordenados por ahorro potencial (KM SAP vs Optimizado)
- **Mapas interactivos** con Leaflet: comparación lado a lado SAP vs Optimizada
- **Edición Drag & Drop** con @dnd-kit para reordenar puntos de visita
- **Cálculo TSP** con OSRM: inicio y fin fijos (oficina), optimiza solo clientes
- **Generación de PDFs** con ReportLab: validación por vendedor con plantilla configurable
- **Exportación a Excel** de rankings y rutas
- **Umbrales configurables**: porcentaje de holgura y factor de semanas
- **Rutas validadas**: persistencia de rutas guardadas tras edición

### Módulo Cambios Masivos
- **Estructura de Venta**: carga, edición y validación por zonas con respaldo automático
- **Carteras**: gestión de clientes por jefe de venta con validación por zona
- **Administrar Dotación**: gestión de dotación del personal
- **Instructivos PDF**: carga y consulta de manuales por módulo (admin puede subir, todos pueden ver)
- **Archivos de respaldo**: backups automáticos con timestamp antes de cada cambio
- **Validación por zonas**: cada jefe de venta valida solo sus zonas asignadas

### Panel de Administración
- **Configuración en tiempo real** via `config.json`:
  - Activar/desactivar módulos (Optimiza Rutas, Cambios Masivos)
  - Umbral de porcentaje de holgura para validación de KM
  - Factor de semanas para cálculo mensual
  - Plantilla PDF personalizable (título, textos, fuentes, firmas)
  - Correos en copia para recuperación de password y validación PDF
- **Automatización programada**: activar/desactivar módulos por fecha y hora (timezone Chile)
- **Reset de contraseñas** de usuarios
- **Gestión de distritos** por usuario

### Automatización
- **Servicio en background**: revisa cada 60 segundos si corresponde activar/desactivar módulos
- **Programación por fecha**: configura inicio y fin para Optimiza Rutas y Cambios Masivos
- **Timezone Chile**: `America/Santiago` para cálculos de horario

### Diseño Responsivo
- Headers de 80px con gradiente verde corporativo
- Breakpoints: 768px (tablets) y 480px (móviles)
- Edición full-screen en móvil con footer sticky
- Touch-friendly: botones de 44px mínimo

---

## Arquitectura del Sistema

### Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Browser)                           │
│                         Next.js 14 Frontend                          │
│                           Port: 3000                                 │
│                                                                      │
│   ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐    │
│   │    Login     │  │  Optimiza Rutas  │  │  Cambios Masivos   │    │
│   │   Menú App   │  │  Dashboard/Mapas │  │  EV/Carteras/Dot.  │    │
│   └─────────────┘  └──────────────────┘  └────────────────────┘    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP REST API
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                             │
│                           Port: 8000                                 │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ Auth Service │ │ User Service │ │Route Service │ │Zona Serv. │ │
│  │  JWT/Login   │ │ Excel Users  │ │ OSRM/TSP     │ │ Zonas/Arch│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └───────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ PDF Service  │ │Email Service │ │Automation Sv.│               │
│  │ ReportLab    │ │ SMTP/Gmail   │ │ Scheduler    │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌────────────────┐ ┌──────────┐ ┌──────────────────┐
     │  Data Files     │ │  OSRM    │ │  SMTP Server     │
     │ usuarios.xlsx   │ │ Port 5000│ │  smtp.gmail.com  │
     │ Maestro APP.csv │ │ Chile Map│ │                  │
     │ config.json     │ │          │ │                  │
     │ routes_json/    │ │          │ │                  │
     │ carga_cm/       │ │          │ │                  │
     └────────────────┘ └──────────┘ └──────────────────┘
```

### Servicios Docker

| Servicio | Imagen | Puerto | Memoria | Descripción |
|----------|--------|--------|---------|-------------|
| **frontend** | Next.js 14 (build) | 3000 | 512MB / 256MB | Interfaz de usuario |
| **backend** | FastAPI + Uvicorn (4 workers) | 8000 | 1.5GB / 512MB | API REST |
| **osrm** | osrm/osrm-backend | 5000 | - | Motor de routing (Chile) |

Red: `optimarutas-network` (bridge)

---

## Estructura del Proyecto

```
SistemaCial/
│
├── docker-compose.yml                 # Orquestación de 3 servicios
├── .env                               # Variables de entorno (no versionado)
├── .env.example                       # Plantilla de variables de entorno
├── README.md                          # Este archivo
├── GUIA_DESPLIEGUE.md                 # Guía detallada de despliegue
├── INICIO_RAPIDO.md                   # Guía rápida de inicio
│
├── backend/                           # Backend FastAPI (Python 3.12)
│   ├── Dockerfile
│   ├── main.py                        # Punto de entrada + lifespan (automation)
│   ├── requirements.txt               # Dependencias Python
│   │
│   ├── app/
│   │   ├── config.py                  # Settings: JWT, CORS, Email, OSRM, archivos
│   │   │
│   │   ├── models/
│   │   │   └── user.py                # UserLogin, TokenResponse, UserInDB,
│   │   │                              # UserInfo, PasswordChange, PasswordReset
│   │   │
│   │   ├── routes/                    # Endpoints de la API
│   │   │   ├── auth.py                # /api/auth/* - Login, logout, recovery
│   │   │   ├── users.py               # /api/users/* - Distritos, reset password
│   │   │   ├── routes.py              # /api/routes/* - Rutas, ranking, OSRM
│   │   │   ├── config.py              # /api/config/* - Configuración del sistema
│   │   │   ├── cambios_masivos.py     # /api/cambios-masivos/* - Módulo CM
│   │   │   ├── carteras.py            # /api/carteras/* - Gestión de carteras
│   │   │   ├── estructura_venta_simple.py  # /api/estructura-venta/* - Estructura
│   │   │   └── instructivo.py         # /api/instructivo/* - Manuales PDF
│   │   │
│   │   ├── services/                  # Lógica de negocio
│   │   │   ├── auth_service.py        # JWT, bcrypt, autenticación
│   │   │   ├── user_service.py        # Lectura Excel, distritos, passwords
│   │   │   ├── route_service.py       # OSRM, TSP, procesamiento CSV
│   │   │   ├── zona_service.py        # Zonas, archivos por zona, metadata
│   │   │   ├── pdf_service.py         # Generación PDF con ReportLab
│   │   │   ├── email_service.py       # SMTP Gmail, emails con CC
│   │   │   └── automation_service.py  # Scheduler de activación/desactivación
│   │   │
│   │   └── utils/
│   │       ├── dependencies.py        # get_current_user (JWT dependency)
│   │       └── excel_cache.py         # Cache de lectura de Excel con pandas
│   │
│   └── data/                          # Datos de runtime (no versionado)
│       ├── usuarios_sistema.xlsx      # Base de usuarios
│       ├── config.json                # Configuración dinámica del sistema
│       ├── rutas/
│       │   └── Maestro APP.csv        # Datos de rutas SAP
│       ├── routes_json/               # JSONs generados por distrito
│       │   └── {DISTRITO}/
│       │       ├── ruta_original.json
│       │       ├── ruta_optimizada.json
│       │       └── ruta_validada.json
│       └── carga_cm/                  # Archivos de Cambios Masivos
│           ├── Cartera/
│           │   ├── Cambios/           # Archivos subidos y temporales
│           │   └── Respaldo/          # Backups automáticos
│           ├── EstructuraVenta/
│           │   ├── Cambios/           # Consolidados y backups de ciclo
│           │   └── Respaldo/          # TBL EstructuraVentaCM
│           └── Instructivo/
│               ├── administrar-dotacion/
│               ├── carteras/
│               └── estructura-venta/
│
├── frontend/                          # Frontend Next.js 14 (TypeScript)
│   ├── Dockerfile
│   ├── package.json                   # React 18, Leaflet, @dnd-kit, xlsx, axios
│   ├── next.config.js
│   ├── tsconfig.json
│   │
│   ├── public/
│   │   └── logo_cial.svg             # Logo corporativo
│   │
│   └── src/
│       ├── app/                       # App Router (Next.js 14)
│       │   ├── layout.tsx             # Layout global
│       │   ├── page.tsx               # Redirect inicial
│       │   ├── globals.css            # Estilos globales
│       │   │
│       │   ├── login/                 # Autenticación
│       │   ├── cambiar-password/      # Cambio de contraseña (primer ingreso)
│       │   ├── recuperar-password/    # Recuperación por email
│       │   │
│       │   ├── menu/                  # Menú principal (selección de módulo)
│       │   ├── admin/                 # Panel de administración
│       │   │
│       │   ├── optimiza-rutas/        # Módulo Optimiza Rutas
│       │   │   ├── page.tsx           # Landing del módulo
│       │   │   ├── dashboard/         # Ranking de vendedores
│       │   │   ├── vendedor/[codigo]/ # Detalle por vendedor
│       │   │   └── ruta/[codigo]/     # Mapa comparativo de rutas
│       │   │
│       │   └── app-Cambios-Masivos/   # Módulo Cambios Masivos
│       │       ├── page.tsx           # Menú del módulo
│       │       ├── estructura-venta/  # Gestión estructura de venta
│       │       ├── carteras/          # Gestión de carteras
│       │       └── administrar-dotacion/ # Gestión de dotación
│       │
│       ├── components/                # Componentes reutilizables
│       │   ├── Header.tsx             # Header con gradiente (80px)
│       │   ├── Button.tsx             # Botón estilizado
│       │   ├── Modal.tsx              # Modal genérico
│       │   ├── ModalDetalleValidacion.tsx  # Modal de detalle de validación
│       │   ├── InstructivoModal.tsx    # Modal para instructivos PDF
│       │   ├── UserMenu.tsx           # Menú desplegable de usuario
│       │   └── LoadingDots.tsx        # Indicador de carga animado
│       │
│       ├── contexts/
│       │   └── AuthContext.tsx         # Context de autenticación global
│       │
│       ├── hooks/
│       │   └── useUmbralConfig.ts     # Hook para configuración de umbral
│       │
│       ├── services/
│       │   ├── api.ts                 # Axios instance configurada
│       │   └── auth.service.ts        # Servicio de autenticación
│       │
│       ├── types/
│       │   └── index.ts               # User, LoginResponse, AuthContextType
│       │
│       └── utils/
│           └── api-url.ts             # Utilidad para URL de API
│
└── osrm_data/                         # Datos OSRM Chile (no versionado)
    └── chile-latest.osrm*             # Archivos de índice del mapa
```

---

## Instalación

### Requisitos Previos

- **Docker Desktop** (Windows/Mac) o **Docker Engine** (Linux)
- **Docker Compose** 2.0+
- **Git**
- 4 GB RAM mínimo (8 GB recomendado)
- 2 GB espacio en disco

### Paso 1: Clonar Repositorio

```bash
git clone <url-del-repositorio>
cd SistemaCial
```

### Paso 2: Configurar Variables de Entorno

Copiar `.env.example` a `.env` y ajustar:

```env
# Email (para recuperación de contraseña)
EMAIL_SENDER=tu-email@gmail.com
EMAIL_PASSWORD=tu-app-password
EMAIL_ADMIN=admin@empresa.com
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

Las variables de JWT, CORS, OSRM y archivos están pre-configuradas en `docker-compose.yml`.

### Paso 3: Preparar Archivos de Datos

#### Usuarios (`backend/data/usuarios_sistema.xlsx`)

El Excel debe contener las columnas:

| Usuario | Nombre | Contraseña | Cargo | Email | Bloquear | Cambiar | Zona1 | Zona2 | ... |
|---------|--------|------------|-------|-------|----------|---------|-------|-------|-----|
| admin | Administrador | (hash) | ADMINISTRADOR | admin@cial.cl | 0 | 0 | 1 | 1 | ... |
| projas | Pedro Rojas | (hash) | JEFE DE VENTA | projas@cial.cl | 0 | 1 | 1 | 0 | ... |

- **Cargo**: `ADMINISTRADOR` o `JEFE DE VENTA`
- **Bloquear**: 0=activo, 1=bloqueado
- **Cambiar**: 0=no requiere cambio, 1=debe cambiar password en próximo login
- **Columnas de Zona**: 1=tiene acceso, 0=no tiene acceso

#### Maestro APP (`backend/data/rutas/Maestro APP.csv`)

```csv
CodDistrito;Distrito;DiaVisita;Fecha;CodVend;NombreVend;Sec.Visita;CodCliente;RazonSocial;Latitud;Longitud;TipoNeg
AR;ARICA;LU;2026-01-15;1001;Juan Pérez;0;0;OFICINA;-18.4783;-70.3126;OF
AR;ARICA;LU;2026-01-15;1001;Juan Pérez;5;C001;MINIMARKET SOL;-18.4700;-70.3050;TI
AR;ARICA;LU;2026-01-15;1001;Juan Pérez;1000;0;OFICINA;-18.4783;-70.3126;OF
```

- `Sec.Visita`: 0=inicio (oficina), 1-999=clientes, 1000=fin (oficina)
- Separador: `;` (punto y coma)

### Paso 4: Datos OSRM

Colocar los archivos de mapa procesados de Chile en `osrm_data/`:
- `chile-latest.osrm` y archivos asociados (`.osrm.hsgr`, `.osrm.edges`, etc.)

### Paso 5: Iniciar con Docker

```powershell
# Windows
docker-compose up -d --build

# Verificar servicios
docker-compose ps
```

Resultado esperado:
```
NAME                    STATUS      PORTS
optimarutas-frontend    Up          0.0.0.0:3000->3000/tcp
optimarutas-backend     Up          0.0.0.0:8000->8000/tcp
optimarutas-osrm        Up          0.0.0.0:5000->5000/tcp
```

### Paso 6: Procesar Rutas (primera vez)

Desde la API docs del backend:
```
http://localhost:8000/docs
```

Ejecutar `POST /api/routes/calculate-routes` para generar los JSONs de rutas desde el Maestro APP.

---

## Uso

### Acceso

Abrir **http://localhost:3000** en el navegador.

### Flujo de Navegación

```
Login → Menú Principal
            ├── Optimiza Rutas → Dashboard → Vendedor → Mapa/Edición de Ruta
            ├── Cambios Masivos → Estructura Venta / Carteras / Dotación
            └── Admin (solo administradores) → Configuración del Sistema
```

### Menú Principal

Tras el login, el menú muestra los módulos disponibles según la configuración:
- **Optimiza Rutas**: si `app_activa = true` en config
- **Cambios Masivos**: si `cambios_masivos.app_activa = true` en config
- **Administración**: solo visible para cargo ADMINISTRADOR

### Optimiza Rutas

1. **Dashboard**: Ranking de vendedores con KM SAP vs Optimizado vs Validado
2. **Detalle Vendedor**: Todas las rutas por día con métricas
3. **Mapa Comparativo**: Vista lado a lado SAP (azul) vs Optimizada (verde)
4. **Edición de Ruta**: Drag & Drop para reordenar puntos, recálculo automático con OSRM
5. **PDF de Validación**: Genera documento con tabla de KM por día

### Cambios Masivos

1. **Estructura de Venta**: Carga Excel, edición inline, validación por zona
2. **Carteras**: Gestión de clientes asignados por jefe de venta
3. **Administrar Dotación**: Gestión de personal
4. Cada sub-módulo tiene su **instructivo PDF** descargable

### Panel de Administración

Configuración del sistema en tiempo real:
- Activar/desactivar módulos
- Programar automatización por fecha
- Ajustar umbral de holgura y factor de semanas
- Personalizar plantilla PDF
- Gestionar correos en copia
- Reset de contraseñas de usuarios

---

## API Endpoints

Todos los endpoints (excepto login y recover-password) requieren `Authorization: Bearer <token>`.

### Autenticación (`/api/auth`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/login` | Autenticar usuario, devuelve JWT + info |
| GET | `/me` | Obtener usuario actual |
| POST | `/change-password` | Cambiar contraseña |
| POST | `/logout` | Cerrar sesión (client-side) |
| POST | `/recover-password` | Recuperar contraseña por email |

### Usuarios (`/api/users`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/districts` | Distritos permitidos del usuario |
| POST | `/reset-password` | Reset de contraseña (solo admin) |

### Rutas (`/api/routes`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/calculate-routes` | Calcular rutas desde CSV (SSE stream) |
| POST | `/upload-routes` | Subir nuevo Maestro APP.csv |
| GET | `/ranking-vendedores` | Ranking con métricas de ahorro |
| GET | `/vendedor/{codigo}` | Detalle completo del vendedor |

### Configuración (`/api/config`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/PUT | `/umbral-porcentaje` | Porcentaje de holgura |
| GET/PUT | `/factor-semanas` | Factor de semanas (mensual) |
| GET/PUT | `/app-status` | Estado módulo Optimiza Rutas |
| GET/PUT | `/automatizacion` | Programación Optimiza Rutas |
| GET/PUT | `/plantilla-pdf` | Plantilla de PDF de validación |
| GET/PUT | `/correos-copia` | Emails CC por tipo |
| GET/PUT | `/cambios-masivos-status` | Estado módulo Cambios Masivos |
| GET/PUT | `/cambios-masivos-automatizacion` | Programación Cambios Masivos |

### Cambios Masivos (`/api/cambios-masivos`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Info del módulo y sub-módulos |

### Estructura de Venta (`/api/estructura-venta`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/status` | Estado de validación |
| GET | `/estado-validacion-zonas` | Validación por zona |
| GET | `/cargar` | Cargar datos de estructura |

### Carteras (`/api/carteras`)

Gestión de carteras de clientes por jefe de venta y zona.

### Instructivos (`/api/instructivo`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/exists?pantalla=X` | Verificar si existe instructivo |
| GET | `/download?pantalla=X` | Descargar instructivo |
| GET | `/view?pantalla=X` | Ver PDF inline |
| GET | `/list?pantalla=X` | Listar instructivos |
| POST | `/upload` | Subir instructivo (solo admin) |

Pantallas disponibles: `estructura-venta`, `carteras`, `administrar-dotacion`

### Documentación Interactiva

Swagger UI disponible en: `http://localhost:8000/docs`

---

## Cómo Funciona el Cálculo de Rutas

### Algoritmo TSP (Traveling Salesman Problem)

El sistema usa el TSP heurístico de OSRM:

```python
# Parámetros OSRM Trip
roundtrip=false         # No volver al inicio automáticamente
source=first           # Primer punto es inicio fijo (oficina)
destination=last       # Último punto es fin fijo (oficina)
overview=full          # Geometría completa
geometries=geojson     # Formato GeoJSON para Leaflet
```

### Proceso

1. **Carga**: Lee `Maestro APP.csv` con pandas, filtra por Distrito → Día → Vendedor
2. **Separación**: Punto inicio (Seq=0), clientes (1-999), punto fin (Seq=1000)
3. **Ruta Original**: OSRM `/route/v1/driving` manteniendo orden SAP
4. **Ruta Optimizada**: OSRM `/trip/v1/driving` reordena solo clientes intermedios
5. **Resultado**: JSONs por distrito con geometría GeoJSON, distancias y tiempos

### Limitaciones

- OSRM usa heurística: rápido y escalable, pero no garantiza solución óptima
- No determinista: mismos datos pueden dar resultados ligeramente diferentes

---

## Desarrollo

### Backend en local (sin Docker)

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend en local (sin Docker)

```bash
cd frontend
npm install
npm run dev
```

### Logs

```bash
docker-compose logs -f              # Todos
docker-compose logs -f backend      # Solo backend
docker-compose logs -f frontend     # Solo frontend
docker-compose logs -f osrm         # Solo OSRM
```

### Reconstruir

```bash
docker-compose down
docker-compose up -d --build
```

### Dependencias Principales

**Backend (Python):**
- fastapi >= 0.115, uvicorn, pydantic >= 2.10, pydantic-settings
- python-jose (JWT), passlib + bcrypt (passwords)
- pandas, openpyxl, numpy (datos Excel/CSV)
- reportlab (PDFs), requests, httpx (HTTP)
- polyline, geopy (geometría), pytz (timezone)

**Frontend (Node.js):**
- next 14, react 18, typescript 5
- axios (HTTP), leaflet + react-leaflet (mapas)
- @dnd-kit (drag & drop), xlsx (exportación Excel)
- js-cookie (cookies)

---

## Troubleshooting

### OSRM no responde

```bash
docker-compose logs osrm
docker-compose restart osrm
curl http://localhost:5000/health
```

### No se encuentran rutas

1. Verificar que existe `backend/data/rutas/Maestro APP.csv`
2. Ejecutar `POST /api/routes/calculate-routes`
3. Verificar JSONs en `backend/data/routes_json/`

### Puertos en uso

Cambiar en `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Usar puerto alternativo
```

### Datos OSRM corruptos

```bash
cd osrm_data
# Reemplazar archivos chile-latest.osrm* desde backup
```

---

## Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/NuevaFuncionalidad`)
3. Commit cambios (`git commit -m 'Add: NuevaFuncionalidad'`)
4. Push a la rama (`git push origin feature/NuevaFuncionalidad`)
5. Abrir Pull Request

### Convención de Commits

```
Add:      Nueva funcionalidad
Fix:      Corrección de bug
Update:   Actualización de código existente
Docs:     Cambios en documentación
Style:    Formateo, sin cambios de lógica
Refactor: Refactorización de código
Test:     Añadir tests
Chore:    Cambios en build, configs, etc.
```

---

## Licencia

Proyecto privado y confidencial para uso exclusivo de CIAL Alimentos.

---

## Soporte

- **Email**: contacto@cial.cl

---

## Agradecimientos

- [OSRM Project](http://project-osrm.org/) - Motor de routing
- [OpenStreetMap](https://www.openstreetmap.org/) - Datos de mapas
- [Next.js](https://nextjs.org/) - Framework React
- [FastAPI](https://fastapi.tiangolo.com/) - Framework Python
- [Leaflet](https://leafletjs.com/) - Biblioteca de mapas
- [ReportLab](https://www.reportlab.com/) - Generación de PDF

---

<div align="center">
  <strong>SistemaCial</strong> - Plataforma de Gestión Comercial CIAL Alimentos
  <br>
  <sub>Next.js 14 + FastAPI + OSRM + Docker</sub>
</div>
