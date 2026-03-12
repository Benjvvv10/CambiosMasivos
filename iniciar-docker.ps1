# Script para iniciar OptimizaRutas con Docker
# Construye e inicia todos los servicios (OSRM, Backend, Frontend)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  OptimizaRutas - Inicio con Docker" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Docker está instalado
Write-Host "Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "Docker encontrado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host "Por favor instala Docker Desktop desde: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Verificar que Docker está corriendo
Write-Host "Verificando que Docker esté corriendo..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "Docker está corriendo correctamente" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker no está corriendo" -ForegroundColor Red
    Write-Host "Por favor inicia Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# Navegar a la carpeta del proyecto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Verificar archivo .env
Write-Host ""
Write-Host "Verificando configuración..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "Creando archivo .env desde .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "IMPORTANTE: Edita el archivo .env con tus configuraciones antes de usar en producción" -ForegroundColor Red
}

# Verificar archivo de usuarios
Write-Host ""
Write-Host "Verificando archivos de datos..." -ForegroundColor Yellow

$datosOk = $true

if (-not (Test-Path "backend\data\usuarios_sistema.xlsx")) {
    Write-Host "ADVERTENCIA: No se encontró el archivo de usuarios" -ForegroundColor Red
    Write-Host "Ruta esperada: backend\data\usuarios_sistema.xlsx" -ForegroundColor Yellow
    $datosOk = $false
}

if (-not (Test-Path "osrm_data\chile-latest.osrm")) {
    Write-Host "ADVERTENCIA: No se encontraron los datos OSRM" -ForegroundColor Red
    Write-Host "Ruta esperada: osrm_data\chile-latest.osrm" -ForegroundColor Yellow
    $datosOk = $false
}

if (-not $datosOk) {
    $continue = Read-Host "Faltan archivos de datos. Deseas continuar de todas formas? (s/n)"
    if ($continue -ne "s" -and $continue -ne "S") {
        Write-Host "Instalación cancelada" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Todos los archivos de datos encontrados" -ForegroundColor Green
}

# Detener contenedores existentes
Write-Host ""
Write-Host "Deteniendo contenedores existentes..." -ForegroundColor Yellow
docker-compose down 2>$null

# Construir imágenes
Write-Host ""
Write-Host "Construyendo imágenes Docker..." -ForegroundColor Green
Write-Host "Esto puede tardar varios minutos la primera vez..." -ForegroundColor Yellow
docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Falló la construcción de las imágenes" -ForegroundColor Red
    exit 1
}

# Iniciar servicios
Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Green
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Falló el inicio de los servicios" -ForegroundColor Red
    exit 1
}

# Esperar a que los servicios estén listos
Write-Host ""
Write-Host "Esperando a que los servicios estén listos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar estado de los contenedores
Write-Host ""
Write-Host "Estado de los servicios:" -ForegroundColor Cyan
docker-compose ps

# Mostrar logs iniciales
Write-Host ""
Write-Host "Logs de inicio (presiona Ctrl+C para salir de los logs):" -ForegroundColor Yellow
Write-Host ""

# Resumen
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  OptimizaRutas Iniciado" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Servicios disponibles:" -ForegroundColor Green
Write-Host "  Frontend:       http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API:    http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:       http://localhost:8000/docs" -ForegroundColor White
Write-Host "  OSRM Server:    http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Yellow
Write-Host "  Ver logs:       docker-compose logs -f" -ForegroundColor White
Write-Host "  Detener:        docker-compose down" -ForegroundColor White
Write-Host "  Reiniciar:      docker-compose restart" -ForegroundColor White
Write-Host "  Ver estado:     docker-compose ps" -ForegroundColor White
Write-Host ""

# Preguntar si desea ver logs
$verLogs = Read-Host "Deseas ver los logs en tiempo real? (s/n)"
if ($verLogs -eq "s" -or $verLogs -eq "S") {
    docker-compose logs -f
}
