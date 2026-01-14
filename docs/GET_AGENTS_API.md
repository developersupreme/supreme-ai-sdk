# getAgents() API

Fetch AI agents for the current organization.

## Parameter

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `all` | boolean | `false` | `true` = all agents in org, `false` = only agents for user's roles |

## Usage

```typescript
import { useCreditSystem, type Agent } from "@supreme-ai/si-sdk";

function MyComponent() {
  const { getAgents } = useCreditSystem({
    apiBaseUrl: "https://app.supremegroup.ai/api/secure-credits/jwt",
    authUrl: "https://app.supremegroup.ai/api/jwt",
  });

  // Get ALL agents in the organization
  const loadAllAgents = async () => {
    const result = await getAgents(true);

    if (result.success) {
      console.log("All agents:", result.agents);
      console.log("Total:", result.total);

      result.agents?.forEach((agent) => {
        console.log(`- ${agent.name} (${agent.assistant_id})`);
      });
    } else {
      console.error("Error:", result.error);
    }
  };

  // Get only agents assigned to user's roles
  const loadMyAgents = async () => {
    const result = await getAgents(false);

    if (result.success) {
      console.log("My agents:", result.agents);
      console.log("Total:", result.total);

      // Agents grouped by role (only available when all=false)
      if (result.roleGrouped) {
        Object.entries(result.roleGrouped).forEach(([roleId, data]) => {
          console.log(`Role: ${data.role_name} (ID: ${roleId})`);
          data.agents.forEach((agent) => {
            console.log(`  - ${agent.name}`);
          });
        });
      }
    } else {
      console.error("Error:", result.error);
    }
  };
}
```

## Response when `getAgents(true)`

```typescript
{
  success: true,
  agents: [
    {
      id: 14,
      assistant_id: "4dd46d71-8690-49ef-9b3a-5042d33034fa",
      name: "OpenKAI MLR Agent",
      description: "OpenKAI MLR Agent",
      short_desc: null
    },
    {
      id: 18,
      assistant_id: "c77f12e6-7333-43bc-8551-b50d277e59f0",
      name: "PHC Main Agent",
      description: null,
      short_desc: "Custom AI supporting PHCbi projects..."
    }
  ],
  total: 2
}
```

## Response when `getAgents(false)`

```typescript
{
  success: true,
  agents: [
    {
      id: 18,
      assistant_id: "c77f12e6-7333-43bc-8551-b50d277e59f0",
      name: "PHC Main Agent",
      description: null,
      short_desc: "Custom AI supporting PHCbi projects...",
      is_default: false,
      grant_type: "organization"
    },
    {
      id: 14,
      assistant_id: "4dd46d71-8690-49ef-9b3a-5042d33034fa",
      name: "OpenKAI MLR Agent",
      description: "OpenKAI MLR Agent",
      short_desc: null,
      is_default: false,
      grant_type: "role"
    }
  ],
  roleGrouped: {
    "2": {
      role_name: "CEO",
      agents: [
        {
          id: 18,
          assistant_id: "c77f12e6-7333-43bc-8551-b50d277e59f0",
          name: "PHC Main Agent",
          description: null,
          short_desc: "Custom AI supporting PHCbi projects...",
          is_default: false,
          grant_type: "organization"
        }
      ]
    },
    "13": {
      role_name: "Developer",
      agents: [
        {
          id: 14,
          assistant_id: "4dd46d71-8690-49ef-9b3a-5042d33034fa",
          name: "OpenKAI MLR Agent",
          description: "OpenKAI MLR Agent",
          short_desc: null,
          is_default: false,
          grant_type: "role"
        }
      ]
    }
  },
  total: 2
}
```
