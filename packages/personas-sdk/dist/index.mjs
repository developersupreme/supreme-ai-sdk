// src/utils/ApiClient.ts
var ApiClient = class {
  constructor(baseUrl, getToken, debug = false) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
    this.debug = debug;
  }
  log(...args) {
    if (this.debug) {
      console.log("[PersonasSDK]", ...args);
    }
  }
  /**
   * Make a GET request
   */
  async get(endpoint) {
    return this.request("GET", endpoint);
  }
  /**
   * Make a request
   */
  async request(method, endpoint, body) {
    const token = this.getToken();
    if (!token) {
      this.log("\u26A0\uFE0F No JWT token available");
      return {
        success: false,
        error: "No authentication token available"
      };
    }
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      };
      const options = {
        method,
        headers
      };
      this.log(`\u{1F4E1} ${method} ${url}`);
      const response = await fetch(url, options);
      const data = await response.json();
      if (response.ok && data.success) {
        this.log(`\u2705 ${method} ${endpoint} - Success`);
        return {
          success: true,
          data: data.data,
          message: data.message
        };
      } else {
        this.log(`\u274C ${method} ${endpoint} - Failed: ${data.error || data.message}`);
        return {
          success: false,
          error: data.error || "Request failed",
          message: data.message || `Request failed with status ${response.status}`
        };
      }
    } catch (error) {
      this.log(`\u274C Request error: ${error.message}`);
      return {
        success: false,
        error: error.message || "Network error",
        message: "Failed to connect to the server"
      };
    }
  }
};

// src/core/PersonasClient.ts
var PersonasClient = class {
  constructor(config = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || "/api/secure-credits/jwt",
      debug: config.debug || false,
      getAuthToken: config.getAuthToken || (() => null)
    };
    this.apiClient = new ApiClient(
      this.config.apiBaseUrl,
      this.config.getAuthToken,
      this.config.debug
    );
  }
  /**
   * Get all personas
   */
  async getPersonas() {
    this.log("\u{1F464} Fetching personas...");
    try {
      const result = await this.apiClient.get("/get-persona");
      if (result.success && result.data) {
        const personas = Array.isArray(result.data) ? result.data : result.data.personas || [];
        this.log(`\u2705 Fetched ${personas.length} personas`);
        return {
          success: true,
          personas
        };
      } else {
        const error = result.message || result.error || "Failed to get personas";
        this.log(`\u274C Failed to fetch personas: ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      this.log(`\u274C Error fetching personas: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  /**
   * Get persona by ID
   */
  async getPersonaById(id) {
    this.log(`\u{1F464} Fetching persona #${id}...`);
    try {
      const result = await this.apiClient.get(`/get-persona/${id}`);
      if (result.success && result.data) {
        this.log(`\u2705 Fetched persona: ${result.data.name || id}`);
        return {
          success: true,
          persona: result.data
        };
      } else {
        const error = result.message || result.error || "Failed to get persona";
        this.log(`\u274C Failed to fetch persona #${id}: ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      this.log(`\u274C Error fetching persona #${id}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  /**
   * Debug logging
   */
  log(...args) {
    if (this.config.debug) {
      console.log("[PersonasSDK]", ...args);
    }
  }
};

// src/react/usePersonas.tsx
import { useState, useCallback, useRef } from "react";
function usePersonas(config) {
  const clientRef = useRef(null);
  if (!clientRef.current) {
    clientRef.current = new PersonasClient(config);
  }
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const getPersonas = useCallback(async () => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    setLoading(true);
    setError(null);
    const result = await clientRef.current.getPersonas();
    if (result.success && result.personas) {
      setPersonas(result.personas);
    } else if (result.error) {
      setError(result.error);
    }
    setLoading(false);
    return result;
  }, []);
  const getPersonaById = useCallback(async (id) => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    setLoading(true);
    setError(null);
    const result = await clientRef.current.getPersonaById(id);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
    return result;
  }, []);
  const refreshPersonas = useCallback(async () => {
    await getPersonas();
  }, [getPersonas]);
  return {
    personas,
    loading,
    error,
    getPersonas,
    getPersonaById,
    refreshPersonas
  };
}
export {
  PersonasClient,
  usePersonas
};
