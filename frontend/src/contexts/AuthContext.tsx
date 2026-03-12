/**
 * Contexto de autenticación global
 * Maneja estado de usuario autenticado en toda la aplicación
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContextType, User, LoginCredentials } from '@/types';
import * as authService from '@/services/auth.service';

// Crear contexto de autenticación
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Proveedor de autenticación
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Cargar usuario al montar el componente
  useEffect(() => {
    loadUser();
  }, []);

  /**
   * Verificar si estamos en localhost
   */
  const isLocalhost = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  };

  /**
   * Cargar usuario desde el token almacenado o modo localhost
   */
  const loadUser = async () => {
    try {
      setIsLoading(true);
      
      // Si estamos en localhost, crear usuario admin automático
      if (isLocalhost()) {
        const localhostUser: User = {
          usuario: 'admin_localhost',
          nombre: 'Administrador',
          cargo: 'Admin',
          distritos_permitidos: [],
          cambiar_password: false,
        };
        setUser(localhostUser);
        setToken('localhost_admin'); // Token especial para localhost
        return;
      }
      
      // Verificar si hay token
      if (!authService.hasValidToken()) {
        setUser(null);
        setToken(null);
        return;
      }

      // Obtener usuario actual desde la API
      const userData = await authService.getCurrentUser();
      setUser(userData);
      setToken(authService.hasValidToken() ? 'valid' : null);
      
    } catch (error) {
      console.error('Error al cargar usuario:', error);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Iniciar sesión
   */
  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      
      // Si estamos en localhost, no hacer login, usar modo admin
      if (isLocalhost()) {
        const localhostUser: User = {
          usuario: 'admin_localhost',
          nombre: 'Administrador',
          cargo: 'Admin',
          distritos_permitidos: [],
          cambiar_password: false,
        };
        setUser(localhostUser);
        setToken('localhost_admin');
        router.push('/menu');
        return;
      }
      
      // Llamar servicio de login
      const response = await authService.login(credentials);
      
      // Actualizar estado
      setUser({
        usuario: response.usuario,
        nombre: response.nombre,
        email: response.email,
        cargo: response.cargo,
        distritos_permitidos: response.distritos_permitidos,
        cambiar_password: response.cambiar_password,
      });
      setToken(response.access_token);

      // Redirigir según necesite cambiar contraseña
      if (response.cambiar_password) {
        router.push('/cambiar-password');
      } else {
        // Redirigir al menú principal unificado
        router.push('/menu');
      }
      
    } catch (error) {
      setUser(null);
      setToken(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cerrar sesión
   */
  const logout = async () => {
    // Si estamos en localhost, no hacer logout (solo recargar menu)
    if (isLocalhost()) {
      router.push('/menu');
      return;
    }
    
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setToken(null);
      router.push('/login');
    }
  };

  // Valor del contexto
  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar el contexto de autenticación
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  
  return context;
}
