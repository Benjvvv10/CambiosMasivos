'use client';

import React, { useEffect, useState } from 'react';
import styles from './InstructivoModal.module.css';
import Cookies from 'js-cookie';
import { getApiUrl } from '@/utils/api-url';

export type PantallaInstructivo = 'estructura-venta' | 'carteras' | 'administrar-dotacion';

interface InstructivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pantalla: PantallaInstructivo;
}

const TITULOS: Record<PantallaInstructivo, string> = {
  'estructura-venta': 'Instructivo – Estructura de Venta',
  'carteras': 'Instructivo – Gestión de Carteras',
  'administrar-dotacion': 'Instructivo – Administrar Dotación',
};

const InstructivoModal: React.FC<InstructivoModalProps> = ({ isOpen, onClose, pantalla }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Limpiar URL al cerrar
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      setError(null);
      return;
    }

    let revoked = false;

    const fetchPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = Cookies.get('auth_token');
        const API_URL = getApiUrl();
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Verificar si existe
        const checkRes = await fetch(`${API_URL}/api/instructivo/exists?pantalla=${encodeURIComponent(pantalla)}`, { headers });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (!checkData.exists) {
            setError('No hay instructivo disponible para esta pantalla. Contacte al administrador.');
            setLoading(false);
            return;
          }
        }

        // Descargar PDF para visualizar
        const res = await fetch(`${API_URL}/api/instructivo/view?pantalla=${encodeURIComponent(pantalla)}`, { headers });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.detail || 'No se pudo cargar el instructivo.');
          setLoading(false);
          return;
        }
        const blob = await res.blob();
        if (!revoked) {
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        }
      } catch {
        if (!revoked) setError('Error de conexión al cargar el instructivo.');
      } finally {
        if (!revoked) setLoading(false);
      }
    };

    fetchPdf();

    return () => {
      revoked = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pantalla]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const token = Cookies.get('auth_token');
      const API_URL = getApiUrl();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/instructivo/download?pantalla=${encodeURIComponent(pantalla)}`, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename=["']?([^"';\n]+)["']?/);
      const filename = match?.[1]?.trim() || 'Instructivo.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalPdf} onClick={(e) => e.stopPropagation()}>
        {/* Header del modal */}
        <div className={styles.modalHeader}>
          <div className={styles.headerIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2 className={styles.modalTitle}>{TITULOS[pantalla]}</h2>
          <button className={styles.downloadButton} onClick={handleDownload} title="Descargar PDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className={styles.pdfContainer}>
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Cargando instructivo...</p>
            </div>
          )}
          {error && (
            <div className={styles.errorState}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p>{error}</p>
            </div>
          )}
          {pdfUrl && !loading && !error && (
            <iframe
              src={pdfUrl}
              className={styles.pdfIframe}
              title="Instructivo PDF"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructivoModal;
