# Auditoria de conferência — Plano único + OpenRouter

**Data:** 2026-06-01
**Escopo:** Conferir, sem alterar nada, se as mudanças do Codex foram implementadas corretamente em duas frentes — (1) substituição de 3 planos por plano único e (2) migração da IA para OpenRouter.
**Método:** Leitura e análise estática do código. Rodei apenas `npx tsc --noEmit` (type-check, sem build de produção, sem deploy). Nenhum arquivo de código foi alterado.

---

## 1. Resumo executivo

A refatoração foi **majoritariamente bem implementada e de forma real** (não é só troca de texto):

- O **plano único "Destravaí Completo"** (R$29,90 no 1º mês, R$49,90/mês depois, sem fidelidade) está implementado de ponta a ponta: landing, telas do app, serviços, Netlify Functions, banco de dados e migração de usuários antigos. Não há mais lógica funcional de Starter/Pro/Expert/Premium.
- A **cobrança em dois preços** (R$29,90 avulso → recorrência de R$49,90 criada pelo webhook após o pagamento) está realmente codificada, não apenas no texto.
- A **IA usa OpenRouter de verdade**, no servidor (Edge Function do Supabase + Netlify Function de fallback), com `Authorization: Bearer`, base URL correta e chave fora do frontend. Há fallback, tratamento de erro, timeout e rate limit.

**Porém há 1 risco crítico operacional e alguns pontos de atenção** que precisam de ação antes de cobrar em produção:

1. 🔴 **O paywall está DESLIGADO** (`VITE_PAYWALL_ENABLED` comentado). Hoje qualquer usuário logado com onboarding concluído tem acesso total, independente de pagamento, cancelamento ou inadimplência. A lógica de liberar/bloquear existe e está correta, mas **não tem efeito enquanto a flag estiver desligada**.
2. 🔴 **Dependência total do webhook do Asaas + variáveis de ambiente no Netlify.** Se `ASAAS_WEBHOOK_TOKEN`/`ASAAS_API_KEY` não estiverem configuradas em produção, o cliente paga e **nunca** recebe acesso (o acesso só é liberado pelo webhook).

O type-check passou sem erros (`tsc --noEmit` → exit 0), então o build deve passar.

---

## 2. O que está correto (com evidências)

### 2.1 Plano único

- **Fonte de verdade do preço no servidor**, espelhada no front:
  - [netlify/functions/_shared.mjs:10-28](netlify/functions/_shared.mjs#L10-L28) — `COMPLETE_PLAN` com `firstMonthPrice: 29.9`, `recurringPrice: 49.9`.
  - [src/lib/plans.ts:14-32](src/lib/plans.ts#L14-L32) — `COMPLETE_PLAN`/`PLANS = [COMPLETE_PLAN]`, comentário deixa claro que o front é só exibição.
- **Planos legados neutralizados** (não removidos do código, mas tratados com segurança):
  - [netlify/functions/_shared.mjs:30](netlify/functions/_shared.mjs#L30) — `LEGACY_PLAN_IDS = {starter, pro, expert, premium}`.
  - [netlify/functions/_shared.mjs:86-92](netlify/functions/_shared.mjs#L86-L92) — `getPlan()` mapeia **qualquer** id legado de volta para `COMPLETE_PLAN` (não quebra chamadas antigas).
- **CTAs e checkout** apontam todos para `/checkout` (oferta única):
  - Landing: [landing-page/index.html:77](landing-page/index.html#L77), [:316](landing-page/index.html#L316), [:363](landing-page/index.html#L363), [:395](landing-page/index.html#L395).
  - Seção de oferta única (sem grade de 3 planos): [landing-page/index.html:292-321](landing-page/index.html#L292-L321).
  - App: [src/pages/Assinatura.tsx:58](src/pages/Assinatura.tsx#L58) → navega para `/checkout`.
- **Endpoint de planos** retorna só a oferta única: [netlify/functions/asaas-plans.mjs:10-21](netlify/functions/asaas-plans.mjs#L10-L21).
- **Fluxo de cobrança em 2 preços realmente implementado:**
  - Cobrança inicial avulsa de R$29,90: [netlify/functions/asaas-create-checkout.mjs:74-84](netlify/functions/asaas-create-checkout.mjs#L74-L84) (`value: COMPLETE_PLAN.firstMonthPrice`).
  - Recorrência de R$49,90 criada **só após** o pagamento confirmado: [netlify/functions/asaas-webhook.mjs:97-99](netlify/functions/asaas-webhook.mjs#L97-L99) + `createRecurringSubscription` em [:184-197](netlify/functions/asaas-webhook.mjs#L184-L197) (`value: COMPLETE_PLAN.recurringPrice`, `cycle: 'MONTHLY'`).
- **Webhook atualiza status corretamente e é seguro:**
  - Valida token: [netlify/functions/asaas-webhook.mjs:13-18](netlify/functions/asaas-webhook.mjs#L13-L18).
  - Idempotência por `event_id` único: [:38-52](netlify/functions/asaas-webhook.mjs#L38-L52).
  - Mapeamento de eventos → status: [netlify/functions/_shared.mjs:196-215](netlify/functions/_shared.mjs#L196-L215) (confirmado→active/paid, overdue→past_due, refunded, failed).
  - Liberação de acesso **idempotente** (só quando `!access_granted`): [:112-116](netlify/functions/asaas-webhook.mjs#L112-L116) e `grantAccess()` em [:156-182](netlify/functions/asaas-webhook.mjs#L156-L182) (cria/atualiza profile + envia e-mail de definição de senha 1x).
- **Cancelamento e reembolso dentro da garantia:** [netlify/functions/asaas-cancel-subscription.mjs](netlify/functions/asaas-cancel-subscription.mjs) — cancela no Asaas, estorna se dentro do prazo, e só marca `refunded` se o Asaas confirmar (status nunca diverge do dinheiro real — boa prática).
- **Migração de usuários antigos:** [supabase/migrations/202606010009_single_subscription_offer.sql](supabase/migrations/202606010009_single_subscription_offer.sql)
  - Desativa planos legados em `destravai_plans` ([:54-56](supabase/migrations/202606010009_single_subscription_offer.sql#L54-L56)).
  - Migra `subscriptions.plan_id`/`plan_name`/preços e `destravai_profiles.plan` para `destravai_completo` ([:58-78](supabase/migrations/202606010009_single_subscription_offer.sql#L58-L78)).
  - Preserva assinaturas de cortesia (`payment_method = 'COURTESY'`) com preço 0.
- **Status de assinatura → acesso** corretamente derivado:
  - [netlify/functions/asaas-subscription-status.mjs:30-31](netlify/functions/asaas-subscription-status.mjs#L30-L31) — `hasAccess = status ∈ {active, trialing} && payment_status === 'paid'`. Logo, `canceled`/`past_due`/`refunded`/`failed` ⇒ sem acesso.
- **Gating no app** (quando ligado): [src/App.tsx:55-59](src/App.tsx#L55-L59) redireciona para `/assinatura` se `!hasAccess`.
- **Cortesia de testador** restrita ao admin: [netlify/functions/admin-create-tester.mjs:18](netlify/functions/admin-create-tester.mjs#L18) (`isAdminUser`).

### 2.2 OpenRouter / IA

- **Chave nunca no frontend.** Não há `OPENROUTER_API_KEY`/`GEMINI` em `import.meta.env`. A única env exposta ao browser é a Supabase URL/anon key (pública por design): [src/lib/ai/googleGemini.ts:14-15](src/lib/ai/googleGemini.ts#L14-L15).
- **Chamada ao OpenRouter só no servidor:**
  - Edge Function (principal): [supabase/functions/destravai-gemini/index.ts:140-155](supabase/functions/destravai-gemini/index.ts#L140-L155).
  - Netlify Function (fallback): [netlify/functions/destravai-gemini.mjs:82-116](netlify/functions/destravai-gemini.mjs#L82-L116).
- **Base URL correta:** `https://openrouter.ai/api/v1` (default, override por env) — [supabase/functions/destravai-gemini/index.ts:13](supabase/functions/destravai-gemini/index.ts#L13), [netlify/functions/destravai-gemini.mjs:21](netlify/functions/destravai-gemini.mjs#L21).
- **Header `Authorization: Bearer ${OPENROUTER_KEY}`:** [supabase/functions/destravai-gemini/index.ts:144](supabase/functions/destravai-gemini/index.ts#L144), [netlify/functions/destravai-gemini.mjs:90](netlify/functions/destravai-gemini.mjs#L90). Inclui `HTTP-Referer`/`X-Title` recomendados pelo OpenRouter.
- **Modelo por variável de ambiente:** `AI_MODEL_PRIMARY` / `OPENROUTER_MODELS` (cadeia de fallback nativa, máx 3) / `DEFAULT_AI_MODEL` (default `openrouter/free`) — [netlify/functions/destravai-gemini.mjs:14-34](netlify/functions/destravai-gemini.mjs#L14-L34).
- **Prompt usa a essência/onboarding do usuário** + bloco de memória:
  - [src/lib/ai.ts:56-123](src/lib/ai.ts#L56-L123) (`buildPrompt` usa perfil, pilares, serviços, tom, público).
  - Memória do usuário injetada no prompt: [src/lib/ai.ts:16-29](src/lib/ai.ts#L16-L29) + `${memoryBlock}` nos prompts.
- **Continua gerando os 4 formatos pedidos:**
  - Story único, sequência de stories e reels: [src/lib/ai.ts:39-54](src/lib/ai.ts#L39-L54) (`TYPE_INSTRUCTIONS`).
  - Ideia de foto com frase: check-ins `work`/`home`/`light` e instruções "FOTO com frase" — [src/lib/ai.ts:293-327](src/lib/ai.ts#L293-L327).
  - Reels curto / sem fala: `exposureLevel` `no-appearance`/`appear-no-talk` ([src/lib/ai.ts:31-37](src/lib/ai.ts#L31-L37)) e check-in `reel` ([:328-334](src/lib/ai.ts#L328-L334)).
- **Tratamento de erro / limite / timeout / resposta vazia:**
  - Timeout de 9,5s (teto do Netlify Free): [netlify/functions/destravai-gemini.mjs:207-213](netlify/functions/destravai-gemini.mjs#L207-L213).
  - Resposta vazia tratada e mensagens amigáveis por tipo de falha (cota/timeout/instabilidade): [:217-244](netlify/functions/destravai-gemini.mjs#L217-L244).
  - Reparo de JSON truncado/sujo: [src/lib/ai.ts:130-207](src/lib/ai.ts#L130-L207).
- **Proteção contra abuso (rate limit):**
  - 15 gerações/min por usuário: [netlify/functions/destravai-gemini.mjs:154-158](netlify/functions/destravai-gemini.mjs#L154-L158).
  - Limite mensal de 1000 gerações: [:166-178](netlify/functions/destravai-gemini.mjs#L166-L178).
  - Rate limiter persistente (Supabase) com cache em memória: [netlify/functions/_rateLimiter.mjs](netlify/functions/_rateLimiter.mjs).
- **Fallback claro:** Edge Function principal → Netlify Function se 5xx/rede; erros 4xx (limite) são mostrados direto sem cair ao fallback — [src/lib/ai/googleGemini.ts:64-78](src/lib/ai/googleGemini.ts#L64-L78).
- **Sem vazamento de dados sensíveis em log:** os `console.error` registram apenas `err.message`/IDs, não a chave nem o conteúdo do usuário.

---

## 3. Problemas encontrados

### P1 — 🔴 Paywall desligado (acesso não é bloqueado em produção)
- **Onde:** [src/App.tsx:32](src/App.tsx#L32) (`PAYWALL_ENABLED = import.meta.env.VITE_PAYWALL_ENABLED === 'true'`) + flag comentada em [.env.local:6](.env.local#L6).
- **Impacto:** Com a flag desligada, o gating [src/App.tsx:55-59](src/App.tsx#L55-L59) é totalmente ignorado. Qualquer pessoa que crie conta e conclua o onboarding usa o app inteiro **de graça**. Cancelamento, inadimplência e estorno **não** bloqueiam acesso na prática.
- **Como corrigir:** Quando o fluxo de pagamento estiver validado, definir `VITE_PAYWALL_ENABLED=true` no Netlify (variável de build do Vite) e refazer o deploy. Testar: usuário sem assinatura paga → recebe acesso; cancela → perde acesso.

### P2 — 🔴 Acesso depende 100% do webhook + envs do Asaas no Netlify
- **Onde:** liberação só ocorre no webhook ([netlify/functions/asaas-webhook.mjs:112-131](netlify/functions/asaas-webhook.mjs#L112-L131)); o polling do Pix na tela de sucesso também depende do `payment_status='paid'` setado pelo webhook ([src/pages/Checkout.tsx:48-62](src/pages/Checkout.tsx#L48-L62)). As chaves `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` estão **comentadas** em [.env.local:19-20](.env.local#L19-L20).
- **Impacto:** Se em produção (Netlify) o `ASAAS_WEBHOOK_TOKEN` não estiver configurado/igual ao do painel Asaas, o webhook responde 401 e **o cliente paga e nunca recebe acesso** (e a tela de Pix fica girando para sempre). Se `ASAAS_API_KEY` faltar, o checkout nem gera cobrança.
- **Como corrigir:** Confirmar no painel do Netlify que `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `APP_URL`, `OPENROUTER_API_KEY` estão definidas em produção. Cadastrar a URL do webhook no Asaas (`https://destravai.dbe.digital/.netlify/functions/asaas-webhook`) com o mesmo token. Fazer um teste real de Pix em sandbox antes de abrir vendas.

### P3 — 🟡 Código duplicado/órfão do agente OpenRouter
- **Onde:** [src/agent/openrouterAgent.ts](src/agent/openrouterAgent.ts), [src/agent/headless.ts](src/agent/headless.ts), [src/agent/tools.ts](src/agent/tools.ts) + dependência `@openrouter/sdk` em [package.json:18](package.json#L18).
- **Impacto:** Esses arquivos são um **agente CLI de exemplo** (skill `create-agent`), **não** fazem parte do fluxo de IA do app (nada em `src/` os importa — confirmado por busca). Não quebram o build (type-check passou), mas confundem: parecem "a integração OpenRouter" e não são. Também adicionam peso de dependências.
- **Como corrigir:** Decidir se o agente CLI tem uso real. Se não, remover `src/agent/`, o script `agent:headless` ([package.json:10](package.json#L10)), a dep `@openrouter/sdk` e o `OPENROUTER_AGENT.md`. **Não confundir com a integração de IA real**, que está em `supabase/functions/destravai-gemini` e `netlify/functions/destravai-gemini.mjs`.

### P4 — 🟡 Dependências de IA possivelmente sem uso (`@anthropic-ai/sdk`, `@google/genai`)
- **Onde:** [package.json:16-17](package.json#L16-L17).
- **Impacto:** As chamadas de IA usam `fetch` direto (não os SDKs). Esses pacotes parecem não ser usados em `src/` — peso morto. Baixo risco, mas é higiene.
- **Como corrigir:** Confirmar uso e remover se realmente não forem referenciados.

### P5 — 🟡 Variáveis de ambiente da IA/Asaas não totalmente documentadas
- **Onde:** [.env.local](.env.local) documenta Supabase, Gemini, Asaas e `APP_URL`, mas **não** lista `OPENROUTER_API_KEY`, `OPENROUTER_MODELS`, `AI_MODEL_PRIMARY`/`AI_MODEL_FALLBACK`, `AI_PROVIDER_*`. Não há `.env.example`.
- **Impacto:** Risco de esquecer de configurar `OPENROUTER_API_KEY` no Netlify/Supabase → a IA responde "Chave OpenRouter nao configurada no servidor" ([netlify/functions/destravai-gemini.mjs:188](netlify/functions/destravai-gemini.mjs#L188)).
- **Como corrigir:** Criar um `.env.example` (sem segredos) listando **todas** as envs do servidor, incluindo as do OpenRouter, e documentar quais vão na Edge Function do Supabase vs. Netlify.

### P6 — 🟢 Comentários/rótulos antigos ("Gemini")
- **Onde:** nome do arquivo [src/lib/ai/googleGemini.ts](src/lib/ai/googleGemini.ts), função `callGemini` em [src/lib/ai.ts:126-128](src/lib/ai.ts#L126-L128), nome das functions `destravai-gemini`.
- **Impacto:** Apenas cosmético/confuso — o caminho real é OpenRouter. Não afeta funcionamento.
- **Como corrigir (opcional):** Renomear para algo neutro (ex.: `aiClient`/`destravai-ai`) numa próxima limpeza. Não urgente.

---

## 4. Riscos críticos

1. **Paywall desligado (P1):** hoje o produto libera acesso sem pagamento. Precisa ligar `VITE_PAYWALL_ENABLED=true` no deploy de produção quando for cobrar — caso contrário, "liberar após pagamento" e "bloquear após cancelamento" não acontecem de fato.
2. **Webhook/ENVs do Asaas (P2):** risco real de **"pagou e não recebeu acesso"** se as variáveis de produção e o cadastro do webhook não estiverem corretos. É o ponto único de liberação de acesso.

> Observação importante: **não há risco de cobrança errada de valor** no código — o servidor é a fonte da verdade do preço (R$29,90 inicial, R$49,90 recorrente) e o front só exibe. O risco é de **acesso**, não de **valor cobrado**.

---

## 5. Riscos médios/baixos

- **P3 (médio):** código órfão do agente OpenRouter pode induzir a erro de interpretação/manutenção.
- **P4 (baixo):** dependências de IA possivelmente sem uso.
- **P5 (médio):** falta de `.env.example` com as envs do OpenRouter aumenta a chance de erro de configuração em produção.
- **P6 (baixo):** nomenclatura "Gemini" remanescente.
- **Webhook responde 200 mesmo em erro interno** ([netlify/functions/asaas-webhook.mjs:147-149](netlify/functions/asaas-webhook.mjs#L147-L149)) — é proposital (evita reenvio infinito), mas significa que falhas não-críticas dependem de monitorar `destravai_error_logs`. Recomendo acompanhar esses logs nos primeiros dias.

---

## 6. Respostas diretas ao checklist

### Plano único / Asaas / checkout
- **Ainda existe referência funcional a Starter/Pro/Premium/3 planos?** Não. Só restam o `Set` de ids legados ([_shared.mjs:30](netlify/functions/_shared.mjs#L30)) usado para **mapear** qualquer id antigo para `destravai_completo`, e comentários em `aiCosts.ts` (sem relação com planos de assinatura). Migração trata usuários antigos.
- **Algum CTA aponta para checkout antigo?** Não. Todos vão para `/checkout` (landing e app).
- **R$29,90 + R$49,90 está realmente implementado ou só no texto?** Implementado de verdade: cobrança avulsa de 29,90 no checkout e assinatura recorrente de 49,90 criada pelo webhook após confirmação.
- **Webhook atualiza o status corretamente?** Sim — valida token, é idempotente e mapeia eventos para `active/past_due/refunded/failed/canceled`.
- **App libera acesso após pagamento aprovado?** Sim na lógica (webhook seta `access_granted`/`status=active`; `hasAccess` deriva disso). **Mas o gating no app está desligado (P1)** e depende do webhook (P2).
- **App bloqueia acesso após cancelamento/falha?** Sim na lógica (`canceled`/`past_due`/`refunded` ⇒ `hasAccess=false`). **Só tem efeito com o paywall ligado (P1).**
- **Risco de cobrança errada ou pagar e não receber acesso?** Cobrança errada: não (preço no servidor). Pagar e não receber: **sim, se envs/webhook do Asaas não estiverem corretos em produção (P2).**

### OpenRouter / IA
- **A IA usa OpenRouter de verdade ou só trocaram o nome?** De verdade — chamadas a `https://openrouter.ai/api/v1/chat/completions` com `Bearer`, cadeia de modelos e fallback. (Os arquivos ainda se chamam "gemini", mas o caminho real é OpenRouter, com Gemini como provedor alternativo opcional.)
- **A chave está segura?** Sim — só no servidor (Edge/Netlify Functions). Nenhuma chave de IA exposta no frontend.
- **A geração depende da essência do usuário?** Sim — prompts montam perfil/essência + memória do usuário.
- **Alguma função antiga ficou duplicada/conflitante?** A integração real está duplicada de propósito (Edge + Netlify como fallback) — ok. O **agente em `src/agent/` está órfão** e não é usado (P3).
- **Existe fallback/erro claro se o OpenRouter falhar?** Sim — fallback Edge→Netlify, cadeia de modelos no próprio OpenRouter, timeout, e mensagens de erro amigáveis por tipo de falha.

---

## 7. Recomendações objetivas de correção (em ordem de prioridade)

1. **Antes de cobrar:** ligar `VITE_PAYWALL_ENABLED=true` em produção (P1).
2. **Antes de cobrar:** validar no Netlify as envs `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL`, `SUPABASE_*`, `APP_URL`, `OPENROUTER_API_KEY`; cadastrar a URL do webhook no Asaas com o mesmo token; fazer um teste real de Pix em sandbox (P2).
3. **Confirmar** que `OPENROUTER_API_KEY` está setada **também** nos secrets da Edge Function do Supabase (caminho principal da IA).
4. **Criar `.env.example`** com todas as envs do servidor, incluindo as do OpenRouter (P5).
5. **Limpar** o agente órfão `src/agent/` + dep `@openrouter/sdk` se não houver uso real (P3) e checar `@anthropic-ai/sdk`/`@google/genai` (P4).
6. **Monitorar** `destravai_error_logs` nos primeiros dias (webhook responde 200 em erro não-crítico).
7. (Opcional) renomear os artefatos "gemini" para nomes neutros (P6).

---

## 8. Checklist final

| Item | Status | Observação |
|---|---|---|
| Plano único funcionando | **Sim** | Código, banco e UI consistentes com R$29,90/R$49,90 |
| Checkout correto | **Sim** | Cobrança avulsa 29,90 + recorrência 49,90 reais; preço validado no servidor |
| Webhook Asaas correto | **Sim** | Token validado, idempotente, mapeamento de status correto (depende das envs em produção — P2) |
| Liberação de acesso correta | **Parcial** | Lógica correta, mas **paywall desligado (P1)** e dependente do webhook/envs (P2) |
| OpenRouter correto | **Sim** | Servidor, base URL, Bearer, modelo por env, fallback e tratamento de erro |
| Segurança da chave | **Sim** | Nenhuma chave de IA/serviço no frontend; `.env.local` fora do git |
| Pronto para produção | **Parcial** | Tecnicamente sólido; **bloqueado por P1 (ligar paywall) e P2 (envs + webhook do Asaas validados)** antes de cobrar |

---

*Auditoria somente de leitura. Nenhum arquivo de código foi alterado, nenhum commit ou deploy foi feito. Único comando executado: `npx tsc --noEmit` (type-check → exit 0).*
