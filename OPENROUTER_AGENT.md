# OpenRouter Agent

This project includes a modular OpenRouter agent based on the `create-agent` skill:

- `src/agent/openrouterAgent.ts`: standalone agent core with event hooks and items-based streaming.
- `src/agent/tools.ts`: default tools for current time and arithmetic.
- `src/agent/headless.ts`: interactive CLI runner for local use.

## Setup

Create an OpenRouter API key at:

https://openrouter.ai/settings/keys

Set it in your shell. Do not commit API keys.

PowerShell:

```powershell
$env:OPENROUTER_API_KEY="sk-or-..."
npm run agent:headless
```

Optional model override:

```powershell
$env:OPENROUTER_MODEL="openrouter/auto"
```

The agent defaults to `openrouter/auto`. For explicit model selection, use
`fetchOpenRouterModels()` or `findOpenRouterModels()` from `src/agent/openrouterAgent.ts`
instead of hardcoding provider model IDs.
