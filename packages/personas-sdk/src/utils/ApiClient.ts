/**
 * ApiClient - Handles API requests with JWT authentication
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;
  private debug: boolean;

  constructor(baseUrl: string, getToken: () => string | null, debug: boolean = false) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
    this.debug = debug;
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[PersonasSDK]', ...args);
    }
  }

  /**
   * Make a GET request
   */
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint);
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
      this.log('⚠️ No JWT token available');
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

      this.log(`📡 ${method} ${url}`);

      const response = await fetch(url, options);
      const data = await response.json();

      if (response.ok && data.success) {
        this.log(`✅ ${method} ${endpoint} - Success`);
        return {
          success: true,
          data: data.data,
          message: data.message
        };
      } else {
        this.log(`❌ ${method} ${endpoint} - Failed: ${data.error || data.message}`);
        return {
          success: false,
          error: data.error || 'Request failed',
          message: data.message || `Request failed with status ${response.status}`
        };
      }
    } catch (error: any) {
      this.log(`❌ Request error: ${error.message}`);

      return {
        success: false,
        error: error.message || 'Network error',
        message: 'Failed to connect to the server'
      };
    }
  }
}
