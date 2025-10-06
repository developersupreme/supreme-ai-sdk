/**
 * Supreme AI Personas SDK - Main Client
 */

import { ApiClient } from '../utils/ApiClient';
import type {
  PersonasSDKConfig,
  PersonasResult,
  PersonaResult
} from '../types';

export class PersonasClient {
  private config: Required<PersonasSDKConfig>;
  private apiClient: ApiClient;

  constructor(config: PersonasSDKConfig = {}) {
    // Configuration with defaults
    this.config = {
      apiBaseUrl: config.apiBaseUrl || '/api/secure-credits/jwt',
      debug: config.debug || false,
      getAuthToken: config.getAuthToken || (() => null)
    };

    // Initialize API client
    this.apiClient = new ApiClient(
      this.config.apiBaseUrl,
      this.config.getAuthToken,
      this.config.debug
    );
  }

  /**
   * Get all personas
   */
  async getPersonas(): Promise<PersonasResult> {
    this.log('👤 Fetching personas...');

    try {
      const result = await this.apiClient.get<any>('/get-persona');

      if (result.success && result.data) {
        const personas = Array.isArray(result.data) ? result.data : (result.data.personas || []);
        this.log(`✅ Fetched ${personas.length} personas`);

        return {
          success: true,
          personas
        };
      } else {
        const error = result.message || result.error || 'Failed to get personas';
        this.log(`❌ Failed to fetch personas: ${error}`);
        return { success: false, error };
      }
    } catch (error: any) {
      this.log(`❌ Error fetching personas: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get persona by ID
   */
  async getPersonaById(id: number): Promise<PersonaResult> {
    this.log(`👤 Fetching persona #${id}...`);

    try {
      const result = await this.apiClient.get<any>(`/get-persona/${id}`);

      if (result.success && result.data) {
        this.log(`✅ Fetched persona: ${result.data.name || id}`);

        return {
          success: true,
          persona: result.data
        };
      } else {
        const error = result.message || result.error || 'Failed to get persona';
        this.log(`❌ Failed to fetch persona #${id}: ${error}`);
        return { success: false, error };
      }
    } catch (error: any) {
      this.log(`❌ Error fetching persona #${id}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[PersonasSDK]', ...args);
    }
  }
}
