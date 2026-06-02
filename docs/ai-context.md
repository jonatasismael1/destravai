# AI Context — Destravaí

## Produto

Destravaí é um app mobile-first para ajudar profissionais a transformar rotina, essência e serviços em ideias de stories/reels, roteiros, legendas, CTAs e gravação com teleprompter.

## Stack

- Frontend: React + Vite + TypeScript.
- Backend serverless: Netlify Functions.
- Banco, Auth e Edge Function: Supabase.
- Pagamentos: Asaas.
- IA: Supabase Edge Function como caminho principal, Netlify Function como fallback, usando OpenRouter/Gemini no servidor.
- PWA: `public/sw.js` e `public/manifest.json`.
- Landing estática: `landing-page/`.

## Regras Comerciais

- Plano único: Destravai Completo.
- Primeiro mês: R$29,90.
- Recorrência: R$49,90/mês.
- Garantia legal de 7 dias, não trial grátis.
- Sem boleto.
- Limite de IA: 1000 requisições por usuário.
- Admin: `assessoriadbe@gmail.com`.

## Arquivos Principais

- App: `src/`.
- Funções Netlify: `netlify/functions/`.
- Migrations Supabase: `supabase/migrations/`.
- Edge Function de IA: `supabase/functions/destravai-gemini/`.
- Cliente Supabase: `src/lib/supabase/client.ts`.
- Cliente de IA do frontend: `src/lib/ai/googleGemini.ts`.
- Fluxo de assinatura no frontend: `src/services/subscriptionService.ts`.
- PWA service worker: `public/sw.js`.

## Atenções Atuais

- Não expor chaves no frontend.
- Não apagar migrations Supabase antigas.
- `subscriptions` precisa de baseline/migration completa.
- `database.types.ts` deve ser regenerado após aplicar migrations novas.
- IA precisa validar assinatura/acesso no backend antes de gerar.
- Service worker não deve cachear `/.netlify/functions/`.
- `tmp-*` é temporário local e não deve ser commitado.
- `destravai_subscriptions` pode ser removida se estiver vazia, sem uso ou duplicada, mas isso deve ser feito por migration após verificação.

## Documentos de Contexto

- Auditoria completa atual: `audits/2026-06-01-auditoria-completa-destravai.md`.
- Resumo visual de melhorias: `audits/2026-06-01-resumo-melhorias-destravai.html`.
- Auditoria de plano único/OpenRouter: `audits/2026-06-01-auditoria-plano-unico-openrouter.md`.
- Plano de implementação: `operations/2026-06-01-plano-implementacao-login-pwa-e-pendencias.md`.
- Plano de organização de arquivos: `operations/plano-organizacao-arquivos-destravai.md`.
