/**
 * Supreme AI Credit System SDK - Main Client
 */

import { EventEmitter } from '../utils/EventEmitter';
import { MessageBridge } from '../utils/MessageBridge';
import { AuthManager } from '../utils/AuthManager';
import { ApiClient } from '../utils/ApiClient';
import { StorageManager } from '../utils/StorageManager';
import { PersonasClient } from './PersonasClient';
import type {
  CreditSDKConfig,
  SDKState,
  User,
  Organization,
  AuthResult,
  BalanceResult,
  SpendResult,
  AddResult,
  HistoryResult,
  CreditSDKEvents,
  TokenResponseMessage,
  PersonasResult,
  PersonaResult,
  Persona,
  UserStateResponseMessage,
  UserStateResult,
  AgentsResult,
  SwitchOrgResult
} from '../types';

export class CreditSystemClient extends EventEmitter<CreditSDKEvents> {
  private config: Required<CreditSDKConfig>;
  private state: SDKState;
  private storage: StorageManager;
  private messageBridge: MessageBridge;
  private authManager: AuthManager;
  private apiClient: ApiClient;
  private agentsApiClient: ApiClient;
  private personasClient: PersonasClient;
  private tokenTimer?: NodeJS.Timeout;
  private balanceTimer?: NodeJS.Timeout;
  private parentResponseReceived = false;

  constructor(config: CreditSDKConfig = {}) {
    super();

    // Set debug flag first
    this.debug = config.debug || false;

    // Configuration with defaults
    this.config = {
      apiBaseUrl: config.apiBaseUrl || '/api/secure-credits/jwt',
      agentsApiBaseUrl: config.agentsApiBaseUrl || '/api/ai-agents/jwt',
      authUrl: config.authUrl || '/api/jwt',
      parentTimeout: config.parentTimeout || 3000,
      tokenRefreshInterval: config.tokenRefreshInterval || 600000, // 10 minutes
      balanceRefreshInterval: config.balanceRefreshInterval || 30000, // 30 seconds
      allowedOrigins: config.allowedOrigins || [window.location.origin],
      autoInit: config.autoInit !== false,
      debug: config.debug || false,
      storagePrefix: config.storagePrefix || 'creditSystem_',
      mode: config.mode || 'auto',
      features: {
        credits: config.features?.credits !== false, // Default true
        personas: config.features?.personas !== false // Default true
      },
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
      balance: 0,
      personas: [],
      accessToken: null,
      refreshToken: null,
      organizations: [],
      selectedOrganization: null
    };

    // Initialize components
    this.storage = new StorageManager(this.config.storagePrefix, this.config.debug);
    this.messageBridge = new MessageBridge(this.config.allowedOrigins, this.config.debug);
    this.authManager = new AuthManager(this.config.authUrl, this.config.debug);
    this.apiClient = new ApiClient(this.config.apiBaseUrl, () => this.getAuthToken(), this.config.debug);
    this.agentsApiClient = new ApiClient(this.config.agentsApiBaseUrl, () => this.getAuthToken(), this.config.debug);

    // Initialize PersonasClient
    const personasBaseUrl = this.config.apiBaseUrl.replace('/secure-credits/jwt', '');
    this.personasClient = new PersonasClient({
      apiBaseUrl: personasBaseUrl,
      getAuthToken: () => this.getAuthToken(),
      debug: this.config.debug
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Auto-initialize if configured
    // Defer initialization to next tick to allow event listeners to be attached
    if (this.config.autoInit) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => this.initialize(), 0);
        });
      } else {
        setTimeout(() => this.initialize(), 0);
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
    this.log('🎬 Initializing embedded mode (iframe)...');
    this.log(`⏱️ Parent timeout set to ${this.config.parentTimeout}ms`);

    // Set up message listener for parent response
    this.messageBridge.on('JWT_TOKEN_RESPONSE', (data: TokenResponseMessage) => {
      this.log('📨 Received JWT_TOKEN_RESPONSE from parent');
      this.log('📨 Received data from parent', data);
      this.handleParentTokenResponse(data);
    });

    this.messageBridge.on('RESPONSE_CURRENT_USER_STATE', (data: UserStateResponseMessage) => {
      this.log('📨 Received RESPONSE_CURRENT_USER_STATE from parent');
      this.log('👤 User State Data:', data.userState);
    });

    // Request JWT token from parent
    this.log('🔑 Requesting JWT token from parent...');
    this.log(`📍 Iframe origin: ${window.location.origin}`);
    this.messageBridge.sendToParent('REQUEST_JWT_TOKEN', {
      origin: window.location.origin,
      timestamp: Date.now()
    });

    this.emit('waitingForParent');
    this.log('⏳ Waiting for parent response...');

    // Set timeout to fall back to standalone mode
    setTimeout(() => {
      if (!this.parentResponseReceived) {
        this.log(`⏰ Timeout! No response from parent after ${this.config.parentTimeout}ms`);
        this.log('🔄 Switching to standalone mode');
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
    this.log('✅ Parent response received!');

    if (data.token) {
      this.log('🎟️ JWT token received from parent');
      this.log(`👤 User: ${data.user?.email || 'Unknown'}`);
      this.log(`🔐 Token length: ${data.token?.length || 0} characters`);

      // Extract organizations array, personas, and userRoleIds from response
      const enrichedUser = data.user ? {
        ...data.user,
        userRoleIds: data.organization?.userRoleIds,
        organizations: (data as any).organizations || data.user.organizations, // Include organizations array
        personas: (data as any).personas || data.user.personas, // Include personas array
      } : data.user;

      this.storage.set('auth', {
        token: data.token,
        refreshToken: data.refreshToken,
        user: enrichedUser
      });
      this.log('💾 Tokens saved to storage');

      // Store personas if provided in JWT response
      if ((data as any).personas) {
        this.state.personas = (data as any).personas;
        this.log(`📋 Personas received in JWT: ${(data as any).personas.length}`);
      }

      // Store organizations if provided
      if ((data as any).organizations) {
        this.log(`🏢 Organizations received in JWT: ${(data as any).organizations.length}`);
        const selectedOrg = (data as any).organizations.find((org: any) => org.selectedStatus === true);
        if (selectedOrg) {
          this.log(`✅ Selected Organization: ${selectedOrg.name} (ID: ${selectedOrg.id})`);
        }
      }

      if (data.organization) {
        this.log(`🏢 Current Organization: ${data.organization.organizationName} (ID: ${data.organization.organizationId})`);

        // Set organization cookie for backend API compatibility
        const orgId = data.organization.organizationId;
        if (orgId) {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30); // 30 days
          document.cookie = `user-selected-org-id=${orgId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
          this.log(`🍪 Set organization cookie: user-selected-org-id=${orgId}`);
        }
      }

      this.state.user = enrichedUser || null;
      this.state.isAuthenticated = true;
      this.state.accessToken = data.token || null;
      this.state.refreshToken = data.refreshToken || null;

      // Store organizations in state
      const orgs = (data as any).organizations || enrichedUser?.organizations;
      if (orgs && Array.isArray(orgs)) {
        // Normalize: support both isSelected and selectedStatus
        const normalizedOrgs = orgs.map((org: any, index: number) => {
          const selected = org.isSelected ?? org.selectedStatus ?? (index === 0);
          const userRoleIds = org.user_role_ids ?? (org.roles ? Object.keys(org.roles).map(Number) : undefined);
          return {
            ...org,
            selectedStatus: selected,
            isSelected: selected,
            ...(userRoleIds ? { user_role_ids: userRoleIds } : {}),
          };
        });
        this.state.organizations = normalizedOrgs;
        this.state.selectedOrganization = normalizedOrgs.find((o: any) => o.selectedStatus) || normalizedOrgs[0] || null;
        this.emit('organizationsUpdated', { organizations: normalizedOrgs });
      }

      this.emit('tokensUpdated', {
        accessToken: data.token!,
        refreshToken: data.refreshToken
      });

      this.log('🚀 Initializing with token...');
      this.initializeWithToken();

      // Notify parent of successful initialization
      this.log('📤 Sending CREDIT_SYSTEM_READY to parent');
      this.messageBridge.sendToParent('CREDIT_SYSTEM_READY', {
        user: this.state.user,
        mode: 'embedded'
      });
      this.log('✨ Embedded mode initialization complete!');
    } else if (data.error) {
      this.log(`❌ Parent authentication error: ${data.error}`);
      this.emit('parentAuthRequired', { error: data.error });
      this.log('🔄 Falling back to standalone mode');
      this.initializeStandaloneMode();
    }
  }

  /**
   * Initialize standalone mode
   */
  private async initializeStandaloneMode(): Promise<void> {
    this.state.mode = 'standalone';
    this.log('🖥️ Initializing standalone mode...');

    // Check for saved tokens
    const savedAuth = this.storage.get('auth');

    if (savedAuth && savedAuth.token) {
      this.log('🔍 Found saved JWT tokens, validating...');
      this.log(`👤 Saved user: ${savedAuth.user?.email || 'Unknown'}`);

      // Validate token
      const isValid = await this.authManager.validateToken(savedAuth.token);

      if (isValid) {
        this.log('✅ Token is valid!');
        this.state.user = savedAuth.user;
        this.state.isAuthenticated = true;
        this.state.accessToken = savedAuth.token;
        this.state.refreshToken = savedAuth.refreshToken || null;

        // Restore organizations from saved user
        if (savedAuth.user?.organizations && Array.isArray(savedAuth.user.organizations)) {
          this.state.organizations = savedAuth.user.organizations;
          this.state.selectedOrganization = savedAuth.user.organizations.find(
            (o: any) => o.selectedStatus || o.isSelected
          ) || savedAuth.user.organizations[0] || null;
        }

        this.log('🚀 Initializing with valid token...');
        this.initializeWithToken();
      } else {
        this.log('❌ Token validation failed');
        // Try to refresh token
        if (savedAuth.refreshToken) {
          this.log('🔄 Attempting token refresh...');
          const refreshed = await this.refreshToken();
          if (!refreshed) {
            this.log('❌ Token refresh failed - authentication required');
            this.emit('authRequired');
            this.config.onAuthRequired();
          }
        } else {
          this.log('❌ No refresh token available - authentication required');
          this.emit('authRequired');
          this.config.onAuthRequired();
        }
      }
    } else {
      this.log('ℹ️ No saved tokens found - authentication required');
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

    // Load initial balance only if credits feature is enabled
    if (this.config.features.credits) {
      this.checkBalance();

      // Start balance refresh timer if configured
      if (this.config.balanceRefreshInterval > 0) {
        this.startBalanceRefreshTimer();
      }
    }

    // Load initial personas if personas feature is enabled
    if (this.config.features.personas) {
      this.loadPersonas();
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
      this.log('⚠️ Login attempt blocked: Not available in embedded mode');
      return {
        success: false,
        error: 'Login not available in embedded mode'
      };
    }

    this.log('🔐 Login attempt started...');
    this.log(`📧 Email: ${email}`);
    this.emit('loginStart' as any);

    try {
      const result = await this.authManager.login(email, password);

      if (result.success && result.tokens && result.user) {
        this.log('✅ Login successful!');
        this.log(`👤 User: ${result.user.email}`);
        this.log(`🔐 Token length: ${result.tokens.access_token?.length || 0} characters`);

        // Save to storage
        this.storage.set('auth', {
          token: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          user: result.user
        });
        this.log('💾 Tokens saved to storage');

        this.state.user = result.user;
        this.state.isAuthenticated = true;
        this.state.accessToken = result.tokens.access_token;
        this.state.refreshToken = result.tokens.refresh_token;

        // Store organizations in state
        if (result.user.organizations && Array.isArray(result.user.organizations)) {
          this.log('📦 Raw orgs from API:', result.user.organizations.map((o: any) => ({
            id: o.id, name: o.name, hasAgents: !!o.agents, hasRoles: !!o.roles, isSelected: o.isSelected,
          })));
          const orgs: Organization[] = result.user.organizations.map((org, index) => {
            // Normalize: support both isSelected and selectedStatus from API
            const selected = org.isSelected ?? org.selectedStatus ?? (index === 0);
            // Derive user_role_ids from roles object if not already set
            const userRoleIds = org.user_role_ids ?? (org.roles ? Object.keys(org.roles).map(Number) : undefined);
            return {
              ...org,
              selectedStatus: selected,
              isSelected: selected,
              ...(userRoleIds ? { user_role_ids: userRoleIds } : {}),
            };
          });
          this.state.organizations = orgs;
          this.state.selectedOrganization = orgs.find(o => o.selectedStatus) || orgs[0] || null;
          this.emit('organizationsUpdated', { organizations: orgs });
          this.log(`🏢 Stored ${orgs.length} organizations. Selected: ${this.state.selectedOrganization?.name} (ID: ${this.state.selectedOrganization?.id})`);
          if (this.state.selectedOrganization?.agents?.all) {
            this.log(`🤖 Selected org has ${this.state.selectedOrganization.agents.all.length} agents`);
          }
        }

        this.emit('tokensUpdated', {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token
        });

        this.log('🚀 Initializing with token...');
        this.initializeWithToken();

        this.emit('loginSuccess', { user: result.user });

        return { success: true, user: result.user, tokens: result.tokens };
      } else {
        const error = result.message || 'Login failed';
        this.log(`❌ Login failed: ${error}`);
        this.emit('loginError', { error });
        return { success: false, error };
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Network error';
      this.log(`❌ Login error: ${errorMsg}`);
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
    this.state.accessToken = null;
    this.state.refreshToken = null;
    this.state.organizations = [];
    this.state.selectedOrganization = null;

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
      this.log('⚠️ Balance check blocked: Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    this.log('💰 Fetching current balance...');
    this.log(`👤 User: ${this.state.user?.email} (ID: ${this.state.user?.id})`);

    try {
      // Build query parameters with organization_id if available
      const params: Record<string, string> = {};
      // Get organization_id from selected organization (same as spendCredits logic)
      const organizationId = this.state.selectedOrganization?.id || this.getOrganizationIdFromCookie();

      this.log(`🔍 Organization ID (selected org or cookie): ${organizationId} (type: ${typeof organizationId})`);

      if (organizationId) {
        params.organization_id = String(organizationId);
        this.log(`🏢 Including organization_id in balance request: ${params.organization_id}`);
      } else {
        this.log('⚠️ WARNING: No organization_id available from state or cookie!');
      }

      this.log(`📤 Balance request params:`, params);

      const result = await this.apiClient.get<{ balance: number }>('/balance', params);

      // If 401 error, try refreshing token and retry once
      if (!result.success && result.error === 'Authentication failed') {
        this.log('⚠️ Balance fetch got 401 - attempting token refresh...');
        const refreshed = await this.refreshToken();

        if (refreshed) {
          this.log('✅ Token refreshed, retrying balance fetch...');
          const retryResult = await this.apiClient.get<{ balance: number }>('/balance', params);

          if (retryResult.success && retryResult.data) {
            const previousBalance = this.state.balance;
            this.state.balance = retryResult.data.balance;

            this.log(`✅ Balance fetched after retry: ${this.state.balance} credits`);
            if (previousBalance !== this.state.balance) {
              this.log(`📊 Balance changed: ${previousBalance} → ${this.state.balance}`);
            }

            this.emit('balanceUpdate', { balance: this.state.balance });

            if (this.state.mode === 'embedded') {
              this.messageBridge.sendToParent('BALANCE_UPDATE', {
                balance: this.state.balance,
                timestamp: Date.now()
              });
            }

            return { success: true, balance: this.state.balance };
          }
        }

        // If refresh failed or retry failed, return error
        const error = result.message || 'Failed to get balance';
        this.log(`❌ Balance fetch failed after refresh attempt: ${error}`);
        return { success: false, error };
      }

      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.balance;

        this.log(`✅ Balance fetched: ${this.state.balance} credits`);
        if (previousBalance !== this.state.balance) {
          this.log(`📊 Balance changed: ${previousBalance} → ${this.state.balance}`);
        }

        this.emit('balanceUpdate', { balance: this.state.balance });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.log('📤 Sending BALANCE_UPDATE to parent');
          this.messageBridge.sendToParent('BALANCE_UPDATE', {
            balance: this.state.balance,
            timestamp: Date.now()
          });
        }

        return { success: true, balance: this.state.balance };
      } else {
        const error = result.message || 'Failed to get balance';
        this.log(`❌ Balance fetch failed: ${error}`);
        return { success: false, error };
      }
    } catch (error: any) {
      this.log(`❌ Balance fetch error: ${error.message}`);
      this.emit('error', { type: 'balance', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Spend credits
   */
  async spendCredits(amount: number, description?: string, referenceId?: string): Promise<SpendResult> {
    if (!this.state.isAuthenticated) {
      this.log('⚠️ Spend credits blocked: Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
      this.log(`⚠️ Spend credits blocked: Invalid amount (${amount})`);
      return { success: false, error: 'Invalid amount' };
    }

    if (amount > this.state.balance) {
      this.log(`⚠️ Spend credits blocked: Insufficient credits (need ${amount}, have ${this.state.balance})`);
      return { success: false, error: 'Insufficient credits' };
    }

    if(this.config.debug)this.log(`👤 User: ${this.state.user?.email} (ID: ${this.state.user?.id})`);

    // Get user_id from state
    const userId = this.state.user?.id;
    if (!userId) {
      this.log('⚠️ Spend credits blocked: User ID not found');
      return { success: false, error: 'User ID not found' };
    }

    // Get organization_id from selected organization or cookie
    const organizationId = this.state.selectedOrganization?.id || this.getOrganizationIdFromCookie();

    if(this.config.debug)this.log('organizationId', organizationId);

    if (!organizationId) {
      this.log('⚠️ Spend credits blocked: No selected organization found');
      return { success: false, error: 'No selected organization found' };
    }

    // Get user_role_id (optional) - get first role from selected org
    const userRoleId = this.state.selectedOrganization?.user_role_ids?.[0];

    this.log(`💳 Spending ${amount} credits...`);
    this.log(`👤 User ID: ${userId}`);
    this.log(`🏢 Organization ID: ${organizationId} (${this.state.selectedOrganization?.name || 'from cookie'})`);
    if (userRoleId) this.log(`🔑 User Role ID: ${userRoleId}`);
    if (description) this.log(`📝 Description: ${description}`);
    if (referenceId) this.log(`🔗 Reference ID: ${referenceId}`);

    try {
      const requestBody: any = {
        user_id: userId,
        organization_id: organizationId,
        amount,
        description,
        reference_id: referenceId
      };

      // Add user_role_id only if it exists
      if (userRoleId) {
        requestBody.user_role_id = userRoleId;
      }

      this.log('📤 Request payload:', requestBody);

      const result = await this.apiClient.post<any>('/spend', requestBody);

      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.new_balance;

        this.log(`✅ Credits spent successfully!`);
        this.log(`📊 Balance: ${previousBalance} → ${this.state.balance} (spent ${amount})`);

        this.emit('creditsSpent', {
          amount,
          description,
          previousBalance,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.log('📤 Sending CREDITS_SPENT to parent');
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
        const error = result.message || 'Failed to spend credits';
        this.log(`❌ Spend credits failed: ${error}`);
        return { success: false, error };
      }
    } catch (error: any) {
      this.log(`❌ Spend credits error: ${error.message}`);
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

    // Get user_id from state
    const userId = this.state.user?.id;
    if (!userId) {
      this.log('⚠️ Add credits blocked: User ID not found');
      return { success: false, error: 'User ID not found' };
    }

    // Get organization_id from selected organization or cookie
    const organizationId = this.state.selectedOrganization?.id || this.getOrganizationIdFromCookie();

    if (!organizationId) {
      this.log('⚠️ Add credits blocked: No selected organization found');
      return { success: false, error: 'No selected organization found' };
    }

    // Get user_role_id (optional) - get first role from selected org
    const userRoleId = this.state.selectedOrganization?.user_role_ids?.[0];

    this.log(`➕ Adding ${amount} credits...`);
    this.log(`👤 User ID: ${userId}`);
    this.log(`🏢 Organization ID: ${organizationId} (${this.state.selectedOrganization?.name || 'from cookie'})`);
    if (userRoleId) this.log(`🔑 User Role ID: ${userRoleId}`);
    if (description) this.log(`📝 Description: ${description}`);
    this.log(`🏷️ Type: ${type}`);

    try {
      const requestBody: any = {
        user_id: userId,
        organization_id: organizationId,
        amount,
        type,
        description
      };

      // Add user_role_id only if it exists
      if (userRoleId) {
        requestBody.user_role_id = userRoleId;
      }

      this.log('📤 Request payload:', requestBody);

      const result = await this.apiClient.post<any>('/add', requestBody);

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

    // Get organization_id from selected organization or cookie
    const organizationId = this.state.selectedOrganization?.id || this.getOrganizationIdFromCookie();

    if (!organizationId) {
      this.log('⚠️ Get history blocked: No selected organization found');
      return { success: false, error: 'No organization selected' };
    }

    // Convert page to offset (Laravel API uses offset, not page)
    const offset = (page - 1) * limit;

    this.log(`📜 Fetching transaction history (page ${page}, limit ${limit}, offset ${offset})...`);

    try {
      const result = await this.apiClient.get<any>(`/history?organization_id=${organizationId}&limit=${limit}&offset=${offset}`);

      if (result.success && result.data) {
        const pagination = result.data.pagination || {};
        const total = pagination.total || 0;
        const totalPages = Math.ceil(total / limit);

        // Transform transactions to match SDK format (add balance_after if missing)
        const transactions = (result.data.transactions || []).map((tx: any) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description || '',
          reference_id: tx.reference_id,
          created_at: tx.created_at,
          balance_after: tx.balance_after || 0, // Default to 0 if not provided by API
          user_id: tx.user_id
        }));

        this.log(`✅ Loaded ${transactions.length} transactions (total: ${total})`);

        return {
          success: true,
          transactions,
          total,
          page,
          pages: totalPages
        };
      } else {
        return { success: false, error: result.message || 'Failed to get history' };
      }
    } catch (error: any) {
      this.log(`❌ Failed to get history: ${error.message}`);
      this.emit('error', { type: 'history', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get AI agents
   * @param all - If true, fetches all agents for the organization. If false/undefined, fetches agents filtered by user's role IDs.
   */
  async getAgents(all: boolean = false): Promise<AgentsResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get organization_id from selected organization or cookie (for standalone mode)
    const organizationId = this.state.selectedOrganization?.id || this.getOrganizationIdFromCookie();

    this.log(`🔍 Organization ID (selected org or cookie): ${organizationId} (type: ${typeof organizationId})`);

    if (!organizationId) {
      this.log('⚠️ Get agents blocked: No selected organization found');
      return { success: false, error: 'No organization selected' };
    }

    // Build query parameters
    let queryParams = `organization_id=${organizationId}`;

    if (all) {
      // Fetch all agents for the organization
      queryParams += '&all=true';
      this.log(`🤖 Fetching all AI agents for organization ${organizationId}...`);
    } else {
      // Fetch agents filtered by user's role IDs
      // Try multiple sources: selectedOrganization.user_role_ids, or user.userRoleIds (from parent state)
      const roleIds = this.state.selectedOrganization?.user_role_ids || this.state.user?.userRoleIds;
      if (!roleIds || roleIds.length === 0) {
        this.log('⚠️ Get agents blocked: No role IDs found for user in selected organization');
        return { success: false, error: 'No role IDs found for user' };
      }
      queryParams += `&role_ids=${roleIds.join(',')}`;
      this.log(`🤖 Fetching AI agents for organization ${organizationId} with role_ids: ${roleIds.join(',')}...`);
    }

    try {
      const result = await this.agentsApiClient.get<any>(`?${queryParams}`);

      if (result.success && result.data) {
        // Handle various response structures
        let agents: any[] = [];
        let roleGrouped: import('../types').RoleGroupedAgents = {};

        if (Array.isArray(result.data)) {
          agents = result.data;
        } else if (result.data.agents) {
          // Handle nested agents structure: { agents: { all: [...] } } or { agents: { "2": { role_name: "CEO", agents: [...] } } }
          // Note: Admin/superadmin users get "all" format even without passing all=true
          if (Array.isArray(result.data.agents.all)) {
            // Agents are under "all" key (admin/superadmin response or all=true)
            agents = result.data.agents.all;
          } else if (Array.isArray(result.data.agents)) {
            // Direct array: { agents: [...] }
            agents = result.data.agents;
          } else if (typeof result.data.agents === 'object') {
            // For role-specific, agents might be in new format: { "2": { role_name: "CEO", agents: [...] } }
            // or old format: { "15": [...], "16": [...] }
            const agentObj = result.data.agents;
            Object.keys(agentObj).forEach(key => {
              // Skip "all" key which is for all=true response
              if (key === 'all') return;

              const roleData = agentObj[key];
              if (roleData && typeof roleData === 'object') {
                // Check if it's the new format with role_name and agents
                if (roleData.role_name && Array.isArray(roleData.agents)) {
                  // New format: { role_name: "CEO", agents: [...] }
                  roleGrouped[key] = {
                    role_name: roleData.role_name,
                    agents: roleData.agents
                  };
                  agents = agents.concat(roleData.agents);
                } else if (Array.isArray(roleData)) {
                  // Old format: direct array under role ID
                  agents = agents.concat(roleData);
                }
              }
            });
          }
        } else if (Array.isArray(result.data.data)) {
          agents = result.data.data;
        }

        const total = result.data.total || agents.length;
        const roleCount = Object.keys(roleGrouped).length;

        if (roleCount > 0) {
          this.log(`✅ Loaded ${agents.length} AI agents across ${roleCount} roles (total: ${total})`);
        } else {
          this.log(`✅ Loaded ${agents.length} AI agents (total: ${total})`);
        }

        return {
          success: true,
          agents,
          roleGrouped: roleCount > 0 ? roleGrouped : undefined,
          total
        };
      } else {
        return { success: false, error: result.message || 'Failed to get agents', agents: [] };
      }
    } catch (error: any) {
      this.log(`❌ Failed to get agents: ${error.message}`);
      this.emit('error', { type: 'agents', error: error.message });
      return { success: false, error: error.message, agents: [] };
    }
  }

  // ===================================================================
  // PERSONAS METHODS
  // ===================================================================

  /**
   * Read personas from cookie
   */
  private getOrganizationIdFromCookie(): string | null {
    try {
      const cookies = document.cookie.split(';');
      const orgCookie = cookies.find(c => c.trim().startsWith('user-selected-org-id='));
      if (orgCookie) {
        const value = orgCookie.split('=')[1];
        this.log(`🍪 Found organization ID in cookie: ${value}`);
        return value;
      }
    } catch (error: any) {
      this.log(`⚠️ Error reading organization ID from cookie: ${error.message}`);
    }
    return null;
  }

  private getPersonasFromCookie(): Persona[] {
    try {
      const cookies = document.cookie.split(';');
      const personasCookie = cookies.find(c => c.trim().startsWith('user-personas='));
      if (personasCookie) {
        const value = personasCookie.split('=')[1];
        const decoded = decodeURIComponent(value);
        const personas = JSON.parse(decoded);
        this.log(`🍪 Found ${personas.length} personas in cookie`);
        return personas;
      }
    } catch (error: any) {
      this.log(`⚠️ Error reading personas from cookie: ${error.message}`);
    }
    return [];
  }

  /**
   * Load personas for authenticated user
   * First tries to load from cookie, falls back to API if cookie is empty
   */
  private async loadPersonas(): Promise<void> {
    this.log('🎭 Loading personas...');

    // First, try to get personas from cookie
    const cookiePersonas = this.getPersonasFromCookie();

    if (cookiePersonas.length > 0) {
      this.log(`✅ Using ${cookiePersonas.length} personas from cookie (skipping API call)`);
      this.state.personas = cookiePersonas;
      this.emit('personasLoaded', { personas: cookiePersonas });

      // Notify parent if in embedded mode
      if (this.state.mode === 'embedded') {
        this.log('📤 Sending PERSONAS_LOADED to parent');
        this.messageBridge.sendToParent('PERSONAS_LOADED', {
          personas: cookiePersonas,
          timestamp: Date.now()
        });
      }
      return;
    }

    // If cookie is empty, fall back to API
    this.log('🍪 No personas in cookie, fetching from API...');

    try {
      const result = await this.personasClient.getPersonas();

      if (result.success && result.personas) {
        this.state.personas = result.personas;
        this.log(`✅ Loaded ${result.personas.length} personas from API`);
        this.emit('personasLoaded', { personas: result.personas });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.log('📤 Sending PERSONAS_LOADED to parent');
          this.messageBridge.sendToParent('PERSONAS_LOADED', {
            personas: result.personas,
            timestamp: Date.now()
          });
        }
      } else {
        this.log(`❌ Failed to load personas: ${result.error}`);
        this.emit('personasFailed', { error: result.error || 'Failed to load personas' });
      }
    } catch (error: any) {
      this.log(`❌ Error loading personas: ${error.message}`);
      this.emit('personasFailed', { error: error.message });
    }
  }

  /**
   * Get all personas for authenticated user
   * If no filters (organizationId/roleId) are provided, returns personas from cookie
   * Otherwise fetches from API with filters
   * @param organizationId - Optional organization ID to filter personas
   * @param roleId - Optional role ID to filter personas
   */
  async getPersonas(organizationId?: string | number, roleId?: string | number): Promise<PersonasResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    this.log('🎭 Fetching personas...');

    // If no filters provided, try to use cookie first
    if (!organizationId && !roleId) {
      const cookiePersonas = this.getPersonasFromCookie();
      if (cookiePersonas.length > 0) {
        this.log(`✅ Returning ${cookiePersonas.length} personas from cookie`);
        this.state.personas = cookiePersonas;
        return { success: true, personas: cookiePersonas };
      }
      this.log('🍪 No personas in cookie, fetching from API...');
    } else {
      this.log('🔍 Filters provided, fetching from API...');
    }

    const result = await this.personasClient.getPersonas(organizationId, roleId);

    if (result.success && result.personas) {
      this.state.personas = result.personas;
      this.emit('personasLoaded', { personas: result.personas });
    }

    return result;
  }

  /**
   * Get specific persona by ID
   */
  async getPersonaById(id: number): Promise<PersonaResult> {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    this.log(`🎭 Fetching persona ID: ${id}`);
    return await this.personasClient.getPersonaById(id);
  }

  // ===================================================================
  // USER STATE METHODS
  // ===================================================================

  /**
   * Request current user state from parent page (embedded mode only)
   */
  async requestCurrentUserState(): Promise<UserStateResult> {
    if (this.state.mode !== 'embedded') {
      this.log('⚠️ requestCurrentUserState blocked: Only available in embedded mode');
      return {
        success: false,
        error: 'requestCurrentUserState is only available in embedded mode'
      };
    }

    this.log('👤 Requesting current user state from parent...');

    return new Promise((resolve) => {
      // Set up one-time listener for response
      const responseHandler = (data: UserStateResponseMessage) => {
        this.log('✅ User state response received from parent');

        // Console log the response data as requested
        console.log('👤 RESPONSE_CURRENT_USER_STATE:', data.userState);

        if (data.userState) {
          this.log(`🏢 Organization: ${data.userState.orgName} (ID: ${data.userState.orgId})`);
          if (data.userState.orgSlug) {
            this.log(`🔗 Organization Slug: ${data.userState.orgSlug}`);
          }
          if (data.userState.orgDomain) {
            this.log(`🌐 Organization Domain: ${data.userState.orgDomain}`);
          }
          this.log(`👤 User ID: ${data.userState.userId}`);
          this.log(`🎭 User Role: ${data.userState.userRole}`);
          if (data.userState.userRoleIds) {
            this.log(`🎭 User Role IDs: [${data.userState.userRoleIds.join(', ')}]`);
          }
          if (data.userState.personas) {
            this.log(`📋 Personas Count: ${data.userState.personas.length}`);
          }

          // Save/override user state data in storage (same place as JWT token response)
          const auth = this.storage.get('auth');
          if (auth && auth.user) {
            // Update organizations array with selected status
            let updatedOrganizations = auth.user.organizations || [];

            if (data.userState?.orgId) {
              // Mark all orgs as not selected first
              updatedOrganizations = updatedOrganizations.map((org: any) => ({
                ...org,
                selectedStatus: false
              }));

              // Find and update the selected org, or add it if not exists
              const orgIndex = updatedOrganizations.findIndex((org: any) => org.id === data.userState?.orgId);
              if (orgIndex >= 0) {
                updatedOrganizations[orgIndex] = {
                  ...updatedOrganizations[orgIndex],
                  id: data.userState.orgId,
                  name: data.userState.orgName,
                  slug: data.userState.orgSlug,
                  domain: data.userState.orgDomain,
                  selectedStatus: true,
                  user_role_ids: data.userState.userRoleIds || updatedOrganizations[orgIndex].user_role_ids
                };
              } else {
                // Add new organization
                updatedOrganizations.push({
                  id: data.userState.orgId,
                  name: data.userState.orgName,
                  slug: data.userState.orgSlug,
                  domain: data.userState.orgDomain,
                  selectedStatus: true,
                  user_role_ids: data.userState.userRoleIds
                });
              }
            }

            // Update existing user with new state data
            const updatedUser = {
              ...auth.user,
              organizations: updatedOrganizations,
              userId: data.userState.userId,
              userRole: data.userState.userRole,
              // Also update userRoleIds if provided (for consistency with JWT token response)
              ...(data.userState.userRoleIds && { userRoleIds: data.userState.userRoleIds })
            };

            this.storage.set('auth', {
              ...auth,
              user: updatedUser
            });

            // Update SDK state
            this.state.user = updatedUser;

            // Sync organizations to state
            this.state.organizations = updatedOrganizations;
            this.state.selectedOrganization = updatedOrganizations.find(
              (org: any) => org.selectedStatus
            ) || null;
            this.emit('organizationsUpdated', { organizations: updatedOrganizations });

            // Update personas if provided
            if (data.userState.personas) {
              this.state.personas = data.userState.personas;
            }

            this.log('💾 User state saved and overridden in storage');
            const selectedOrg = updatedOrganizations.find((org: any) => org.selectedStatus);
            this.log('📊 Updated user fields:', {
              selectedOrganization: selectedOrg ? `${selectedOrg.name} (ID: ${selectedOrg.id})` : 'none',
              totalOrganizations: updatedOrganizations.length,
              userId: updatedUser.userId,
              userRole: updatedUser.userRole,
              userRoleIds: updatedUser.userRoleIds
            });
          }

          resolve({
            success: true,
            userState: data.userState
          });
        } else if (data.error) {
          this.log(`❌ User state request error: ${data.error}`);
          resolve({
            success: false,
            error: data.error
          });
        } else {
          this.log('❌ Invalid user state response from parent');
          resolve({
            success: false,
            error: 'Invalid response from parent'
          });
        }

        // Remove listener after handling response
        this.messageBridge.off('RESPONSE_CURRENT_USER_STATE', responseHandler);
      };

      // Add listener for response
      this.messageBridge.on('RESPONSE_CURRENT_USER_STATE', responseHandler);

      // Send request to parent
      this.messageBridge.sendToParent('REQUEST_CURRENT_USER_STATE', {
        origin: window.location.origin,
        timestamp: Date.now()
      });

      // Set timeout for response
      setTimeout(() => {
        this.log('⏰ User state request timeout - no response from parent');
        this.messageBridge.off('RESPONSE_CURRENT_USER_STATE', responseHandler);
        resolve({
          success: false,
          error: 'Timeout waiting for parent response'
        });
      }, 5000); // 5 second timeout
    });
  }

  /**
   * Request user organizations from parent page (embedded mode only)
   */
  async requestUserOrganizations(): Promise<import('../types').UserOrgsResult> {
    if (this.state.mode !== 'embedded') {
      this.log('⚠️ requestUserOrganizations blocked: Only available in embedded mode');
      return {
        success: false,
        error: 'requestUserOrganizations is only available in embedded mode'
      };
    }

    this.log('🏢 Requesting user organizations from parent...');

    return new Promise((resolve) => {
      // Set up one-time listener for response
      const responseHandler = (data: import('../types').UserOrgsResponseMessage) => {
        this.log('✅ User organizations response received from parent');

        // Console log the response data
        console.log('🏢 RESPONSE_USER_ORGS:', data);

        if (data.organizations) {
          this.log(`📋 Organizations Count: ${data.organizations.length}`);

          // Log selected organization
          const selectedOrg = data.organizations.find(org => org.selectedStatus === true);
          if (selectedOrg) {
            this.log(`✅ Selected Organization: ${selectedOrg.name} (ID: ${selectedOrg.id})`);
          }

          resolve({
            success: true,
            organizations: data.organizations,
            count: data.count || data.organizations.length
          });
        } else if (data.error) {
          this.log(`❌ User organizations request error: ${data.error}`);
          resolve({
            success: false,
            error: data.error
          });
        } else {
          this.log('❌ Invalid user organizations response from parent');
          resolve({
            success: false,
            error: 'Invalid response from parent'
          });
        }

        // Remove listener after handling response
        this.messageBridge.off('RESPONSE_USER_ORGS', responseHandler);
      };

      // Add listener for response
      this.messageBridge.on('RESPONSE_USER_ORGS', responseHandler);

      // Send request to parent
      this.messageBridge.sendToParent('REQUEST_USER_ORGS', {
        origin: window.location.origin,
        timestamp: Date.now()
      });

      // Set timeout for response
      setTimeout(() => {
        this.log('⏰ User organizations request timeout - no response from parent');
        this.messageBridge.off('RESPONSE_USER_ORGS', responseHandler);
        resolve({
          success: false,
          error: 'Timeout waiting for parent response'
        });
      }, 5000); // 5 second timeout
    });
  }

  /**
   * Request user personas from parent page (embedded mode only)
   */
  async requestUserPersonas(): Promise<import('../types').UserPersonasResult> {
    if (this.state.mode !== 'embedded') {
      this.log('⚠️ requestUserPersonas blocked: Only available in embedded mode');
      return {
        success: false,
        error: 'requestUserPersonas is only available in embedded mode'
      };
    }

    this.log('👥 Requesting user personas from parent...');

    return new Promise((resolve) => {
      // Set up one-time listener for response
      const responseHandler = (data: import('../types').UserPersonasResponseMessage) => {
        this.log('✅ User personas response received from parent');

        // Console log the response data
        console.log('👥 RESPONSE_USER_PERSONAS:', data);

        if (data.personas) {
          this.log(`📋 Personas Count: ${data.personas.length}`);

          // Log persona names
          if (data.personas.length > 0) {
            this.log(`📝 Personas: ${data.personas.map(p => p.name).join(', ')}`);
          }

          resolve({
            success: true,
            personas: data.personas,
            count: data.count || data.personas.length
          });
        } else if (data.error) {
          this.log(`❌ User personas request error: ${data.error}`);
          resolve({
            success: false,
            error: data.error
          });
        } else {
          this.log('❌ Invalid user personas response from parent');
          resolve({
            success: false,
            error: 'Invalid response from parent'
          });
        }

        // Remove listener after handling response
        this.messageBridge.off('RESPONSE_USER_PERSONAS', responseHandler);
      };

      // Add listener for response
      this.messageBridge.on('RESPONSE_USER_PERSONAS', responseHandler);

      // Send request to parent
      this.messageBridge.sendToParent('REQUEST_USER_PERSONAS', {
        origin: window.location.origin,
        timestamp: Date.now()
      });

      // Set timeout for response
      setTimeout(() => {
        this.log('⏰ User personas request timeout - no response from parent');
        this.messageBridge.off('RESPONSE_USER_PERSONAS', responseHandler);
        resolve({
          success: false,
          error: 'Timeout waiting for parent response'
        });
      }, 5000); // 5 second timeout
    });
  }

  /**
   * Refresh JWT token
   */
  private async refreshToken(): Promise<boolean> {
    const auth = this.storage.get('auth');

    this.log('═══════════════════════════════════════════════════');
    this.log('🔄 TOKEN REFRESH CYCLE STARTED');
    this.log('═══════════════════════════════════════════════════');

    if (!auth?.refreshToken) {
      this.log('❌ CRITICAL: No refresh token found in storage!');
      this.log('   Cannot proceed with token refresh');
      return false;
    }

    this.log('✅ Refresh token found in storage');
    this.log(`   Length: ${auth.refreshToken?.length || 0} characters`);
    this.log(`   Preview: ${auth.refreshToken?.substring(0, 30)}...`);

    try {
      this.log('📤 Initiating token refresh request...');
      const result = await this.authManager.refreshToken(auth.refreshToken);

      if (result.success && result.tokens) {
        this.log('');
        this.log('✅ TOKEN REFRESH SUCCESSFUL!');
        this.log('───────────────────────────────────────────────────');

        const hasNewRefreshToken = !!result.tokens.refresh_token;
        const oldRefreshToken = auth.refreshToken;
        const newRefreshToken = result.tokens.refresh_token || oldRefreshToken;

        this.log('📊 Token Status:');
        this.log(`   ✓ New Access Token:  ${result.tokens.access_token?.substring(0, 30)}...`);
        this.log(`   ✓ Access Token Length: ${result.tokens.access_token?.length || 0} chars`);

        if (hasNewRefreshToken) {
          this.log(`   ✓ New Refresh Token: ${result.tokens.refresh_token?.substring(0, 30)}...`);
          this.log('   ℹ️ Server returned NEW refresh token - will use this for next cycle');
        } else {
          this.log('   ⚠️ Server did NOT return new refresh token');
          this.log(`   ✓ Preserving OLD refresh token: ${oldRefreshToken?.substring(0, 30)}...`);
          this.log('   ℹ️ Will reuse same refresh token for next cycle');
        }

        // Update storage - preserve old refresh token if new one not provided
        this.storage.set('auth', {
          ...auth,
          token: result.tokens.access_token,
          refreshToken: newRefreshToken
        });

        this.log('');
        this.log('💾 Storage Updated Successfully:');
        this.log(`   • Access Token:  UPDATED ✓`);
        this.log(`   • Refresh Token: ${hasNewRefreshToken ? 'UPDATED ✓' : 'PRESERVED ✓'}`);
        this.log(`   • User Data:     PRESERVED ✓`);

        // Update in-memory state with new tokens
        this.state.accessToken = result.tokens.access_token;
        if (hasNewRefreshToken) {
          this.state.refreshToken = result.tokens.refresh_token!;
        }

        this.emit('tokenRefreshed');
        this.emit('tokensUpdated', {
          accessToken: result.tokens.access_token,
          refreshToken: newRefreshToken
        });

        // Notify parent if in embedded mode
        if (this.state.mode === 'embedded') {
          this.log('📤 Sending JWT_TOKEN_REFRESHED to parent');
          this.messageBridge.sendToParent('JWT_TOKEN_REFRESHED', {
            token: result.tokens.access_token,
            timestamp: Date.now()
          });
        }

        this.log('');
        this.log('✨ TOKEN REFRESH CYCLE COMPLETED SUCCESSFULLY');
        this.log('═══════════════════════════════════════════════════');

        return true;
      } else {
        this.log('');
        this.log('❌ TOKEN REFRESH FAILED: Invalid response from server');
        this.log('═══════════════════════════════════════════════════');
      }
    } catch (error) {
      this.log('');
      this.log('❌ TOKEN REFRESH ERROR:', error);
      this.log('═══════════════════════════════════════════════════');
    }

    this.log('⚠️ Token expired - authentication required');
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
   * Switch to a different organization
   */
  async switchOrganization(orgId: string): Promise<SwitchOrgResult> {
    this.log(`🔄 switchOrganization called with orgId: ${orgId} (type: ${typeof orgId})`);

    if (!this.state.isAuthenticated || !this.state.user) {
      this.log('❌ switchOrganization: User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    this.log(`📋 SDK has ${this.state.organizations.length} organizations in state`);
    if (this.state.organizations.length > 0) {
      this.log('📋 Organization IDs in SDK state:', this.state.organizations.map(o => `${o.id} (type: ${typeof o.id}, selectedStatus: ${o.selectedStatus})`));
    }

    if (this.state.organizations.length === 0) {
      this.log('❌ switchOrganization: No organizations in SDK state');
      return { success: false, error: 'No organizations found for user' };
    }

    const targetOrg = this.state.organizations.find(org => String(org.id) === String(orgId));
    if (!targetOrg) {
      this.log(`❌ switchOrganization: Organization with ID ${orgId} not found. Available IDs: ${this.state.organizations.map(o => o.id).join(', ')}`);
      return { success: false, error: `Organization with ID ${orgId} not found` };
    }

    const previousOrg = this.state.selectedOrganization;
    if (String(previousOrg?.id) === String(orgId)) {
      this.log(`ℹ️ switchOrganization: Already on org ${orgId}, no change needed`);
      return { success: true, previousOrgId: String(orgId), newOrgId: String(orgId) };
    }

    // Update organizations array
    const isMatch = (org: Organization) => String(org.id) === String(orgId);
    const updatedOrgs = this.state.organizations.map(org => ({
      ...org,
      selectedStatus: isMatch(org),
      isSelected: isMatch(org),
    }));

    // Update state
    this.state.organizations = updatedOrgs;
    this.state.selectedOrganization = updatedOrgs.find(o => o.selectedStatus) || null;

    // Update user.organizations to keep in sync
    if (this.state.user) {
      this.state.user = {
        ...this.state.user,
        organizations: updatedOrgs,
      };
    }

    // Update storage
    const auth = this.storage.get('auth');
    if (auth) {
      this.storage.set('auth', {
        ...auth,
        user: { ...auth.user, organizations: updatedOrgs },
      });
    }

    // Update cookie for API compatibility
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    document.cookie = `user-selected-org-id=${orgId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;

    this.log(`🏢 Organization switched: ${previousOrg?.name} -> ${targetOrg.name}`);
    this.log('📋 Updated organizations:', updatedOrgs.map(o => `${o.name}: selectedStatus=${o.selectedStatus}`));

    this.emit('organizationSwitched', {
      previousOrgId: previousOrg?.id,
      newOrgId: orgId,
      organization: this.state.selectedOrganization!,
    });

    // Also emit organizationsUpdated so React hook syncs the full list
    this.emit('organizationsUpdated', { organizations: updatedOrgs });

    return {
      success: true,
      previousOrgId: previousOrg?.id,
      newOrgId: orgId,
    };
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