/**
 * React Hook for Supreme AI Credit System SDK
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CreditSystemClient } from '../core/CreditSystemClient';
import type {
  CreditSDKConfig,
  User,
  AuthResult,
  BalanceResult,
  SpendResult,
  AddResult,
  HistoryResult,
  UseCreditSystemReturn,
  Persona,
  PersonasResult,
  PersonaResult
} from '../types';

export function useCreditSystem(config?: CreditSDKConfig): UseCreditSystemReturn {
  const clientRef = useRef<CreditSystemClient | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState<'embedded' | 'standalone' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize client
  useEffect(() => {
    const client = new CreditSystemClient({
      ...config,
      autoInit: true
    });

    clientRef.current = client;

    // Set up event listeners
    client.on('ready', (data) => {
      if (data) {
        setIsInitialized(true);
        setIsAuthenticated(true);
        setUser(data.user);
        setMode(data.mode as 'embedded' | 'standalone');
        setLoading(false);
      }
    });

    client.on('modeDetected', (data) => {
      if (data) {
        setMode(data.mode as 'embedded' | 'standalone');
      }
    });

    client.on('authRequired', () => {
      setIsAuthenticated(false);
      setLoading(false);
    });

    client.on('loginSuccess', (data) => {
      if (data) {
        setIsAuthenticated(true);
        setUser(data.user);
        setError(null);
      }
    });

    client.on('loginError', (data) => {
      if (data) {
        setError(data.error);
      }
    });

    client.on('logoutSuccess', () => {
      setIsAuthenticated(false);
      setUser(null);
      setBalance(null);
    });

    client.on('balanceUpdate', (data) => {
      if (data) {
        setBalance(data.balance);
      }
    });

    client.on('personasLoaded', (data) => {
      if (data) {
        setPersonas(data.personas);
      }
    });

    client.on('personasFailed', (data) => {
      if (data) {
        console.error('Failed to load personas:', data.error);
      }
    });

    client.on('error', (data) => {
      if (data) {
        setError(`${data.type}: ${data.error}`);
      }
    });

    client.on('tokenExpired', () => {
      setIsAuthenticated(false);
      setError('Session expired. Please login again.');
    });

    // Cleanup
    return () => {
      client.destroy();
    };
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);

    if (!clientRef.current) {
      setLoading(false);
      return { success: false, error: 'Client not initialized' };
    }

    const result = await clientRef.current.login(email, password);
    setLoading(false);

    return result;
  }, []);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    if (!clientRef.current) return;

    await clientRef.current.logout();
  }, []);

  // Check balance
  const checkBalance = useCallback(async (): Promise<BalanceResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    return await clientRef.current.checkBalance();
  }, []);

  // Spend credits
  const spendCredits = useCallback(async (
    amount: number,
    description?: string,
    referenceId?: string
  ): Promise<SpendResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    return await clientRef.current.spendCredits(amount, description, referenceId);
  }, []);

  // Add credits
  const addCredits = useCallback(async (
    amount: number,
    type?: string,
    description?: string
  ): Promise<AddResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    return await clientRef.current.addCredits(amount, type, description);
  }, []);

  // Get history
  const getHistory = useCallback(async (
    page?: number,
    limit?: number
  ): Promise<HistoryResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    return await clientRef.current.getHistory(page, limit);
  }, []);

  // Get personas
  const getPersonas = useCallback(async (): Promise<PersonasResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    return await clientRef.current.getPersonas();
  }, []);

  // Get persona by ID
  const getPersonaById = useCallback(async (id: number): Promise<PersonaResult> => {
    if (!clientRef.current) {
      return { success: false, error: 'Client not initialized' };
    }

    return await clientRef.current.getPersonaById(id);
  }, []);

  return {
    isInitialized,
    isAuthenticated,
    mode,
    user,
    balance,
    personas,
    loading,
    error,
    login,
    logout,
    checkBalance,
    spendCredits,
    addCredits,
    getHistory,
    getPersonas,
    getPersonaById
  };
}