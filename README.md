# Destravaí

App mobile-first que transforma a rotina do profissional em ideias, roteiros,
legendas e gravação (teleprompter) para o Instagram. Plano único, com IA.

- **App:** https://destravai.dbe.digital
- **Landing:** https://lpdestravai.dbe.digital

## Stack
React + Vite + TypeScript · Supabase (Auth, Postgres, Edge Functions) ·
Netlify (hosting + Functions) · Asaas (pagamentos) · OpenRouter (IA primária) +
Google Gemini (fallback) · Resend (SMTP dos e-mails de autenticação, no Supabase).

## Comandos
```bash
npm install
npm run dev        # ambiente local (Vite)
npm run build      # tsc + vite build (gera dist/)
npm run preview    # serve o build
npm run gen:types  # regenera src/lib/supabase/database.types.ts (requer Supabase CLI)
```

## Estrutura
```text
src/            App React (pages, components, context, lib, services)
netlify/functions/   Backend serverless: Asaas (checkout/webhook/assinatura) + IA fallback
supabase/functions/  Edge Function destravai-gemini (IA principal)
supabase/migrations/ Histórico do banco (NÃO apagar migrations antigas)
landing-page/        Página de vendas (deploy separado em lpdestravai)
public/              Assets do app + PWA (manifest, sw.js)
docs/                Documentação (ver docs/README.md e docs/ai-context.md)
```

## Regras comerciais
- Plano único **Destravaí Completo**: R$29,90 no 1º mês, depois R$49,90/mês.
- Sem fidelidade; cancele quando quiser. **Garantia de 7 dias** (estorno).
- Após 7 dias, o cancelamento mantém acesso até o fim do período já pago.
- Sem boleto (Pix e cartão). Limite de 1000 gerações de IA/mês por usuário.
- Admin (acesso liberado sempre): `assessoriadbe@gmail.com`.

## Deploy
- **App** (`destravai.dbe.digital`): Netlify, auto-deploy do branch `master`.
- **Landing** (`lpdestravai.dbe.digital`): Netlify, deploy manual
  (`netlify deploy --prod --dir=landing-page --site=<id>`); repo `lpdestravai`.
- **Edge Function** (IA): deploy via Supabase (CLI/MCP). Secrets no painel do Supabase.

## Variáveis de ambiente
Veja [`.env.example`](.env.example) e [`docs/operations/env-vars.md`](docs/operations/env-vars.md).
Segredos ficam no Netlify (Functions) e no Supabase (Edge Function secrets + SMTP).
Nunca commitar chaves; o frontend só usa as chaves públicas `VITE_*`.

## Documentação
- [`docs/ai-context.md`](docs/ai-context.md) — contexto rápido para IAs.
- [`docs/email-auth-resend-supabase.md`](docs/email-auth-resend-supabase.md) — e-mails/auth.
- [`docs/operations/`](docs/operations/) — runbooks e env-vars.
- [`docs/audits/`](docs/audits/) — auditorias.
