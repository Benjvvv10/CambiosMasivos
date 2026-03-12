"""
Servicio de Automatización de la Aplicación
Gestiona la activación/desactivación automática según horarios configurados
"""

import asyncio
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

# Ruta del archivo de configuración
CONFIG_FILE = "data/config.json"

class AutomationService:
    """Servicio para gestionar la automatización de la aplicación"""
    
    def __init__(self):
        self.running = False
        self.task = None
        self.timezone = ZoneInfo("America/Santiago")  # Hora de Chile
    
    def load_config(self):
        """Cargar configuración desde archivo JSON"""
        if not os.path.exists(CONFIG_FILE):
            return None
        
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error al cargar configuración para automatización: {e}")
            return None
    
    def save_config(self, config):
        """Guardar configuración en archivo JSON"""
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error al guardar configuración para automatización: {e}")
            return False
    
    def check_and_update_app_status(self):
        """Verificar y actualizar el estado de las apps según la configuración de automatización"""
        config = self.load_config()
        if not config:
            print("[AUTOMATIZACIÓN] No se pudo cargar configuración")
            return
        
        # ========== OPTIMIZA RUTAS ==========
        auto_config = config.get("automatizacion", {})
        
        if auto_config.get("activa", False):
            self._check_module(config, "Optimiza Rutas", auto_config, "app_activa")
        
        # ========== CAMBIOS MASIVOS ==========
        cambios_config = config.get("cambios_masivos", {})
        auto_cambios = cambios_config.get("automatizacion", {})
        
        if auto_cambios.get("activa", False):
            self._check_module(config, "Cambios Masivos", auto_cambios, "cambios_masivos", "app_activa")
    
    def _check_module(self, config: dict, module_name: str, auto_config: dict, *path_keys):
        """Verificar y actualizar el estado de un módulo específico"""
        fecha_inicio_str = auto_config.get("fecha_hora_inicio", "")
        fecha_fin_str = auto_config.get("fecha_hora_fin", "")
        
        if not fecha_inicio_str or not fecha_fin_str:
            print(f"[{module_name}] Fechas no configuradas: inicio={fecha_inicio_str}, fin={fecha_fin_str}")
            return
        
        try:
            # Normalizar formato
            fecha_inicio_normalizada = fecha_inicio_str.replace('T', ' ').replace(' PM', '').replace(' AM', '')
            fecha_fin_normalizada = fecha_fin_str.replace('T', ' ').replace(' PM', '').replace(' AM', '')
            
            print(f"\n[{module_name}] Verificando automatización:")
            print(f"  Inicio: '{fecha_inicio_normalizada}'")
            print(f"  Fin: '{fecha_fin_normalizada}'")
            
            # Parsear fechas
            fecha_inicio = None
            fecha_fin = None
            
            # Formato 1: YYYY-MM-DD HH:MM
            try:
                fecha_inicio = datetime.strptime(fecha_inicio_normalizada, "%Y-%m-%d %H:%M").replace(tzinfo=self.timezone)
                fecha_fin = datetime.strptime(fecha_fin_normalizada, "%Y-%m-%d %H:%M").replace(tzinfo=self.timezone)
            except ValueError:
                pass
            
            # Formato 2: MM/DD/YYYY HH:MM
            if not fecha_inicio:
                try:
                    fecha_inicio = datetime.strptime(fecha_inicio_normalizada, "%m/%d/%Y %H:%M").replace(tzinfo=self.timezone)
                    fecha_fin = datetime.strptime(fecha_fin_normalizada, "%m/%d/%Y %H:%M").replace(tzinfo=self.timezone)
                except ValueError:
                    pass
            
            if not fecha_inicio or not fecha_fin:
                print(f"[{module_name}] ERROR: No se pudo parsear las fechas")
                return
            
            # Obtener hora actual
            ahora = datetime.now(self.timezone)
            
            print(f"  Ahora:   {ahora.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"  Inicio:  {fecha_inicio.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"  Fin:     {fecha_fin.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Determinar si debe estar activa
            debe_estar_activa = fecha_inicio <= ahora <= fecha_fin
            
            # Navegar a la ubicación del estado actual
            current = config
            for key in path_keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]
            
            # Obtener estado actual
            app_activa_actual = current.get(path_keys[-1], True)
            
            print(f"  Debe estar activa: {debe_estar_activa}, Estado actual: {app_activa_actual}")
            
            # Si el estado cambió, actualizar
            if debe_estar_activa != app_activa_actual:
                current[path_keys[-1]] = debe_estar_activa
                self.save_config(config)
                
                estado = "✅ ACTIVADA" if debe_estar_activa else "🔴 DESACTIVADA"
                print(f"[{module_name}] {estado} automáticamente a las {ahora.strftime('%Y-%m-%d %H:%M:%S')}")
            else:
                print(f"[{module_name}] Sin cambios - {'activa' if app_activa_actual else 'inactiva'}")
            
            # Si pasó la fecha de fin, desactivar automatización
            if ahora > fecha_fin:
                print(f"[{module_name}] ⏰ Horario finalizado, desactivando automatización...")
                auto_config["activa"] = False
                
                # Actualizar la ubicación correcta de la automatización
                if len(path_keys) > 1:
                    # Es cambios masivos
                    config["cambios_masivos"]["automatizacion"] = auto_config
                else:
                    # Es optimiza rutas
                    config["automatizacion"] = auto_config
                
                self.save_config(config)
        
        except Exception as e:
            import traceback
            print(f"[{module_name}] ERROR: {e}")
            traceback.print_exc()
    
    async def automation_loop(self):
        """Loop principal de automatización que se ejecuta cada minuto"""
        print("[AUTOMATIZACIÓN] 🚀 Servicio de automatización iniciado")
        print(f"[AUTOMATIZACIÓN] Timezone configurado: {self.timezone}")
        
        while self.running:
            try:
                print(f"\n[AUTOMATIZACIÓN] 🔄 Verificación periódica - {datetime.now(self.timezone).strftime('%Y-%m-%d %H:%M:%S')}")
                self.check_and_update_app_status()
            except Exception as e:
                import traceback
                print(f"[AUTOMATIZACIÓN ERROR] Error en loop: {e}")
                traceback.print_exc()
            
            # Esperar 60 segundos antes de la próxima verificación
            print(f"[AUTOMATIZACIÓN] ⏳ Esperando 60 segundos...")
            await asyncio.sleep(60)
    
    async def start(self):
        """Iniciar el servicio de automatización"""
        if self.running:
            return
        
        # Verificar si alguna automatización está activa antes de iniciar
        config = self.load_config()
        if config:
            auto_optimiza = config.get("automatizacion", {})
            cambios_config = config.get("cambios_masivos", {})
            auto_cambios = cambios_config.get("automatizacion", {})
            
            if not auto_optimiza.get("activa", False) and not auto_cambios.get("activa", False):
                print("[AUTOMATIZACIÓN] Ninguna automatización activa, servicio no iniciado")
                return
        
        self.running = True
        self.task = asyncio.create_task(self.automation_loop())
        print("[AUTOMATIZACIÓN] ✅ Servicio iniciado correctamente")
    
    async def stop(self):
        """Detener el servicio de automatización"""
        if not self.running:
            return
        
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        print("[AUTOMATIZACIÓN] Servicio detenido")

# Instancia global del servicio
automation_service = AutomationService()
