/**
 * Supreme AI SDK - Credit System and Personas Management
 *
 * @packageDocumentation
 */

// Core imports and exports
import { CreditSystemClient } from './core/CreditSystemClient';
import { PersonasClient } from './core/PersonasClient';
export { CreditSystemClient };
export { PersonasClient };
export type { PersonasClientConfig } from './core/PersonasClient';

// React exports
export { useCreditSystem } from './react/useCreditSystem';
export { CreditSystemProvider, useCreditContext } from './react/CreditSystemProvider';

// Parent integration exports
export { ParentIntegrator } from './parent/ParentIntegrator';
export type { ParentConfig } from './parent/ParentIntegrator';

// Type exports
export type {
  // User and Auth
  User,
  AuthTokens,
  AuthResult,

  // Credit System
  CreditBalance,
  Transaction,
  TransactionHistory,

  // Configuration
  CreditSDKConfig,
  SDKState,

  // Messages
  IframeMessage,
  TokenRequestMessage,
  TokenResponseMessage,

  // Events
  CreditSDKEvents,

  // API
  ApiResponse,
  BalanceResponse,
  SpendResponse,
  AddCreditsResponse,

  // Operations
  OperationResult,
  BalanceResult,
  SpendResult,
  AddResult,
  HistoryResult,

  // Personas
  Persona,
  PersonasResult,
  PersonaResult,

  // React
  UseCreditSystemReturn
} from './types';

// Default export
export default CreditSystemClient;