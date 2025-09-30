# Supreme AI Credit System SDK

A comprehensive TypeScript SDK for integrating the Supreme AI Credit System into your applications. This SDK supports both embedded (iframe) and standalone modes with JWT authentication, making it perfect for SaaS applications, marketplaces, and any platform requiring a credit-based system.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Detailed Integration Guide](#detailed-integration-guide)
  - [Standalone Mode](#standalone-mode-full-example)
  - [Embedded Mode (iFrame)](#embedded-mode-iframe)
  - [React Integration](#react-integration-complete-guide)
  - [Next.js Integration](#nextjs-integration)
- [Parent Page Setup](#parent-page-setup-detailed)
- [Child iFrame Setup](#child-iframe-setup)
- [API Reference](#api-reference)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Examples](#complete-examples)

## Features

- 🔐 **JWT-based Authentication** - Secure token-based authentication with refresh tokens
- 🖼️ **Dual Mode Support** - Seamlessly works as embedded iframe or standalone application
- ⚛️ **React Hooks & Provider** - First-class React integration with hooks and context
- 📦 **Full TypeScript Support** - Complete type definitions and IntelliSense
- 🔄 **Automatic Token Management** - Auto-refresh tokens before expiration
- 💾 **Session Persistence** - Maintains authentication across page refreshes
- 🌐 **Secure Cross-Origin Communication** - Safe postMessage API for iframe integration
- 📊 **Real-time Balance Updates** - Automatic balance synchronization
- 🎯 **Event-Driven Architecture** - Rich event system for reactive UIs
- 🛡️ **Built-in Security** - Origin validation and secure token storage

## Installation

### Using NPM

```bash
npm install @supreme-ai/credit-sdk
```

### Using Yarn

```bash
yarn add @supreme-ai/credit-sdk
```

### Using PNPM

```bash
pnpm add @supreme-ai/credit-sdk
```

### CDN Usage (For non-bundled projects)

```html
<script src="https://unpkg.com/@supreme-ai/credit-sdk@latest/dist/index.js"></script>
```

## Quick Start

### Basic Setup (Standalone Mode)

```typescript
import { CreditSystemClient } from '@supreme-ai/credit-sdk';

// Initialize the client
const creditSystem = new CreditSystemClient({
  apiBaseUrl: 'https://api.yourdomain.com/api/secure-credits/jwt',
  authUrl: 'https://api.yourdomain.com/api/jwt',
  debug: true // Enable debug logs
});

// The client will auto-initialize and check for existing sessions
```

## Detailed Integration Guide

### Standalone Mode (Full Example)

This mode is perfect when you want to integrate the credit system directly into your application without iframes.

```typescript
import { CreditSystemClient } from '@supreme-ai/credit-sdk';
import type {
  CreditSDKEvents,
  User,
  Transaction
} from '@supreme-ai/credit-sdk';

class CreditManager {
  private client: CreditSystemClient;
  private currentUser: User | null = null;

  constructor() {
    // Initialize with full configuration
    this.client = new CreditSystemClient({
      apiBaseUrl: 'https://api.yourdomain.com/api/secure-credits/jwt',
      authUrl: 'https://api.yourdomain.com/api/jwt',

      // Timing configurations
      tokenRefreshInterval: 600000, // Refresh token every 10 minutes
      balanceRefreshInterval: 30000, // Update balance every 30 seconds

      // Behavior
      autoInit: true, // Auto-initialize on creation
      debug: process.env.NODE_ENV === 'development',
      storagePrefix: 'myapp_credit_', // Prefix for storage keys
      mode: 'standalone', // Force standalone mode

      // Callbacks
      onAuthRequired: () => {
        console.log('Authentication required');
        this.showLoginForm();
      },

      onTokenExpired: () => {
        console.log('Token expired, please login again');
        this.showLoginForm();
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for successful initialization
    this.client.on('ready', ({ user, mode }) => {
      console.log(`Credit system ready in ${mode} mode`);
      this.currentUser = user;
      this.updateUI();
    });

    // Listen for balance updates
    this.client.on('balanceUpdate', ({ balance }) => {
      console.log(`Balance updated: ${balance} credits`);
      this.updateBalanceDisplay(balance);
    });

    // Listen for credit spending
    this.client.on('creditsSpent', ({
      amount,
      description,
      previousBalance,
      newBalance,
      transaction
    }) => {
      console.log(`Spent ${amount} credits: ${description}`);
      console.log(`Balance: ${previousBalance} → ${newBalance}`);
      this.addTransactionToHistory(transaction);
    });

    // Listen for credit additions
    this.client.on('creditsAdded', ({
      amount,
      type,
      newBalance
    }) => {
      console.log(`Added ${amount} credits (${type})`);
      this.showSuccessNotification(`${amount} credits added!`);
    });

    // Listen for errors
    this.client.on('error', ({ type, error }) => {
      console.error(`Error in ${type}:`, error);
      this.showErrorNotification(error);
    });

    // Listen for login events
    this.client.on('loginSuccess', ({ user }) => {
      console.log('Login successful:', user.email);
      this.currentUser = user;
      this.hideLoginForm();
      this.updateUI();
    });

    this.client.on('loginError', ({ error }) => {
      console.error('Login failed:', error);
      this.showLoginError(error);
    });
  }

  // Authentication methods
  async login(email: string, password: string): Promise<void> {
    const result = await this.client.login(email, password);

    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }
  }

  async logout(): Promise<void> {
    await this.client.logout();
    this.currentUser = null;
    this.showLoginForm();
  }

  // Credit operations
  async checkBalance(): Promise<number> {
    const result = await this.client.checkBalance();

    if (result.success && result.balance !== undefined) {
      return result.balance;
    }

    throw new Error(result.error || 'Failed to get balance');
  }

  async spendCredits(
    amount: number,
    description: string,
    referenceId?: string
  ): Promise<void> {
    // Validate before spending
    const currentBalance = await this.checkBalance();

    if (currentBalance < amount) {
      throw new Error('Insufficient credits');
    }

    const result = await this.client.spendCredits(
      amount,
      description,
      referenceId
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to spend credits');
    }

    console.log('Transaction:', result.transaction);
  }

  async purchaseCredits(amount: number, paymentMethod: string): Promise<void> {
    // Process payment first (your payment logic)
    const paymentSuccessful = await this.processPayment(amount, paymentMethod);

    if (paymentSuccessful) {
      const result = await this.client.addCredits(
        amount,
        'purchase',
        `Purchased via ${paymentMethod}`
      );

      if (!result.success) {
        throw new Error('Credits purchased but failed to add to account');
      }
    }
  }

  async getTransactionHistory(page: number = 1): Promise<Transaction[]> {
    const result = await this.client.getHistory(page, 20);

    if (result.success && result.transactions) {
      return result.transactions;
    }

    return [];
  }

  // Helper methods (implement based on your UI framework)
  private showLoginForm(): void { /* Your implementation */ }
  private hideLoginForm(): void { /* Your implementation */ }
  private showLoginError(error: string): void { /* Your implementation */ }
  private updateUI(): void { /* Your implementation */ }
  private updateBalanceDisplay(balance: number): void { /* Your implementation */ }
  private addTransactionToHistory(transaction?: Transaction): void { /* Your implementation */ }
  private showSuccessNotification(message: string): void { /* Your implementation */ }
  private showErrorNotification(error: string): void { /* Your implementation */ }
  private async processPayment(amount: number, method: string): Promise<boolean> {
    /* Your payment implementation */
    return true;
  }

  // Cleanup
  destroy(): void {
    this.client.destroy();
  }
}

// Usage
const creditManager = new CreditManager();

// In your UI handlers
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;

  try {
    await creditManager.login(email, password);
  } catch (error) {
    console.error('Login failed:', error);
  }
});
```

### Embedded Mode (iFrame)

When you want to embed the credit system as an iframe in your application, you need to set up both the parent page and the iframe.

#### Parent Page Complete Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Application with Embedded Credit System</title>
</head>
<body>
    <div id="app">
        <h1>My Application</h1>

        <!-- Control Panel -->
        <div id="controls">
            <button id="refreshBalance">Refresh Balance</button>
            <button id="getStatus">Get Status</button>
            <button id="clearStorage">Clear Storage</button>
            <div id="balanceDisplay">Balance: <span id="balance">0</span> credits</div>
        </div>

        <!-- Credit System iFrame -->
        <iframe
            id="creditSystemFrame"
            src="https://credits.yourdomain.com/iframe"
            width="100%"
            height="600"
            style="border: 1px solid #ccc; border-radius: 8px;"
        ></iframe>

        <!-- Transaction Log -->
        <div id="transactionLog">
            <h3>Recent Activity</h3>
            <ul id="logList"></ul>
        </div>
    </div>

    <script type="module">
        import { ParentIntegrator } from '@supreme-ai/credit-sdk';

        class ParentPageManager {
            constructor() {
                this.userToken = null; // Your app's auth token
                this.integrator = null;
                this.init();
            }

            async init() {
                // Wait for DOM to be ready
                await this.waitForDOM();

                // Initialize the parent integrator
                this.integrator = new ParentIntegrator({
                    // CRITICAL: This function is called when iframe requests JWT
                    getJWTToken: async () => {
                        console.log('iFrame requesting JWT token...');

                        try {
                            // Option 1: If user is logged in via your app's auth system
                            const userSession = this.getCurrentUserSession();

                            if (!userSession) {
                                console.log('No user session found');
                                return null;
                            }

                            // Option 2: Request JWT from your backend
                            const response = await fetch('/api/iframe/generate-token', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${userSession.token}`,
                                    'Content-Type': 'application/json'
                                },
                                credentials: 'include'
                            });

                            if (!response.ok) {
                                throw new Error('Failed to generate JWT token');
                            }

                            const data = await response.json();

                            if (data.success) {
                                console.log('JWT token generated for user:', data.data.user.email);

                                return {
                                    token: data.data.tokens.access_token,
                                    refreshToken: data.data.tokens.refresh_token,
                                    user: data.data.user
                                };
                            }

                            return null;
                        } catch (error) {
                            console.error('Error generating JWT token:', error);
                            return null;
                        }
                    },

                    // Optional: Specify allowed origins for security
                    allowedOrigins: [
                        'https://credits.yourdomain.com',
                        'http://localhost:3000' // For development
                    ],

                    // Event callbacks
                    onIframeReady: () => {
                        console.log('✅ Credit system iframe is ready');
                        this.updateStatus('ready');
                    },

                    onBalanceUpdate: (balance) => {
                        console.log('💰 Balance updated:', balance);
                        document.getElementById('balance').textContent = balance.toString();
                        this.logActivity(`Balance updated: ${balance} credits`);
                    },

                    onCreditsSpent: (amount, newBalance) => {
                        console.log(`💸 Spent ${amount} credits, new balance: ${newBalance}`);
                        document.getElementById('balance').textContent = newBalance.toString();
                        this.logActivity(`Spent ${amount} credits`);

                        // You might want to sync this with your backend
                        this.syncWithBackend('spend', { amount, newBalance });
                    },

                    onCreditsAdded: (amount, newBalance) => {
                        console.log(`➕ Added ${amount} credits, new balance: ${newBalance}`);
                        document.getElementById('balance').textContent = newBalance.toString();
                        this.logActivity(`Added ${amount} credits`);

                        // Sync with backend
                        this.syncWithBackend('add', { amount, newBalance });
                    },

                    onLogout: () => {
                        console.log('👋 User logged out from credit system');
                        this.handleLogout();
                    },

                    onError: (error) => {
                        console.error('❌ Credit system error:', error);
                        this.showError(error);
                    },

                    debug: true // Enable debug logging
                });

                // Attach to the iframe
                const iframe = document.getElementById('creditSystemFrame');
                this.integrator.attachToIframe(iframe);

                // Set up control buttons
                this.setupControls();
            }

            setupControls() {
                // Refresh balance button
                document.getElementById('refreshBalance')?.addEventListener('click', () => {
                    console.log('Requesting balance refresh...');
                    this.integrator.refreshBalance();
                });

                // Get status button
                document.getElementById('getStatus')?.addEventListener('click', () => {
                    console.log('Requesting status...');
                    this.integrator.getStatus();
                });

                // Clear storage button
                document.getElementById('clearStorage')?.addEventListener('click', () => {
                    if (confirm('This will log out the user from the credit system. Continue?')) {
                        console.log('Clearing storage...');
                        this.integrator.clearStorage();
                    }
                });
            }

            // Helper methods
            getCurrentUserSession() {
                // Your logic to get current user session
                // This could be from cookies, localStorage, or your auth system
                const token = localStorage.getItem('authToken');
                const user = JSON.parse(localStorage.getItem('user') || 'null');

                if (token && user) {
                    return { token, user };
                }
                return null;
            }

            async syncWithBackend(action, data) {
                // Sync credit operations with your backend
                try {
                    await fetch('/api/credit-sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.userToken}`
                        },
                        body: JSON.stringify({ action, ...data })
                    });
                } catch (error) {
                    console.error('Failed to sync with backend:', error);
                }
            }

            logActivity(message) {
                const logList = document.getElementById('logList');
                const li = document.createElement('li');
                li.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                logList?.insertBefore(li, logList.firstChild);

                // Keep only last 10 entries
                while (logList?.children.length > 10) {
                    logList.removeChild(logList.lastChild);
                }
            }

            updateStatus(status) {
                const indicator = document.getElementById('statusIndicator');
                if (indicator) {
                    indicator.textContent = status;
                    indicator.className = `status-${status}`;
                }
            }

            handleLogout() {
                // Handle logout from credit system
                document.getElementById('balance').textContent = '0';
                this.logActivity('User logged out');
            }

            showError(error) {
                // Show error to user
                alert(`Credit System Error: ${error}`);
            }

            waitForDOM() {
                return new Promise(resolve => {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', resolve);
                    } else {
                        resolve();
                    }
                });
            }

            // Cleanup
            destroy() {
                this.integrator?.destroy();
            }
        }

        // Initialize the parent page manager
        const manager = new ParentPageManager();

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            manager.destroy();
        });
    </script>
</body>
</html>
```

#### Backend Endpoint for JWT Generation (Laravel Example)

```php
// app/Http/Controllers/Api/IframeTokenController.php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use App\Services\JWTService;

class IframeTokenController extends Controller
{
    private JWTService $jwtService;

    public function __construct(JWTService $jwtService)
    {
        $this->jwtService = $jwtService;
    }

    public function generateToken(Request $request)
    {
        // Check if user is authenticated via your app's auth
        if (!auth()->check()) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated'
            ], 401);
        }

        $user = auth()->user();

        // Generate JWT tokens for the iframe
        $tokens = $this->jwtService->generateTokens($user);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'name' => $user->name
                ],
                'tokens' => [
                    'access_token' => $tokens['access'],
                    'refresh_token' => $tokens['refresh']
                ]
            ]
        ]);
    }
}
```

### Child iFrame Setup

If you're building the iframe page that will be embedded, here's how to set it up:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Credit System</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }

        .loading { display: none; }
        .loading.active { display: block; }

        .auth-section { display: none; }
        .auth-section.active { display: block; }

        .credit-section { display: none; }
        .credit-section.active { display: block; }
    </style>
</head>
<body>
    <!-- Loading State -->
    <div id="loading" class="loading active">
        <p>Initializing credit system...</p>
    </div>

    <!-- Authentication Section (Standalone Mode) -->
    <div id="authSection" class="auth-section">
        <h2>Login</h2>
        <form id="loginForm">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
    </div>

    <!-- Credit System Section -->
    <div id="creditSection" class="credit-section">
        <h2>Credit System</h2>

        <div class="user-info">
            <p>User: <span id="userEmail"></span></p>
            <p>Balance: <span id="balance">0</span> credits</p>
        </div>

        <div class="actions">
            <button id="refreshBtn">Refresh Balance</button>
            <button id="spendBtn">Spend 10 Credits</button>
            <button id="addBtn">Add 50 Credits</button>
            <button id="historyBtn">View History</button>
            <button id="logoutBtn">Logout</button>
        </div>

        <div id="history" style="display: none;">
            <h3>Transaction History</h3>
            <ul id="historyList"></ul>
        </div>
    </div>

    <script type="module">
        import { CreditSystemClient } from '@supreme-ai/credit-sdk';

        class IframeCreditSystem {
            constructor() {
                this.client = null;
                this.init();
            }

            async init() {
                // Initialize credit system client
                this.client = new CreditSystemClient({
                    apiBaseUrl: '/api/secure-credits/jwt',
                    authUrl: '/api/jwt',
                    mode: 'auto', // Will detect if in iframe
                    debug: true,

                    onAuthRequired: () => {
                        console.log('Authentication required');
                        this.showAuthSection();
                    }
                });

                // Set up event listeners
                this.setupEventListeners();
                this.setupUIHandlers();
            }

            setupEventListeners() {
                // Listen for ready event
                this.client.on('ready', ({ user, mode }) => {
                    console.log(`Credit system ready in ${mode} mode`);
                    this.hideLoading();
                    this.showCreditSection();
                    this.updateUserInfo(user);
                });

                // Listen for mode detection
                this.client.on('modeDetected', ({ mode }) => {
                    console.log(`Operating in ${mode} mode`);

                    if (mode === 'embedded') {
                        // In iframe, waiting for parent
                        this.updateLoadingMessage('Waiting for authentication from parent...');
                    }
                });

                // Listen for parent timeout (fallback to standalone)
                this.client.on('parentTimeout', () => {
                    console.log('No response from parent, switching to standalone mode');
                    this.updateLoadingMessage('Switching to standalone mode...');
                });

                // Listen for authentication events
                this.client.on('authRequired', () => {
                    this.hideLoading();
                    this.showAuthSection();
                });

                this.client.on('loginSuccess', ({ user }) => {
                    console.log('Login successful:', user.email);
                    this.hideAuthSection();
                    this.showCreditSection();
                    this.updateUserInfo(user);
                });

                this.client.on('loginError', ({ error }) => {
                    alert(`Login failed: ${error}`);
                });

                // Listen for balance updates
                this.client.on('balanceUpdate', ({ balance }) => {
                    document.getElementById('balance').textContent = balance.toString();
                });

                // Listen for credit operations
                this.client.on('creditsSpent', ({ amount, newBalance }) => {
                    alert(`Spent ${amount} credits. New balance: ${newBalance}`);
                });

                this.client.on('creditsAdded', ({ amount, newBalance }) => {
                    alert(`Added ${amount} credits. New balance: ${newBalance}`);
                });

                // Listen for errors
                this.client.on('error', ({ type, error }) => {
                    console.error(`Error in ${type}:`, error);
                    alert(`Error: ${error}`);
                });
            }

            setupUIHandlers() {
                // Login form
                document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;

                    await this.client.login(email, password);
                });

                // Refresh balance
                document.getElementById('refreshBtn')?.addEventListener('click', async () => {
                    await this.client.checkBalance();
                });

                // Spend credits
                document.getElementById('spendBtn')?.addEventListener('click', async () => {
                    const result = await this.client.spendCredits(10, 'Test spending');

                    if (!result.success) {
                        alert(`Failed to spend credits: ${result.error}`);
                    }
                });

                // Add credits
                document.getElementById('addBtn')?.addEventListener('click', async () => {
                    const result = await this.client.addCredits(50, 'purchase', 'Test purchase');

                    if (!result.success) {
                        alert(`Failed to add credits: ${result.error}`);
                    }
                });

                // View history
                document.getElementById('historyBtn')?.addEventListener('click', async () => {
                    const result = await this.client.getHistory(1, 10);

                    if (result.success && result.transactions) {
                        this.displayHistory(result.transactions);
                    }
                });

                // Logout
                document.getElementById('logoutBtn')?.addEventListener('click', async () => {
                    await this.client.logout();
                    this.hideCreditSection();

                    // Show auth section only if in standalone mode
                    const state = this.client.getState();
                    if (state.mode === 'standalone') {
                        this.showAuthSection();
                    } else {
                        this.showLoading();
                        this.updateLoadingMessage('Logged out. Waiting for parent authentication...');
                    }
                });
            }

            // UI Helper methods
            showLoading() {
                document.getElementById('loading').classList.add('active');
            }

            hideLoading() {
                document.getElementById('loading').classList.remove('active');
            }

            updateLoadingMessage(message) {
                const loading = document.getElementById('loading');
                if (loading) {
                    loading.querySelector('p').textContent = message;
                }
            }

            showAuthSection() {
                document.getElementById('authSection').classList.add('active');
            }

            hideAuthSection() {
                document.getElementById('authSection').classList.remove('active');
            }

            showCreditSection() {
                document.getElementById('creditSection').classList.add('active');
            }

            hideCreditSection() {
                document.getElementById('creditSection').classList.remove('active');
            }

            updateUserInfo(user) {
                if (user) {
                    document.getElementById('userEmail').textContent = user.email;
                }
            }

            displayHistory(transactions) {
                const historyDiv = document.getElementById('history');
                const historyList = document.getElementById('historyList');

                historyList.innerHTML = '';

                transactions.forEach(transaction => {
                    const li = document.createElement('li');
                    li.textContent = `${transaction.type === 'credit' ? '+' : '-'}${transaction.amount} - ${transaction.description} (${new Date(transaction.created_at).toLocaleString()})`;
                    historyList.appendChild(li);
                });

                historyDiv.style.display = 'block';
            }
        }

        // Initialize the iframe credit system
        new IframeCreditSystem();
    </script>
</body>
</html>
```

### React Integration (Complete Guide)

#### React App Setup

```tsx
// App.tsx
import React from 'react';
import { CreditSystemProvider } from '@supreme-ai/credit-sdk';
import CreditSystemDashboard from './components/CreditSystemDashboard';
import './App.css';

function App() {
  return (
    <CreditSystemProvider
      config={{
        apiBaseUrl: process.env.REACT_APP_API_URL + '/api/secure-credits/jwt',
        authUrl: process.env.REACT_APP_API_URL + '/api/jwt',
        debug: process.env.NODE_ENV === 'development',
        tokenRefreshInterval: 600000,
        balanceRefreshInterval: 30000,

        onAuthRequired: () => {
          console.log('User needs to authenticate');
          // Could redirect to login page or show modal
        },

        onTokenExpired: () => {
          console.log('Token expired');
          // Could show notification or redirect
        }
      }}
    >
      <CreditSystemDashboard />
    </CreditSystemProvider>
  );
}

export default App;
```

#### Credit System Dashboard Component

```tsx
// components/CreditSystemDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useCreditContext } from '@supreme-ai/credit-sdk';
import type { Transaction } from '@supreme-ai/credit-sdk';

const CreditSystemDashboard: React.FC = () => {
  const {
    isInitialized,
    isAuthenticated,
    mode,
    user,
    balance,
    loading,
    error,
    login,
    logout,
    checkBalance,
    spendCredits,
    addCredits,
    getHistory
  } = useCreditContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spendAmount, setSpendAmount] = useState(10);
  const [spendDescription, setSpendDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Load transaction history when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadTransactionHistory();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        console.log('Login successful');
        setEmail('');
        setPassword('');
      } else {
        alert(`Login failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpendCredits = async () => {
    if (spendAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (spendAmount > balance) {
      alert('Insufficient credits');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await spendCredits(
        spendAmount,
        spendDescription || 'Manual spending',
        `REF-${Date.now()}`
      );

      if (result.success) {
        alert(`Successfully spent ${spendAmount} credits`);
        setSpendAmount(10);
        setSpendDescription('');
        loadTransactionHistory(); // Refresh history
      } else {
        alert(`Failed to spend credits: ${result.error}`);
      }
    } catch (err) {
      console.error('Spend error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchaseCredits = async (amount: number) => {
    setIsProcessing(true);

    try {
      // In a real app, you'd process payment first
      const paymentSuccessful = await processPayment(amount);

      if (paymentSuccessful) {
        const result = await addCredits(
          amount,
          'purchase',
          'Credit purchase via dashboard'
        );

        if (result.success) {
          alert(`Successfully added ${amount} credits`);
          loadTransactionHistory();
        } else {
          alert(`Failed to add credits: ${result.error}`);
        }
      }
    } catch (err) {
      console.error('Purchase error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadTransactionHistory = async () => {
    try {
      const result = await getHistory(1, 20);

      if (result.success && result.transactions) {
        setTransactions(result.transactions);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const processPayment = async (amount: number): Promise<boolean> => {
    // Simulate payment processing
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Processing payment for ${amount} credits`);
        resolve(true);
      }, 1000);
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Initializing credit system...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <h2>Login to Credit System</h2>
        <p>Mode: {mode || 'Detecting...'}</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isProcessing}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isProcessing}
            />
          </div>

          <button type="submit" disabled={isProcessing}>
            {isProcessing ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    );
  }

  // Authenticated - Show dashboard
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Credit System Dashboard</h1>
        <div className="user-info">
          <span>👤 {user?.email}</span>
          <span>Mode: {mode}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Balance Card */}
        <div className="card balance-card">
          <h2>Current Balance</h2>
          <div className="balance-amount">{balance} credits</div>
          <button onClick={checkBalance} disabled={isProcessing}>
            Refresh Balance
          </button>
        </div>

        {/* Spend Credits Card */}
        <div className="card spend-card">
          <h2>Spend Credits</h2>
          <div className="form-group">
            <label>Amount:</label>
            <input
              type="number"
              value={spendAmount}
              onChange={(e) => setSpendAmount(Number(e.target.value))}
              min="1"
              max={balance}
              disabled={isProcessing}
            />
          </div>

          <div className="form-group">
            <label>Description:</label>
            <input
              type="text"
              value={spendDescription}
              onChange={(e) => setSpendDescription(e.target.value)}
              placeholder="What are you spending credits on?"
              disabled={isProcessing}
            />
          </div>

          <button
            onClick={handleSpendCredits}
            disabled={isProcessing || spendAmount > balance}
            className="spend-btn"
          >
            {isProcessing ? 'Processing...' : `Spend ${spendAmount} Credits`}
          </button>
        </div>

        {/* Purchase Credits Card */}
        <div className="card purchase-card">
          <h2>Purchase Credits</h2>
          <div className="purchase-options">
            <button
              onClick={() => handlePurchaseCredits(100)}
              disabled={isProcessing}
              className="purchase-btn"
            >
              Buy 100 Credits - $10
            </button>
            <button
              onClick={() => handlePurchaseCredits(500)}
              disabled={isProcessing}
              className="purchase-btn"
            >
              Buy 500 Credits - $45
            </button>
            <button
              onClick={() => handlePurchaseCredits(1000)}
              disabled={isProcessing}
              className="purchase-btn best-value"
            >
              Buy 1000 Credits - $80 (Best Value!)
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="card history-card">
          <h2>Transaction History</h2>
          <button onClick={loadTransactionHistory} disabled={isProcessing}>
            Refresh History
          </button>

          <div className="transaction-list">
            {transactions.length === 0 ? (
              <p>No transactions yet</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className={tx.type}>
                      <td>{new Date(tx.created_at).toLocaleString()}</td>
                      <td>{tx.type}</td>
                      <td className={tx.type === 'credit' ? 'credit' : 'debit'}>
                        {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                      </td>
                      <td>{tx.description}</td>
                      <td>{tx.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditSystemDashboard;
```

#### Styles for the Dashboard

```css
/* App.css or CreditSystemDashboard.css */

.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.user-info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.logout-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.dashboard-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.balance-card {
  grid-column: span 2;
}

.balance-amount {
  font-size: 48px;
  font-weight: bold;
  color: #28a745;
  margin: 20px 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.spend-btn {
  background: #ffc107;
  color: #212529;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.purchase-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.purchase-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.purchase-btn.best-value {
  background: #28a745;
  font-weight: bold;
}

.history-card {
  grid-column: span 2;
}

.transaction-list {
  margin-top: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.transaction-list table {
  width: 100%;
  border-collapse: collapse;
}

.transaction-list th {
  background: #f8f9fa;
  padding: 10px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
}

.transaction-list td {
  padding: 10px;
  border-bottom: 1px solid #dee2e6;
}

.transaction-list .credit {
  color: #28a745;
}

.transaction-list .debit {
  color: #dc3545;
}

.loading-container,
.error-container,
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Next.js Integration

#### Next.js App Setup

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { CreditSystemProvider } from '@supreme-ai/credit-sdk';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <CreditSystemProvider
      config={{
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL + '/api/secure-credits/jwt',
        authUrl: process.env.NEXT_PUBLIC_API_URL + '/api/jwt',
        debug: process.env.NODE_ENV === 'development'
      }}
    >
      <Component {...pageProps} />
    </CreditSystemProvider>
  );
}

export default MyApp;
```

#### Next.js Page with Credit System

```tsx
// pages/dashboard.tsx
import { NextPage } from 'next';
import { useEffect } from 'react';
import { useCreditContext } from '@supreme-ai/credit-sdk';
import { useRouter } from 'next/router';

const Dashboard: NextPage = () => {
  const router = useRouter();
  const {
    isAuthenticated,
    user,
    balance,
    loading
  } = useCreditContext();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.email}</p>
      <p>Balance: {balance} credits</p>
    </div>
  );
};

export default Dashboard;
```

#### Next.js API Route for JWT Generation

```typescript
// pages/api/iframe/generate-token.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react'; // If using NextAuth
import jwt from 'jsonwebtoken';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get user session
  const session = await getSession({ req });

  if (!session || !session.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  // Generate JWT tokens
  const accessToken = jwt.sign(
    {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: session.user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '24h' }
  );

  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken
      }
    }
  });
}
```

## API Reference

### CreditSystemClient

The main client class for interacting with the credit system.

#### Constructor

```typescript
new CreditSystemClient(config?: CreditSDKConfig)
```

#### Methods

| Method | Description | Returns |
|--------|------------|---------|
| `initialize()` | Manually initialize the client | `Promise<void>` |
| `login(email, password)` | Login with credentials | `Promise<AuthResult>` |
| `logout()` | Logout and clear session | `Promise<void>` |
| `checkBalance()` | Get current balance | `Promise<BalanceResult>` |
| `spendCredits(amount, description?, referenceId?)` | Spend credits | `Promise<SpendResult>` |
| `addCredits(amount, type?, description?)` | Add credits | `Promise<AddResult>` |
| `getHistory(page?, limit?)` | Get transaction history | `Promise<HistoryResult>` |
| `getState()` | Get current SDK state | `SDKState` |
| `destroy()` | Cleanup and destroy client | `void` |

#### Events

```typescript
// Event types and their payloads
client.on('ready', ({ user, mode }) => {});
client.on('authRequired', () => {});
client.on('loginSuccess', ({ user }) => {});
client.on('loginError', ({ error }) => {});
client.on('balanceUpdate', ({ balance }) => {});
client.on('creditsSpent', ({ amount, description, previousBalance, newBalance, transaction }) => {});
client.on('creditsAdded', ({ amount, type, description, previousBalance, newBalance, transaction }) => {});
client.on('error', ({ type, error }) => {});
client.on('tokenRefreshed', () => {});
client.on('tokenExpired', () => {});
```

### ParentIntegrator

Helper class for parent pages hosting the credit system in an iframe.

#### Constructor

```typescript
new ParentIntegrator(config: ParentConfig)
```

#### Methods

| Method | Description |
|--------|------------|
| `attachToIframe(iframe)` | Attach integrator to an iframe element |
| `refreshBalance()` | Request balance refresh from iframe |
| `getStatus()` | Request current status from iframe |
| `clearStorage()` | Clear iframe storage and logout |
| `sendCustomMessage(message, data?)` | Send custom message to iframe |
| `destroy()` | Cleanup and destroy integrator |

### React Hooks

#### useCreditSystem

```typescript
const {
  isInitialized,
  isAuthenticated,
  mode,
  user,
  balance,
  loading,
  error,
  login,
  logout,
  checkBalance,
  spendCredits,
  addCredits,
  getHistory
} = useCreditSystem(config?);
```

#### useCreditContext

Must be used within a `CreditSystemProvider`:

```typescript
const creditSystem = useCreditContext();
```

## Security

### Best Practices

1. **Always use HTTPS** in production
2. **Configure allowed origins** for iframe communication
3. **Implement rate limiting** on your backend
4. **Validate JWT tokens** on every API request
5. **Use short-lived access tokens** (15-30 minutes)
6. **Store tokens in sessionStorage**, not localStorage
7. **Implement CSRF protection** for your endpoints
8. **Sanitize all user inputs**

### Security Configuration Example

```typescript
const client = new CreditSystemClient({
  // Restrict allowed origins
  allowedOrigins: [
    'https://your-domain.com',
    'https://credits.your-domain.com'
  ],

  // Use session storage (default)
  storagePrefix: 'secure_credit_',

  // Short token refresh interval
  tokenRefreshInterval: 300000, // 5 minutes

  // Disable debug in production
  debug: false
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "No response from parent" in embedded mode

**Cause**: Parent page not set up correctly or JWT generation failing.

**Solution**:
```javascript
// Ensure parent integrator is initialized
const integrator = new ParentIntegrator({
  getJWTToken: async () => {
    // Must return token object or null
    return {
      token: 'jwt-token',
      refreshToken: 'refresh-token',
      user: { id: 1, email: 'user@example.com' }
    };
  }
});

// Must attach to iframe
integrator.attachToIframe(document.getElementById('creditFrame'));
```

#### 2. "401 Unauthorized" errors

**Cause**: JWT token expired or invalid.

**Solution**:
```typescript
// Client will auto-refresh, but you can handle manually
client.on('tokenExpired', () => {
  // Handle token expiration
  client.login(email, password);
});
```

#### 3. Cross-origin errors

**Cause**: CORS not configured on backend.

**Solution** (Laravel):
```php
// config/cors.php
'paths' => ['api/*'],
'allowed_origins' => ['https://your-frontend.com'],
'allowed_headers' => ['*'],
'exposed_headers' => [],
'max_age' => 0,
'supports_credentials' => true,
```

#### 4. Balance not updating

**Cause**: Balance refresh disabled or interval too long.

**Solution**:
```typescript
const client = new CreditSystemClient({
  balanceRefreshInterval: 10000 // 10 seconds
});

// Or manually refresh
await client.checkBalance();
```

## Complete Examples

### Example 1: E-commerce Integration

```typescript
// E-commerce site integrating credit system for rewards
class EcommerceCredits {
  private creditClient: CreditSystemClient;

  constructor() {
    this.creditClient = new CreditSystemClient({
      apiBaseUrl: 'https://api.shop.com/credits/jwt',
      authUrl: 'https://api.shop.com/auth/jwt'
    });

    this.setupRewardSystem();
  }

  private setupRewardSystem() {
    // Award credits on purchase
    this.creditClient.on('ready', async () => {
      // Check if user has pending rewards
      const pendingRewards = await this.checkPendingRewards();

      if (pendingRewards > 0) {
        await this.creditClient.addCredits(
          pendingRewards,
          'reward',
          'Purchase rewards'
        );
      }
    });
  }

  async applyCreditsToOrder(orderId: string, creditsToUse: number) {
    // Check balance first
    const balanceResult = await this.creditClient.checkBalance();

    if (!balanceResult.success || balanceResult.balance! < creditsToUse) {
      throw new Error('Insufficient credits');
    }

    // Spend credits
    const spendResult = await this.creditClient.spendCredits(
      creditsToUse,
      `Applied to order ${orderId}`,
      orderId
    );

    if (spendResult.success) {
      // Apply discount to order
      const discount = this.calculateDiscount(creditsToUse);
      await this.applyOrderDiscount(orderId, discount);

      return {
        creditsUsed: creditsToUse,
        discount: discount,
        remainingBalance: spendResult.newBalance
      };
    }

    throw new Error('Failed to apply credits');
  }

  private calculateDiscount(credits: number): number {
    // 100 credits = $1 discount
    return credits / 100;
  }

  private async checkPendingRewards(): Promise<number> {
    // Your logic to check pending rewards
    return 0;
  }

  private async applyOrderDiscount(orderId: string, discount: number): Promise<void> {
    // Your logic to apply discount
  }
}
```

### Example 2: SaaS API Usage Tracking

```typescript
// SaaS platform tracking API usage with credits
class ApiUsageTracker {
  private creditClient: CreditSystemClient;
  private costPerRequest = {
    'gpt-4': 10,
    'gpt-3.5': 2,
    'dalle': 15,
    'whisper': 5
  };

  constructor() {
    this.creditClient = new CreditSystemClient({
      apiBaseUrl: 'https://api.saas.com/credits/jwt',
      authUrl: 'https://api.saas.com/auth/jwt'
    });
  }

  async trackApiCall(
    endpoint: string,
    model: keyof typeof this.costPerRequest,
    requestId: string
  ): Promise<boolean> {
    const cost = this.costPerRequest[model];

    // Check if user has enough credits
    const balance = await this.creditClient.checkBalance();

    if (!balance.success || balance.balance! < cost) {
      // Log failed attempt
      console.error(`Insufficient credits for ${model} API call`);
      return false;
    }

    // Deduct credits
    const result = await this.creditClient.spendCredits(
      cost,
      `API call: ${model} - ${endpoint}`,
      requestId
    );

    if (result.success) {
      // Log successful API usage
      await this.logApiUsage(requestId, model, cost);
      return true;
    }

    return false;
  }

  async purchaseCreditsBundle(bundle: 'starter' | 'pro' | 'enterprise') {
    const bundles = {
      starter: { credits: 1000, price: 10 },
      pro: { credits: 5000, price: 40 },
      enterprise: { credits: 20000, price: 150 }
    };

    const selectedBundle = bundles[bundle];

    // Process payment (integrate with Stripe/PayPal/etc)
    const paymentSuccess = await this.processPayment(selectedBundle.price);

    if (paymentSuccess) {
      await this.creditClient.addCredits(
        selectedBundle.credits,
        'purchase',
        `${bundle} bundle purchase`
      );
    }
  }

  private async logApiUsage(
    requestId: string,
    model: string,
    credits: number
  ): Promise<void> {
    // Your logging logic
  }

  private async processPayment(amount: number): Promise<boolean> {
    // Your payment processing logic
    return true;
  }
}
```

### Example 3: Gaming Platform Integration

```typescript
// Gaming platform with in-game currency
class GameCreditSystem {
  private creditClient: CreditSystemClient;

  constructor() {
    this.creditClient = new CreditSystemClient({
      apiBaseUrl: 'https://api.game.com/credits/jwt',
      authUrl: 'https://api.game.com/auth/jwt'
    });

    this.setupGameEvents();
  }

  private setupGameEvents() {
    // Listen for credit changes
    this.creditClient.on('creditsSpent', ({ amount, description }) => {
      // Update game UI
      this.updateGameUI('spend', amount, description);

      // Play sound effect
      this.playSound('coin_spend');
    });

    this.creditClient.on('creditsAdded', ({ amount, type }) => {
      // Show animation
      this.showCreditAnimation('+' + amount);

      // Play sound effect
      this.playSound('coin_receive');
    });
  }

  async buyInGameItem(itemId: string, itemCost: number, itemName: string) {
    // Check balance
    const balance = await this.creditClient.checkBalance();

    if (!balance.success || balance.balance! < itemCost) {
      this.showNotification('Insufficient credits! Purchase more?');
      return false;
    }

    // Purchase item
    const result = await this.creditClient.spendCredits(
      itemCost,
      `Purchased: ${itemName}`,
      `ITEM-${itemId}`
    );

    if (result.success) {
      // Add item to inventory
      await this.addToInventory(itemId);

      // Show success
      this.showNotification(`You purchased ${itemName}!`);

      return true;
    }

    return false;
  }

  async rewardPlayerCredits(
    reason: 'level_up' | 'achievement' | 'daily_bonus',
    amount: number
  ) {
    const descriptions = {
      level_up: 'Level up reward',
      achievement: 'Achievement unlocked',
      daily_bonus: 'Daily login bonus'
    };

    const result = await this.creditClient.addCredits(
      amount,
      'reward',
      descriptions[reason]
    );

    if (result.success) {
      this.showRewardNotification(descriptions[reason], amount);
    }
  }

  private updateGameUI(type: string, amount: number, description?: string): void {
    // Your UI update logic
  }

  private playSound(sound: string): void {
    // Your sound playing logic
  }

  private showCreditAnimation(text: string): void {
    // Your animation logic
  }

  private showNotification(message: string): void {
    // Your notification logic
  }

  private showRewardNotification(reason: string, amount: number): void {
    // Your reward notification logic
  }

  private async addToInventory(itemId: string): Promise<void> {
    // Your inventory logic
  }
}
```

## Migration Guide

### Migrating from Session-based to JWT Authentication

If you're migrating from a session-based system:

```typescript
// Old session-based approach
fetch('/api/credits/balance', {
  credentials: 'include' // Uses cookies
});

// New JWT approach with SDK
import { CreditSystemClient } from '@supreme-ai/credit-sdk';

const client = new CreditSystemClient({
  apiBaseUrl: '/api/secure-credits/jwt',
  authUrl: '/api/jwt'
});

// SDK handles JWT tokens automatically
const balance = await client.checkBalance();
```

## Testing

### Unit Testing with Jest

```typescript
// __tests__/creditSystem.test.ts
import { CreditSystemClient } from '@supreme-ai/credit-sdk';

describe('CreditSystemClient', () => {
  let client: CreditSystemClient;

  beforeEach(() => {
    client = new CreditSystemClient({
      apiBaseUrl: 'http://localhost:3000/api/credits',
      authUrl: 'http://localhost:3000/api/auth',
      autoInit: false
    });
  });

  afterEach(() => {
    client.destroy();
  });

  test('should initialize in standalone mode', async () => {
    await client.initialize();
    const state = client.getState();
    expect(state.mode).toBe('standalone');
  });

  test('should handle login', async () => {
    const result = await client.login('test@example.com', 'password');
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
  });

  test('should check balance', async () => {
    await client.login('test@example.com', 'password');
    const result = await client.checkBalance();
    expect(result.success).toBe(true);
    expect(typeof result.balance).toBe('number');
  });
});
```

## Support

For issues, questions, or feature requests:

- GitHub Issues: [https://github.com/supreme-ai/credit-sdk/issues](https://github.com/supreme-ai/credit-sdk/issues)
- Documentation: [https://docs.supreme-ai.com/credit-sdk](https://docs.supreme-ai.com/credit-sdk)
- Email: support@supreme-ai.com

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes in each version.