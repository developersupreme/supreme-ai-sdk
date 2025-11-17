/**
 * MessageBridge - Handles postMessage communication between iframe and parent
 */

import { EventEmitter } from './EventEmitter';
import type { IframeMessage } from '../types';

export class MessageBridge extends EventEmitter {
  private allowedOrigins: string[];
  private debug: boolean;
  private isIframe: boolean;
  private messageHandler?: (event: MessageEvent) => void;

  constructor(allowedOrigins: string[] = [], debug: boolean = false) {
    super();
    this.allowedOrigins = allowedOrigins;
    this.debug = debug;
    this.isIframe = window !== window.parent;

    this.setupMessageListener();
  }

  /**
   * Set up message listener
   */
  private setupMessageListener(): void {
    this.messageHandler = (event: MessageEvent) => {
      if (this.debug) {
        console.log('[SDK MessageBridge] Received postMessage:', {
          origin: event.origin,
          type: event.data?.type,
          allowedOrigins: this.allowedOrigins,
          isValid: this.isValidOrigin(event.origin)
        });
      }

      // Validate origin
      if (!this.isValidOrigin(event.origin)) {
        if (this.debug) {
          console.warn('[SDK MessageBridge] ❌ Message from untrusted origin:', {
            receivedOrigin: event.origin,
            allowedOrigins: this.allowedOrigins,
            messageType: event.data?.type
          });
        }
        return;
      }

      // Process message
      if (event.data && event.data.type) {
        if (this.debug) {
          console.log('[SDK MessageBridge] ✅ Message accepted:', event.data);
        }

        // Emit event for the message type
        this.emit(event.data.type, event.data);

        // Also emit a general message event
        this.emit('message', event.data);
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Validate message origin
   */
  private isValidOrigin(origin: string): boolean {
    // Always allow same origin
    if (origin === window.location.origin) {
      return true;
    }

    // Check against allowed origins
    if (this.allowedOrigins.length === 0) {
      return true; // No restrictions if empty
    }

    return this.allowedOrigins.includes(origin);
  }

  /**
   * Send message to parent window
   */
  sendToParent(type: string, data: Record<string, any> = {}): boolean {
    if (!this.isIframe) {
      if (this.debug) {
        console.warn('Not in iframe, cannot send to parent');
      }
      return false;
    }

    const message: IframeMessage = {
      type,
      ...data,
      timestamp: Date.now()
    };

    if (this.debug) {
      console.log('Sending to parent:', message);
    }

    window.parent.postMessage(message, '*');
    return true;
  }

  /**
   * Send message to iframe
   */
  sendToIframe(iframe: HTMLIFrameElement, type: string, data: Record<string, any> = {}): boolean {
    if (!iframe || !iframe.contentWindow) {
      if (this.debug) {
        console.warn('Invalid iframe element');
      }
      return false;
    }

    const message: IframeMessage = {
      type,
      ...data,
      timestamp: Date.now()
    };

    if (this.debug) {
      console.log('Sending to iframe:', message);
    }

    iframe.contentWindow.postMessage(message, '*');
    return true;
  }

  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin: string): void {
    if (!this.allowedOrigins.includes(origin)) {
      this.allowedOrigins.push(origin);
    }
  }

  /**
   * Remove allowed origin
   */
  removeAllowedOrigin(origin: string): void {
    const index = this.allowedOrigins.indexOf(origin);
    if (index > -1) {
      this.allowedOrigins.splice(index, 1);
    }
  }

  /**
   * Destroy the message bridge
   */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    this.removeAllListeners();
  }
}