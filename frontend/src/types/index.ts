/**
 * Tipos globales de TypeScript
 */

// Tipo de usuario autenticado
export interface User {
  usuario: string;
  nombre: string;
  email?: string;
  cargo: string;
  distritos_permitidos: string[];
  cambiar_password: boolean;
}

// Respuesta de login
export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario: string;
  nombre: string;
  email?: string;
  cargo: string;
  distritos_permitidos: string[];
  cambiar_password: boolean;
}

// Credenciales de login
export interface LoginCredentials {
  usuario: string;
  password: string;
}

// Error de API
export interface ApiError {
  detail: string;
  status?: number;
}

// Contexto de autenticación
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}
