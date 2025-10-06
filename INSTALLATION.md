# Supreme AI Credit System - JWT Authentication Documentation

## Table of Contents

-   [Overview](#overview)
-   [Authentication Flow](#authentication-flow)
    -   [Standalone Mode](#standalone-mode)
    -   [Embedded Mode (iframe)](#embedded-mode-iframe)
-   [Implementation Details](#implementation-details)
    -   [Lovable App Setup & Installation](#1-lovable-app-setup--installation)
    -   [JWT Token Structure](#2-jwt-token-structure)
    -   [Custom Hook Implementation](#3-implementation-custom-hook-usesimplecreditsystem)
    -   [Standalone Mode Implementation](#4-standalone-mode-implementation)
    -   [Embedded Mode Implementation](#5-embedded-mode-implementation)
    -   [SDK Methods Reference](#6-sdk-methods-reference)
    -   [Supreme Credit SDK](#7-supreme-credit-sdk-npm-package)
    -   [Custom Hook vs SDK Comparison](#8-comparison-custom-hook-vs-sdk)
    -   [Parent Page Integration](#9-parent-page-integration)
-   [API Endpoints](#api-endpoints)
-   [Security Best Practices](#security-best-practices-client-side)
    -   [Token Storage](#1-token-storage)
    -   [PostMessage Origin Validation](#2-postmessage-origin-validation)
    -   [Automatic Token Refresh](#3-automatic-token-refresh)
    -   [Environment Variables](#4-environment-variables)
    -   [SDK Security Configuration](#5-sdk-security-configuration)
    -   [HTTPS Only in Production](#6-https-only-in-production)
-   [Sequence Diagrams](#sequence-diagrams)
-   [Environment Configuration](#environment-configuration)
-   [Troubleshooting](#troubleshooting)
-   [Best Practices](#best-practices)
-   [Conclusion](#conclusion)

---

## Overview

The Supreme AI Credit System is a comprehensive credit management platform that supports two operational modes:

1. **Standalone Mode**: Direct application usage with username/password authentication
2. **Embedded Mode**: iframe integration using parent session-based JWT tokens

Both modes utilize JWT (JSON Web Tokens) for secure API authentication, with different token acquisition methods.

---

## Authentication Flow

### Standalone Mode

In standalone mode, users authenticate directly with email/password to obtain JWT tokens.

```mermaid
sequenceDiagram
    participant User
    participant LovableApp as Lovable App<br/>(Frontend)
    participant Hook as useSimpleCreditSystem
    participant API as JWT Auth API<br/>/api/jwt
    participant Backend as Laravel Backend

    User->>LovableApp: Opens app directly
    LovableApp->>Hook: Initialize (mode detection)
    Hook->>Hook: Detects standalone mode<br/>(window.self === window.top)

    Note over Hook: Check sessionStorage for tokens

    alt No existing session
        Hook->>LovableApp: Show login form
        User->>LovableApp: Enter email/password
        LovableApp->>Hook: login(email, password)
        Hook->>API: POST /api/jwt/login<br/>{email, password}
        API->>Backend: Validate credentials
        Backend->>Backend: Generate JWT tokens
        Backend-->>API: {access_token, refresh_token, user}
        API-->>Hook: JWT tokens response
        Hook->>Hook: Store in sessionStorage
        Hook->>LovableApp: Trigger 'loginSuccess' event
        LovableApp->>LovableApp: Show dashboard
    else Has existing session
        Hook->>Hook: Load tokens from sessionStorage
        Hook->>LovableApp: Auto-authenticate
        LovableApp->>LovableApp: Show dashboard
    end

    User->>LovableApp: Check balance
    LovableApp->>Hook: checkBalance()
    Hook->>API: GET /api/secure-credits/jwt/balance<br/>Authorization: Bearer {access_token}
    API->>Backend: Validate JWT
    Backend->>Backend: Get user balance
    Backend-->>API: {balance: 8270}
    API-->>Hook: Balance response
    Hook->>LovableApp: Update balance display
```

### Embedded Mode (iframe)

In embedded mode, the parent application provides JWT tokens derived from the Laravel session.

```mermaid
sequenceDiagram
    participant User
    participant Parent as Parent Page<br/>(iframe-parent.blade.php)
    participant Laravel as Laravel Session
    participant SessionAPI as Session JWT API<br/>/iframe/jwt-from-session
    participant Iframe as Lovable App<br/>(in iframe)
    participant Hook as useSimpleCreditSystem
    participant CreditAPI as Credit API<br/>/api/secure-credits/jwt

    User->>Parent: Navigate to /credit-system
    Note over Parent: User already authenticated<br/>via Laravel session
    Parent->>Parent: Load iframe
    Parent->>Iframe: Load embedded app

    Iframe->>Hook: Initialize
    Hook->>Hook: Detect embedded mode<br/>(window.self !== window.top)
    Hook->>Hook: Clear all previous tokens

    Note over Hook,Parent: JWT Token Request Flow
    Hook->>Parent: postMessage('REQUEST_JWT_TOKEN')

    Parent->>Laravel: Check auth()->check()
    alt User authenticated in Laravel
        Parent->>SessionAPI: POST /iframe/jwt-from-session<br/>Cookies: Laravel session
        SessionAPI->>Laravel: Verify session auth
        Laravel-->>SessionAPI: Authenticated user
        SessionAPI->>SessionAPI: Generate JWT tokens<br/>(access + refresh)
        SessionAPI-->>Parent: {access_token, refresh_token, user}
        Parent->>Iframe: postMessage('JWT_TOKEN_RESPONSE',<br/>{token, refreshToken, user})

        Iframe->>Hook: Receive JWT tokens
        Hook->>Hook: Store in sessionStorage
        Hook->>Hook: setIsAuthenticated(true)
        Hook->>Iframe: Trigger 'ready' event

        Note over Iframe,CreditAPI: Fetch Balance
        Hook->>CreditAPI: GET /api/secure-credits/jwt/balance<br/>Authorization: Bearer {access_token}
        CreditAPI->>CreditAPI: Validate JWT
        CreditAPI->>CreditAPI: Get user balance
        CreditAPI-->>Hook: {balance: 8270}
        Hook->>Iframe: Update balance (8,270)
        Iframe->>Parent: postMessage('BALANCE_UPDATE', {balance: 8270})
    else User not authenticated
        Parent->>Iframe: postMessage('JWT_TOKEN_RESPONSE',<br/>{error: 'Not authenticated'})
        Hook->>Iframe: Show auth required
    end

    User->>Iframe: Spend 100 credits
    Iframe->>Hook: spendCredits(100, 'Test purchase')
    Hook->>CreditAPI: POST /api/secure-credits/jwt/spend<br/>Authorization: Bearer {access_token}<br/>{amount: 100, description: 'Test purchase'}
    CreditAPI->>CreditAPI: Validate JWT & balance
    CreditAPI->>CreditAPI: Deduct credits
    CreditAPI-->>Hook: {success: true, new_balance: 8170}
    Hook->>Iframe: Update balance (8,170)
    Iframe->>Parent: postMessage('CREDITS_SPENT',<br/>{amount: 100, newBalance: 8170})
```

---

## Implementation Details

### 1. Lovable App Setup & Installation

#### Project Structure

```
C:\Users\My_Project\
├── src/
│   ├── components/
│   │   └── CreditSystemDemo.tsx          # Main credit UI component
│   ├── hooks/
│   │   └── useSimpleCreditSystem.ts      # Custom hook (wrapper around SDK)
│   ├── pages/
│   │   ├── Index.tsx                     # Landing page
│   │   └── Credits.tsx                   # Credits page
│   ├── App.tsx                           # App router
│   └── main.tsx                          # Entry point
├── package.json
└── vite.config.ts
```

#### Installation

**Step 1: Install SDK via NPM**

```bash
# Install from GitHub repository
npm install git+https://<personal_access_token>@github.com/developersupreme/supreme-ai-sdk.git
```

```json
// package.json
{
    "dependencies": {
        "@supreme-ai/credit-sdk": "git+https://<personal_access_token>@github.com/developersupreme/supreme-ai-sdk.git",
        "@tanstack/react-query": "^5.83.0",
        "react": "^18.3.1",
        "react-router-dom": "^6.30.1",
        "sonner": "^1.7.4"
    }
}
```

**Note:** Replace `<personal_access_token>` with your GitHub Personal Access Token.

**Alternative (if repository is public):**

```bash
npm install github:developersupreme/supreme-ai-sdk
```

**Step 2: Environment Configuration**

```env
# .env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/secure-credits/jwt
VITE_AUTH_URL=http://127.0.0.1:8000/api/jwt
```

#### Application Setup

**App.tsx - Router Configuration**

```typescript
// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Credits from "./pages/Credits";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/credits" element={<Credits />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;
```

**Credits Page**

```typescript
// src/pages/Credits.tsx
import CreditSystemDemo from "@/components/CreditSystemDemo";

export default function Credits() {
    return <CreditSystemDemo />;
}
```

---

### 2. JWT Token Structure

#### Access Token Payload

```json
{
    "sub": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "iat": 1704067200,
    "exp": 1704067800,
    "type": "access"
}
```

#### Refresh Token Payload

```json
{
    "sub": 123,
    "iat": 1704067200,
    "exp": 1704153600,
    "type": "refresh"
}
```

**Token Lifetimes:**

-   **Access Token**: 15 minutes (900 seconds)
-   **Refresh Token**: 24 hours (86400 seconds)

---

### 3. Implementation: Custom Hook (useSimpleCreditSystem)

The Lovable App uses a **custom React hook** that wraps the SDK functionality and provides React-specific features like state management and lifecycle handling.

**File:** `My_Project\src\hooks\useSimpleCreditSystem.ts`

#### Key Features:

-   ✅ Automatic mode detection (embedded vs standalone)
-   ✅ JWT token management and storage
-   ✅ Auto token refresh mechanism
-   ✅ Balance checking and credit operations
-   ✅ React state integration
-   ✅ PostMessage communication for iframe
-   ✅ Session restoration

#### Hook Structure

```typescript
export function useSimpleCreditSystem(config: CreditSystemConfig = {}) {
    // React state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEmbedded, setIsEmbedded] = useState(false);

    // Token refs (not in state to avoid re-renders)
    const accessTokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);

    // API URLs from config
    const apiBaseUrl =
        config.apiBaseUrl ||
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8000/api/secure-credits/jwt";

    const authUrl =
        config.authUrl ||
        import.meta.env.VITE_AUTH_URL ||
        "http://127.0.0.1:8000/api/jwt";

    // ... implementation
}
```

---

### 4. Standalone Mode Implementation

#### Step 1: Mode Detection

```typescript
// Check if running in iframe on component mount
useEffect(() => {
    const inIframe = window.self !== window.top;
    setIsEmbedded(inIframe);

    if (!inIframe) {
        console.log("Running in standalone mode");
        // Try to restore session from sessionStorage
        restoreSession();
    }
}, []); // Runs once on mount
```

#### Step 2: Session Restoration

```typescript
// Restore saved session from sessionStorage
useEffect(() => {
    // Skip in embedded mode - parent will provide tokens
    if (isEmbedded) {
        console.log("Embedded mode - skipping session restoration");
        return;
    }

    try {
        const savedAccessToken = sessionStorage.getItem("supreme_access_token");
        const savedRefreshToken = sessionStorage.getItem(
            "supreme_refresh_token"
        );
        const savedUser = sessionStorage.getItem("supreme_user");

        if (savedAccessToken && savedRefreshToken && savedUser) {
            accessTokenRef.current = savedAccessToken;
            refreshTokenRef.current = savedRefreshToken;

            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);
            console.log("Restored session for user:", parsedUser.email);
        }
    } catch (error) {
        console.error("Error loading saved session:", error);
    }
}, [isEmbedded]);
```

#### Step 3: Login Function (Standalone)

```typescript
const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
        setLoading(true);
        setError(null);

        try {
            // Call JWT authentication endpoint
            const response = await fetch(`${authUrl}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            console.log("Login response:", data);

            if (response.ok && data.success) {
                // Extract tokens from response
                const { tokens, user } = data.data;

                // Store in refs (no re-render)
                accessTokenRef.current = tokens.access_token;
                refreshTokenRef.current = tokens.refresh_token;

                // Store in sessionStorage (persist across page refresh)
                sessionStorage.setItem(
                    "supreme_access_token",
                    tokens.access_token
                );
                sessionStorage.setItem(
                    "supreme_refresh_token",
                    tokens.refresh_token
                );
                sessionStorage.setItem("supreme_user", JSON.stringify(user));

                // Update React state (triggers re-render)
                setUser(user);
                setIsAuthenticated(true);
                setLoading(false);

                toast.success("Login successful!");

                return {
                    success: true,
                    user: user,
                    tokens: {
                        access: tokens.access_token,
                        refresh: tokens.refresh_token,
                    },
                };
            } else {
                const errorMsg = data.message || "Login failed";
                setError(errorMsg);
                setLoading(false);
                toast.error(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (err) {
            const errorMsg =
                err instanceof Error ? err.message : "Network error";
            setError(errorMsg);
            setLoading(false);
            toast.error(errorMsg);
            return { success: false, error: errorMsg };
        }
    },
    [authUrl]
);
```

#### Step 4: Making Authenticated Requests

```typescript
const makeAuthenticatedRequest = useCallback(
    async (url: string, options: RequestInit = {}) => {
        if (!accessTokenRef.current) {
            console.error("No access token available");
            throw new Error("Not authenticated");
        }

        console.log("Making authenticated request to:", url);

        // Make request with Bearer token
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${accessTokenRef.current}`,
                ...options.headers,
            },
        });

        console.log("Response status:", response.status);

        // Handle token expiration (401 Unauthorized)
        if (response.status === 401) {
            // Try to refresh token
            if (refreshTokenRef.current) {
                const refreshResponse = await fetch(`${authUrl}/refresh`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        refresh_token: refreshTokenRef.current,
                    }),
                });

                if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json();
                    if (refreshData.success && refreshData.data) {
                        // Update access token
                        accessTokenRef.current = refreshData.data.access_token;
                        sessionStorage.setItem(
                            "supreme_access_token",
                            refreshData.data.access_token
                        );

                        // Retry original request with new token
                        return fetch(url, {
                            ...options,
                            headers: {
                                "Content-Type": "application/json",
                                Accept: "application/json",
                                Authorization: `Bearer ${accessTokenRef.current}`,
                                ...options.headers,
                            },
                        });
                    }
                }
            }

            // Refresh failed, logout user
            await logout();
            throw new Error("Session expired");
        }

        return response;
    },
    [authUrl, logout]
);
```

#### Step 5: Check Balance

```typescript
const checkBalance = useCallback(async (): Promise<OperationResult> => {
    try {
        console.log("Fetching balance...");

        const response = await makeAuthenticatedRequest(
            `${apiBaseUrl}/balance`
        );

        const data = await response.json();
        console.log("Balance API response:", data);

        if (response.ok && data.success) {
            const balanceValue = data.data?.balance || 0;
            console.log("Setting balance to:", balanceValue);

            // Update state
            setBalance(balanceValue);

            return { success: true, balance: balanceValue };
        } else {
            const errorMsg = data.message || "Failed to fetch balance";
            console.error("Balance fetch error:", errorMsg);
            setError(errorMsg);
            toast.error(errorMsg);
            return { success: false, error: errorMsg };
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Network error";
        console.error("Balance fetch exception:", err);
        setError(errorMsg);
        toast.error(`Failed to fetch balance: ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
}, [apiBaseUrl, makeAuthenticatedRequest]);
```

#### Step 6: Spend Credits

```typescript
const spendCredits = useCallback(
    async (
        amount: number,
        description?: string,
        referenceId?: string
    ): Promise<OperationResult> => {
        try {
            const response = await makeAuthenticatedRequest(
                `${apiBaseUrl}/spend`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        amount,
                        description,
                        reference_id: referenceId,
                    }),
                }
            );

            const data = await response.json();
            console.log("Spend response:", data);

            if (response.ok && data.success) {
                const newBalance =
                    data.data?.updated_balance ||
                    data.data?.new_balance ||
                    data.data?.balance;

                // Update state
                setBalance(newBalance);

                toast.success(`Successfully spent ${amount} credits`);

                return { success: true, balance: newBalance };
            } else {
                const errorMsg = data.message || "Failed to spend credits";
                setError(errorMsg);
                toast.error(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (err) {
            const errorMsg =
                err instanceof Error ? err.message : "Network error";
            setError(errorMsg);
            toast.error(errorMsg);
            return { success: false, error: errorMsg };
        }
    },
    [apiBaseUrl, makeAuthenticatedRequest]
);
```

#### Complete Standalone Usage Example

```typescript
// CreditSystemDemo.tsx (Standalone Mode)
import { useSimpleCreditSystem } from "@/hooks/useSimpleCreditSystem";

export default function CreditSystemDemo() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const {
        isAuthenticated,
        user,
        balance,
        loading,
        error,
        login,
        logout,
        checkBalance,
        spendCredits,
    } = useSimpleCreditSystem({
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
        authUrl: import.meta.env.VITE_AUTH_URL,
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await login(email, password);

        if (result.success) {
            // Fetch balance after login
            await checkBalance();
        }
    };

    const handleSpend = async () => {
        const result = await spendCredits(100, "Test purchase");
        if (result.success) {
            console.log("New balance:", result.balance);
        }
    };

    if (!isAuthenticated) {
        return (
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>
        );
    }

    return (
        <div>
            <h2>Welcome, {user?.email}</h2>
            <p>Balance: {balance.toLocaleString()} Credits</p>
            <button onClick={checkBalance}>Refresh Balance</button>
            <button onClick={handleSpend}>Spend 100 Credits</button>
            <button onClick={logout}>Logout</button>
        </div>
    );
}
```

---

### 5. Embedded Mode Implementation

#### Step 1: Mode Detection & Session Clear

```typescript
// Detect iframe mode and clear previous session
useEffect(() => {
    const inIframe = window.self !== window.top;
    setIsEmbedded(inIframe);

    if (inIframe) {
        console.log("Running in embedded mode (iframe)");

        // Clear ALL previous session data immediately
        console.log("Clearing all previous session data...");

        // Clear sessionStorage
        sessionStorage.removeItem("supreme_access_token");
        sessionStorage.removeItem("supreme_refresh_token");
        sessionStorage.removeItem("supreme_user");

        // Clear localStorage
        localStorage.removeItem("supreme_access_token");
        localStorage.removeItem("supreme_refresh_token");
        localStorage.removeItem("supreme_user");

        // Reset all state
        accessTokenRef.current = null;
        refreshTokenRef.current = null;
        setIsAuthenticated(false);
        setUser(null);
        setBalance(0);
        setError(null);

        // Request JWT token from parent after clearing
        setTimeout(() => {
            console.log("Requesting fresh JWT token from parent...");
            window.parent.postMessage(
                {
                    type: "REQUEST_JWT_TOKEN",
                    timestamp: Date.now(),
                },
                "*"
            );
        }, 500);
    }
}, []); // Runs only once on mount
```

#### Step 2: Listen for Parent Messages

```typescript
useEffect(() => {
    if (!isEmbedded) return;

    const handleMessage = (event: MessageEvent) => {
        // Handle JWT token response from parent
        if (event.data && event.data.type === "JWT_TOKEN_RESPONSE") {
            console.log("Received JWT token from parent:", event.data);

            if (event.data.token) {
                // Clear everything first (ensure fresh state)
                console.log("Clearing old session before setting new JWT...");
                sessionStorage.clear();
                setError(null);

                // Now set the new values
                accessTokenRef.current = event.data.token;
                refreshTokenRef.current = event.data.refreshToken;

                // Save to sessionStorage
                sessionStorage.setItem(
                    "supreme_access_token",
                    event.data.token
                );
                sessionStorage.setItem(
                    "supreme_refresh_token",
                    event.data.refreshToken
                );
                sessionStorage.setItem(
                    "supreme_user",
                    JSON.stringify(event.data.user)
                );

                setUser(event.data.user);
                setIsAuthenticated(true);

                // Notify parent that credit system is ready
                window.parent.postMessage(
                    {
                        type: "CREDIT_SYSTEM_READY",
                        user: event.data.user,
                        timestamp: Date.now(),
                    },
                    "*"
                );

                toast.success(`Authenticated as ${event.data.user.email}`);
                console.log(
                    "✓ Fresh authentication complete for:",
                    event.data.user.email
                );
            } else if (event.data.error) {
                console.error("Failed to get JWT token:", event.data.error);
                setError(event.data.error);
            }
        }

        // Handle parent control messages
        switch (event.data?.type) {
            case "REFRESH_BALANCE":
                console.log("Parent requested balance refresh");
                checkBalance();
                break;

            case "CLEAR_STORAGE":
            case "CLEAR_SESSION":
                console.log("Parent requested session/storage clear");
                sessionStorage.clear();
                accessTokenRef.current = null;
                refreshTokenRef.current = null;
                setIsAuthenticated(false);
                setUser(null);
                setBalance(0);
                break;
        }
    };

    window.addEventListener("message", handleMessage);

    return () => {
        window.removeEventListener("message", handleMessage);
    };
}, [isEmbedded, checkBalance]);
```

#### Step 3: Notify Parent of Credit Operations

```typescript
const checkBalance = useCallback(async (): Promise<OperationResult> => {
    try {
        const response = await makeAuthenticatedRequest(
            `${apiBaseUrl}/balance`
        );
        const data = await response.json();

        if (response.ok && data.success) {
            const balanceValue = data.data?.balance || 0;
            setBalance(balanceValue);

            // Notify parent if in embedded mode
            if (isEmbedded && window.parent) {
                window.parent.postMessage(
                    {
                        type: "BALANCE_UPDATE",
                        balance: balanceValue,
                        timestamp: Date.now(),
                    },
                    "*"
                );
            }

            return { success: true, balance: balanceValue };
        }
    } catch (err) {
        // Handle error...
    }
}, [apiBaseUrl, makeAuthenticatedRequest, isEmbedded]);

const spendCredits = useCallback(
    async (
        amount: number,
        description?: string,
        referenceId?: string
    ): Promise<OperationResult> => {
        try {
            const response = await makeAuthenticatedRequest(
                `${apiBaseUrl}/spend`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        amount,
                        description,
                        reference_id: referenceId,
                    }),
                }
            );

            const data = await response.json();

            if (response.ok && data.success) {
                const newBalance = data.data?.updated_balance;
                setBalance(newBalance);

                // Notify parent if in embedded mode
                if (isEmbedded && window.parent) {
                    window.parent.postMessage(
                        {
                            type: "CREDITS_SPENT",
                            amount,
                            newBalance,
                            description,
                            timestamp: Date.now(),
                        },
                        "*"
                    );
                }

                toast.success(`Successfully spent ${amount} credits`);
                return { success: true, balance: newBalance };
            }
        } catch (err) {
            // Handle error...
        }
    },
    [apiBaseUrl, makeAuthenticatedRequest, isEmbedded]
);
```

#### Complete Embedded Usage Example

```typescript
// CreditSystemDemo.tsx (Embedded Mode)
export default function CreditSystemDemo() {
    const {
        isAuthenticated,
        isEmbedded,
        user,
        balance,
        loading,
        error,
        checkBalance,
        spendCredits,
    } = useSimpleCreditSystem();

    // In embedded mode, show waiting state
    if (!isAuthenticated && isEmbedded) {
        return (
            <div>
                <h2>Authenticating...</h2>
                <p>Getting credentials from parent application...</p>
            </div>
        );
    }

    // Authenticated - show dashboard
    return (
        <div>
            <div className="flex items-center gap-2">
                <Badge variant={isEmbedded ? "secondary" : "default"}>
                    Mode: {isEmbedded ? "Embedded (iframe)" : "Standalone"}
                </Badge>
            </div>

            <h2>Welcome, {user?.email}</h2>
            <p>Balance: {balance.toLocaleString()} Credits</p>

            <button onClick={checkBalance}>Refresh Balance</button>

            <button onClick={() => spendCredits(100, "Test")}>
                Spend 100 Credits
            </button>
        </div>
    );
}
```

---

### 6. SDK Methods Reference

The custom hook provides these methods:

#### Authentication Methods

| Method                   | Description                        | Parameters                             | Returns               |
| ------------------------ | ---------------------------------- | -------------------------------------- | --------------------- |
| `login(email, password)` | Authenticate user with credentials | `email: string`<br/>`password: string` | `Promise<AuthResult>` |
| `logout()`               | Log out and clear session          | None                                   | `Promise<void>`       |

**Usage:**

```typescript
const { login, logout } = useSimpleCreditSystem();

// Login
const result = await login("user@example.com", "password123");
if (result.success) {
    console.log("Logged in as:", result.user?.email);
}

// Logout
await logout();
```

#### Credit Operations

| Method           | Description                 | Parameters                                                             | Returns                    |
| ---------------- | --------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| `checkBalance()` | Get current credit balance  | None                                                                   | `Promise<OperationResult>` |
| `spendCredits()` | Deduct credits from balance | `amount: number`<br/>`description?: string`<br/>`referenceId?: string` | `Promise<OperationResult>` |
| `addCredits()`   | Add credits to balance      | `amount: number`<br/>`type?: string`<br/>`description?: string`        | `Promise<OperationResult>` |
| `getHistory()`   | Fetch transaction history   | `page?: number`<br/>`limit?: number`                                   | `Promise<HistoryResult>`   |

**Usage:**

```typescript
const { checkBalance, spendCredits, addCredits, getHistory } =
    useSimpleCreditSystem();

// Check balance
const balanceResult = await checkBalance();
console.log("Current balance:", balanceResult.balance);

// Spend credits
const spendResult = await spendCredits(100, "API usage", "REF-123");
if (spendResult.success) {
    console.log("New balance:", spendResult.balance);
}

// Add credits
const addResult = await addCredits(500, "purchase", "Credit package");

// Get transaction history
const historyResult = await getHistory(1, 20);
if (historyResult.success) {
    console.log("Transactions:", historyResult.history?.transactions);
}
```

#### State Values

The hook returns these state values:

| State             | Type             | Description                    |
| ----------------- | ---------------- | ------------------------------ |
| `isAuthenticated` | `boolean`        | Whether user is authenticated  |
| `isEmbedded`      | `boolean`        | Whether running in iframe mode |
| `user`            | `User \| null`   | Current authenticated user     |
| `balance`         | `number`         | Current credit balance         |
| `loading`         | `boolean`        | Loading state for operations   |
| `error`           | `string \| null` | Last error message             |

**Usage:**

```typescript
const { isAuthenticated, isEmbedded, user, balance, loading, error } =
    useSimpleCreditSystem();

// Display mode badge
<Badge>Mode: {isEmbedded ? "Embedded" : "Standalone"}</Badge>;

// Show user info
{
    isAuthenticated && (
        <div>
            <p>Welcome, {user?.email}</p>
            <p>Balance: {balance.toLocaleString()} Credits</p>
        </div>
    );
}

// Show loading state
{
    loading && <Spinner />;
}

// Show errors
{
    error && <Alert>{error}</Alert>;
}
```

---

### 7. Supreme Credit SDK (NPM Package)

The Lovable App's custom hook is built on top of the official **Supreme AI SDK**, which provides lower-level functionality.

**Package:** `@supreme-ai/credit-sdk`
**Repository:** `github:developersupreme/supreme-ai-sdk`

**Installation:**

```bash
# Install from GitHub with personal access token
npm install git+https://<personal_access_token>@github.com/developersupreme/supreme-ai-sdk.git

# Or if public
npm install github:developersupreme/supreme-ai-sdk
```

#### SDK Core Classes

##### CreditSystemClient

Main client class for standalone integration.

```typescript
import { CreditSystemClient } from "@supreme-ai/credit-sdk";

const client = new CreditSystemClient({
    apiBaseUrl: "http://127.0.0.1:8000/api/secure-credits/jwt",
    authUrl: "http://127.0.0.1:8000/api/jwt",
    mode: "auto", // 'auto' | 'embedded' | 'standalone'
    debug: true,
    autoInit: true,
    tokenRefreshInterval: 600000, // 10 minutes
    balanceRefreshInterval: 30000, // 30 seconds
    storagePrefix: "creditSystem_",
    onAuthRequired: () => console.log("Auth required"),
    onTokenExpired: () => console.log("Token expired"),
});

// Wait for initialization
await client.initialize();

// Use the client
await client.login("user@example.com", "password");
const balance = await client.checkBalance();
await client.spendCredits(100, "Test purchase");
```

**Configuration Options:**

| Option                   | Type                                   | Default                   | Description                   |
| ------------------------ | -------------------------------------- | ------------------------- | ----------------------------- |
| `apiBaseUrl`             | `string`                               | `/api/secure-credits/jwt` | Credit API base URL           |
| `authUrl`                | `string`                               | `/api/jwt`                | Authentication API URL        |
| `mode`                   | `'auto' \| 'embedded' \| 'standalone'` | `'auto'`                  | Operation mode                |
| `debug`                  | `boolean`                              | `false`                   | Enable debug logging          |
| `autoInit`               | `boolean`                              | `true`                    | Auto-initialize on creation   |
| `tokenRefreshInterval`   | `number`                               | `600000`                  | Token refresh interval (ms)   |
| `balanceRefreshInterval` | `number`                               | `30000`                   | Balance refresh interval (ms) |
| `storagePrefix`          | `string`                               | `'creditSystem_'`         | Storage key prefix            |
| `onAuthRequired`         | `function`                             | `() => {}`                | Auth required callback        |
| `onTokenExpired`         | `function`                             | `() => {}`                | Token expired callback        |

**SDK Events:**

```typescript
// Listen to SDK events
client.on("ready", ({ user, mode }) => {
    console.log(`Ready in ${mode} mode`, user);
});

client.on("authRequired", () => {
    console.log("User needs to authenticate");
});

client.on("balanceUpdate", ({ balance }) => {
    console.log("Balance updated:", balance);
});

client.on("creditsSpent", ({ amount, newBalance }) => {
    console.log(`Spent ${amount} credits, new balance: ${newBalance}`);
});

client.on("error", ({ type, error }) => {
    console.error(`Error in ${type}:`, error);
});

client.on("tokenRefreshed", () => {
    console.log("Token refreshed successfully");
});
```

##### ParentIntegrator

Helper class for parent pages hosting iframes.

```typescript
import { ParentIntegrator } from "@supreme-ai/credit-sdk";

const integrator = new ParentIntegrator({
    // Required: Function to get JWT token for iframe
    getJWTToken: async () => {
        const response = await fetch("/iframe/jwt-from-session", {
            method: "POST",
            credentials: "include",
        });
        const data = await response.json();

        if (data.success) {
            return {
                token: data.data.tokens.access_token,
                refreshToken: data.data.tokens.refresh_token,
                user: data.data.user,
            };
        }
        return null;
    },

    // Optional: Allowed origins
    allowedOrigins: ["https://lovable-app.com"],

    // Optional: Event callbacks
    onIframeReady: () => console.log("Iframe ready"),
    onBalanceUpdate: (balance) => console.log("Balance:", balance),
    onCreditsSpent: (amount, newBalance) => {
        console.log(`Spent ${amount}, new: ${newBalance}`);
    },
    onLogout: () => console.log("User logged out"),
    onError: (error) => console.error("Error:", error),

    debug: true,
});

// Attach to iframe element
const iframe = document.getElementById("creditSystemFrame");
integrator.attachToIframe(iframe);

// Control methods
integrator.refreshBalance();
integrator.getStatus();
integrator.clearStorage();
integrator.destroy();
```

---

### 8. Comparison: Custom Hook vs SDK

#### When to Use Custom Hook (useSimpleCreditSystem)

✅ **Use when:**

-   Building with React
-   Need React state integration
-   Want simpler API
-   Building Lovable-style apps
-   Need automatic re-renders on state changes

**Example:**

```typescript
const { balance, spendCredits } = useSimpleCreditSystem();

// React component automatically re-renders when balance changes
<p>Balance: {balance}</p>;
```

#### When to Use SDK Directly (CreditSystemClient)

✅ **Use when:**

-   Building vanilla JavaScript apps
-   Building with other frameworks (Vue, Angular, Svelte)
-   Need fine-grained control
-   Want event-driven architecture
-   Building complex integrations

**Example:**

```typescript
const client = new CreditSystemClient();
client.on("balanceUpdate", ({ balance }) => {
    document.getElementById("balance").textContent = balance;
});
```

### 9. Parent Page Integration

**PostMessage Communication:**

```typescript
// On iframe load - Request JWT from parent
useEffect(() => {
    const inIframe = window.self !== window.top;
    setIsEmbedded(inIframe);

    if (inIframe) {
        // Clear all previous session data
        sessionStorage.clear();
        localStorage.clear();

        // Request fresh JWT token from parent
        window.parent.postMessage(
            {
                type: "REQUEST_JWT_TOKEN",
                timestamp: Date.now(),
            },
            "*"
        );
    }
}, []);

// Listen for JWT token response
useEffect(() => {
    if (!isEmbedded) return;

    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "JWT_TOKEN_RESPONSE") {
            if (event.data.token) {
                // Store tokens
                accessTokenRef.current = event.data.token;
                refreshTokenRef.current = event.data.refreshToken;

                sessionStorage.setItem(
                    "supreme_access_token",
                    event.data.token
                );
                sessionStorage.setItem(
                    "supreme_refresh_token",
                    event.data.refreshToken
                );
                sessionStorage.setItem(
                    "supreme_user",
                    JSON.stringify(event.data.user)
                );

                setUser(event.data.user);
                setIsAuthenticated(true);

                // Notify parent
                window.parent.postMessage(
                    {
                        type: "CREDIT_SYSTEM_READY",
                        user: event.data.user,
                    },
                    "*"
                );
            }
        }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
}, [isEmbedded]);
```

---

### 3. Parent Page Integration

**File:** `C:\Git Projects\supreme-intelligence-v2\resources\views\iframe-parent.blade.php`

**JavaScript Integration:**

```javascript
// Get Laravel authenticated user
const laravelUser = @json(auth()->user());
const isAuthenticated = {{ auth()->check() ? 'true' : 'false' }};

// Function to get JWT token for iframe
async function getJWTTokenForIframe() {
  if (!laravelUser) {
    console.error('No Laravel user authenticated');
    return false;
  }

  try {
    // Call session-based JWT generation endpoint
    const response = await fetch('/iframe/jwt-from-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      parentJWT = data.data.tokens.access_token;
      parentRefreshToken = data.data.tokens.refresh_token;
      parentUser = data.data.user;

      return true;
    }
  } catch (error) {
    console.error('Failed to generate JWT token:', error);
  }

  return false;
}

// Listen for JWT token requests from iframe
window.addEventListener('message', async function(event) {
  if (event.data?.type === 'REQUEST_JWT_TOKEN') {
    console.log('Iframe requesting JWT token');

    // Get fresh JWT token
    const success = await getJWTTokenForIframe();

    if (success) {
      // Send token to iframe
      iframe.contentWindow.postMessage({
        type: 'JWT_TOKEN_RESPONSE',
        token: parentJWT,
        refreshToken: parentRefreshToken,
        user: parentUser,
        timestamp: Date.now()
      }, iframeOrigin);
    } else {
      // Send error response
      iframe.contentWindow.postMessage({
        type: 'JWT_TOKEN_RESPONSE',
        token: null,
        error: 'Authentication required'
      }, iframeOrigin);
    }
  }
});

// On iframe load, send JWT token
iframe.addEventListener('load', async function() {
  // Wait for iframe to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  const success = await getJWTTokenForIframe();

  if (success) {
    iframe.contentWindow.postMessage({
      type: 'JWT_TOKEN_RESPONSE',
      token: parentJWT,
      refreshToken: parentRefreshToken,
      user: parentUser
    }, iframeOrigin);
  }
});
```

---

## API Endpoints

### JWT Authentication Endpoints

#### 1. Login (Standalone Mode)

```http
POST /api/jwt/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "user": {
            "id": 123,
            "email": "user@example.com",
            "name": "John Doe"
        },
        "tokens": {
            "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "token_type": "Bearer",
            "expires_in": 900
        }
    }
}
```

#### 2. Generate JWT from Session (Embedded Mode)

```http
POST /iframe/jwt-from-session
Cookie: laravel_session=...
X-CSRF-TOKEN: ...
```

**Response:**

```json
{
    "success": true,
    "data": {
        "tokens": {
            "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "token_type": "Bearer",
            "expires_in": 900
        },
        "user": {
            "id": 123,
            "email": "user@example.com",
            "name": "John Doe"
        }
    }
}
```

#### 3. Refresh Token

```http
POST /api/jwt/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
        "expires_in": 900
    }
}
```

### Credit System Endpoints

All credit endpoints require JWT authentication via `Authorization: Bearer {access_token}` header.

#### 1. Check Balance

```http
GET /api/secure-credits/jwt/balance
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

**Response:**

```json
{
    "success": true,
    "message": "Balance retrieved successfully",
    "data": {
        "balance": 8270,
        "user_id": 123,
        "authenticated": true
    }
}
```

#### 2. Spend Credits

```http
POST /api/secure-credits/jwt/spend
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json

{
  "amount": 100,
  "description": "API usage - GPT-4",
  "reference_id": "REF-12345"
}
```

**Response:**

```json
{
    "success": true,
    "message": "Credits spent successfully",
    "data": {
        "updated_balance": 8170,
        "transaction": {
            "id": 456,
            "type": "spend",
            "amount": -100,
            "description": "API usage - GPT-4",
            "balance_after": 8170,
            "created_at": "2024-01-01T12:00:00Z"
        }
    }
}
```

#### 3. Add Credits

```http
POST /api/secure-credits/jwt/add
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json

{
  "amount": 500,
  "type": "purchase",
  "description": "Credit package purchase"
}
```

**Response:**

```json
{
    "success": true,
    "message": "Credits added successfully",
    "data": {
        "updated_balance": 8670,
        "transaction": {
            "id": 457,
            "type": "add",
            "amount": 500,
            "description": "Credit package purchase",
            "balance_after": 8670,
            "created_at": "2024-01-01T12:05:00Z"
        }
    }
}
```

#### 4. Transaction History

```http
GET /api/secure-credits/jwt/history?page=1&limit=20
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

**Response:**

```json
{
    "success": true,
    "data": {
        "transactions": [
            {
                "id": 457,
                "type": "add",
                "amount": 500,
                "balance_after": 8670,
                "description": "Credit package purchase",
                "created_at": "2024-01-01T12:05:00Z"
            },
            {
                "id": 456,
                "type": "spend",
                "amount": -100,
                "balance_after": 8170,
                "description": "API usage - GPT-4",
                "created_at": "2024-01-01T12:00:00Z"
            }
        ],
        "total": 150,
        "current_page": 1,
        "per_page": 20
    }
}
```

---

## Security Best Practices (Client-Side)

### 1. Token Storage

**Best Practice:** Store JWT tokens in `sessionStorage`, not `localStorage`

```typescript
// ✅ Secure - tokens cleared on tab close
sessionStorage.setItem("supreme_access_token", accessToken);
sessionStorage.setItem("supreme_refresh_token", refreshToken);

// ❌ Avoid - persists across sessions
localStorage.setItem("supreme_access_token", accessToken);
```

**Token Lifetimes:**

-   Access Token: 15 minutes (900 seconds)
-   Refresh Token: 24 hours (86400 seconds)

**Clear on Logout:**

```typescript
const logout = () => {
    // Clear all stored tokens
    sessionStorage.clear();
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
};
```

---

### 2. PostMessage Origin Validation

**Always validate message origins to prevent XSS attacks:**

```typescript
// In Lovable App (iframe)
useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        // Define allowed parent origins
        const allowedOrigins = [
            "https://api.supremeopti.com",
            "http://localhost:8000",
        ];

        // Validate origin
        if (!allowedOrigins.includes(event.origin)) {
            console.warn(
                "⚠️ Ignoring message from untrusted origin:",
                event.origin
            );
            return; // Reject message
        }

        // Safe to process
        if (event.data?.type === "JWT_TOKEN_RESPONSE") {
            handleTokenResponse(event.data);
        }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
}, []);
```

```typescript
// In Parent Page
window.addEventListener("message", (event) => {
    const allowedOrigins = ["https://lovable-app.com", "http://localhost:5173"];

    if (!allowedOrigins.includes(event.origin)) {
        console.warn("⚠️ Ignoring iframe message from:", event.origin);
        return;
    }

    // Safe to process iframe messages
    handleIframeMessage(event.data);
});
```

---

### 3. Automatic Token Refresh

**Handle 401 errors and automatically refresh expired tokens:**

```typescript
const makeAuthenticatedRequest = async (url: string, options = {}) => {
    // First attempt with current token
    let response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessTokenRef.current}`,
            ...options.headers,
        },
    });

    // If 401 Unauthorized, try to refresh
    if (response.status === 401 && refreshTokenRef.current) {
        console.log("Token expired, refreshing...");

        const refreshResponse = await fetch(`${authUrl}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                refresh_token: refreshTokenRef.current,
            }),
        });

        if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            const newAccessToken = data.data.access_token;

            // Update stored token
            accessTokenRef.current = newAccessToken;
            sessionStorage.setItem("supreme_access_token", newAccessToken);

            // Retry original request with new token
            response = await fetch(url, {
                ...options,
                headers: {
                    Authorization: `Bearer ${newAccessToken}`,
                    ...options.headers,
                },
            });
        } else {
            // Refresh failed - logout user
            await logout();
            throw new Error("Session expired");
        }
    }

    return response;
};
```

---

### 4. Environment Variables

**Never hardcode API URLs or sensitive data:**

```typescript
// ✅ Good - use environment variables
const config = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    authUrl: import.meta.env.VITE_AUTH_URL,
    allowedOrigins: [
        import.meta.env.VITE_PARENT_ORIGIN,
        import.meta.env.VITE_IFRAME_ORIGIN,
    ],
    debug: import.meta.env.DEV, // Only in development
};

// ❌ Bad - hardcoded values
const config = {
    apiBaseUrl: "https://api.supremeopti.com/api",
    debug: true, // Exposed in production!
};
```

**.env file:**

```env
# API endpoints
VITE_API_BASE_URL=https://api.supremeopti.com/api/secure-credits/jwt
VITE_AUTH_URL=https://api.supremeopti.com/api/jwt

# Allowed origins for postMessage
VITE_PARENT_ORIGIN=https://api.supremeopti.com
VITE_IFRAME_ORIGIN=https://lovable-app.com

# Development
VITE_DEV_MODE=false
```

---

### 5. SDK Security Configuration

```typescript
import { CreditSystemClient } from "@supreme-ai/credit-sdk";

const client = new CreditSystemClient({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    authUrl: import.meta.env.VITE_AUTH_URL,

    // Restrict allowed origins
    allowedOrigins: [import.meta.env.VITE_PARENT_ORIGIN],

    // Only enable debug in development
    debug: import.meta.env.DEV,

    // Secure token refresh interval (10 minutes)
    tokenRefreshInterval: 600000,

    // Use sessionStorage prefix
    storagePrefix: "supreme_credit_",

    // Handle auth events
    onTokenExpired: () => {
        console.log("Token expired, please login again");
        // Redirect to login or show modal
    },
});
```

---

### 6. HTTPS Only in Production

**Always use HTTPS in production environments:**

```typescript
// Check protocol in production
if (import.meta.env.PROD && window.location.protocol !== "https:") {
    console.error("⚠️ HTTPS required in production");
    // Redirect to HTTPS
    window.location.href = window.location.href.replace("http:", "https:");
}
```

---

## Sequence Diagrams

### Complete Flow: Embedded Mode with Credit Operations

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as Parent Page
    participant L as Laravel Backend
    participant I as Iframe (Lovable App)
    participant H as useSimpleCreditSystem
    participant A as Credit API

    Note over U,A: Initial Load & Authentication
    U->>P: Navigate to /credit-system
    P->>L: Check auth()->check()
    L-->>P: Authenticated user
    P->>I: Load iframe with Lovable app
    I->>H: Initialize hook
    H->>H: Detect embedded mode
    H->>H: Clear previous session data
    H->>P: postMessage('REQUEST_JWT_TOKEN')

    P->>L: POST /iframe/jwt-from-session
    L->>L: Verify Laravel session
    L->>L: Generate JWT tokens
    L-->>P: {access_token, refresh_token, user}

    P->>I: postMessage('JWT_TOKEN_RESPONSE', tokens)
    I->>H: Receive tokens
    H->>H: Store in sessionStorage
    H->>H: setIsAuthenticated(true)
    H->>I: Trigger 'ready' event
    I->>I: Show dashboard

    Note over I,A: Fetch Balance
    I->>H: checkBalance()
    H->>A: GET /balance (Bearer token)
    A->>A: Validate JWT
    A->>A: Query database
    A-->>H: {balance: 8270}
    H->>I: Update UI (8,270)
    I->>P: postMessage('BALANCE_UPDATE')

    Note over U,A: Spend Credits
    U->>I: Click "Spend 100 Credits"
    I->>H: spendCredits(100, desc)
    H->>A: POST /spend (Bearer token)
    A->>A: Validate JWT
    A->>A: Check balance >= 100
    A->>A: Deduct credits
    A->>A: Create transaction
    A-->>H: {new_balance: 8170, transaction}
    H->>I: Update UI (8,170)
    I->>P: postMessage('CREDITS_SPENT')

    Note over I,A: Add Credits
    U->>I: Click "Add 500 Credits"
    I->>H: addCredits(500, 'purchase')
    H->>A: POST /add (Bearer token)
    A->>A: Validate JWT
    A->>A: Add credits
    A->>A: Create transaction
    A-->>H: {new_balance: 8670, transaction}
    H->>I: Update UI (8,670)
    I->>P: postMessage('CREDITS_ADDED')

    Note over I,A: View History
    U->>I: Click "View History"
    I->>H: getHistory(page=1)
    H->>A: GET /history?page=1 (Bearer token)
    A->>A: Validate JWT
    A->>A: Query transactions
    A-->>H: {transactions: [...]}
    H->>I: Display transaction list
```

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant H as useSimpleCreditSystem
    participant A as Credit API
    participant J as JWT Auth API

    Note over H,J: Access Token Expired
    H->>A: GET /balance (expired token)
    A-->>H: 401 Unauthorized

    H->>H: Detect 401 error
    H->>H: Check refresh token exists

    alt Has refresh token
        H->>J: POST /refresh {refresh_token}
        J->>J: Validate refresh token
        J->>J: Generate new access token
        J-->>H: {access_token, expires_in}
        H->>H: Update accessTokenRef
        H->>H: Update sessionStorage

        Note over H,A: Retry original request
        H->>A: GET /balance (new token)
        A->>A: Validate JWT
        A-->>H: {balance: 8270}
        H->>H: Return success
    else No refresh token
        H->>H: Clear session
        H->>H: Trigger 'authRequired' event
        H->>H: Show login form
    end
```

---

## Environment Configuration

### Lovable App (.env)

```env
# API Endpoints
VITE_API_BASE_URL=https://api.supremeopti.com/api/secure-credits/jwt
VITE_AUTH_URL=https://api.supremeopti.com/api/jwt

# Security - Allowed Origins for PostMessage
VITE_PARENT_ORIGIN=https://api.supremeopti.com
VITE_IFRAME_ORIGIN=https://lovable-app.com

# Development Mode
VITE_DEV_MODE=false
```

### Development (.env.development)

```env
# Local Development API
VITE_API_BASE_URL=http://127.0.0.1:8000/api/secure-credits/jwt
VITE_AUTH_URL=http://127.0.0.1:8000/api/jwt

# Local Allowed Origins
VITE_PARENT_ORIGIN=http://localhost:8000
VITE_IFRAME_ORIGIN=http://localhost:5173

# Enable Debug Mode
VITE_DEV_MODE=true
```

---

## Troubleshooting

### Issue 1: Balance shows 0 then updates in embedded mode

**Cause:** Race condition where balance state was reset when receiving JWT tokens.

**Solution:** Modified `useSimpleCreditSystem.ts` line 179 to not reset balance when receiving tokens:

```typescript
// Before (incorrect):
setBalance(0); // ❌ This caused the flash of 0

// After (correct):
// Don't reset balance - let API call set it
```

### Issue 2: JWT token not received in iframe

**Symptoms:**

-   Iframe shows "Authenticating..." indefinitely
-   Console shows "JWT not received" warnings

**Solutions:**

1. Check parent page has valid Laravel session
2. Verify CORS configuration allows iframe origin
3. Check browser console for postMessage errors
4. Ensure `/iframe/jwt-from-session` endpoint is accessible

### Issue 3: 401 Unauthorized on API calls

**Causes:**

-   Expired access token
-   Invalid JWT secret key
-   Token not included in request headers

**Debug Steps:**

```javascript
// Check token in sessionStorage
console.log("Access token:", sessionStorage.getItem("supreme_access_token"));

// Check token expiry
const token = sessionStorage.getItem("supreme_access_token");
if (token) {
    const payload = JSON.parse(atob(token.split(".")[1]));
    console.log("Token expires:", new Date(payload.exp * 1000));
    console.log("Current time:", new Date());
}
```

---

## Best Practices

### 1. Token Management

-   ✅ Store tokens in sessionStorage (not localStorage)
-   ✅ Clear tokens on logout
-   ✅ Implement automatic token refresh
-   ✅ Handle token expiry gracefully

### 2. Error Handling

-   ✅ Display user-friendly error messages
-   ✅ Log detailed errors to console (dev mode only)
-   ✅ Implement retry logic for network errors
-   ✅ Provide fallback UI for authentication failures

### 3. Security

-   ✅ Validate message origins in postMessage
-   ✅ Use HTTPS in production
-   ✅ Implement CSRF protection
-   ✅ Keep JWT secret keys secure
-   ✅ Use short-lived access tokens

### 4. Performance

-   ✅ Cache user data appropriately
-   ✅ Debounce balance checks
-   ✅ Lazy load transaction history
-   ✅ Optimize API calls with proper loading states

---

## Conclusion

The Supreme AI Credit System provides a robust, secure JWT-based authentication mechanism that seamlessly works in both standalone and embedded modes. The dual-mode architecture allows for maximum flexibility while maintaining security and user experience.

**Key Takeaways:**

-   **Standalone Mode**: Direct username/password authentication
-   **Embedded Mode**: Leverages parent Laravel session for seamless SSO
-   **JWT Tokens**: Short-lived, secure, and automatically refreshed
-   **PostMessage API**: Secure cross-origin communication for iframes
-   **Balance Display**: Formatted with thousand separators (8,270)
-   **Transaction History**: Complete audit trail of all credit operations

For additional support or questions, refer to the SDK documentation at:

-   **SDK Repository**: `https://github.com/developersupreme/supreme-ai-sdk`
-   **NPM Package**: `@supreme-ai/credit-sdk`
-   **Installation**: `npm install git+https://<personal_access_token>@github.com/developersupreme/supreme-ai-sdk.git`
