// src/utils/EventEmitter.ts
var EventEmitter = class {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
    this.debug = false;
  }
  /**
   * Subscribe to an event
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, /* @__PURE__ */ new Set());
    }
    this.events.get(event).add(listener);
    return this;
  }
  /**
   * Subscribe to an event once
   */
  once(event, listener) {
    const onceWrapper = (data) => {
      listener(data);
      this.off(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }
  /**
   * Unsubscribe from an event
   */
  off(event, listener) {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }
  /**
   * Emit an event
   */
  emit(event, data) {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) return false;
    listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        if (this.debug) {
          console.error(`Error in event listener for "${String(event)}":`, error);
        }
      }
    });
    return true;
  }
  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
  /**
   * Get listener count for an event
   */
  listenerCount(event) {
    const listeners = this.events.get(event);
    return listeners ? listeners.size : 0;
  }
};

// src/utils/MessageBridge.ts
var MessageBridge = class extends EventEmitter {
  constructor(allowedOrigins = [], debug = false) {
    super();
    this.allowedOrigins = allowedOrigins;
    this.debug = debug;
    this.isIframe = window !== window.parent;
    this.setupMessageListener();
  }
  /**
   * Set up message listener
   */
  setupMessageListener() {
    this.messageHandler = (event) => {
      if (!this.isValidOrigin(event.origin)) {
        if (this.debug) {
          console.warn("Message from untrusted origin:", event.origin);
        }
        return;
      }
      if (event.data && event.data.type) {
        if (this.debug) {
          console.log("Message received:", event.data);
        }
        this.emit(event.data.type, event.data);
        this.emit("message", event.data);
      }
    };
    window.addEventListener("message", this.messageHandler);
  }
  /**
   * Validate message origin
   */
  isValidOrigin(origin) {
    if (origin === window.location.origin) {
      return true;
    }
    if (this.allowedOrigins.length === 0) {
      return true;
    }
    return this.allowedOrigins.includes(origin);
  }
  /**
   * Send message to parent window
   */
  sendToParent(type, data = {}) {
    if (!this.isIframe) {
      if (this.debug) {
        console.warn("Not in iframe, cannot send to parent");
      }
      return false;
    }
    const message = {
      type,
      ...data,
      timestamp: Date.now()
    };
    if (this.debug) {
      console.log("Sending to parent:", message);
    }
    window.parent.postMessage(message, "*");
    return true;
  }
  /**
   * Send message to iframe
   */
  sendToIframe(iframe, type, data = {}) {
    if (!iframe || !iframe.contentWindow) {
      if (this.debug) {
        console.warn("Invalid iframe element");
      }
      return false;
    }
    const message = {
      type,
      ...data,
      timestamp: Date.now()
    };
    if (this.debug) {
      console.log("Sending to iframe:", message);
    }
    iframe.contentWindow.postMessage(message, "*");
    return true;
  }
  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin) {
    if (!this.allowedOrigins.includes(origin)) {
      this.allowedOrigins.push(origin);
    }
  }
  /**
   * Remove allowed origin
   */
  removeAllowedOrigin(origin) {
    const index = this.allowedOrigins.indexOf(origin);
    if (index > -1) {
      this.allowedOrigins.splice(index, 1);
    }
  }
  /**
   * Destroy the message bridge
   */
  destroy() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
    }
    this.removeAllListeners();
  }
};

// src/utils/AuthManager.ts
var AuthManager = class {
  constructor(authUrl, debug = false) {
    this.authUrl = authUrl;
    this.debug = debug;
  }
  /**
   * Login with credentials
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.authUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        if (this.debug) {
          console.log("Login successful");
        }
        return {
          success: true,
          tokens: data.data.tokens,
          user: data.data.user
        };
      } else {
        return {
          success: false,
          message: data.message || "Login failed"
        };
      }
    } catch (error) {
      if (this.debug) {
        console.error("Login error:", error);
      }
      return {
        success: false,
        message: error.message || "Network error"
      };
    }
  }
  /**
   * Validate JWT token
   */
  async validateToken(token) {
    try {
      const response = await fetch(`${this.authUrl}/validate`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });
      const data = await response.json();
      return response.ok && data.success;
    } catch (error) {
      if (this.debug) {
        console.error("Token validation error:", error);
      }
      return false;
    }
  }
  /**
   * Refresh JWT token
   */
  async refreshToken(refreshToken) {
    try {
      const response = await fetch(`${this.authUrl}/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        if (this.debug) {
          console.log("Token refreshed successfully");
        }
        return {
          success: true,
          tokens: data.data.tokens
        };
      } else {
        return {
          success: false,
          message: data.message || "Token refresh failed"
        };
      }
    } catch (error) {
      if (this.debug) {
        console.error("Token refresh error:", error);
      }
      return {
        success: false,
        message: error.message || "Network error"
      };
    }
  }
  /**
   * Logout
   */
  async logout(token) {
    try {
      const response = await fetch(`${this.authUrl}/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });
      const data = await response.json();
      return response.ok && data.success;
    } catch (error) {
      if (this.debug) {
        console.error("Logout error:", error);
      }
      return false;
    }
  }
};

// src/utils/ApiClient.ts
var ApiClient = class {
  constructor(baseUrl, getToken, debug = false) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
    this.debug = debug;
  }
  /**
   * Make a GET request
   */
  async get(endpoint) {
    return this.request("GET", endpoint);
  }
  /**
   * Make a POST request
   */
  async post(endpoint, body) {
    return this.request("POST", endpoint, body);
  }
  /**
   * Make a PUT request
   */
  async put(endpoint, body) {
    return this.request("PUT", endpoint, body);
  }
  /**
   * Make a DELETE request
   */
  async delete(endpoint) {
    return this.request("DELETE", endpoint);
  }
  /**
   * Make a request
   */
  async request(method, endpoint, body) {
    const token = this.getToken();
    if (!token) {
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
      if (body && (method === "POST" || method === "PUT")) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
      if (this.debug) {
        console.log(`[ApiClient] ${method} ${url}`, body || "");
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
        if (response.status === 401) {
          return {
            success: false,
            error: "Authentication failed",
            message: data.message || "Unauthorized"
          };
        } else if (response.status === 403) {
          return {
            success: false,
            error: "Access denied",
            message: data.message || "Forbidden"
          };
        } else {
          return {
            success: false,
            error: data.error || "Request failed",
            message: data.message || `Request failed with status ${response.status}`
          };
        }
      }
    } catch (error) {
      if (this.debug) {
        console.error("[ApiClient] Request error:", error);
      }
      return {
        success: false,
        error: error.message || "Network error",
        message: "Failed to connect to the server"
      };
    }
  }
  /**
   * Set the token (for dynamic updates)
   */
  setToken(getToken) {
    this.getToken = getToken;
  }
};

// src/utils/StorageManager.ts
var StorageManager = class {
  constructor(prefix = "", debug = false) {
    this.prefix = prefix;
    this.debug = debug;
  }
  /**
   * Get an item from storage
   */
  get(key) {
    try {
      const item = sessionStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      if (this.debug) {
        console.error("Storage get error:", error);
      }
      return null;
    }
  }
  /**
   * Set an item in storage
   */
  set(key, value) {
    try {
      sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (this.debug) {
        console.error("Storage set error:", error);
      }
      return false;
    }
  }
  /**
   * Remove an item from storage
   */
  remove(key) {
    try {
      sessionStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      if (this.debug) {
        console.error("Storage remove error:", error);
      }
      return false;
    }
  }
  /**
   * Clear all items with the prefix
   */
  clear() {
    try {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => sessionStorage.removeItem(key));
      return true;
    } catch (error) {
      if (this.debug) {
        console.error("Storage clear error:", error);
      }
      return false;
    }
  }
  /**
   * Check if an item exists
   */
  has(key) {
    return sessionStorage.getItem(this.prefix + key) !== null;
  }
};

// src/core/PersonasClient.ts
var PersonasClient = class {
  constructor(config) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.getAuthToken = config.getAuthToken;
    this.debug = config.debug || false;
  }
  /**
   * Log messages if debug mode is enabled
   */
  log(...args) {
    if (this.debug) {
      console.log("[PersonasClient]", ...args);
    }
  }
  /**
   * Make authenticated API request
   */
  async makeRequest(endpoint, options = {}) {
    const token = this.getAuthToken();
    if (!token) {
      this.log("\u274C No authentication token available");
      return {
        success: false,
        error: "Authentication required"
      };
    }
    try {
      this.log(`\u{1F4E1} Making request to: ${this.apiBaseUrl}${endpoint}`);
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...options.headers
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        this.log(`\u2705 Request successful: ${endpoint}`);
        return {
          success: true,
          data: data.data,
          message: data.message
        };
      } else {
        this.log(`\u274C Request failed: ${data.message || "Unknown error"}`);
        return {
          success: false,
          error: data.message || "Request failed"
        };
      }
    } catch (error) {
      this.log(`\u274C Network error: ${error.message}`);
      return {
        success: false,
        error: error.message || "Network error"
      };
    }
  }
  /**
   * Get all personas
   */
  async getPersonas() {
    this.log("\u{1F3AD} Fetching all personas...");
    const token = this.getAuthToken();
    if (!token) {
      this.log("\u274C No authentication token available");
      return {
        success: false,
        error: "Authentication required"
      };
    }
    try {
      this.log(`\u{1F4E1} Making request to: ${this.apiBaseUrl}/personas/jwt/list`);
      const response = await fetch(`${this.apiBaseUrl}/personas/jwt/list`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        this.log(`\u274C HTTP error: ${response.status}`);
        return {
          success: false,
          error: `HTTP error: ${response.status}`
        };
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        this.log(`\u2705 Fetched ${data.length} personas`);
        return {
          success: true,
          personas: data
        };
      }
      if (data.success && data.data) {
        this.log(`\u2705 Fetched ${data.data.length} personas`);
        return {
          success: true,
          personas: data.data
        };
      }
      this.log(`\u274C Unexpected response format`);
      return {
        success: false,
        error: "Unexpected response format"
      };
    } catch (error) {
      this.log(`\u274C Error fetching personas: ${error.message}`);
      return {
        success: false,
        error: error.message || "Unknown error"
      };
    }
  }
  /**
   * Get a specific persona by ID
   */
  async getPersonaById(id) {
    this.log(`\u{1F3AD} Fetching persona with ID: ${id}`);
    try {
      const response = await this.makeRequest(`/get-persona/${id}`);
      if (response.success && response.data) {
        this.log(`\u2705 Fetched persona: ${response.data.name || "Unknown"}`);
        return {
          success: true,
          persona: response.data
        };
      } else {
        return {
          success: false,
          error: response.error || "Failed to fetch persona"
        };
      }
    } catch (error) {
      this.log(`\u274C Error fetching persona: ${error.message}`);
      return {
        success: false,
        error: error.message || "Unknown error"
      };
    }
  }
};

// src/core/CreditSystemClient.ts
var CreditSystemClient = class extends EventEmitter {
  constructor(config = {}) {
    super();
    this.parentResponseReceived = false;
    this.debug = config.debug || false;
    this.config = {
      apiBaseUrl: config.apiBaseUrl || "/api/secure-credits/jwt",
      authUrl: config.authUrl || "/api/jwt",
      parentTimeout: config.parentTimeout || 3e3,
      tokenRefreshInterval: config.tokenRefreshInterval || 6e5,
      // 10 minutes
      balanceRefreshInterval: config.balanceRefreshInterval || 3e4,
      // 30 seconds
      allowedOrigins: config.allowedOrigins || [window.location.origin],
      autoInit: config.autoInit !== false,
      debug: config.debug || false,
      storagePrefix: config.storagePrefix || "creditSystem_",
      mode: config.mode || "auto",
      features: {
        credits: config.features?.credits !== false,
        // Default true
        personas: config.features?.personas !== false
        // Default true
      },
      onAuthRequired: config.onAuthRequired || (() => {
      }),
      onTokenExpired: config.onTokenExpired || (() => {
      })
    };
    this.state = {
      mode: null,
      isInIframe: window !== window.parent,
      isInitialized: false,
      isAuthenticated: false,
      user: null,
      balance: 0,
      personas: []
    };
    this.storage = new StorageManager(this.config.storagePrefix, this.config.debug);
    this.messageBridge = new MessageBridge(this.config.allowedOrigins, this.config.debug);
    this.authManager = new AuthManager(this.config.authUrl, this.config.debug);
    this.apiClient = new ApiClient(this.config.apiBaseUrl, () => this.getAuthToken(), this.config.debug);
    const personasBaseUrl = this.config.apiBaseUrl.replace("/secure-credits/jwt", "");
    this.personasClient = new PersonasClient({
      apiBaseUrl: personasBaseUrl,
      getAuthToken: () => this.getAuthToken(),
      debug: this.config.debug
    });
    this.setupEventHandlers();
    if (this.config.autoInit) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
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
  async initialize() {
    if (this.state.isInitialized) {
      this.log("Credit system already initialized");
      return;
    }
    this.log("Initializing Credit System...");
    if (this.config.mode === "auto") {
      this.state.mode = this.state.isInIframe ? "embedded" : "standalone";
    } else {
      this.state.mode = this.config.mode;
    }
    this.log(`Operating in ${this.state.mode.toUpperCase()} mode`);
    this.emit("modeDetected", { mode: this.state.mode });
    if (this.state.mode === "embedded") {
      await this.initializeEmbeddedMode();
    } else {
      await this.initializeStandaloneMode();
    }
  }
  /**
   * Initialize embedded mode (iframe)
   */
  async initializeEmbeddedMode() {
    this.log("\u{1F3AC} Initializing embedded mode (iframe)...");
    this.log(`\u23F1\uFE0F Parent timeout set to ${this.config.parentTimeout}ms`);
    this.messageBridge.on("JWT_TOKEN_RESPONSE", (data) => {
      this.log("\u{1F4E8} Received JWT_TOKEN_RESPONSE from parent");
      this.handleParentTokenResponse(data);
    });
    this.log("\u{1F511} Requesting JWT token from parent...");
    this.log(`\u{1F4CD} Iframe origin: ${window.location.origin}`);
    this.messageBridge.sendToParent("REQUEST_JWT_TOKEN", {
      origin: window.location.origin,
      timestamp: Date.now()
    });
    this.emit("waitingForParent");
    this.log("\u23F3 Waiting for parent response...");
    setTimeout(() => {
      if (!this.parentResponseReceived) {
        this.log(`\u23F0 Timeout! No response from parent after ${this.config.parentTimeout}ms`);
        this.log("\u{1F504} Switching to standalone mode");
        this.emit("parentTimeout");
        this.initializeStandaloneMode();
      }
    }, this.config.parentTimeout);
  }
  /**
   * Handle JWT token response from parent
   */
  handleParentTokenResponse(data) {
    this.parentResponseReceived = true;
    this.log("\u2705 Parent response received!");
    if (data.token) {
      this.log("\u{1F39F}\uFE0F JWT token received from parent");
      this.log(`\u{1F464} User: ${data.user?.email || "Unknown"}`);
      this.log(`\u{1F510} Token length: ${data.token?.length || 0} characters`);
      this.storage.set("auth", {
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user
      });
      this.log("\u{1F4BE} Tokens saved to storage");
      this.state.user = data.user || null;
      this.state.isAuthenticated = true;
      this.log("\u{1F680} Initializing with token...");
      this.initializeWithToken();
      this.log("\u{1F4E4} Sending CREDIT_SYSTEM_READY to parent");
      this.messageBridge.sendToParent("CREDIT_SYSTEM_READY", {
        user: this.state.user,
        mode: "embedded"
      });
      this.log("\u2728 Embedded mode initialization complete!");
    } else if (data.error) {
      this.log(`\u274C Parent authentication error: ${data.error}`);
      this.emit("parentAuthRequired", { error: data.error });
      this.log("\u{1F504} Falling back to standalone mode");
      this.initializeStandaloneMode();
    }
  }
  /**
   * Initialize standalone mode
   */
  async initializeStandaloneMode() {
    this.state.mode = "standalone";
    this.log("\u{1F5A5}\uFE0F Initializing standalone mode...");
    const savedAuth = this.storage.get("auth");
    if (savedAuth && savedAuth.token) {
      this.log("\u{1F50D} Found saved JWT tokens, validating...");
      this.log(`\u{1F464} Saved user: ${savedAuth.user?.email || "Unknown"}`);
      const isValid = await this.authManager.validateToken(savedAuth.token);
      if (isValid) {
        this.log("\u2705 Token is valid!");
        this.state.user = savedAuth.user;
        this.state.isAuthenticated = true;
        this.log("\u{1F680} Initializing with valid token...");
        this.initializeWithToken();
      } else {
        this.log("\u274C Token validation failed");
        if (savedAuth.refreshToken) {
          this.log("\u{1F504} Attempting token refresh...");
          const refreshed = await this.refreshToken();
          if (!refreshed) {
            this.log("\u274C Token refresh failed - authentication required");
            this.emit("authRequired");
            this.config.onAuthRequired();
          }
        } else {
          this.log("\u274C No refresh token available - authentication required");
          this.emit("authRequired");
          this.config.onAuthRequired();
        }
      }
    } else {
      this.log("\u2139\uFE0F No saved tokens found - authentication required");
      this.emit("authRequired");
      this.config.onAuthRequired();
    }
  }
  /**
   * Initialize with valid JWT token
   */
  initializeWithToken() {
    this.state.isInitialized = true;
    this.startTokenRefreshTimer();
    if (this.config.features.credits) {
      this.checkBalance();
      if (this.config.balanceRefreshInterval > 0) {
        this.startBalanceRefreshTimer();
      }
    }
    if (this.config.features.personas) {
      this.loadPersonas();
    }
    this.emit("ready", {
      user: this.state.user,
      mode: this.state.mode
    });
  }
  /**
   * Get current auth token
   */
  getAuthToken() {
    const auth = this.storage.get("auth");
    return auth?.token || null;
  }
  /**
   * Login with credentials (standalone mode)
   */
  async login(email, password) {
    if (this.state.mode === "embedded") {
      this.log("\u26A0\uFE0F Login attempt blocked: Not available in embedded mode");
      return {
        success: false,
        error: "Login not available in embedded mode"
      };
    }
    this.log("\u{1F510} Login attempt started...");
    this.log(`\u{1F4E7} Email: ${email}`);
    this.emit("loginStart");
    try {
      const result = await this.authManager.login(email, password);
      if (result.success && result.tokens && result.user) {
        this.log("\u2705 Login successful!");
        this.log(`\u{1F464} User: ${result.user.email}`);
        this.log(`\u{1F510} Token length: ${result.tokens.access_token?.length || 0} characters`);
        this.storage.set("auth", {
          token: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          user: result.user
        });
        this.log("\u{1F4BE} Tokens saved to storage");
        this.state.user = result.user;
        this.state.isAuthenticated = true;
        this.log("\u{1F680} Initializing with token...");
        this.initializeWithToken();
        this.emit("loginSuccess", { user: result.user });
        return { success: true, user: result.user, tokens: result.tokens };
      } else {
        const error = result.message || "Login failed";
        this.log(`\u274C Login failed: ${error}`);
        this.emit("loginError", { error });
        return { success: false, error };
      }
    } catch (error) {
      const errorMsg = error.message || "Network error";
      this.log(`\u274C Login error: ${errorMsg}`);
      this.emit("loginError", { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }
  /**
   * Logout
   */
  async logout() {
    this.emit("logoutStart");
    try {
      const token = this.getAuthToken();
      if (token) {
        await this.authManager.logout(token);
      }
    } catch (error) {
      this.log("Logout API error:", error);
    }
    this.state.user = null;
    this.state.balance = 0;
    this.state.isInitialized = false;
    this.state.isAuthenticated = false;
    this.storage.remove("auth");
    this.clearTimers();
    if (this.state.mode === "embedded") {
      this.messageBridge.sendToParent("LOGOUT", {
        timestamp: Date.now()
      });
    }
    this.emit("logoutSuccess");
  }
  /**
   * Check current credit balance
   */
  async checkBalance() {
    if (!this.state.isAuthenticated) {
      this.log("\u26A0\uFE0F Balance check blocked: Not authenticated");
      return { success: false, error: "Not authenticated" };
    }
    this.log("\u{1F4B0} Fetching current balance...");
    try {
      const result = await this.apiClient.get("/balance");
      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.balance;
        this.log(`\u2705 Balance fetched: ${this.state.balance} credits`);
        if (previousBalance !== this.state.balance) {
          this.log(`\u{1F4CA} Balance changed: ${previousBalance} \u2192 ${this.state.balance}`);
        }
        this.emit("balanceUpdate", { balance: this.state.balance });
        if (this.state.mode === "embedded") {
          this.log("\u{1F4E4} Sending BALANCE_UPDATE to parent");
          this.messageBridge.sendToParent("BALANCE_UPDATE", {
            balance: this.state.balance,
            timestamp: Date.now()
          });
        }
        return { success: true, balance: this.state.balance };
      } else {
        const error = result.message || "Failed to get balance";
        this.log(`\u274C Balance fetch failed: ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      this.log(`\u274C Balance fetch error: ${error.message}`);
      this.emit("error", { type: "balance", error: error.message });
      return { success: false, error: error.message };
    }
  }
  /**
   * Spend credits
   */
  async spendCredits(amount, description, referenceId) {
    if (!this.state.isAuthenticated) {
      this.log("\u26A0\uFE0F Spend credits blocked: Not authenticated");
      return { success: false, error: "Not authenticated" };
    }
    if (amount <= 0) {
      this.log(`\u26A0\uFE0F Spend credits blocked: Invalid amount (${amount})`);
      return { success: false, error: "Invalid amount" };
    }
    if (amount > this.state.balance) {
      this.log(`\u26A0\uFE0F Spend credits blocked: Insufficient credits (need ${amount}, have ${this.state.balance})`);
      return { success: false, error: "Insufficient credits" };
    }
    this.log(`\u{1F4B3} Spending ${amount} credits...`);
    if (description) this.log(`\u{1F4DD} Description: ${description}`);
    if (referenceId) this.log(`\u{1F517} Reference ID: ${referenceId}`);
    try {
      const result = await this.apiClient.post("/spend", {
        amount,
        description,
        reference_id: referenceId
      });
      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.new_balance;
        this.log(`\u2705 Credits spent successfully!`);
        this.log(`\u{1F4CA} Balance: ${previousBalance} \u2192 ${this.state.balance} (spent ${amount})`);
        this.emit("creditsSpent", {
          amount,
          description,
          previousBalance,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        });
        if (this.state.mode === "embedded") {
          this.log("\u{1F4E4} Sending CREDITS_SPENT to parent");
          this.messageBridge.sendToParent("CREDITS_SPENT", {
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
        const error = result.message || "Failed to spend credits";
        this.log(`\u274C Spend credits failed: ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      this.log(`\u274C Spend credits error: ${error.message}`);
      this.emit("error", { type: "spend", error: error.message });
      return { success: false, error: error.message };
    }
  }
  /**
   * Add credits
   */
  async addCredits(amount, type = "purchase", description) {
    if (!this.state.isAuthenticated) {
      return { success: false, error: "Not authenticated" };
    }
    if (amount <= 0) {
      return { success: false, error: "Invalid amount" };
    }
    try {
      const result = await this.apiClient.post("/add", {
        amount,
        type,
        description
      });
      if (result.success && result.data) {
        const previousBalance = this.state.balance;
        this.state.balance = result.data.new_balance;
        this.emit("creditsAdded", {
          amount,
          type,
          description,
          previousBalance,
          newBalance: this.state.balance,
          transaction: result.data.transaction
        });
        if (this.state.mode === "embedded") {
          this.messageBridge.sendToParent("CREDITS_ADDED", {
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
        return { success: false, error: result.message || "Failed to add credits" };
      }
    } catch (error) {
      this.emit("error", { type: "add", error: error.message });
      return { success: false, error: error.message };
    }
  }
  /**
   * Get transaction history
   */
  async getHistory(page = 1, limit = 10) {
    if (!this.state.isAuthenticated) {
      return { success: false, error: "Not authenticated" };
    }
    try {
      const result = await this.apiClient.get(`/history?page=${page}&limit=${limit}`);
      if (result.success && result.data) {
        return {
          success: true,
          transactions: result.data.transactions,
          total: result.data.total,
          page: result.data.current_page,
          pages: result.data.total_pages
        };
      } else {
        return { success: false, error: result.message || "Failed to get history" };
      }
    } catch (error) {
      this.emit("error", { type: "history", error: error.message });
      return { success: false, error: error.message };
    }
  }
  // ===================================================================
  // PERSONAS METHODS
  // ===================================================================
  /**
   * Load personas for authenticated user
   */
  async loadPersonas() {
    this.log("\u{1F3AD} Loading personas...");
    try {
      const result = await this.personasClient.getPersonas();
      if (result.success && result.personas) {
        this.state.personas = result.personas;
        this.log(`\u2705 Loaded ${result.personas.length} personas`);
        this.emit("personasLoaded", { personas: result.personas });
        if (this.state.mode === "embedded") {
          this.log("\u{1F4E4} Sending PERSONAS_LOADED to parent");
          this.messageBridge.sendToParent("PERSONAS_LOADED", {
            personas: result.personas,
            timestamp: Date.now()
          });
        }
      } else {
        this.log(`\u274C Failed to load personas: ${result.error}`);
        this.emit("personasFailed", { error: result.error || "Failed to load personas" });
      }
    } catch (error) {
      this.log(`\u274C Error loading personas: ${error.message}`);
      this.emit("personasFailed", { error: error.message });
    }
  }
  /**
   * Get all personas for authenticated user
   */
  async getPersonas() {
    if (!this.state.isAuthenticated) {
      return { success: false, error: "Not authenticated" };
    }
    this.log("\u{1F3AD} Fetching personas...");
    const result = await this.personasClient.getPersonas();
    if (result.success && result.personas) {
      this.state.personas = result.personas;
      this.emit("personasLoaded", { personas: result.personas });
    }
    return result;
  }
  /**
   * Get specific persona by ID
   */
  async getPersonaById(id) {
    if (!this.state.isAuthenticated) {
      return { success: false, error: "Not authenticated" };
    }
    this.log(`\u{1F3AD} Fetching persona ID: ${id}`);
    return await this.personasClient.getPersonaById(id);
  }
  /**
   * Refresh JWT token
   */
  async refreshToken() {
    const auth = this.storage.get("auth");
    if (!auth?.refreshToken) {
      this.log("\u26A0\uFE0F Token refresh blocked: No refresh token available");
      return false;
    }
    this.log("\u{1F504} Refreshing JWT token...");
    this.log(`\u{1F510} Refresh token length: ${auth.refreshToken?.length || 0} characters`);
    try {
      const result = await this.authManager.refreshToken(auth.refreshToken);
      if (result.success && result.tokens) {
        this.log("\u2705 Token refreshed successfully!");
        this.log(`\u{1F510} New token length: ${result.tokens.access_token?.length || 0} characters`);
        this.storage.set("auth", {
          ...auth,
          token: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token
        });
        this.log("\u{1F4BE} New tokens saved to storage");
        this.emit("tokenRefreshed");
        if (this.state.mode === "embedded") {
          this.log("\u{1F4E4} Sending JWT_TOKEN_REFRESHED to parent");
          this.messageBridge.sendToParent("JWT_TOKEN_REFRESHED", {
            token: result.tokens.access_token,
            timestamp: Date.now()
          });
        }
        return true;
      } else {
        this.log("\u274C Token refresh failed: Invalid response");
      }
    } catch (error) {
      this.log("\u274C Token refresh error:", error);
    }
    this.log("\u26A0\uFE0F Token expired - authentication required");
    this.emit("tokenExpired");
    this.config.onTokenExpired();
    return false;
  }
  /**
   * Start token refresh timer
   */
  startTokenRefreshTimer() {
    this.clearTokenTimer();
    this.tokenTimer = setInterval(async () => {
      await this.refreshToken();
    }, this.config.tokenRefreshInterval);
  }
  /**
   * Start balance refresh timer
   */
  startBalanceRefreshTimer() {
    this.clearBalanceTimer();
    this.balanceTimer = setInterval(async () => {
      await this.checkBalance();
    }, this.config.balanceRefreshInterval);
  }
  /**
   * Clear all timers
   */
  clearTimers() {
    this.clearTokenTimer();
    this.clearBalanceTimer();
  }
  clearTokenTimer() {
    if (this.tokenTimer) {
      clearInterval(this.tokenTimer);
      this.tokenTimer = void 0;
    }
  }
  clearBalanceTimer() {
    if (this.balanceTimer) {
      clearInterval(this.balanceTimer);
      this.balanceTimer = void 0;
    }
  }
  /**
   * Set up internal event handlers
   */
  setupEventHandlers() {
    if (this.state.isInIframe) {
      this.messageBridge.on("REFRESH_BALANCE", () => {
        this.checkBalance();
      });
      this.messageBridge.on("GET_STATUS", () => {
        this.messageBridge.sendToParent("STATUS_RESPONSE", {
          initialized: this.state.isInitialized,
          mode: this.state.mode,
          user: this.state.user,
          balance: this.state.balance,
          timestamp: Date.now()
        });
      });
      this.messageBridge.on("CLEAR_STORAGE", () => {
        this.logout();
      });
    }
  }
  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
  /**
   * Debug logging
   */
  log(...args) {
    if (this.config.debug) {
      console.log("[CreditSystem]", ...args);
    }
  }
  /**
   * Destroy the client
   */
  destroy() {
    this.clearTimers();
    this.messageBridge.destroy();
    this.removeAllListeners();
    this.state.isInitialized = false;
  }
};

// src/react/useCreditSystem.tsx
import { useState, useEffect, useCallback, useRef } from "react";
function useCreditSystem(config) {
  const clientRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState(null);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const client = new CreditSystemClient({
      ...config,
      autoInit: true
    });
    clientRef.current = client;
    client.on("ready", (data) => {
      if (data) {
        setIsInitialized(true);
        setIsAuthenticated(true);
        setUser(data.user);
        setMode(data.mode);
        setLoading(false);
      }
    });
    client.on("modeDetected", (data) => {
      if (data) {
        setMode(data.mode);
      }
    });
    client.on("authRequired", () => {
      setIsAuthenticated(false);
      setLoading(false);
    });
    client.on("loginSuccess", (data) => {
      if (data) {
        setIsAuthenticated(true);
        setUser(data.user);
        setError(null);
      }
    });
    client.on("loginError", (data) => {
      if (data) {
        setError(data.error);
      }
    });
    client.on("logoutSuccess", () => {
      setIsAuthenticated(false);
      setUser(null);
      setBalance(null);
    });
    client.on("balanceUpdate", (data) => {
      if (data) {
        setBalance(data.balance);
      }
    });
    client.on("personasLoaded", (data) => {
      if (data) {
        setPersonas(data.personas);
      }
    });
    client.on("personasFailed", (data) => {
      if (data) {
        console.error("Failed to load personas:", data.error);
      }
    });
    client.on("error", (data) => {
      if (data) {
        setError(`${data.type}: ${data.error}`);
      }
    });
    client.on("tokenExpired", () => {
      setIsAuthenticated(false);
      setError("Session expired. Please login again.");
    });
    return () => {
      client.destroy();
    };
  }, []);
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    if (!clientRef.current) {
      setLoading(false);
      return { success: false, error: "Client not initialized" };
    }
    const result = await clientRef.current.login(email, password);
    setLoading(false);
    return result;
  }, []);
  const logout = useCallback(async () => {
    if (!clientRef.current) return;
    await clientRef.current.logout();
  }, []);
  const checkBalance = useCallback(async () => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    return await clientRef.current.checkBalance();
  }, []);
  const spendCredits = useCallback(async (amount, description, referenceId) => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    return await clientRef.current.spendCredits(amount, description, referenceId);
  }, []);
  const addCredits = useCallback(async (amount, type, description) => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    return await clientRef.current.addCredits(amount, type, description);
  }, []);
  const getHistory = useCallback(async (page, limit) => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    return await clientRef.current.getHistory(page, limit);
  }, []);
  const getPersonas = useCallback(async () => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    return await clientRef.current.getPersonas();
  }, []);
  const getPersonaById = useCallback(async (id) => {
    if (!clientRef.current) {
      return { success: false, error: "Client not initialized" };
    }
    return await clientRef.current.getPersonaById(id);
  }, []);
  return {
    isInitialized,
    isAuthenticated,
    mode,
    user,
    balance,
    personas,
    loading,
    error,
    login,
    logout,
    checkBalance,
    spendCredits,
    addCredits,
    getHistory,
    getPersonas,
    getPersonaById
  };
}

// src/react/CreditSystemProvider.tsx
import { createContext, useContext } from "react";
import { jsx } from "react/jsx-runtime";
var CreditSystemContext = createContext(void 0);
function CreditSystemProvider({ children, config }) {
  const creditSystem = useCreditSystem(config);
  return /* @__PURE__ */ jsx(CreditSystemContext.Provider, { value: creditSystem, children });
}
function useCreditContext() {
  const context = useContext(CreditSystemContext);
  if (!context) {
    throw new Error("useCreditContext must be used within a CreditSystemProvider");
  }
  return context;
}

// src/parent/ParentIntegrator.ts
var ParentIntegrator = class {
  constructor(config) {
    this.iframe = null;
    this.config = config;
    this.setupMessageListener();
  }
  /**
   * Attach to an iframe element
   */
  attachToIframe(iframe) {
    this.iframe = iframe;
    iframe.addEventListener("load", () => {
      if (this.config.debug) {
        console.log("[ParentIntegrator] Iframe loaded");
      }
    });
  }
  /**
   * Set up message listener for iframe communication
   */
  setupMessageListener() {
    this.messageHandler = async (event) => {
      if (!this.isValidOrigin(event.origin)) {
        if (this.config.debug) {
          console.warn("[ParentIntegrator] Invalid origin:", event.origin);
        }
        return;
      }
      if (!event.data || !event.data.type) return;
      if (this.config.debug) {
        console.log("[ParentIntegrator] Received message:", event.data.type, event.data);
      }
      switch (event.data.type) {
        case "REQUEST_JWT_TOKEN":
          await this.handleTokenRequest();
          break;
        case "CREDIT_SYSTEM_READY":
          this.handleIframeReady(event.data);
          break;
        case "BALANCE_UPDATE":
          this.handleBalanceUpdate(event.data);
          break;
        case "CREDITS_SPENT":
          this.handleCreditsSpent(event.data);
          break;
        case "CREDITS_ADDED":
          this.handleCreditsAdded(event.data);
          break;
        case "JWT_TOKEN_REFRESHED":
          this.handleTokenRefreshed(event.data);
          break;
        case "LOGOUT":
          this.handleLogout();
          break;
        case "ERROR":
          this.handleError(event.data);
          break;
        case "STATUS_RESPONSE":
          this.handleStatusResponse(event.data);
          break;
        default:
          if (this.config.debug) {
            console.log("[ParentIntegrator] Unhandled message type:", event.data.type);
          }
      }
    };
    window.addEventListener("message", this.messageHandler);
  }
  /**
   * Handle JWT token request from iframe
   */
  async handleTokenRequest() {
    if (this.config.debug) {
      console.log("[ParentIntegrator] Iframe requesting JWT token");
    }
    try {
      const tokenData = await this.config.getJWTToken();
      if (tokenData) {
        this.cachedToken = tokenData;
        this.sendToIframe("JWT_TOKEN_RESPONSE", {
          token: tokenData.token,
          refreshToken: tokenData.refreshToken,
          user: tokenData.user,
          timestamp: Date.now()
        });
        if (this.config.debug) {
          console.log("[ParentIntegrator] JWT token sent to iframe");
        }
      } else {
        this.sendToIframe("JWT_TOKEN_RESPONSE", {
          token: null,
          error: "Authentication required",
          timestamp: Date.now()
        });
        if (this.config.debug) {
          console.log("[ParentIntegrator] No JWT token available");
        }
      }
    } catch (error) {
      if (this.config.debug) {
        console.error("[ParentIntegrator] Error getting JWT token:", error);
      }
      this.sendToIframe("JWT_TOKEN_RESPONSE", {
        token: null,
        error: error.message || "Failed to get token",
        timestamp: Date.now()
      });
    }
  }
  /**
   * Handle iframe ready event
   */
  handleIframeReady(data) {
    if (this.config.debug) {
      console.log("[ParentIntegrator] Credit system ready:", data);
    }
    if (this.config.onIframeReady) {
      this.config.onIframeReady();
    }
  }
  /**
   * Handle balance update
   */
  handleBalanceUpdate(data) {
    if (this.config.onBalanceUpdate) {
      this.config.onBalanceUpdate(data.balance);
    }
  }
  /**
   * Handle credits spent
   */
  handleCreditsSpent(data) {
    if (this.config.onCreditsSpent) {
      this.config.onCreditsSpent(data.amount, data.newBalance);
    }
  }
  /**
   * Handle credits added
   */
  handleCreditsAdded(data) {
    if (this.config.onCreditsAdded) {
      this.config.onCreditsAdded(data.amount, data.newBalance);
    }
  }
  /**
   * Handle token refreshed
   */
  handleTokenRefreshed(data) {
    if (data.token && this.cachedToken) {
      this.cachedToken.token = data.token;
    }
  }
  /**
   * Handle logout
   */
  handleLogout() {
    this.cachedToken = void 0;
    if (this.config.onLogout) {
      this.config.onLogout();
    }
  }
  /**
   * Handle error
   */
  handleError(data) {
    if (this.config.onError) {
      this.config.onError(data.message || "Unknown error");
    }
  }
  /**
   * Handle status response
   */
  handleStatusResponse(data) {
    if (this.config.debug) {
      console.log("[ParentIntegrator] Status:", data);
    }
  }
  /**
   * Send message to iframe
   */
  sendToIframe(type, data = {}) {
    if (!this.iframe || !this.iframe.contentWindow) {
      if (this.config.debug) {
        console.warn("[ParentIntegrator] Iframe not ready");
      }
      return false;
    }
    const message = {
      type,
      ...data,
      timestamp: Date.now()
    };
    if (this.config.debug) {
      console.log("[ParentIntegrator] Sending to iframe:", message);
    }
    this.iframe.contentWindow.postMessage(message, "*");
    return true;
  }
  /**
   * Validate message origin
   */
  isValidOrigin(origin) {
    if (origin === window.location.origin) {
      return true;
    }
    if (this.config.allowedOrigins && this.config.allowedOrigins.length > 0) {
      return this.config.allowedOrigins.includes(origin);
    }
    return true;
  }
  /**
   * Request balance refresh from iframe
   */
  refreshBalance() {
    this.sendToIframe("REFRESH_BALANCE");
  }
  /**
   * Request status from iframe
   */
  getStatus() {
    this.sendToIframe("GET_STATUS");
  }
  /**
   * Clear iframe storage
   */
  clearStorage() {
    this.sendToIframe("CLEAR_STORAGE");
  }
  /**
   * Send custom message to iframe
   */
  sendCustomMessage(message, data) {
    this.sendToIframe("CUSTOM_MESSAGE", { message, ...data });
  }
  /**
   * Destroy the integrator
   */
  destroy() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
    }
    this.iframe = null;
    this.cachedToken = void 0;
  }
};

// src/index.ts
var index_default = CreditSystemClient;
export {
  CreditSystemClient,
  CreditSystemProvider,
  ParentIntegrator,
  PersonasClient,
  index_default as default,
  useCreditContext,
  useCreditSystem
};
