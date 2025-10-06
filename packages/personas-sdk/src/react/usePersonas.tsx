/**
 * React Hook for Supreme AI Personas SDK
 */

import { useState, useCallback, useRef } from 'react';
import { PersonasClient } from '../core/PersonasClient';
import type {
  PersonasSDKConfig,
  Persona,
  PersonasResult,
  PersonaResult,
  UsePersonasReturn
} from '../types';

export function usePersonas(config?: PersonasSDKConfig): UsePersonasReturn {
  const clientRef = useRef<PersonasClient | null>(null);

  // Initialize client only once
  if (!clientRef.current) {
    clientRef.current = new PersonasClient(config);
  }

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get all personas
  const getPersonas = useCallback(async (): Promise<PersonasResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    setLoading(true);
    setError(null);

    const result = await clientRef.current.getPersonas();

    if (result.success && result.personas) {
      setPersonas(result.personas);
    } else if (result.error) {
      setError(result.error);
    }

    setLoading(false);
    return result;
  }, []);

  // Get persona by ID
  const getPersonaById = useCallback(async (id: number): Promise<PersonaResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    setLoading(true);
    setError(null);

    const result = await clientRef.current.getPersonaById(id);

    if (result.error) {
      setError(result.error);
    }

    setLoading(false);
    return result;
  }, []);

  // Refresh personas (alias for getPersonas)
  const refreshPersonas = useCallback(async (): Promise<void> => {
    await getPersonas();
  }, [getPersonas]);

  return {
    personas,
    loading,
    error,
    getPersonas,
    getPersonaById,
    refreshPersonas
  };
}
