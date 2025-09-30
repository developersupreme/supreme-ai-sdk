/**
 * React Context Provider for Supreme AI Credit System SDK
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useCreditSystem } from './useCreditSystem';
import type { CreditSDKConfig, UseCreditSystemReturn } from '../types';

const CreditSystemContext = createContext<UseCreditSystemReturn | undefined>(undefined);

interface CreditSystemProviderProps {
  children: ReactNode;
  config?: CreditSDKConfig;
}

export function CreditSystemProvider({ children, config }: CreditSystemProviderProps) {
  const creditSystem = useCreditSystem(config);

  return (
    <CreditSystemContext.Provider value={creditSystem}>
      {children}
    </CreditSystemContext.Provider>
  );
}

export function useCreditContext(): UseCreditSystemReturn {
  const context = useContext(CreditSystemContext);
  if (!context) {
    throw new Error('useCreditContext must be used within a CreditSystemProvider');
  }
  return context;
}