"""
Servicio de envío de correos electrónicos
Maneja envío de correos con SMTP (Gmail)
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from app.config import settings
from datetime import datetime
from pathlib import Path
import pytz
import json
import os

class EmailService:
    """Servicio para envío de correos"""
    
    def __init__(self):
        """Inicializar servicio de email"""
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.email_sender = settings.EMAIL_SENDER
        self.email_password = settings.EMAIL_PASSWORD
        self.config_file_path = Path(__file__).parent.parent.parent / "data" / "config.json"
    
    def _load_config(self) -> dict:
        """Cargar configuración desde config.json"""
        try:
            if self.config_file_path.exists():
                with open(self.config_file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"⚠️ Error al cargar config.json: {e}")
        return {}
    
    def _get_cc_emails(self, tipo: str) -> list[str]:
        """
        Obtener lista de correos para copia según el tipo
        
        Args:
            tipo: Tipo de correo ('recuperacion_password' o 'validacion_pdf')
            
        Returns:
            Lista de correos electrónicos
        """
        config = self._load_config()
        correos_copia = config.get('correos_copia', {})
        cc_emails = correos_copia.get(tipo, [])
        
        # Filtrar correos vacíos y validar formato básico
        return [email.strip() for email in cc_emails if email and '@' in email]
    
    def send_email(self, destinatario: str, asunto: str, cuerpo_html: str) -> tuple[bool, str]:
        """
        Enviar correo electrónico usando SMTP
        
        Args:
            destinatario: Email del destinatario
            asunto: Asunto del correo
            cuerpo_html: Contenido del correo en formato HTML
            
        Returns:
            Tupla (éxito, mensaje_error)
        """
        # Verificar credenciales
        if not self.email_sender or not self.email_password:
            return False, "Credenciales de correo no configuradas"
        
        try:
            # Crear mensaje
            mensaje = MIMEMultipart('alternative')
            mensaje['From'] = f"Sistema CIAL <{self.email_sender}>"
            mensaje['To'] = destinatario
            mensaje['Subject'] = asunto
            
            # Agregar cuerpo HTML
            parte_html = MIMEText(cuerpo_html, 'html', 'utf-8')
            mensaje.attach(parte_html)
            
            # Conectar al servidor SMTP
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as servidor:
                servidor.starttls()  # Habilitar seguridad TLS
                servidor.login(self.email_sender, self.email_password)
                servidor.send_message(mensaje)
            
            print(f"✅ Correo enviado exitosamente a {destinatario}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError as e:
            msg = f"Error de autenticación SMTP: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
        except smtplib.SMTPException as e:
            msg = f"Error SMTP: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
        except Exception as e:
            msg = f"Error inesperado: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
    
    def _send_email_with_cc(
        self, 
        destinatario: str, 
        asunto: str, 
        cuerpo_html: str,
        cc_emails: list[str]
    ) -> tuple[bool, str]:
        """
        Enviar correo electrónico con copias (CC) usando SMTP
        
        Args:
            destinatario: Email del destinatario principal
            asunto: Asunto del correo
            cuerpo_html: Contenido del correo en formato HTML
            cc_emails: Lista de correos para copia
            
        Returns:
            Tupla (éxito, mensaje_error)
        """
        # Verificar credenciales
        if not self.email_sender or not self.email_password:
            return False, "Credenciales de correo no configuradas"
        
        # Eliminar destinatario principal de la lista de CC para evitar duplicados
        cc_emails_filtrados = [email for email in cc_emails if email.lower() != destinatario.lower()]
        
        # Si no quedan correos en CC después de filtrar, usar envío simple
        if not cc_emails_filtrados:
            return self.send_email(destinatario, asunto, cuerpo_html)
        
        try:
            # Crear mensaje
            mensaje = MIMEMultipart('alternative')
            mensaje['From'] = f"Sistema CIAL <{self.email_sender}>"
            mensaje['To'] = destinatario
            mensaje['Subject'] = asunto
            
            # Agregar CC
            mensaje['Cc'] = ', '.join(cc_emails_filtrados)
            
            # Agregar cuerpo HTML
            parte_html = MIMEText(cuerpo_html, 'html', 'utf-8')
            mensaje.attach(parte_html)
            
            # Preparar lista de todos los destinatarios
            todos_destinatarios = [destinatario] + cc_emails_filtrados
            
            # Conectar al servidor SMTP
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as servidor:
                servidor.starttls()
                servidor.login(self.email_sender, self.email_password)
                servidor.send_message(mensaje)
            
            cc_info = f" (copia a: {', '.join(cc_emails_filtrados)})"
            print(f"✅ Correo enviado exitosamente a {destinatario}{cc_info}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError as e:
            msg = f"Error de autenticación SMTP: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
        except smtplib.SMTPException as e:
            msg = f"Error SMTP: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
        except Exception as e:
            msg = f"Error inesperado: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
    
    def send_password_recovery_email(
        self, 
        usuario: str, 
        nombre: str, 
        email: str, 
        password_temporal: str
    ) -> tuple[bool, str]:
        """
        Enviar correo de recuperación de contraseña
        
        Args:
            usuario: Nombre de usuario
            nombre: Nombre completo
            email: Correo electrónico
            password_temporal: Contraseña temporal generada
            
        Returns:
            Tupla (éxito, mensaje_error)
        """
        asunto = "Recuperación de Contraseña - Sistema CIAL"
        # Obtener hora de Chile
        chile_tz = pytz.timezone('America/Santiago')
        fecha_hora = datetime.now(chile_tz).strftime('%d/%m/%Y a las %H:%M:%S')
        
        cuerpo_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #2d7a3e; border-bottom: 2px solid #2d7a3e; padding-bottom: 10px;">
                        Recuperación de Contraseña
                    </h2>
                    
                    <div style="margin: 20px 0;">
                        <p style="font-size: 16px; color: #333;">Hola <strong>{nombre}</strong>,</p>
                        
                        <p style="font-size: 15px; color: #333;">
                            Hemos recibido tu solicitud de recuperación de contraseña para el Sistema CIAL.
                        </p>
                        
                        <div style="background-color: #e8f5ea; border-left: 4px solid #2d7a3e; padding: 20px; margin: 20px 0; border-radius: 5px;">
                            <p style="margin: 0 0 10px 0; color: #333; font-size: 14px;"><strong>Tus datos de acceso:</strong></p>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px; color: #555; font-weight: bold;">Usuario:</td>
                                    <td style="padding: 8px; color: #333; font-family: monospace; background-color: #f5f5f5; border-radius: 4px;">{usuario}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px; color: #555; font-weight: bold;">Contraseña temporal:</td>
                                    <td style="padding: 8px; color: #333; font-family: monospace; background-color: #f5f5f5; border-radius: 4px; font-weight: bold; font-size: 16px;">{password_temporal}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                <strong>Importante:</strong><br>
                                Esta es una contraseña <strong>temporal</strong><br>
                                Al iniciar sesión, el sistema te pedirá que cambies tu contraseña<br>
                                Por seguridad, elige una contraseña diferente y segura<br>
                                No compartas esta contraseña con nadie
                            </p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 20px;">
                            Si no solicitaste este cambio, por favor contacta al administrador de inmediato.
                        </p>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <div style="text-align: center;">
                        <p style="margin: 5px 0; font-size: 14px; color: #333; font-weight: bold;">Sistema CIAL</p>
                        <p style="margin: 5px 0; font-size: 13px; color: #666;">CIAL Alimentos</p>
                        <p style="margin: 15px 0 0 0; font-size: 11px; color: #999;">
                            Este es un correo automático, por favor no responder<br>
                            Generado el {fecha_hora}
                        </p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        # Obtener correos de copia desde configuración
        cc_emails = self._get_cc_emails('recuperacion_password')
        
        # Eliminar el destinatario de la lista de CC si está presente (evitar duplicados)
        cc_emails = [cc for cc in cc_emails if cc.lower() != email.lower()]
        
        # Si hay correos en copia, usar send_email_with_cc
        if cc_emails:
            return self._send_email_with_cc(email, asunto, cuerpo_html, cc_emails)
        
        return self.send_email(email, asunto, cuerpo_html)
    
    def send_pdf_email(
        self,
        destinatario: str,
        asunto: str,
        cuerpo_html: str,
        pdf_content: bytes,
        pdf_filename: str,
        cc_email: str = None
    ) -> tuple[bool, str]:
        """
        Enviar correo electrónico con PDF adjunto usando SMTP
        
        Args:
            destinatario: Email del destinatario principal
            asunto: Asunto del correo
            cuerpo_html: Contenido del correo en formato HTML
            pdf_content: Contenido del PDF en bytes
            pdf_filename: Nombre del archivo PDF
            cc_email: Email para enviar copia (opcional)
            
        Returns:
            Tupla (éxito, mensaje_error)
        """
        # Verificar credenciales
        if not self.email_sender or not self.email_password:
            return False, "Credenciales de correo no configuradas"
        
        # Obtener correos de copia desde configuración
        cc_emails_config = self._get_cc_emails('validacion_pdf')
        
        # Combinar con cc_email del parámetro si existe
        all_cc_emails = list(cc_emails_config)
        if cc_email:
            all_cc_emails.append(cc_email)
        
        # Eliminar duplicados (mismo correo múltiples veces)
        all_cc_emails = list(dict.fromkeys(all_cc_emails))
        
        # Eliminar destinatario principal para evitar que le llegue doble
        all_cc_emails = [email for email in all_cc_emails if email.lower() != destinatario.lower()]
        
        try:
            # Crear mensaje
            mensaje = MIMEMultipart('mixed')
            mensaje['From'] = f"Sistema CIAL <{self.email_sender}>"
            mensaje['To'] = destinatario
            mensaje['Subject'] = asunto
            
            # Agregar CC si hay correos
            if all_cc_emails:
                mensaje['Cc'] = ', '.join(all_cc_emails)
            
            # Crear parte HTML
            parte_html = MIMEMultipart('alternative')
            texto_html = MIMEText(cuerpo_html, 'html', 'utf-8')
            parte_html.attach(texto_html)
            mensaje.attach(parte_html)
            
            # Adjuntar PDF
            parte_pdf = MIMEBase('application', 'pdf')
            parte_pdf.set_payload(pdf_content)
            encoders.encode_base64(parte_pdf)
            parte_pdf.add_header(
                'Content-Disposition',
                f'attachment; filename="{pdf_filename}"'
            )
            mensaje.attach(parte_pdf)
            
            # Preparar lista de destinatarios
            destinatarios = [destinatario] + all_cc_emails
            
            # Conectar al servidor SMTP
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as servidor:
                servidor.starttls()  # Habilitar seguridad TLS
                servidor.login(self.email_sender, self.email_password)
                servidor.send_message(mensaje)
            
            cc_info = f" (copia a: {', '.join(all_cc_emails)})" if all_cc_emails else ""
            print(f"✅ PDF enviado exitosamente a {destinatario}{cc_info}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError as e:
            msg = f"Error de autenticación SMTP: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
        except smtplib.SMTPException as e:
            msg = f"Error SMTP: {str(e)}"
            print(f"❌ {msg}")
            return False, msg
        except Exception as e:
            msg = f"Error inesperado: {str(e)}"
            print(f"❌ {msg}")
            return False, msg

# Instancia global del servicio
email_service = EmailService()
