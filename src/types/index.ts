/**
 * Supreme AI Credit SDK - Type Definitions
 */

// User and Authentication Types
export interface User {
  id: number;
  email: string;
  name?: string;
  organization?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  tokens?: AuthTokens;
  message?: string;
  error?: string;
}

// Credit System Types
export interface CreditBalance {
  balance: number;
  currency?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description?: string;
  reference_id?: string;
  created_at: string;
  balance_after: number;
}

export interface TransactionHistory {
  transactions: Transaction[];
  total: number;
  current_page: number;
  total_pages: number;
}

// SDK Configuration
export interface CreditSDKConfig {
  apiBaseUrl?: string;
  authUrl?: string;
  parentTimeout?: number;
  tokenRefreshInterval?: number;
  balanceRefreshInterval?: number;
  allowedOrigins?: string[];
  autoInit?: boolean;
  debug?: boolean;
  storagePrefix?: string;
  mode?: 'auto' | 'embedded' | 'standalone';
  onAuthRequired?: () => void;
  onTokenExpired?: () => void;
}

// SDK State
export interface SDKState {
  mode: 'embedded' | 'standalone' | null;
  isInIframe: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: User | null;
  balance: number;
}

// Message Types for iframe Communication
export interface IframeMessage {
  type: string;
  timestamp: number;
  [key: string]: any;
}

export interface TokenRequestMessage extends IframeMessage {
  type: 'REQUEST_JWT_TOKEN';
  origin: string;
}

export interface TokenResponseMessage extends IframeMessage {
  type: 'JWT_TOKEN_RESPONSE';
  token?: string;
  refreshToken?: string;
  user?: User;
  error?: string;
}

// Event Types
export type CreditSDKEvents = {
  'ready': { user: User | null; mode: string };
  'modeDetected': { mode: string };
  'authRequired': void;
  'loginSuccess': { user: User };
  'loginError': { error: string };
  'logoutSuccess': void;
  'balanceUpdate': { balance: number };
  'creditsSpent': {
    amount: number;
    description?: string;
    previousBalance: number;
    newBalance: number;
    transaction?: Transaction;
  };
  'creditsAdded': {
    amount: number;
    type: string;
    description?: string;
    previousBalance: number;
    newBalance: number;
    transaction?: Transaction;
  };
  'tokenRefreshed': void;
  'tokenExpired': void;
  'error': { type: string; error: string };
  'waitingForParent': void;
  'parentTimeout': void;
  'parentAuthRequired': { error: string };
};

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface BalanceResponse {
  balance: number;
  currency?: string;
}

export interface SpendResponse {
  new_balance: number;
  transaction: Transaction;
}

export interface AddCreditsResponse {
  new_balance: number;
  transaction: Transaction;
}

// Operation Results
export interface OperationResult {
  success: boolean;
  error?: string;
}

export interface BalanceResult extends OperationResult {
  balance?: number;
}

export interface SpendResult extends OperationResult {
  newBalance?: number;
  transaction?: Transaction;
}

export interface AddResult extends OperationResult {
  newBalance?: number;
  transaction?: Transaction;
}

export interface HistoryResult extends OperationResult {
  transactions?: Transaction[];
  total?: number;
  page?: number;
  pages?: number;
}

// React Hook Types
export interface UseCreditSystemReturn {
  isInitialized: boolean;
  isAuthenticated: boolean;
  mode: 'embedded' | 'standalone' | null;
  user: User | null;
  balance: number;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  checkBalance: () => Promise<BalanceResult>;
  spendCredits: (amount: number, description?: string, referenceId?: string) => Promise<SpendResult>;
  addCredits: (amount: number, type?: string, description?: string) => Promise<AddResult>;
  getHistory: (page?: number, limit?: number) => Promise<HistoryResult>;
}