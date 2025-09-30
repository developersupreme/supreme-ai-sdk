/**
 * Supreme AI Credit System SDK - Main Client
 */

import { EventEmitter } from '../utils/EventEmitter';
import { MessageBridge } from '../utils/MessageBridge';
import { AuthManager } from '../utils/AuthManager';
import { ApiClient } from '../utils/ApiClient';
import { StorageManager } from '../utils/StorageManager';
import type {
  CreditSDKConfig,
  SDKState,
  User,
  AuthResult,
  BalanceResult,
  SpendResult,
  AddResult,
  HistoryResult,
  CreditSDKEvents,
  TokenResponseMessage
} from '../types';

export class CreditSystemClient extends EventEmitter<CreditSDKEvents> {
  private config: Required<CreditSDKConfig>;
  private state: SDKState;
  private storage: StorageManager;
  private messageBridge: MessageBridge;
  private authManager: AuthManager;
  private apiClient: ApiClient;
  private tokenTimer?: NodeJS.Timeout;
  private balanceTimer?: NodeJS.Timeout;
  private parentResponseReceived = false;

  constructor(config: CreditSDKConfig = {}) {
    super();

    // Configuration with defaults
    this.config = {
      apiBaseUrl: config.apiBaseUrl || '/api/secure-credits/jwt',
      authUrl: config.authUrl || '/api/jwt',
      parentTimeout: config.parentTimeout || 3000,
      tokenRefreshInterval: config.tokenRefreshInterval || 600000, // 10 minutes
      balanceRefreshInterval: config.balanceRefreshInterval || 30000, // 30 seconds
      allowedOrigins: config.allowedOrigins || [window.location.origin],
      autoInit: config.autoInit !== false,
      debug: config.debug || false,
      storagePrefix: config.storagePrefix || 'creditSystem_',
      mode: config.mode || 'auto',
      onAuthRequired: config.onAuthRequired || (() => {}),
      onTokenExpired: config.onTokenExpired || (() => {})
    };

    // Application state
    this.state = {
      mode: null,
      isInIframe: window !== window.parent,
      isInitialized: false,
      isAuthenticated: false,
      user: null,
      balance: 0
    };

    // Initialize components
    this.storage = new StorageManager(this.config.storagePrefix);
    this.messageBridge = new MessageBridge(this.config.allowedOrigins, this.config.debug);
    this.authManager = new AuthManager(this.config.authUrl, this.config.debug);
    this.apiClient = new ApiClient(this.config.apiBaseUrl, () => this.getAuthToken(), this.config.debug);

    // Set up event handlers
    this.setupEventHandlers();

    // Auto-initialize if configured
    if (this.config.autoInit) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize());
      } else {
        this.initialize();
      }
    }
  }

  /**
   * Initialize the credit system
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      this.log('Credit system already initialized');
      return;
    }

    this.log('Initializing Credit System...');

    // Determine mode
    if (this.config.mode === 'auto') {
      this.state.mode = this.state.isInIframe ? 'embedded' : 'standalone';
    } else {
      this.state.mode = this.config.mode as 'embedded' | 'standalone';
    }

    this.log(`Operating in ${this.state.mode.toUpperCase()} mode`);
    this.emit('modeDetected', { mode: this.state.mode });

    if (this.state.mode === 'embedded') {
      await this.initializeEmbeddedMode();
    } else {
      await this.initializeStandaloneMode();
    }
  }

  /**
   * Initialize embedded mode (iframe)
   */
  private async initializeEmbeddedMode(): Promise<void> {
    // Set up message listener for parent response
    this.messageBridge.on('JWT_TOKEN_RESPONSE', (data: TokenResponseMessage) => {
      this.handleParentTokenResponse(data);
    });

    // Request JWT token from parent
    this.log('Requesting JWT token from parent...');
    this.messageBridge.sendToParent('REQUEST_JWT_TOKEN', {
      origin: window.location.origin,
      timestamp: Date.now()
    });

    this.emit('waitingForParent');

    // Set timeout to fall back to standalone mode
    setTimeout(() => {
      if (!this.parentResponseReceived) {
        this.log('No response from parent, switching to standalone mode');
        this.emit('parentTimeout');
        this.initializeStandaloneMode();
      }
    }, this.config.parentTimeout);
  }

  /**
   * Handle JWT token response from parent
   */
  private handleParentTokenResponse(data: TokenResponseMessage): void {
    this.parentResponseReceived = true;

    if (data.token) {
      this.log('JWT token received from parent');
      this.storage.set('auth', {
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user
      });

      this.state.user = data.user || null;
      this.state.isAuthenticated = true;

      this.initializeWithToken();

      // Notify parent of successful initialization
      this.messageBridge.sendToParent('CREDIT_SYSTEM_READY', {
        user: this.state.user,
        mode: 'embedded'
      });
    } else if (data.error) {
      this.log('Parent requires authentication');
      this.emit('parentAuthRequired', { error: data.error });
      this.initializeStandaloneMode();
    }
  }

  /**
   * Initialize standalone mode
   */
  private async initializeStandaloneMode(): Promise<void> {
    this.state.mode = 'standalone';

    // Check for saved tokens
    const savedAuth = this.storage.get('auth');

    if (savedAuth && savedAuth.token) {
      this.log('Found saved JWT tokens, validating...');

      // Validate token
      const isValid = await this.authManager.validateToken(savedAuth.token);

      if (isValid) {
        this.state.user = savedAuth.user;
        this.state.isAuthenticated = true;
        this.initializeWithToken();
      } else {
        // Try to refresh token
        if (savedAuth.refreshToken) {
          const refreshed = await this.refreshToken();
          if (!refreshed) {
            this.emit('authRequired');
            this.config.onAuthRequired();
          }
        } else {
          this.emit('authRequired');
          this.config.onAuthRequired();
        }
      }
    } else {
      this.emit('authRequired');
      this.config.onAuthRequired();
    }
  }

  /**
   * Initialize with valid JWT token
   */
  private initializeWithToken(): void {
    this.state.isInitialized = true;

    // Start token refresh timer
    this.startTokenRefreshTimer();

    // Load initial balance
    this.checkBalance();

    // Start balance refresh timer if configured
    if (this.config.balanceRefreshInterval > 0) {
      this.startBalanceRefreshTimer();
    }

    this.emit('ready', {
      user: this.state.user,
      mode: this.state.mode!
    });
  }

  /**
   * Get current auth token
   */
  private getAuthToken(): string | null {
    const auth = this.storage.get('auth');
    return auth?.token || null;
  }

  /**
   * Login with credentials (standalone mode)
   */
  async login(email: string, password: string): Promise<AuthResult> {
    if (this.state.mode === 'embedded') {
      return {
        success: false,
        error: 'Login not available in embedded mode'
      };
    }

    this.emit('loginStart' as any);

    try {
      const result = await this.authManager.login(email, password);

      if (result.success && result.tokens && result.user) {
        // Save to storage
        this.storage.set('auth', {
          token: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          user: result.user
        });

        this.state.user = result.user;
        this.state.isAuthenticated = true;

        this.initializeWithToken();

        this.emit('loginSuccess', { user: result.user });

        return { success: true, user: result.user, tokens: result.tokens };
      } else {
        const error = result.message || 'Login failed';
        this.emit('loginError', { error });
        return { success: false, error };
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Network error';
      this.emit('loginError', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    this.emit('logoutStart' as any);

    try {
      const token = this.getAuthToken();
      if (token) {
        await this.authManager.logout(token);
      }
    } catch (error) {
      this.log('Logout API error:', error);
    }

    // Clear state
    this.state.user = null;
    this.state.balance = 0;
    this.state.isInitialized = false;
    this.state.isAuthenticated = false;

    // Clear storage
    this.storage.remove('auth');

    // Clear timers
    this.clearTimers();

    // Notify parent if in embedded mode
    if (this.state.mode === 'embedded') {
      this.messageBridge.sendToParent('LOGOUT', {
        timestamp: Date.now()
      });
    }

    this.emit('logoutSuccess');
  }

  /**
   * Check current credit balance
   */
  async checkBalance(): Promise<BalanceResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await this.apiClient.get<{ balance: number }>('/balance');

      if (result.success && result.data) {
        this.state.balance = result.data.balance;

        this.emit('balanceUpdate', { balance: this.state.balance });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.messageBridge.sendToParent('BALANCE_UPDATE', {
            balance: this.state.balance,
            timestamp: Date.now()
          });
        }

        return { success: true, balance: this.state.balance };
      } else {
        return { success: false, error: result.message || 'Failed to get balance' };
      }
    } catch (error: any) {
      this.emit('error', { type: 'balance', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Spend credits
   */
  async spendCredits(amount: number, description?: string, referenceId?: string): Promise<SpendResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    if (amount > this.state.balance) {
      return { success: false, error: 'Insufficient credits' };
    }

    try {
      const result = await this.apiClient.post<any>('/spend', {
        amount,
        description,
        reference_id: referenceId
      });

      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.new_balance;

        this.emit('creditsSpent', {
          amount,
          description,
          previousBalance,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.messageBridge.sendToParent('CREDITS_SPENT', {
            amount,
            description,
            newBalance: this.state.balance,
            timestamp: Date.now()
          });
        }

        return {
          success: true,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        };
      } else {
        return { success: false, error: result.message || 'Failed to spend credits' };
      }
    } catch (error: any) {
      this.emit('error', { type: 'spend', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Add credits
   */
  async addCredits(amount: number, type: string = 'purchase', description?: string): Promise<AddResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    try {
      const result = await this.apiClient.post<any>('/add', {
        amount,
        type,
        description
      });

      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.new_balance;

        this.emit('creditsAdded', {
          amount,
          type,
          description,
          previousBalance,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.messageBridge.sendToParent('CREDITS_ADDED', {
            amount,
            type,
            description,
            newBalance: this.state.balance,
            timestamp: Date.now()
          });
        }

        return {
          success: true,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        };
      } else {
        return { success: false, error: result.message || 'Failed to add credits' };
      }
    } catch (error: any) {
      this.emit('error', { type: 'add', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get transaction history
   */
  async getHistory(page: number = 1, limit: number = 10): Promise<HistoryResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await this.apiClient.get<any>(`/history?page=${page}&limit=${limit}`);

      if (result.success && result.data) {
        return {
          success: true,
          transactions: result.data.transactions,
          total: result.data.total,
          page: result.data.current_page,
          pages: result.data.total_pages
        };
      } else {
        return { success: false, error: result.message || 'Failed to get history' };
      }
    } catch (error: any) {
      this.emit('error', { type: 'history', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh JWT token
   */
  private async refreshToken(): Promise<boolean> {
    const auth = this.storage.get('auth');
    if (!auth?.refreshToken) {
      return false;
    }

    try {
      const result = await this.authManager.refreshToken(auth.refreshToken);

      if (result.success && result.tokens) {
        // Update storage
        this.storage.set('auth', {
          ...auth,
          token: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token
        });

        this.emit('tokenRefreshed');

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.messageBridge.sendToParent('JWT_TOKEN_REFRESHED', {
            token: result.tokens.access_token,
            timestamp: Date.now()
          });
        }

        return true;
      }
    } catch (error) {
      this.log('Token refresh failed:', error);
    }

    this.emit('tokenExpired');
    this.config.onTokenExpired();
    return false;
  }

  /**
   * Start token refresh timer
   */
  private startTokenRefreshTimer(): void {
    this.clearTokenTimer();

    this.tokenTimer = setInterval(async () => {
      await this.refreshToken();
    }, this.config.tokenRefreshInterval);
  }

  /**
   * Start balance refresh timer
   */
  private startBalanceRefreshTimer(): void {
    this.clearBalanceTimer();

    this.balanceTimer = setInterval(async () => {
      await this.checkBalance();
    }, this.config.balanceRefreshInterval);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    this.clearTokenTimer();
    this.clearBalanceTimer();
  }

  private clearTokenTimer(): void {
    if (this.tokenTimer) {
      clearInterval(this.tokenTimer);
      this.tokenTimer = undefined;
    }
  }

  private clearBalanceTimer(): void {
    if (this.balanceTimer) {
      clearInterval(this.balanceTimer);
      this.balanceTimer = undefined;
    }
  }

  /**
   * Set up internal event handlers
   */
  private setupEventHandlers(): void {
    // Handle parent messages when in embedded mode
    if (this.state.isInIframe) {
      this.messageBridge.on('REFRESH_BALANCE', () => {
        this.checkBalance();
      });

      this.messageBridge.on('GET_STATUS', () => {
        this.messageBridge.sendToParent('STATUS_RESPONSE', {
          initialized: this.state.isInitialized,
          mode: this.state.mode,
          user: this.state.user,
          balance: this.state.balance,
          timestamp: Date.now()
        });
      });

      this.messageBridge.on('CLEAR_STORAGE', () => {
        this.logout();
      });
    }
  }

  /**
   * Get current state
   */
  getState(): SDKState {
    return { ...this.state };
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[CreditSystem]', ...args);
    }
  }

  /**
   * Destroy the client
   */
  destroy(): void {
    this.clearTimers();
    this.messageBridge.destroy();
    this.removeAllListeners();
    this.state.isInitialized = false;
  }
}