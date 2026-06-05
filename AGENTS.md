# AGENTS.md - Destravai

## Antes de tudo: usar o segundo cerebro (vault)

Vault: `C:\Users\User\OneDrive\Área de Trabalho\SaaS DBE\obsidian-dbe`

1. Ler `<vault>/CONTEXT.md`.
2. Ler `<vault>/01-projetos/destravai/00-dashboard.md` e `09-solucoes.md`.
3. Ao terminar, atualizar o vault (solucoes, backlog, concluidas, decisoes, bugs, dashboard).

Responder em portugues do Brasil. Carregar contexto do vault, devolver o que aprendeu.

## Identidade

- SaaS React+Vite+TS, Supabase, Netlify Functions, Asaas, OpenRouter/Gemini, PWA.
- Deploy: destravai.dbe.digital. Status: pre-producao.

## Regras obrigatorias

- Trabalhar so neste projeto. Mudanca pequena e verificavel.
- Nunca criar `.env` real nem expor secrets; so nomes de variaveis.
- Nao alterar checkout, webhook Asaas, RLS, RPC security definer ou paywall sem plano.
- Confirmar `VITE_PAYWALL_ENABLED` antes de qualquer release de venda.
- Reportar arquivos alterados e verificacoes ao final.

## Comandos

- dev: `npm run dev` | build: `npm run build` | types: `npm run gen:types` | rls: `npm run test:rls`
