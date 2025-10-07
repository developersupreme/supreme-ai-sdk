/**
 * PersonasClient - Handles persona management
 */

import type { Persona, PersonasResult, PersonaResult, ApiResponse } from '../types';

export interface PersonasClientConfig {
  apiBaseUrl: string;
  getAuthToken: () => string | null;
  debug?: boolean;
}

export class PersonasClient {
  private apiBaseUrl: string;
  private getAuthToken: () => string | null;
  private debug: boolean;

  constructor(config: PersonasClientConfig) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.getAuthToken = config.getAuthToken;
    this.debug = config.debug || false;
  }

  /**
   * Log messages if debug mode is enabled
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[PersonasClient]', ...args);
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getAuthToken();

    if (!token) {
      this.log('❌ No authentication token available');
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    try {
      this.log(`📡 Making request to: ${this.apiBaseUrl}${endpoint}`);

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.log(`✅ Request successful: ${endpoint}`);
        return {
          success: true,
          data: data.data,
          message: data.message
        };
      } else {
        this.log(`❌ Request failed: ${data.message || 'Unknown error'}`);
        return {
          success: false,
          error: data.message || 'Request failed'
        };
      }
    } catch (error: any) {
      this.log(`❌ Network error: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  /**
   * Get all personas
   */
  async getPersonas(): Promise<PersonasResult> {
    this.log('🎭 Fetching all personas...');

    const token = this.getAuthToken();
    if (!token) {
      this.log('❌ No authentication token available');
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    try {
      this.log(`📡 Making request to: ${this.apiBaseUrl}/personas/jwt/list`);

      const response = await fetch(`${this.apiBaseUrl}/personas/jwt/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        this.log(`❌ HTTP error: ${response.status}`);
        return {
          success: false,
          error: `HTTP error: ${response.status}`
        };
      }

      const data = await response.json();

      // Handle direct array response (current Laravel format)
      if (Array.isArray(data)) {
        this.log(`✅ Fetched ${data.length} personas`);
        return {
          success: true,
          personas: data
        };
      }

      // Handle structured response {success, data}
      if (data.success && data.data) {
        this.log(`✅ Fetched ${data.data.length} personas`);
        return {
          success: true,
          personas: data.data
        };
      }

      this.log(`❌ Unexpected response format`);
      return {
        success: false,
        error: 'Unexpected response format'
      };
    } catch (error: any) {
      this.log(`❌ Error fetching personas: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Get a specific persona by ID
   */
  async getPersonaById(id: number): Promise<PersonaResult> {
    this.log(`🎭 Fetching persona with ID: ${id}`);

    try {
      const response = await this.makeRequest<Persona>(`/get-persona/${id}`);

      if (response.success && response.data) {
        this.log(`✅ Fetched persona: ${response.data.name || 'Unknown'}`);
        return {
          success: true,
          persona: response.data
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to fetch persona'
        };
      }
    } catch (error: any) {
      this.log(`❌ Error fetching persona: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
}
