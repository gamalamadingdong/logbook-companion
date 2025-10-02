# Testing the CLI Locally

## Current Status

The CLI tool (`@sge/create-app`) is **built and working** but **not yet published to npm**. This means `npx @sge/create-app` won't work until we publish the package.

## How to Test Locally

### Method 1: Direct Node Execution (Recommended)

**Important:** Run from **outside** the template directory to avoid circular copy errors!

```bash
# CORRECT: Run from parent directory or any external location
cd c:\Users\samgammon\apps\
node sge-starter/generator/dist/index.js my-test-app

# OR: Use absolute path for output
cd c:\Users\samgammon\apps\sge-starter\generator
node dist/index.js c:\temp\my-test-app

# WRONG: Don't run inside template with relative path
cd c:\Users\samgammon\apps\sge-starter\generator
node dist/index.js test  # ❌ ERROR: Tries to copy template into itself!
```

### Method 2: npm link (Global Testing)

```bash
# From generator directory
cd generator
npm install
npm run build
npm link

# Now you can use it globally (until you unlink)
create-sge-app my-test-app

# To unlink when done testing
npm unlink -g @sge/create-app
```

### Method 3: Local npx (Alternative)

```bash
# From generator directory
npm pack

# This creates @sge-create-app-0.1.0.tgz
# Install it globally for testing
npm install -g ./sge-create-app-0.1.0.tgz

# Now test
create-sge-app my-test-app

# Uninstall when done
npm uninstall -g @sge/create-app
```

## Testing Checklist

### Basic Functionality
- [ ] `node dist/index.js --help` shows all options
- [ ] `node dist/index.js --version` shows version
- [ ] Interactive mode works: `node dist/index.js`
- [ ] Non-interactive mode works: `node dist/index.js my-app`

### Feature Toggles
- [ ] `--no-mobile` removes mobile package
- [ ] `--no-subscriptions` removes subscriptions functions
- [ ] `--no-notifications` removes notifications functions
- [ ] `--no-auth` removes auth functions

### Configuration
- [ ] Package manager selection works (npm/yarn/pnpm)
- [ ] Email provider selection works (resend/sendgrid/none)
- [ ] API key prompts appear when appropriate
- [ ] Environment file generation works

### File Operations
- [ ] Template cloning works
- [ ] package.json gets updated with project name
- [ ] .env and .env.example are created
- [ ] Unused features are removed correctly

### Error Handling
- [ ] Directory exists prompt works
- [ ] Invalid project name shows error
- [ ] Missing dependencies handled gracefully

## Test Project Creation

### Full-Featured App
```bash
node dist/index.js my-full-app
# Answer prompts:
# - Include all features
# - Provide test API keys (optional)
```

### Minimal App
```bash
node dist/index.js my-minimal-app --no-mobile --no-subscriptions --no-notifications
```

### Custom Configuration
```bash
node dist/index.js my-custom-app --email resend --pm pnpm --skip-install
```

## Verify Generated Project

After creating a test project:

```bash
cd my-test-app

# Check structure
ls -la

# Verify package.json
cat package.json

# Verify .env was created
cat .env

# Verify features were included/excluded as requested
ls packages/functions/

# Install and test (if not skipped)
npm install
npm run dev
```

## Why npx Doesn't Work Yet

The command `npx @sge/create-app` will fail because:

1. **Package not published to npm** - The `@sge/create-app` package doesn't exist on npm registry yet
2. **npx requires published packages** - npx downloads and executes packages from npm
3. **Local packages not accessible** - npx can't access local files by default

## Publishing to npm

To make `npx @sge/create-app` work:

```bash
cd generator

# 1. Ensure you're logged in
npm login

# 2. Build the package
npm run build

# 3. Test the package locally first
npm pack
npm install -g ./sge-create-app-0.1.0.tgz
create-sge-app test-from-global

# 4. If tests pass, publish
npm publish --access public

# 5. Test from npm
npx @sge/create-app test-from-npm
```

## After Publishing

Once published, update README to use:
```bash
# Instead of local usage
npx @sge/create-app my-app

# Or install globally
npm install -g @sge/create-app
create-sge-app my-app
```

## Common Issues

### Issue: "Cannot find module"
**Solution:** Run `npm install` in generator directory

### Issue: "tsc not found"
**Solution:** TypeScript is installed as dev dependency, use `npm run build`

### Issue: "Permission denied"
**Solution:** Make sure dist/index.js has shebang: `#!/usr/bin/env node`

### Issue: "npx @sge/create-app not found"
**Solution:** Package not published yet, use local method

### Issue: "Template cloning fails"
**Solution:** Check that parent directory structure exists

## Summary

✅ **CLI is built and working**  
✅ **Can be tested locally with `node dist/index.js`**  
✅ **Ready for local development and testing**  
❌ **Not yet published to npm**  
❌ **npx @sge/create-app won't work until published**  

**Current working command:**
```bash
cd sge-starter/generator
node dist/index.js my-app
```

**Future command (after npm publish):**
```bash
npx @sge/create-app my-app
```
