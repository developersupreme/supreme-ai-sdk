# Installation Guide - Supreme AI Credit SDK

This guide covers how to install the SDK from GitHub and publish it to NPM.

## Installing from GitHub

There are several ways to install this package directly from GitHub:

### Method 1: Install from GitHub Repository (Recommended)

```bash
# Install directly from GitHub (main branch)
npm install github:supreme-ai/credit-sdk

# Or with yarn
yarn add github:supreme-ai/credit-sdk

# Or install a specific branch
npm install github:supreme-ai/credit-sdk#feature/new-feature

# Or install a specific commit
npm install github:supreme-ai/credit-sdk#commit-hash

# Or install a specific tag/release
npm install github:supreme-ai/credit-sdk#v1.0.0
```

### Method 2: Using GitHub URL

```bash
# Using HTTPS
npm install https://github.com/supreme-ai/credit-sdk.git

# Or with authentication (for private repos)
npm install git+https://github.com/supreme-ai/credit-sdk.git

# With specific branch
npm install https://github.com/supreme-ai/credit-sdk.git#main
```

### Method 3: Using package.json

Add to your `package.json`:

```json
{
  "dependencies": {
    "@supreme-ai/credit-sdk": "github:supreme-ai/credit-sdk"
  }
}
```

Or with a specific version:

```json
{
  "dependencies": {
    "@supreme-ai/credit-sdk": "github:supreme-ai/credit-sdk#v1.0.0"
  }
}
```

Then run:
```bash
npm install
```

### Method 4: Install from GitHub Packages (if published there)

First, create a `.npmrc` file in your project root:

```bash
@supreme-ai:registry=https://npm.pkg.github.com
```

Then install:
```bash
npm install @supreme-ai/credit-sdk
```

## Publishing to GitHub

### Step 1: Prepare Your Repository

1. **Create a GitHub repository** (if not already created):
   - Go to https://github.com/new
   - Name: `credit-sdk` or `supreme-credit-sdk`
   - Make it public for easier installation

2. **Initialize git in your SDK folder**:
```bash
cd C:\Git Projects\supreme-intelligence-v2\public\js\supreme-credit-sdk
git init
git add .
git commit -m "Initial commit: Supreme AI Credit SDK"
```

3. **Add GitHub remote**:
```bash
git remote add origin https://github.com/YOUR-USERNAME/credit-sdk.git
git branch -M main
git push -u origin main
```

### Step 2: Create a Release

1. **Tag your version**:
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

2. **Create GitHub Release**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Choose your tag (v1.0.0)
   - Add release notes
   - Publish release

### Step 3: Configure for Auto-Build

Create `.github/workflows/npm-publish.yml` in your repository:

```yaml
name: Build and Publish

on:
  push:
    branches: [ main ]
  release:
    types: [created]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

## Publishing to NPM Registry

### Step 1: Prepare for NPM

1. **Create NPM account** (if you don't have one):
   - Go to https://www.npmjs.com/signup

2. **Login to NPM**:
```bash
npm login
# Enter your username, password, and email
```

3. **Verify package name availability**:
```bash
npm view @supreme-ai/credit-sdk
# If it returns "404", the name is available
```

### Step 2: Publish to NPM

1. **Build the package**:
```bash
cd C:\Git Projects\supreme-intelligence-v2\public\js\supreme-credit-sdk
npm install
npm run build
```

2. **Test locally** (optional):
```bash
npm pack
# This creates supreme-ai-credit-sdk-1.0.0.tgz
# You can test install it in another project:
# npm install path/to/supreme-ai-credit-sdk-1.0.0.tgz
```

3. **Publish to NPM**:
```bash
# For scoped package (@supreme-ai/credit-sdk)
npm publish --access public

# If you get an error about scope, you might need to:
# 1. Add the scope to your npm account:
npm init --scope=@supreme-ai

# 2. Or change package name to non-scoped:
# Edit package.json: "name": "supreme-credit-sdk"
# Then publish:
npm publish
```

### Step 3: Automate NPM Publishing with GitHub Actions

Create `.github/workflows/npm-publish-registry.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

**Add NPM token to GitHub secrets**:
1. Get token from NPM: https://www.npmjs.com/settings/YOUR-USERNAME/tokens
2. Create new token (Automation type)
3. In GitHub repo: Settings → Secrets → Actions → New repository secret
4. Name: `NPM_TOKEN`, Value: your npm token

## Usage After Installation

### From GitHub:
```javascript
// If installed from GitHub
import { CreditSystemClient } from '@supreme-ai/credit-sdk';

const client = new CreditSystemClient({
  apiBaseUrl: 'https://api.yourdomain.com/api/secure-credits/jwt',
  authUrl: 'https://api.yourdomain.com/api/jwt'
});
```

### From NPM:
```javascript
// If installed from NPM
import { CreditSystemClient } from '@supreme-ai/credit-sdk';
// Usage is the same
```

## Complete Setup Checklist

- [ ] Configure package.json with proper metadata
- [ ] Add .npmignore file
- [ ] Add .gitignore file
- [ ] Add LICENSE file
- [ ] Add README.md with documentation
- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Create GitHub release/tag
- [ ] Set up GitHub Actions (optional)
- [ ] Create NPM account
- [ ] Login to NPM locally
- [ ] Publish to NPM registry

## Troubleshooting

### Common Issues

1. **"402 Payment Required" when publishing scoped package**:
   - Use `npm publish --access public` for scoped packages
   - Or use unscoped name: `supreme-credit-sdk` instead of `@supreme-ai/credit-sdk`

2. **"Cannot find module" after GitHub install**:
   - Ensure `prepare` script in package.json: `"prepare": "npm run build"`
   - This builds the package after installation

3. **"Permission denied" when publishing to NPM**:
   - Verify you're logged in: `npm whoami`
   - Check package name availability
   - For scoped packages, ensure you own the scope

4. **Build fails after GitHub installation**:
   - Make sure all devDependencies are listed
   - Add `prepare` script to build after install
   - Consider committing `dist/` folder to GitHub (not recommended but works)

## Version Management

### Bumping Versions

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major

# Push tags to GitHub
git push --tags
```

### Semantic Versioning

- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features, backward compatible
- **PATCH** (x.x.1): Bug fixes, backward compatible

## Quick Start Commands

```bash
# Complete setup and publish flow
cd C:\Git Projects\supreme-intelligence-v2\public\js\supreme-credit-sdk

# 1. Initialize and build
npm install
npm run build

# 2. Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/credit-sdk.git
git push -u origin main

# 3. Create and push tag
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0

# 4. Publish to NPM
npm login
npm publish --access public
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/supreme-ai/credit-sdk/issues
- NPM Package: https://www.npmjs.com/package/@supreme-ai/credit-sdk