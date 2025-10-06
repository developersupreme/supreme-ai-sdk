# Supreme AI Personas SDK

A TypeScript SDK for managing AI personas with JWT authentication integration.

## Installation

```bash
npm install github:developersupreme/supreme-ai-sdk#packages/personas-sdk
```

## Usage with Credit SDK

The Personas SDK is designed to work seamlessly with the Credit SDK by sharing JWT tokens:

```typescript
import { useCreditSystem } from '@supreme-ai/credit-sdk'
import { usePersonas } from '@supreme-ai/personas-sdk'

function MyComponent() {
  // Get auth from credit SDK
  const { isAuthenticated } = useCreditSystem({
    apiBaseUrl: 'http://127.0.0.1:8000/api/secure-credits/jwt',
    debug: true
  })

  // Use personas SDK with shared JWT token
  const { personas, loading, error, getPersonas } = usePersonas({
    apiBaseUrl: 'http://127.0.0.1:8000/api/secure-credits/jwt',
    debug: true,
    getAuthToken: () => {
      // Get token from credit SDK's session storage
      const auth = sessionStorage.getItem('creditSystem_auth')
      if (auth) {
        const parsed = JSON.parse(auth)
        return parsed.token || null
      }
      return null
    }
  })

  useEffect(() => {
    if (isAuthenticated) {
      getPersonas()
    }
  }, [isAuthenticated])

  return (
    <div>
      {loading && <p>Loading personas...</p>}
      {error && <p>Error: {error}</p>}
      {personas.map(persona => (
        <div key={persona.id}>
          <h3>{persona.name}</h3>
          <p>{persona.description}</p>
        </div>
      ))}
    </div>
  )
}
```

## API

### `usePersonas(config?)`

React hook for personas management.

**Parameters:**
- `config.apiBaseUrl` - Base URL for API requests
- `config.debug` - Enable debug logging
- `config.getAuthToken` - Function that returns JWT token

**Returns:**
- `personas` - Array of persona objects
- `loading` - Loading state
- `error` - Error message if any
- `getPersonas()` - Fetch all personas
- `getPersonaById(id)` - Fetch specific persona
- `refreshPersonas()` - Refresh personas list

## License

MIT
