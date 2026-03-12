/**
 * Servicio de API - Cliente HTTP para comunicación con el backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';

/**
 * Obtener URL base de la API dinámicamente
 * Si estamos en localhost, usar localhost:8000
 * Si no, usar el mismo hostname pero con puerto 8000
 */
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol; // http: o https:
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'http://localhost:8000';
    }
    
    // Usar el mismo hostname del navegador pero con puerto 8000
    return `${protocol}//${hostname}:8000`;
  }
  // Fallback para SSR (Server-Side Rendering)
  return process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.55:8000';
};

// URL base del backend
const API_BASE_URL = getApiBaseUrl();

// Nombre de la cookie del token
const TOKEN_COOKIE_NAME = 'auth_token';

/**
 * Cliente Axios configurado con interceptores
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    // Crear instancia de Axios
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor de request: agregar token de autenticación
    this.client.interceptors.request.use(
      (config) => {
        // Verificar si estamos en localhost
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname === '::1');
        
        // Si es localhost, no agregar token (el backend lo detectará)
        if (isLocalhost) {
          return config;
        }
        
        // Obtener token de las cookies
        const token = Cookies.get(TOKEN_COOKIE_NAME);
        
        if (token) {
          // Agregar header de autorización
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor de response: manejar errores globales
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Si hay error 401, limpiar token y redirigir a login
        if (error.response?.status === 401) {
          Cookies.remove(TOKEN_COOKIE_NAME);
          // Redirigir a login si no estamos ya ahí
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        
        // Si hay error 503 (aplicación desactivada), limpiar token y redirigir a login
        if (error.response?.status === 503) {
          Cookies.remove(TOKEN_COOKIE_NAME);
          // Redirigir a login si no estamos ya ahí
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Obtener instancia del cliente Axios
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Guardar token en cookies
   */
  setToken(token: string): void {
    // Guardar token en cookie (expira en 1 día)
    Cookies.set(TOKEN_COOKIE_NAME, token, { 
      expires: 1,
      sameSite: 'lax',  // Cambio de 'strict' a 'lax' para permitir cookies entre IPs
      secure: false      // Cambio a false para desarrollo (HTTP sin SSL)
    });
  }

  /**
   * Obtener token de las cookies
   */
  getToken(): string | undefined {
    return Cookies.get(TOKEN_COOKIE_NAME);
  }

  /**
   * Eliminar token de las cookies
   */
  removeToken(): void {
    Cookies.remove(TOKEN_COOKIE_NAME);
  }
}

// Instancia global del cliente
const apiClient = new ApiClient();

export default apiClient;
export { TOKEN_COOKIE_NAME };

