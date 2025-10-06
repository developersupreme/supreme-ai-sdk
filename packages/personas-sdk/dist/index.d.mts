/**
 * Supreme AI Personas SDK - Type Definitions
 */
interface Persona {
    id: number;
    name: string;
    description?: string;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
interface PersonasSDKConfig {
    apiBaseUrl?: string;
    debug?: boolean;
    getAuthToken?: () => string | null;
}
interface OperationResult {
    success: boolean;
    error?: string;
    message?: string;
}
interface PersonasResult extends OperationResult {
    personas?: Persona[];
}
interface PersonaResult extends OperationResult {
    persona?: Persona;
}
interface UsePersonasReturn {
    personas: Persona[];
    loading: boolean;
    error: string | null;
    getPersonas: () => Promise<PersonasResult>;
    getPersonaById: (id: number) => Promise<PersonaResult>;
    refreshPersonas: () => Promise<void>;
}

/**
 * Supreme AI Personas SDK - Main Client
 */

declare class PersonasClient {
    private config;
    private apiClient;
    constructor(config?: PersonasSDKConfig);
    /**
     * Get all personas
     */
    getPersonas(): Promise<PersonasResult>;
    /**
     * Get persona by ID
     */
    getPersonaById(id: number): Promise<PersonaResult>;
    /**
     * Debug logging
     */
    private log;
}

/**
 * React Hook for Supreme AI Personas SDK
 */

declare function usePersonas(config?: PersonasSDKConfig): UsePersonasReturn;

export { type OperationResult, type Persona, type PersonaResult, PersonasClient, type PersonasResult, type PersonasSDKConfig, type UsePersonasReturn, usePersonas };
