/**
 * Supreme AI Credit System SDK
 *
 * @packageDocumentation
 */

// Core exports
export { CreditSystemClient } from './core/CreditSystemClient';

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

  // React
  UseCreditSystemReturn
} from './types';

// Default export
export default CreditSystemClient;