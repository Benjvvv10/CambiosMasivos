/**
 * Obtener URL base de la API dinámicamente.
 * Si estamos en localhost, usar localhost:8000.
 * Si no, usar el mismo hostname del navegador con puerto 8000.
 */
export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'http://localhost:8000';
    }

    return `${protocol}//${hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
};
