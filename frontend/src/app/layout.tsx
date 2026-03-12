/**
 * Layout principal de la aplicación
 * Envuelve todas las páginas con el contexto de autenticación
 */

import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Sistema CIAL',
  description: 'Sistema de optimización y gestión de rutas de distribución',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
