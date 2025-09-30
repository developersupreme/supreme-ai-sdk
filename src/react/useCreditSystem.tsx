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
  UseCreditSystemReturn
} from '../types';

export function useCreditSystem(config?: CreditSDKConfig): UseCreditSystemReturn {
  const clientRef = useRef<CreditSystemClient | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState<'embedded' | 'standalone' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState(0);
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
    client.on('ready', ({ user, mode }) => {
      setIsInitialized(true);
      setIsAuthenticated(true);
      setUser(user);
      setMode(mode as 'embedded' | 'standalone');
      setLoading(false);
    });

    client.on('modeDetected', ({ mode }) => {
      setMode(mode as 'embedded' | 'standalone');
    });

    client.on('authRequired', () => {
      setIsAuthenticated(false);
      setLoading(false);
    });

    client.on('loginSuccess', ({ user }) => {
      setIsAuthenticated(true);
      setUser(user);
      setError(null);
    });

    client.on('loginError', ({ error }) => {
      setError(error);
    });

    client.on('logoutSuccess', () => {
      setIsAuthenticated(false);
      setUser(null);
      setBalance(0);
    });

    client.on('balanceUpdate', ({ balance }) => {
      setBalance(balance);
    });

    client.on('error', ({ type, error }) => {
      setError(`${type}: ${error}`);
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

  return {
    isInitialized,
    isAuthenticated,
    mode,
    user,
    balance,
    loading,
    error,
    login,
    logout,
    checkBalance,
    spendCredits,
    addCredits,
    getHistory
  };
}