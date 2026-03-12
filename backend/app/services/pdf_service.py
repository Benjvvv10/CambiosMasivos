"""
Servicio para generación de PDFs de rutas validadas
"""

import json
import logging
import re
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from fastapi.responses import Response
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class PDFService:
    """Servicio para generar PDFs de rutas validadas"""
    
    def __init__(self):
        self.config_file_path = Path(__file__).parent.parent.parent / "data" / "config.json"
    
    def _cargar_configuracion(self):
        """Carga la configuración de PDF desde config.json"""
        umbral_porcentaje = 15  # Valor por defecto
        factor_semanas = 4.20  # Valor por defecto
        plantilla_pdf = {
            "titulo": "Reporte de Rutas Validadas",
            "texto_superior": "",
            "texto_inferior": "",
            "tamano_fuente_titulo": 16,
            "tamano_fuente_contenido": 11,
            "firma_izquierda": "",
            "firma_derecha": ""
        }
        
        if self.config_file_path.exists():
            try:
                with open(self.config_file_path, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                    umbral_porcentaje = config_data.get("umbral_porcentaje", 15)
                    factor_semanas = config_data.get("factor_semanas", 4.20)
                    if "plantilla_pdf" in config_data:
                        plantilla_pdf.update(config_data["plantilla_pdf"])
            except Exception as e:
                logger.warning(f"Error al cargar config desde config.json: {e}")
        
        return umbral_porcentaje, factor_semanas, plantilla_pdf
    
    def _procesar_formato_texto(self, texto: str) -> str:
        """
        Convierte marcadores de formato a HTML para el PDF.
        Soporta combinaciones como ***negrita y cursiva***
        
        Formatos soportados:
        - ***texto*** -> <b><i>texto</i></b>  (negrita + cursiva)
        - **texto** -> <b>texto</b>  (negrita)
        - __texto__ -> <u>texto</u>  (subrayado)
        - *texto*  -> <i>texto</i>   (cursiva)
        
        Preserva saltos de línea y espacios múltiples
        """
        
        # PRIMERO: Convertir espacios múltiples a &nbsp; para preservarlos en HTML
        # Esto debe hacerse ANTES de aplicar los formatos para que los espacios 
        # dentro de las etiquetas también se preserven
        def reemplazar_espacios(match):
            espacios = match.group(0)
            if len(espacios) > 1:
                # Primer espacio normal, resto como &nbsp;
                return ' ' + '&nbsp;' * (len(espacios) - 1)
            return espacios
        
        texto = re.sub(r' {2,}', reemplazar_espacios, texto)
        
        # LUEGO: Aplicar formatos
        # Primero procesar combinación negrita + cursiva (***texto***)
        # IMPORTANTE: Debe procesarse ANTES que ** y * individuales
        texto = re.sub(r'\*\*\*([\s\S]+?)\*\*\*', r'<b><i>\1</i></b>', texto, flags=re.DOTALL)
        
        # Luego procesar negrita (**texto**) - debe ir antes que cursiva
        texto = re.sub(r'\*\*([\s\S]+?)\*\*', r'<b>\1</b>', texto, flags=re.DOTALL)
        
        # Procesar subrayado (__texto__)
        texto = re.sub(r'__([\s\S]+?)__', r'<u>\1</u>', texto, flags=re.DOTALL)
        
        # Finalmente cursiva (*texto*) - debe ir después de negrita
        texto = re.sub(r'\*([\s\S]+?)\*', r'<i>\1</i>', texto, flags=re.DOTALL)
        
        return texto
    
    def _reemplazar_variables(
        self, 
        texto: str, 
        vendedor_nombre: str,
        cod_vendedor: str,
        distrito_nombre: str,
        jefe_venta: str,
        km_validado_total: float,
        km_sap_total: float,
        km_optimizado_total: float,
        km_holgura_total: float,
        km_ruta_total: float,
        km_diferencia_total: float,
        umbral_porcentaje: int,
        factor_semanas: float,
        ruta_data=None
    ) -> str:
        """Reemplaza las variables en el texto con valores reales"""
        texto = texto.replace("[NOMBRE_VENDEDOR]", vendedor_nombre)
        texto = texto.replace("[CODIGO_VENDEDOR]", str(cod_vendedor))
        texto = texto.replace("[KM_VALIDADO_TOTAL]", f"{km_validado_total:.2f}")
        texto = texto.replace("[DISTRITO]", distrito_nombre)
        texto = texto.replace("[JEFE_VENTA]", jefe_venta)
        
        # Variables globales de totales
        texto = texto.replace("[KM_SAP]", f"{km_sap_total:.2f}")
        texto = texto.replace("[KM_OPTIMIZADO]", f"{km_optimizado_total:.2f}")
        texto = texto.replace("[KM_VALIDADO]", f"{km_validado_total:.2f}")
        texto = texto.replace("[KM_HOLGURA]", f"{km_holgura_total:.2f}")
        texto = texto.replace("[KM_DIFERENCIA]", f"{km_diferencia_total:.2f}")
        texto = texto.replace("[KM_RUTA]", f"{km_ruta_total:.2f}")
        texto = texto.replace("[PORCENTAJE_HOLGURA]", f"{umbral_porcentaje}%")
        texto = texto.replace("[FACTOR_SEMANAS]", f"{factor_semanas:.2f}")
        
        # Calcular KM_MES (KM_VALIDADO * FACTOR_SEMANAS)
        km_mes = km_validado_total * factor_semanas
        texto = texto.replace("[KM_MES]", f"{km_mes:.2f}")
        
        # Fecha y hora con timezone de Chile
        ahora = datetime.now(ZoneInfo("America/Santiago"))
        texto = texto.replace("[FECHA]", ahora.strftime("%d/%m/%Y"))
        texto = texto.replace("[HORA]", ahora.strftime("%H:%M:%S"))
        texto = texto.replace("[FECHA_ACTUAL]", ahora.strftime("%d/%m/%Y %H:%M:%S"))
        texto = texto.replace("[HORA_ACTUAL]", ahora.strftime("%H:%M:%S"))
        texto = texto.replace("[ANIO_ACTUAL]", ahora.strftime("%Y"))
        texto = texto.replace("[MES_ACTUAL]", ahora.strftime("%m"))
        texto = texto.replace("[DIA_ACTUAL]", ahora.strftime("%d"))
        
        # Variables específicas de ruta (si se proporciona ruta_data)
        if ruta_data:
            total_puntos = ruta_data.get('total_puntos', 0)
            clientes = total_puntos - 2 if total_puntos > 2 else 0
            
            texto = texto.replace("[DIA]", ruta_data.get('dia', ''))
            texto = texto.replace("[CLIENTES]", str(clientes))
        
        return texto
    
    def _obtener_jefe_venta(self, usuario_actual: str) -> str:
        """Retorna el nombre del usuario actual como jefe de venta"""
        return usuario_actual if usuario_actual else "N/A"
    
    def generar_pdf_vendedor(
        self,
        distrito: str,
        cod_vendedor: str,
        nombre_usuario: str = None
    ) -> Response:
        """
        Genera un PDF con las rutas guardadas de un vendedor.
        
        Args:
            distrito: Código del distrito
            cod_vendedor: Código del vendedor
            nombre_usuario: Nombre del usuario actual
            
        Returns:
            Response con el PDF generado
        """
        try:
            # Cargar configuración
            umbral_porcentaje, factor_semanas, plantilla_pdf = self._cargar_configuracion()
            
            # Rutas de archivos
            distrito_dir = Path(f"data/routes_json/{distrito}")
            guardado_path = distrito_dir / "ruta_guardada.json"
            original_path = distrito_dir / "ruta_original.json"
            optimizada_path = distrito_dir / "ruta_optimizada.json"
            
            if not guardado_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"No hay rutas guardadas para el distrito {distrito}"
                )
            
            # Cargar archivos
            with open(guardado_path, 'r', encoding='utf-8') as f:
                data_guardada = json.load(f)
            
            # Cargar rutas originales para obtener km_sap
            data_original = {}
            if original_path.exists():
                with open(original_path, 'r', encoding='utf-8') as f:
                    data_original = json.load(f)
            
            # Cargar rutas optimizadas
            data_optimizada = {}
            if optimizada_path.exists():
                with open(optimizada_path, 'r', encoding='utf-8') as f:
                    data_optimizada = json.load(f)
            
            # Construir diccionarios de km_sap y km_optimizado por vendedor y día
            km_sap_dict = {}
            km_opt_dict = {}
            
            # Procesar rutas originales
            for ruta in data_original.get("rutas_por_dia", []):
                vendedor = ruta.get("vendedor", {})
                cod_vend = str(vendedor.get("codigo", ""))
                dia = ruta.get("dia", "")
                km_sap = ruta.get("distancia_km", 0)
                key = f"{cod_vend}_{dia}"
                km_sap_dict[key] = km_sap
            
            # Procesar rutas optimizadas
            for ruta in data_optimizada.get("rutas_optimizadas", []):
                vendedor = ruta.get("vendedor", {})
                cod_vend = str(vendedor.get("codigo", ""))
                dia = ruta.get("dia", "")
                km_opt = ruta.get("distancia_km", 0)
                key = f"{cod_vend}_{dia}"
                km_opt_dict[key] = km_opt
            
            # Buscar rutas del vendedor
            rutas_vendedor = []
            vendedor_nombre = ""
            distrito_nombre = data_guardada.get("distrito", distrito)
            
            # Totales
            km_validado_total = 0
            km_sap_total = 0
            km_optimizado_total = 0
            km_holgura_total = 0
            km_ruta_total = 0
            
            # Obtener el jefe de venta (usuario actual)
            jefe_venta = self._obtener_jefe_venta(nombre_usuario)
            
            for ruta in data_guardada.get("rutas", []):
                vendedor_info = ruta.get("vendedor", {})
                if str(vendedor_info.get("codigo")) == str(cod_vendedor):
                    dia = ruta.get("dia", "")
                    key = f"{cod_vendedor}_{dia}"
                    
                    # Agregar km_sap y km_optimizado desde los diccionarios
                    ruta["km_sap"] = km_sap_dict.get(key, 0)
                    ruta["km_optimizado"] = km_opt_dict.get(key, 0)
                    
                    rutas_vendedor.append(ruta)
                    km_validado_total += ruta.get("km_validado", 0)
                    km_sap_total += ruta.get("km_sap", 0)
                    km_optimizado_total += ruta.get("km_optimizado", 0)
                    km_holgura_total += ruta.get("km_holgura", 0)
                    km_ruta_total += ruta.get("distancia_km", 0)
                    if not vendedor_nombre:
                        vendedor_nombre = vendedor_info.get("nombre", "")
            
            # Calcular diferencia total
            km_diferencia_total = km_validado_total - km_sap_total
            
            if not rutas_vendedor:
                raise HTTPException(
                    status_code=404,
                    detail=f"No se encontraron rutas guardadas para el vendedor {cod_vendedor}"
                )
            
            # Crear buffer para el PDF
            buffer = BytesIO()
            
            # Crear documento PDF
            doc = SimpleDocTemplate(
                buffer, 
                pagesize=A4, 
                rightMargin=30, 
                leftMargin=30, 
                topMargin=30, 
                bottomMargin=30
            )
            
            # Contenedor para elementos del PDF
            elements = []
            
            # Estilos
            styles = getSampleStyleSheet()
            
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=plantilla_pdf["tamano_fuente_titulo"],
                textColor=colors.black,
                spaceAfter=10,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold'
            )
            
            subtitle_style = ParagraphStyle(
                'CustomSubtitle',
                parent=styles['Normal'],
                fontSize=plantilla_pdf["tamano_fuente_contenido"],
                textColor=colors.black,
                spaceAfter=6,
                alignment=TA_LEFT,
                fontName='Helvetica',
                preserveWhitespace=True  # Preservar espacios en blanco
            )
            
            # Título con soporte de formato
            titulo_procesado = self._reemplazar_variables(
                plantilla_pdf["titulo"],
                vendedor_nombre, cod_vendedor, distrito_nombre, jefe_venta,
                km_validado_total, km_sap_total, km_optimizado_total,
                km_holgura_total, km_ruta_total, km_diferencia_total, umbral_porcentaje, factor_semanas
            )
            titulo_procesado = self._procesar_formato_texto(titulo_procesado)
            elements.append(Paragraph(titulo_procesado, title_style))
            
            # Texto superior (antes de la tabla)
            if plantilla_pdf.get("texto_superior", ""):
                texto_sup = self._reemplazar_variables(
                    plantilla_pdf["texto_superior"],
                    vendedor_nombre, cod_vendedor, distrito_nombre, jefe_venta,
                    km_validado_total, km_sap_total, km_optimizado_total,
                    km_holgura_total, km_ruta_total, km_diferencia_total, umbral_porcentaje, factor_semanas
                )
                texto_sup = self._procesar_formato_texto(texto_sup)
                # Convertir saltos de línea a <br/> pero preservar múltiples saltos
                # Convertir \n\n en <br/><br/> para preservar espaciado
                texto_sup = texto_sup.replace("\n", "<br/>")
                elements.append(Paragraph(texto_sup, subtitle_style))
            
            elements.append(Spacer(1, 15))
            
            # Ordenar rutas por día
            dias_orden = {'LU': 1, 'MA': 2, 'MI': 3, 'JU': 4, 'VI': 5, 'SA': 6, 'DO': 7}
            rutas_vendedor.sort(key=lambda x: dias_orden.get(x.get('dia', ''), 999))
            
            # Crear tabla de rutas
            data = [['Día', 'Clientes', 'KM Ruta', f'KM Holgura (+{umbral_porcentaje}%)', 'KM Validado']]
            
            for ruta in rutas_vendedor:
                total_puntos = ruta.get('total_puntos', 0)
                clientes = total_puntos - 2 if total_puntos > 2 else 0
                
                km_ruta = ruta.get('distancia_km', 0)
                km_holgura = ruta.get('km_holgura', 0)
                km_validado = ruta.get('km_validado', 0)
                
                data.append([
                    ruta.get('dia', ''),
                    str(clientes),
                    f"{km_ruta:.2f}",
                    f"{km_holgura:.2f}",
                    f"{km_validado:.2f}"
                ])
            
            # Crear tabla con estilo
            table = Table(data, colWidths=[0.8*inch, 1.0*inch, 1.2*inch, 1.8*inch, 1.3*inch])
            
            # Estilo de la tabla
            table.setStyle(TableStyle([
                # Header
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d7a3e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                # Body
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('TOPPADDING', (0, 1), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ]))
            
            elements.append(table)
            
            # Texto inferior (después de la tabla)
            if plantilla_pdf.get("texto_inferior", ""):
                elements.append(Spacer(1, 15))
                texto_inf = self._reemplazar_variables(
                    plantilla_pdf["texto_inferior"],
                    vendedor_nombre, cod_vendedor, distrito_nombre, jefe_venta,
                    km_validado_total, km_sap_total, km_optimizado_total,
                    km_holgura_total, km_ruta_total, km_diferencia_total, umbral_porcentaje, factor_semanas
                )
                texto_inf = self._procesar_formato_texto(texto_inf)
                # Preservar múltiples saltos de línea
                texto_inf = texto_inf.replace("\n", "<br/>")
                elements.append(Paragraph(texto_inf, subtitle_style))
            
            # Agregar líneas de firma si están configuradas
            firma_izquierda = self._reemplazar_variables(
                plantilla_pdf.get('firma_izquierda', ''),
                vendedor_nombre, cod_vendedor, distrito_nombre, jefe_venta,
                km_validado_total, km_sap_total, km_optimizado_total,
                km_holgura_total, km_ruta_total, km_diferencia_total, umbral_porcentaje, factor_semanas
            )
            firma_izquierda = self._procesar_formato_texto(firma_izquierda)
            
            firma_derecha = self._reemplazar_variables(
                plantilla_pdf.get('firma_derecha', ''),
                vendedor_nombre, cod_vendedor, distrito_nombre, jefe_venta,
                km_validado_total, km_sap_total, km_optimizado_total,
                km_holgura_total, km_ruta_total, km_diferencia_total, umbral_porcentaje, factor_semanas
            )
            firma_derecha = self._procesar_formato_texto(firma_derecha)
            
            if firma_izquierda or firma_derecha:
                # Espaciador antes de las firmas
                elements.append(Spacer(1, 1.5*inch))
                
                # Crear tabla para las líneas de firma
                firma_data = []
                
                # Si hay al menos una firma, crear la estructura
                if firma_izquierda or firma_derecha:
                    # Estilo para texto de firma
                    firma_text_style = ParagraphStyle(
                        'FirmaText',
                        parent=styles['Normal'],
                        fontSize=10,
                        textColor=colors.HexColor('#666666'),
                        alignment=1,  # CENTER
                        fontName='Helvetica',
                        preserveWhitespace=True
                    )
                    
                    # Fila con las líneas
                    firma_data.append([
                        '_' * 30 if firma_izquierda else '',
                        '_' * 30 if firma_derecha else ''
                    ])
                    
                    # Fila con los textos (usando Paragraph para soportar formato HTML)
                    firma_data.append([
                        Paragraph(firma_izquierda.replace("\n", "<br/>"), firma_text_style) if firma_izquierda else '',
                        Paragraph(firma_derecha.replace("\n", "<br/>"), firma_text_style) if firma_derecha else ''
                    ])
                    
                    # Crear tabla de firmas
                    if firma_izquierda and firma_derecha:
                        firma_table = Table(firma_data, colWidths=[3.5*inch, 3.5*inch])
                    elif firma_izquierda:
                        firma_table = Table([[firma_data[0][0]], [firma_data[1][0]]], colWidths=[3.5*inch])
                    else:
                        firma_table = Table([[firma_data[0][1]], [firma_data[1][1]]], colWidths=[3.5*inch])
                    
                    # Estilo de la tabla de firmas
                    firma_style = TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('TOPPADDING', (0, 1), (-1, 1), 8),
                    ])
                    
                    firma_table.setStyle(firma_style)
                    elements.append(firma_table)
            
            # Generar PDF
            doc.build(elements)
            
            # Obtener contenido del buffer
            buffer.seek(0)
            
            return Response(
                content=buffer.getvalue(),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={cod_vendedor}.pdf"
                }
            )
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error generando PDF: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al generar PDF: {str(e)}"
            )


# Instancia global del servicio
pdf_service = PDFService()
