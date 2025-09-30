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
    tokens: AuthTokens;
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

      if (response.ok && data.success && data.data) {
        if (this.debug) {
          console.log('Token refreshed successfully');
        }

        return {
          success: true,
          tokens: data.data.tokens
        };
      } else {
        return {
          success: false,
          message: data.message || 'Token refresh failed'
        };
      }
    } catch (error: any) {
      if (this.debug) {
        console.error('Token refresh error:', error);
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