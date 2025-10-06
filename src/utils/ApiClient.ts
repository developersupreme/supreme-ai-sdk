/**
 * ApiClient - Handles API requests with JWT authentication
 */

import type { ApiResponse } from '../types';

export class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;
  private debug: boolean;

  constructor(baseUrl: string, getToken: () => string | null, debug: boolean = false) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
    this.debug = debug;
  }

  /**
   * Make a GET request
   */
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint);
  }

  /**
   * Make a POST request
   */
  async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body);
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body);
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  /**
   * Make a request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();

    if (!token) {
      return {
        success: false,
        error: 'No authentication token available'
      };
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;

      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      };

      const options: RequestInit = {
        method,
        headers
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }

      if (this.debug) {
        console.log(`[ApiClient] ${method} ${url}`, body || '');
      }

      const response = await fetch(url, options);
      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          data: data.data,
          message: data.message
        };
      } else {
        // Handle specific HTTP status codes
        if (response.status === 401) {
          return {
            success: false,
            error: 'Authentication failed',
            message: data.message || 'Unauthorized'
          };
        } else if (response.status === 403) {
          return {
            success: false,
            error: 'Access denied',
            message: data.message || 'Forbidden'
          };
        } else {
          return {
            success: false,
            error: data.error || 'Request failed',
            message: data.message || `Request failed with status ${response.status}`
          };
        }
      }
    } catch (error: any) {
      if (this.debug) {
        console.error('[ApiClient] Request error:', error);
      }

      return {
        success: false,
        error: error.message || 'Network error',
        message: 'Failed to connect to the server'
      };
    }
  }

  /**
   * Set the token (for dynamic updates)
   */
  setToken(getToken: () => string | null): void {
    this.getToken = getToken;
  }
}