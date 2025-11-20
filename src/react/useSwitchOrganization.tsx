/**
 * React Hook for switching selected organization
 * Updates organization status everywhere it's stored:
 * - User state in storage
 * - Cookie for API compatibility
 * - Triggers balance refresh for new organization
 */

import { useCallback } from 'react';
import { useCreditContext } from './CreditSystemProvider';

export interface SwitchOrgResult {
  success: boolean;
  error?: string;
  previousOrgId?: string;
  newOrgId?: string;
}

export function useSwitchOrganization() {
  const creditSystem = useCreditContext();

  /**
   * Switch to a different organization
   * @param orgId - The ID of the organization to switch to
   * @returns Result indicating success/failure
   */
  const switchOrganization = useCallback(
    async (orgId: string): Promise<SwitchOrgResult> => {
      try {
        // Check if user is authenticated
        if (!creditSystem.isAuthenticated || !creditSystem.user) {
          return {
            success: false,
            error: 'User not authenticated'
          };
        }

        const organizations = creditSystem.user.organizations;

        // Check if organizations array exists
        if (!organizations || organizations.length === 0) {
          return {
            success: false,
            error: 'No organizations found for user'
          };
        }

        // Find the organization to switch to
        const targetOrg = organizations.find((org: any) => org.id === orgId);

        if (!targetOrg) {
          return {
            success: false,
            error: `Organization with ID ${orgId} not found`
          };
        }

        // Find currently selected organization
        const previousOrg = organizations.find((org: any) => org.selectedStatus === true);
        const previousOrgId = previousOrg?.id;

        // If already selected, no action needed
        if (previousOrgId === orgId) {
          return {
            success: true,
            previousOrgId: orgId,
            newOrgId: orgId,
            error: 'Organization already selected'
          };
        }

        // Update organizations array - unselect all, then select target
        const updatedOrganizations = organizations.map((org: any) => ({
          ...org,
          selectedStatus: org.id === orgId
        }));

        // Get current auth from storage via the client
        // We need to access the storage manager, but it's private
        // So we'll use sessionStorage directly with the same prefix
        const storagePrefix = 'creditSystem_';
        const authKey = storagePrefix + 'auth';

        let authData;
        try {
          const storedAuth = sessionStorage.getItem(authKey);
          authData = storedAuth ? JSON.parse(storedAuth) : null;
        } catch (error) {
          return {
            success: false,
            error: 'Failed to read authentication data from storage'
          };
        }

        if (!authData || !authData.user) {
          return {
            success: false,
            error: 'Authentication data not found in storage'
          };
        }

        // Update user object with new organizations array
        const updatedUser = {
          ...authData.user,
          organizations: updatedOrganizations
        };

        // Save updated auth back to storage
        try {
          sessionStorage.setItem(authKey, JSON.stringify({
            ...authData,
            user: updatedUser
          }));
        } catch (error) {
          return {
            success: false,
            error: 'Failed to update storage with new organization selection'
          };
        }

        // Update organization cookie for backend API compatibility
        const expires = new Date();
        expires.setDate(expires.getDate() + 30); // 30 days
        document.cookie = `user-selected-org-id=${orgId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;

        // Trigger balance refresh for the new organization
        // This ensures the balance displayed is for the newly selected org
        if (creditSystem.checkBalance) {
          await creditSystem.checkBalance();
        }

        return {
          success: true,
          previousOrgId,
          newOrgId: orgId
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to switch organization'
        };
      }
    },
    [creditSystem]
  );

  return {
    switchOrganization
  };
}
