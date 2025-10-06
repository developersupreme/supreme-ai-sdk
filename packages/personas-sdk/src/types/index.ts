/**
 * Supreme AI Personas SDK - Type Definitions
 */

// Persona Types
export interface Persona {
  id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// SDK Configuration
export interface PersonasSDKConfig {
  apiBaseUrl?: string;
  debug?: boolean;
  getAuthToken?: () => string | null;
}

// Operation Results
export interface OperationResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface PersonasResult extends OperationResult {
  personas?: Persona[];
}

export interface PersonaResult extends OperationResult {
  persona?: Persona;
}

// React Hook Types
export interface UsePersonasReturn {
  personas: Persona[];
  loading: boolean;
  error: string | null;
  getPersonas: () => Promise<PersonasResult>;
  getPersonaById: (id: number) => Promise<PersonaResult>;
  refreshPersonas: () => Promise<void>;
}
