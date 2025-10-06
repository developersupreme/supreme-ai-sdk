/**
 * Supreme AI Personas SDK
 *
 * A TypeScript SDK for managing AI personas with JWT authentication
 */

// Core exports
export { PersonasClient } from './core/PersonasClient';

// React hooks
export { usePersonas } from './react/usePersonas';

// Type exports
export type {
  Persona,
  PersonasSDKConfig,
  OperationResult,
  PersonasResult,
  PersonaResult,
  UsePersonasReturn
} from './types';
