# Variáveis de ambiente — Destravaí

Lista de referência (sem valores). Os valores reais ficam no **Netlify** (build +
Functions) e no **Supabase** (secrets da Edge Function + SMTP). Veja também o
[`.env.example`](../../.env.example) na raiz.

## Frontend (build do Vite — Netlify) — expostas no browser
| Variável | Função |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `VITE_PAYWALL_ENABLED` | `true` para exigir assinatura ativa |
| `VITE_ADMIN_EMAIL` | (opcional) e-mail admin; default `assessoriadbe@gmail.com` |

## Backend (Netlify Functions) — nunca no frontend
| Variável | Função |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Acesso ao Supabase |
| `APP_URL` | Base do app (redirects e link de e-mail). Ex.: `https://destravai.dbe.digital` |
| `ADMIN_EMAIL` | E-mail do admin (libera testadores/IA) |
| `ASAAS_BASE_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | Pagamentos Asaas |
| `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` | IA via OpenRouter |
| `AI_PROVIDER_PRIMARY`, `AI_MODEL_PRIMARY` | Provedor/modelo primário (`openrouter` / `deepseek/deepseek-v4-flash`) |
| `AI_PROVIDER_FALLBACK`, `AI_MODEL_FALLBACK` | Fallback (`gemini` / `gemini-2.5-flash-lite`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Chave do Gemini (fallback) |
| `AI_ENFORCE_SUBSCRIPTION` | (opcional) `false` desliga o bloqueio de IA por assinatura |

## Supabase — Edge Function `destravai-gemini` (secrets)
Mesmos valores de IA do backend: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`,
`AI_PROVIDER_PRIMARY`, `AI_MODEL_PRIMARY`, `AI_PROVIDER_FALLBACK`,
`AI_MODEL_FALLBACK`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ADMIN_EMAIL`,
`AI_ENFORCE_SUBSCRIPTION`. `SUPABASE_URL`/`SUPABASE_ANON_KEY`/
`SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase.

## Resend (e-mails)
Sem variável no app. Credenciais SMTP do Resend ficam **só** no painel do Supabase
(Authentication → SMTP Settings). Detalhes em
[`../email-auth-resend-supabase.md`](../email-auth-resend-supabase.md).

## Checklist de produção (antes de vender)
- [ ] `VITE_PAYWALL_ENABLED=true` no Netlify
- [ ] Chaves Asaas de **produção** (`ASAAS_BASE_URL=https://api.asaas.com/v3`)
- [ ] `ASAAS_WEBHOOK_TOKEN` igual ao cadastrado no painel do Asaas
- [ ] Webhook do Asaas apontando para `…/.netlify/functions/asaas-webhook`
- [ ] `OPENROUTER_API_KEY` no Netlify **e** nos secrets do Supabase
- [ ] Supabase → Site URL `https://destravai.dbe.digital` e Redirect URLs incluindo `/definir-senha`
- [ ] Domínio verificado no Resend (SPF/DKIM)
