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
export { useSwitchOrganization } from './react/useSwitchOrganization';
export type { SwitchOrgResult } from './react/useSwitchOrganization';

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
  UserStateRequestMessage,
  UserStateResponseMessage,

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

  // User State
  UserStateResult,

  // React
  UseCreditSystemReturn
} from './types';

// Default export
export default CreditSystemClient;