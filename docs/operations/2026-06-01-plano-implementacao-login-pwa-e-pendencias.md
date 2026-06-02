# Plano de implementação — Destravaí

Não confie cegamente no que vem a seguir, pedi para outra IA fazer isso, então talvez ela esteja por fora do seu contexto, se ver que algo não faz sentido ou pode ser ignorado, ignore.

## Objetivo
Resolver o login que fica carregando no Chrome mobile/PWA, especialmente em conta existente/admin, e fechar os pontos abertos da auditoria que afetam produção, segurança, pagamento, IA e UX.

## Regra inicial
Não expor credenciais. Remover qualquer script temporário com login/senha hardcoded antes de commit.

---

## Fase 1 — Corrigir login travado no mobile/PWA

### Hipótese principal
O problema não parece ser credencial, porque:
- desktop entra;
- novos usuários entram;
- mobile/PWA trava em conta existente;
- o spinner é o `PageLoader` do `App`, preso em `authLoading`, `profileLoading` ou `subscriptionLoading`.

A correção do `navigator.locks` em `src/lib/supabase/client.ts` ajuda, mas pode não resolver tudo. Também pode haver:
- sessão/storage corrompido no PWA;
- service worker cacheando função de assinatura;
- `getSubscriptionStatus()` travando;
- `profileLoading` ou `subscriptionLoading` sem timeout;
- callback de auth ainda disputando lock com chamada redundante no `Login`.

### Passos

1. Revisar `src/lib/supabase/client.ts`
   - Confirmar que o `lock` com timeout está aplicado.
   - Se der `AbortError`, seguir sem lock.
   - Não chamar operação duas vezes em erro real.

2. Revisar `src/pages/Login.tsx`
   - Remover chamada redundante de `supabase.auth.getSession()` ou `getUser()` logo após `signInWithPassword`, se existir.
   - Após login, confiar no `onAuthStateChange` e no `AppContext`.
   - Evitar navegação manual antes do estado global resolver.

3. Revisar `src/context/AppContext.tsx`
   - Garantir timeout individual para:
     - `getCurrentProfile()`
     - `getBrandEssence()`
     - `getSubscriptionStatus()`
     - `loadStoredProgress()`
     - `loadStoredMissions()`
     - `loadPersonalSpace()`
   - Nenhuma dessas chamadas pode deixar `profileLoading` ou `subscriptionLoading` preso para sempre.
   - Se `getSubscriptionStatus()` falhar, setar `subscription = null` e `subscriptionLoading = false`.

4. Criar fallback de recuperação para PWA/mobile
   - No login, se ficar mais de 10s carregando:
     - limpar sessão Supabase;
     - limpar localStorage relacionado ao app;
     - mostrar botão “Tentar novamente”.
   - Considerar versão manual em Config/Login: “Limpar sessão local”.

5. Corrigir service worker
   - Em `public/sw.js`, ignorar explicitamente:
     - `/.netlify/functions/`
     - `/auth/`
     - qualquer endpoint dinâmico de pagamento/assinatura
   - Não cachear status de checkout, assinatura ou funções Netlify.

6. Testar
   - Desktop Chrome.
   - Chrome Android normal.
   - PWA instalado.
   - Conta admin existente.
   - Usuário novo.
   - Usuário sem assinatura.
   - Usuário com assinatura/cortesia.
   - Logout/login repetido.

---

## Fase 2 — Segurança imediata

1. Remover `tmp-login-test.mjs`.
2. Confirmar que `.gitignore` mantém `tmp-*.mjs`, `tmp-*.js`, `tmp-*.ts`.
3. Rotacionar a senha usada no teste temporário.
4. Criar `.env.example` sem valores reais.
5. Conferir que nenhum segredo aparece em:
   - docs;
   - scripts;
   - funções;
   - arquivos temporários;
   - histórico antes de commit.

---

## Fase 3 — Receita e paywall

1. Confirmar `VITE_PAYWALL_ENABLED=true` no Netlify.
2. Manter admin liberado pelo e-mail definido.
3. Adicionar validação de assinatura nas funções de IA:
   - Supabase Edge Function `destravai-gemini`;
   - Netlify Function `destravai-gemini`.
4. Regra:
   - permitir se assinatura ativa, cortesia válida ou admin;
   - bloquear se sem acesso, cancelado fora do período pago, inadimplente ou reembolsado.
5. Manter limite de 1000 requisições por usuário.

---

## Fase 4 — Banco e migrations

1. Aplicar migrations novas no banco vivo.
2. Rodar `npm run gen:types`.
3. Confirmar que `subscriptions` nos types contém:
   - `first_month_price`;
   - `recurring_price`;
   - `current_period_end`.
4. Criar baseline/migration completa para `public.subscriptions`.
5. Verificar `destravai_subscriptions`:
   - se vazia, sem uso ou duplicada, criar migration para remover;
   - se tiver dados úteis, migrar antes.

---

## Fase 5 — Pagamentos

1. Documentar teste do webhook Asaas já realizado.
2. Criar checklist de envs de produção:
   - Asaas API;
   - webhook token;
   - Supabase service role;
   - OpenRouter;
   - app URL.
3. Criar alerta para:
   - pagamento confirmado sem assinatura local;
   - recorrência não criada após primeiro pagamento;
   - webhook com erro interno.
4. Criar forma de reprocessar webhook manualmente.
5. Adicionar rate limit em `asaas-checkout-status`.

---

## Fase 6 — Correções de produto

1. Home
   - Corrigir botão “salvar na biblioteca”.
   - Ele deve chamar `createLibraryItem()` ou mudar o texto.

2. Biblioteca
   - Corrigir “Carregar mais” para usar próxima página real.
   - Evitar duplicação de geração inicial com trava/idempotência.

3. Landing
   - Remover menção a boleto.
   - Corrigir links de Termos e Privacidade.
   - Validar encoding no navegador.

4. Legal
   - Atualizar Política de Privacidade para citar OpenRouter/Gemini conforme uso real.
   - Trocar linguagem de “trial/período de teste” por “garantia legal de 7 dias”.

---

## Fase 7 — Validação final

1. Rodar:
   - `npx tsc --noEmit`
   - `npm run build`
   - `npm run test:rls`, se token estiver em env segura.

2. Testar manualmente:
   - login desktop;
   - login Chrome mobile;
   - login PWA;
   - checkout Pix;
   - checkout cartão;
   - webhook;
   - acesso após pagamento;
   - bloqueio sem assinatura;
   - IA sem assinatura;
   - IA com assinatura;
   - cancelamento dentro e fora da garantia.

3. Conferir `git status`
   - Não commitar arquivos temporários.
   - Não commitar credenciais.