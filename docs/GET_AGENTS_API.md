# getAgents() API

Fetch AI agents for the current organization.

## Method Signature

```typescript
getAgents(all?: boolean): Promise<AgentsResult>
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `all` | boolean | `false` | If `true`, returns all agents of the organization regardless of roles. If `false`, returns agents filtered by user's role IDs. |

## Response

```typescript
interface AgentsResult {
  success: boolean;
  agents?: Agent[];
  total?: number;
  error?: string;
}

interface Agent {
  id: number;
  name: string;
  description?: string;
  assistant_id?: string;
  short_desc?: string;
  status?: string;
}
```

---

## Usage

### Embedded Mode (iframe)

```typescript
import { useCreditSystem } from '@supreme-ai/si-sdk';

function MyComponent() {
  const { getAgents } = useCreditSystem({
    apiBaseUrl: 'https://api.example.com/api/secure-credits/jwt',
    debug: true
  });

  // Get all agents for the organization
  const fetchAllAgents = async () => {
    const result = await getAgents(true);
    if (result.success) {
      console.log('All agents:', result.agents);
    }
  };

  // Get agents filtered by user's role IDs
  const fetchMyAgents = async () => {
    const result = await getAgents(false);
    if (result.success) {
      console.log('My agents:', result.agents);
    }
  };
}
```

### Standalone Mode

```typescript
import { CreditSystemClient } from '@supreme-ai/si-sdk';

const client = new CreditSystemClient({
  apiBaseUrl: 'https://api.example.com/api/secure-credits/jwt',
  authUrl: 'https://api.example.com/api/jwt',
  mode: 'standalone',
  debug: true
});

// After authentication...

// Get all agents
const allResult = await client.getAgents(true);
// GET /ai-agents?organization_id=1&all=true

// Get role-filtered agents
const filteredResult = await client.getAgents(false);
// GET /ai-agents?organization_id=1&role_ids=15,16
```

---

## API Endpoints

| Call | Endpoint |
|------|----------|
| `getAgents(true)` | `/ai-agents?organization_id={orgId}&all=true` |
| `getAgents(false)` | `/ai-agents?organization_id={orgId}&role_ids={roleIds}` |
