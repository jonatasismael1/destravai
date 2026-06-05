# CLAUDE.md - Destravai

## Antes de tudo: usar o segundo cerebro (vault)

Vault: `C:\Users\User\OneDrive\Área de Trabalho\SaaS DBE\obsidian-dbe`

1. Ler `<vault>/CONTEXT.md` (ritual de entrada e de saida).
2. Ler `<vault>/01-projetos/destravai/00-dashboard.md` e `09-solucoes.md`.
3. Ao terminar, atualizar o vault: solucoes, backlog, concluidas, decisoes, bugs, dashboard.

O objetivo e nao reexplicar contexto: carregue do vault, devolva para o vault.
Sempre responder em portugues do Brasil, de forma simples e pratica.

## Projeto

- Tipo: SaaS de criacao de conteudo com IA, PWA.
- Stack: React + Vite + TypeScript, Supabase (Auth/RLS/Storage), Netlify Functions,
  Supabase Edge Function (destravai-gemini), Asaas (pagamento), OpenRouter/Gemini (IA).
- Deploy: Netlify em destravai.dbe.digital. Repo: jonatasismael1/destravai (branch master).
- Status: mais perto de producao; falta validar pagamento e IA ponta a ponta.

## Areas criticas

- Pagamento/checkout Asaas e webhook (paga -> libera acesso).
- Paywall depende de `VITE_PAYWALL_ENABLED=true` (build-time).
- RPCs `security definer` de grupos e IA.
- Bucket `avatars` publico. Service worker nao pode cachear dados sensiveis.

## Regras

- Analisar antes de alterar. Escopo pequeno.
- Nunca criar/expor secrets; usar so nomes de env. Valores ficam em Privado-auditoria.
- Nao mexer em banco, auth, pagamento ou webhook sem plano.
- Comandos: dev `npm run dev`, build `npm run build`, types `npm run gen:types`, rls `npm run test:rls`.
