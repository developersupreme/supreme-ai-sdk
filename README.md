# Supreme AI SDK Monorepo

A collection of TypeScript SDKs for Supreme AI services.

## Packages

### [@supreme-ai/credit-sdk](./packages/credit-sdk)
TypeScript SDK for Supreme AI Credit System with dual-mode architecture (embedded iframe & standalone).

**Installation:**
```bash
npm install github:developersupreme/supreme-ai-sdk#packages/credit-sdk
```

### [@supreme-ai/personas-sdk](./packages/personas-sdk)
TypeScript SDK for managing AI personas with JWT authentication.

**Installation:**
```bash
npm install github:developersupreme/supreme-ai-sdk#packages/personas-sdk
```

## Development

### Install dependencies
```bash
npm install
```

### Build all packages
```bash
npm run build
```

### Build specific package
```bash
npm run build:credit
npm run build:personas
```

### Watch mode for development
```bash
npm run dev
```

## Usage

Both SDKs can be used together by sharing JWT tokens:

```typescript
import { useCreditSystem } from '@supreme-ai/credit-sdk'
import { usePersonas } from '@supreme-ai/personas-sdk'

function MyApp() {
  // Credit SDK handles authentication
  const { isAuthenticated } = useCreditSystem({
    apiBaseUrl: 'http://127.0.0.1:8000/api/secure-credits/jwt',
    debug: true
  })

  // Personas SDK shares the JWT token
  const { personas, getPersonas } = usePersonas({
    apiBaseUrl: 'http://127.0.0.1:8000/api/secure-credits/jwt',
    debug: true,
    getAuthToken: () => {
      const auth = sessionStorage.getItem('creditSystem_auth')
      return auth ? JSON.parse(auth).token : null
    }
  })

  useEffect(() => {
    if (isAuthenticated) {
      getPersonas()
    }
  }, [isAuthenticated])

  return <div>...</div>
}
```

## License

MIT
