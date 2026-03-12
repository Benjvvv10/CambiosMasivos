# Script para detener OptimizaRutas Docker
# Detiene y elimina todos los contenedores

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  OptimizaRutas - Detener Docker" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Navegar a la carpeta del proyecto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Preguntar si desea eliminar volúmenes
Write-Host "Opciones de detención:" -ForegroundColor Yellow
Write-Host "1. Detener contenedores (mantener datos)" -ForegroundColor White
Write-Host "2. Detener y eliminar volúmenes (ELIMINA DATOS)" -ForegroundColor Red
Write-Host ""
$opcion = Read-Host "Selecciona una opción (1/2)"

if ($opcion -eq "2") {
    Write-Host ""
    Write-Host "ADVERTENCIA: Esto eliminará todos los volúmenes de datos" -ForegroundColor Red
    $confirmar = Read-Host "Estás seguro? (s/n)"
    
    if ($confirmar -eq "s" -or $confirmar -eq "S") {
        Write-Host ""
        Write-Host "Deteniendo contenedores y eliminando volúmenes..." -ForegroundColor Yellow
        docker-compose down -v
    } else {
        Write-Host "Operación cancelada" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host ""
    Write-Host "Deteniendo contenedores..." -ForegroundColor Yellow
    docker-compose down
}

Write-Host ""
Write-Host "Contenedores detenidos correctamente" -ForegroundColor Green
Write-Host ""

# Mostrar contenedores activos
Write-Host "Contenedores activos:" -ForegroundColor Cyan
docker ps

Write-Host ""
