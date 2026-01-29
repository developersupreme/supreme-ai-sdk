/**
 * React Hook for switching selected organization
 * Delegates to the core CreditSystemClient.switchOrganization() method
 */

import { useCallback } from 'react';
import { useCreditContext } from './CreditSystemProvider';
import type { SwitchOrgResult } from '../types';

// Re-export SwitchOrgResult for backward compatibility
export type { SwitchOrgResult } from '../types';

export function useSwitchOrganization() {
  const creditSystem = useCreditContext();

  /**
   * Switch to a different organization
   * @param orgId - The ID of the organization to switch to
   * @returns Result indicating success/failure
   */
  const switchOrganization = useCallback(
    async (orgId: string): Promise<SwitchOrgResult> => {
      return creditSystem.switchOrganization(orgId);
    },
    [creditSystem]
  );

  return {
    switchOrganization
  };
}
