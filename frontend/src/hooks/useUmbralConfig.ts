import { useState, useEffect } from 'react';
import apiClient from '../services/api';

/**
 * Hook personalizado para cargar el umbral de porcentaje desde la API
 * @param defaultUmbral - Valor por defecto del umbral (opcional)
 * @returns El umbral de porcentaje actual
 */
export const useUmbralConfig = (defaultUmbral: number = 10) => {
  const [umbralPorcentaje, setUmbralPorcentaje] = useState<number>(defaultUmbral);

  useEffect(() => {
    const fetchUmbral = async () => {
      try {
        const response = await apiClient.getClient().get('/api/config/umbral-porcentaje');
        if (response.data && response.data.umbral_porcentaje !== undefined) {
          console.log('🔧 Umbral cargado desde API:', response.data.umbral_porcentaje);
          setUmbralPorcentaje(response.data.umbral_porcentaje);
        }
      } catch (error) {
        console.error('Error al cargar umbral:', error);
      }
    };

    // Cargar al montar
    fetchUmbral();

    // Escuchar cambios desde el admin
    const handleUmbralChange = () => {
      fetchUmbral();
    };

    window.addEventListener('umbralPorcentajeChange', handleUmbralChange);

    return () => {
      window.removeEventListener('umbralPorcentajeChange', handleUmbralChange);
    };
  }, []);

  return umbralPorcentaje;
};
