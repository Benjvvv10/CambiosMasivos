/**
 * Servicio de autenticación
 * Maneja login, logout y validación de usuario
 */

import apiClient from './api';
import { LoginCredentials, LoginResponse, User } from '@/types';
import { AxiosError } from 'axios';

/**
 * Iniciar sesión
 */
export const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const response = await apiClient.getClient().post<LoginResponse>('/api/auth/login', credentials);
    
    // Guardar token en cookies
    apiClient.setToken(response.data.access_token);
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ detail: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Error al iniciar sesión');
  }
};

/**
 * Cerrar sesión
 */
export const logout = async (): Promise<void> => {
  try {
    // Llamar al endpoint de logout (opcional)
    await apiClient.getClient().post('/api/auth/logout');
  } catch (error) {
    // Ignorar errores de logout
    console.error('Error en logout:', error);
  } finally {
    // Siempre eliminar el token localmente
    apiClient.removeToken();
  }
};

/**
 * Obtener información del usuario actual
 */
export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await apiClient.getClient().get<User>('/api/auth/me');
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ detail: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Error al obtener usuario');
  }
};

/**
 * Cambiar contraseña
 */
export const changePassword = async (
  passwordNueva: string
): Promise<void> => {
  try {
    await apiClient.getClient().post('/api/auth/change-password', {
      password_nueva: passwordNueva,
    });
  } catch (error) {
    const axiosError = error as AxiosError<{ detail: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Error al cambiar contraseña');
  }
};

/**
 * Verificar si hay token válido
 */
export const hasValidToken = (): boolean => {
  const token = apiClient.getToken();
  return !!token;
};

/**
 * Recuperar contraseña
 */
export const recoverPassword = async (usuario: string): Promise<{ email: string }> => {
  try {
    const response = await apiClient.getClient().post<{ message: string; email: string }>(
      '/api/auth/recover-password', 
      { usuario }
    );
    return { email: response.data.email };
  } catch (error) {
    const axiosError = error as AxiosError<{ detail: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Error al recuperar contraseña');
  }
};
