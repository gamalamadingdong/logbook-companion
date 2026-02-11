# GitHub Copilot Coding Agent — MCP Configuration

This file documents how to configure the GitHub Copilot coding agent for this repository.

## 1. MCP Server Configuration

Go to **repo Settings → Copilot → Coding agent** and paste this JSON:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "supabase-mcp-server@latest"],
      "env": {
        "SUPABASE_URL": "COPILOT_MCP_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY": "COPILOT_MCP_SUPABASE_SERVICE_ROLE_KEY"
      },
      "tools": [
        "execute_sql",
        "list_tables",
        "get_table_schema",
        "apply_migration"
      ]
    },
    "vercel": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "vercel-mcp-server@latest"],
      "env": {
        "VERCEL_TOKEN": "COPILOT_MCP_VERCEL_TOKEN"
      },
      "tools": [
        "get-project",
        "list-projects",
        "list-deployments",
        "get-deployment",
        "deploy-project"
      ]
    },
    "github-mcp-server": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp",
      "tools": ["*"],
      "headers": {
        "X-MCP-Toolsets": "repos,issues,users,pull_requests,code_security,actions,web_search"
      }
    }
  }
}
```

## 2. Environment Secrets

Go to **repo Settings → Environments** → Create environment named `copilot`.

Add these secrets (all must start with `COPILOT_MCP_`):

| Secret Name | Where to Get It |
|---|---|
| `COPILOT_MCP_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `COPILOT_MCP_SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Service Role Key |
| `COPILOT_MCP_VERCEL_TOKEN` | Vercel → Settings → Tokens → Create Token |

**Note**: The enhanced GitHub MCP server uses the built-in Copilot auth — no extra secret needed.

## 3. Setup Steps

The `.github/workflows/copilot-setup-steps.yml` file installs Node.js 20 and `npm ci` before the agent starts. This is already committed.

## 4. Testing

After configuring:

1. Create an issue and assign it to Copilot
2. Wait for Copilot to react with 👀 and create a PR
3. In the PR, click "View session" → expand "Start MCP Servers" step
4. Verify all server tools are listed

## 5. Instructions

The coding agent automatically reads:
- `.github/instructions/copilot-instructions.md` (path-specific, `applyTo: '**'`)
- All `working-memory/` files referenced in the instructions

No additional instruction file is needed — the existing path-specific file covers everything.
