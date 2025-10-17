/**
 * AuthManager - Handles JWT authentication
 */

import type { AuthTokens, User } from '../types';

interface LoginResponse {
  success: boolean;
  data?: {
    user: User;
    tokens: AuthTokens;
  };
  message?: string;
}

interface RefreshResponse {
  success: boolean;
  data?: {
    tokens?: AuthTokens;
    access_token?: string;
    expires_in?: number;
  };
  message?: string;
}

export class AuthManager {
  private authUrl: string;
  private debug: boolean;

  constructor(authUrl: string, debug: boolean = false) {
    this.authUrl = authUrl;
    this.debug = debug;
  }

  /**
   * Login with credentials
   */
  async login(email: string, password: string): Promise<{
    success: boolean;
    tokens?: AuthTokens;
    user?: User;
    message?: string;
  }> {
    try {
      const response = await fetch(`${this.authUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data: LoginResponse = await response.json();

      if (response.ok && data.success && data.data) {
        if (this.debug) {
          console.log('Login successful');
        }

        return {
          success: true,
          tokens: data.data.tokens,
          user: data.data.user
        };
      } else {
        return {
          success: false,
          message: data.message || 'Login failed'
        };
      }
    } catch (error: any) {
      if (this.debug) {
        console.error('Login error:', error);
      }

      return {
        success: false,
        message: error.message || 'Network error'
      };
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.authUrl}/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      return response.ok && data.success;
    } catch (error) {
      if (this.debug) {
        console.error('Token validation error:', error);
      }
      return false;
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    tokens?: AuthTokens;
    message?: string;
  }> {
    if (this.debug) {
      console.log('[AuthManager] 📤 Sending token refresh request to server');
      console.log('[AuthManager] 🔐 Using refresh token (length):', refreshToken?.length || 0);
    }

    try {
      const response = await fetch(`${this.authUrl}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      const data: RefreshResponse = await response.json();

      if (this.debug) {
        console.log('[AuthManager] 📥 Server response status:', response.status);
        console.log('[AuthManager] 📦 RAW Server response:', JSON.stringify(data, null, 2));
        console.log('[AuthManager] 📦 Parsed response:', {
          success: data.success,
          hasData: !!data.data,
          hasTokensObject: !!data.data?.tokens,
          hasAccessToken: !!data.data?.access_token,
          hasRefreshToken: !!(data.data?.tokens?.refresh_token || data.data?.access_token)
        });
      }

      if (response.ok && data.success && data.data) {
        // Handle both response formats:
        // Format 1: { data: { tokens: { access_token, refresh_token } } }
        // Format 2: { data: { access_token, expires_in } } (server only returns access_token)
        const hasNewRefreshToken = !!(data.data.tokens?.refresh_token);
        const tokens: AuthTokens = data.data.tokens || {
          access_token: data.data.access_token!,
          refresh_token: undefined as any // Will be preserved by CreditSystemClient
        };

        if (this.debug) {
          console.log('[AuthManager] ✅ Token refresh successful');
          console.log('[AuthManager] 🎟️ Received new access_token:', tokens.access_token?.substring(0, 20) + '...');
          if (hasNewRefreshToken) {
            console.log('[AuthManager] 🔄 Received NEW refresh_token:', tokens.refresh_token?.substring(0, 20) + '...');
          } else {
            console.log('[AuthManager] ⚠️ Server did NOT return new refresh_token');
            console.log('[AuthManager] 💡 CreditSystemClient will preserve existing refresh_token');
          }
        }

        return {
          success: true,
          tokens: tokens
        };
      } else {
        if (this.debug) {
          console.error('[AuthManager] ❌ Token refresh failed:', data.message);
        }
        return {
          success: false,
          message: data.message || 'Token refresh failed'
        };
      }
    } catch (error: any) {
      if (this.debug) {
        console.error('[AuthManager] ❌ Token refresh network error:', error.message);
      }

      return {
        success: false,
        message: error.message || 'Network error'
      };
    }
  }

  /**
   * Logout
   */
  async logout(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.authUrl}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      return response.ok && data.success;
    } catch (error) {
      if (this.debug) {
        console.error('Logout error:', error);
      }
      return false;
    }
  }
}