# Plano de Organização de Arquivos — Destravaí

Data: 2026-06-01

Objetivo: deixar o projeto mais legível para você, para outras IAs e para manutenção futura. Este documento não executa nenhuma exclusão ou reorganização; é uma lista para análise antes de qualquer ação.

Regra geral: antes de excluir qualquer arquivo, confirmar se ele está versionado, se é usado no build, se é referenciado por import/link e se contém informação histórica útil.

## 1. Visão geral do estado atual

O projeto hoje mistura quatro tipos de material na raiz:

- Código de produção: `src/`, `netlify/`, `supabase/`, `public/`, `landing-page/`.
- Configuração: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `netlify.toml`, `.gitignore`.
- Documentação atual e antiga: auditorias, PRDs, banco, checkout, OpenRouter, docs comerciais.
- Arquivos temporários/diagnóstico: scripts `tmp-*`, logs e verificadores pontuais.

Para humanos e IAs, o maior ganho vem de limpar a raiz e criar um índice claro em `docs/`.

## 2. Arquivos que podem ser excluídos agora

### Excluir imediatamente

| Arquivo | Motivo | Observação |
|---|---|---|
| `tmp-login-test.mjs` | Arquivo temporário com credencial hardcoded | Remover localmente e rotacionar a senha usada no teste |
| `tmp-vite.log` | Log temporário local | Já deve ficar ignorado por `*.log` |
| `tmp-vite.err.log` | Log temporário local | Já deve ficar ignorado por `*.log` |

Esses arquivos não precisam ir para `docs/archive`; são lixo operacional/local.

## 3. Arquivos que podem ser excluídos se confirmado sem uso

### Agente CLI OpenRouter

| Arquivo/pasta | Pode excluir se... | Como confirmar |
|---|---|---|
| `src/agent/` | o agente CLI não for usado no produto nem em rotina interna | procurar imports e uso do script `agent:headless` |
| `OPENROUTER_AGENT.md` | `src/agent/` for removido | mover primeiro para archive se quiser manter histórico |
| script `agent:headless` em `package.json` | o agente CLI for removido | confirmar que ninguém usa esse comando |
| dependências `@openrouter/sdk` e `eventemitter3` | só eram usadas pelo agente CLI | confirmar após remoção de `src/agent/` |

Importante: isso não remove a IA real do app. A IA real está em:

- `supabase/functions/destravai-gemini/index.ts`
- `netlify/functions/destravai-gemini.mjs`
- `src/lib/ai/googleGemini.ts`
- `src/lib/ai.ts`

### Dependências de IA possivelmente órfãs

| Dependência | Pode remover se... |
|---|---|
| `@anthropic-ai/sdk` | nenhum arquivo importar ou usar |
| `@google/genai` | nenhum arquivo importar ou usar |

Confirmar com busca antes de remover. Não remover só porque parece antigo.

### Scripts de design/verificação

| Arquivo | Pode excluir se... |
|---|---|
| `verify-design.cjs` | não fizer parte do fluxo atual de QA visual |
| `verify-design2.cjs` | for duplicado/experimento antigo |
| `scripts/generate-mockups.mjs` | os mockups não forem mais gerados por script |
| `scripts/theme-transform.cjs` | não houver fluxo ativo de transformação de tema |

Sugestão: se houver dúvida, mover para `docs/archive/tools/` ou `scripts/archive/` antes de excluir.

## 4. Arquivos que não devem ser excluídos agora

| Arquivo/pasta | Motivo |
|---|---|
| `supabase/migrations/` | histórico de banco; migrations não devem ser apagadas sem estratégia |
| `supabase/functions/destravai-gemini/` | Edge Function principal de IA |
| `netlify/functions/` | backend de pagamento, assinatura e IA fallback |
| `src/lib/supabase/database.types.ts` | arquivo gerado, mas usado pelo app; regenerar, não apagar |
| `package-lock.json` | garante instalação reprodutível |
| `public/` | assets do app e PWA |
| `landing-page/` | página de vendas separada |
| `index.html` da raiz | entrada do Vite |
| `src/lib/ai/googleGemini.ts` | nome antigo, mas ainda é o client central de IA |

## 5. Documentos que devem ser mantidos, mas movidos

### Auditorias

Mover para `docs/audits/`:

- `auditoria-completa-destravai.md`
- `resumo-melhorias-destravai.html`
- `auditoria-codex-plano-unico-openrouter.md`
- `auditoria2.md`

Sugestão de nomes:

- `docs/audits/2026-06-01-auditoria-completa.md`
- `docs/audits/2026-06-01-resumo-melhorias.html`
- `docs/audits/2026-06-01-plano-unico-openrouter.md`
- `docs/audits/archive/2026-05-29-auditoria-antiga.md`

### Produto e negócio

Mover para `docs/product/`:

- `prd_e_design_system_dbe_pulse.md`
- `docs/PRD.md`
- `docs/DESIGN-SYSTEM.md`
- `docs/MELHORIAS-FUTURAS.md`
- `docs/PLANO-DE-NEGOCIOS.md`

Mover para `docs/business/`:

- `docs/FUNIL-DE-VENDAS.md`
- `docs/PAGINA-DE-VENDAS.md`
- `docs/calculadora-negocio.html`
- `docs/calculadora-custos-ia.html`

### Técnicos e operação

Mover para `docs/technical/`:

- `CHECKOUT_PLANO_UNICO.md`
- `banco_de_dados.md`
- `docs/email-auth-resend-supabase.md`
- `docs/FLUXO-IA-E-GAMIFICACAO.html`
- `docs/PLANO-DE-IMPLEMENTACAO.html`

Criar ou reescrever:

- `docs/technical/architecture.md`
- `docs/technical/database.md`
- `docs/technical/payments-asaas.md`
- `docs/technical/ai-openrouter-supabase.md`
- `docs/technical/pwa-service-worker.md`

### Documentos antigos ou conflitantes

Mover para `docs/archive/`:

- `DESTRAVAI_DATABASE_AI_FLOW.md`, porque descreve partes antigas da arquitetura de IA/banco.
- `ajuste1.md`, se for rascunho antigo.
- `auditoria2.md`, se já foi substituída pela auditoria completa atual.
- `banco_de_dados.md`, se virar apenas histórico depois de criar `docs/technical/database.md`.

Não apagar esses documentos antes de extrair qualquer informação útil.

## 6. Organização recomendada da raiz

Raiz ideal:

```text
.
├─ README.md
├─ package.json
├─ package-lock.json
├─ netlify.toml
├─ vite.config.ts
├─ tsconfig.json
├─ tailwind.config.js
├─ postcss.config.js
├─ index.html
├─ src/
├─ public/
├─ netlify/
├─ supabase/
├─ landing-page/
├─ scripts/
└─ docs/
```

O que sairia da raiz:

- auditorias;
- PRDs;
- docs comerciais;
- docs técnicos soltos;
- documentos históricos;
- qualquer arquivo temporário.

## 7. Organização recomendada de `docs/`

```text
docs/
├─ README.md
├─ ai-context.md
├─ audits/
│  ├─ README.md
│  ├─ 2026-06-01-auditoria-completa.md
│  ├─ 2026-06-01-resumo-melhorias.html
│  └─ archive/
├─ product/
│  ├─ README.md
│  ├─ prd.md
│  ├─ design-system.md
│  └─ roadmap.md
├─ technical/
│  ├─ README.md
│  ├─ architecture.md
│  ├─ database.md
│  ├─ payments-asaas.md
│  ├─ ai-openrouter-supabase.md
│  ├─ auth-login-pwa.md
│  └─ pwa-service-worker.md
├─ operations/
│  ├─ README.md
│  ├─ runbook-payments.md
│  ├─ runbook-webhook.md
│  ├─ runbook-login-pwa.md
│  └─ env-vars.md
├─ business/
│  ├─ README.md
│  ├─ funnel.md
│  ├─ sales-page.md
│  └─ pricing.md
├─ marketing/
│  ├─ roteiros/
│  └─ assets/
├─ screenshots/
│  ├─ README.md
│  ├─ png/
│  └─ svg/
└─ archive/
```

## 8. Arquivo importante para IA: `docs/ai-context.md`

Criar um arquivo curto para qualquer IA entender o projeto rapidamente.

Conteúdo recomendado:

```md
# AI Context — Destravaí

## Produto
App mobile-first para gerar ideias, roteiros, legendas e gravação com teleprompter para Instagram.

## Stack
React + Vite + Supabase + Netlify Functions + Supabase Edge Functions + Asaas + OpenRouter/Gemini.

## Regras comerciais
- Plano único: Destravai Completo.
- Primeiro mês: R$29,90.
- Recorrência: R$49,90/mês.
- Garantia legal de 7 dias.
- Sem boleto.
- Limite: 1000 requisições de IA por usuário.
- Admin: assessoriadbe@gmail.com.

## IA
Fluxo principal: Supabase Edge Function.
Fallback: Netlify Function.
Não expor chaves no frontend.

## Banco
Migrations ficam em `supabase/migrations/`.
Não apagar migrations antigas.
Gerar types com `npm run gen:types`.

## Atenções
- Paywall depende de env.
- IA precisa validar assinatura no backend.
- Service worker não deve cachear Netlify Functions.
- `subscriptions` precisa de baseline completa.
```

Esse arquivo ajuda muito a evitar que outra IA leia documentos antigos e tome decisões erradas.

## 9. Organização recomendada de `src/`

### Estado atual aceitável

A estrutura atual é funcional:

```text
src/
├─ components/
├─ context/
├─ lib/
├─ pages/
├─ services/
├─ types/
├─ App.tsx
├─ main.tsx
└─ index.css
```

Ela é simples e não exige refactor imediato.

### Estrutura futura mais organizada

Se quiser evoluir para leitura melhor por domínio:

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ providers/
│  └─ routes.tsx
├─ features/
│  ├─ auth/
│  ├─ onboarding/
│  ├─ home/
│  ├─ create/
│  ├─ library/
│  ├─ calendar/
│  ├─ studio/
│  ├─ subscription/
│  ├─ groups/
│  ├─ personal-space/
│  └─ settings/
├─ shared/
│  ├─ components/
│  ├─ lib/
│  ├─ services/
│  └─ types/
└─ styles/
```

Recomendação pragmática: não fazer esse refactor agora. Primeiro corrigir login/PWA, paywall, IA backend e pagamentos. Depois reorganizar por feature se o app continuar crescendo.

## 10. Organização recomendada de `netlify/functions/`

Manter `netlify/functions/` simples, porque o Netlify espera essa pasta.

Estrutura atual está aceitável:

```text
netlify/functions/
├─ _shared.mjs
├─ _rateLimiter.mjs
├─ asaas-create-checkout.mjs
├─ asaas-webhook.mjs
├─ asaas-subscription-status.mjs
├─ asaas-cancel-subscription.mjs
├─ asaas-checkout-status.mjs
├─ asaas-plans.mjs
├─ admin-create-tester.mjs
└─ destravai-gemini.mjs
```

Melhoria sem mexer em runtime:

- Criar `docs/technical/netlify-functions.md` explicando cada função.
- Padronizar comentários de topo.
- Evitar mover arquivos se isso puder quebrar deploy.

## 11. Organização recomendada de `supabase/`

Não apagar migrations antigas.

Estrutura recomendada:

```text
supabase/
├─ migrations/
├─ functions/
│  └─ destravai-gemini/
└─ README.md
```

Criar `supabase/README.md` com:

- como aplicar migrations;
- como regenerar types;
- quais funções existem;
- quais secrets a Edge Function precisa;
- aviso para não apagar migrations.

Sobre `destravai_subscriptions`:

1. Consultar se a tabela existe no banco vivo.
2. Verificar contagem de linhas.
3. Verificar se algum código usa.
4. Se estiver vazia, sem uso ou duplicada, criar migration de remoção.
5. Nunca apagar diretamente sem migration.

## 12. Organização recomendada de assets

Hoje há assets em:

- `public/`
- `landing-page/`
- `docs/Prints/`

Sugestão:

```text
public/
├─ app-icons/
├─ brand/
└─ pwa/

landing-page/
├─ assets/
│  ├─ brand/
│  └─ icons/
├─ index.html
├─ styles.css
└─ script.js

docs/screenshots/
├─ png/
└─ svg/
```

Não mover agora sem revisar todas as referências de caminho em HTML, manifest, CSS e React.

## 13. Documentos novos recomendados

Criar estes documentos para deixar o projeto bom para humanos e IAs:

| Arquivo | Função |
|---|---|
| `README.md` | visão geral, comandos, estrutura e links principais |
| `docs/README.md` | índice da documentação |
| `docs/ai-context.md` | contexto curto para IA |
| `docs/operations/env-vars.md` | lista de envs sem valores |
| `docs/operations/runbook-login-pwa.md` | como diagnosticar login travado |
| `docs/operations/runbook-webhook.md` | como testar/reprocessar webhook |
| `docs/technical/database.md` | tabelas principais e migrations |
| `docs/technical/payments-asaas.md` | fluxo de checkout/assinatura |
| `docs/technical/ai-openrouter-supabase.md` | fluxo de IA |
| `docs/technical/pwa-service-worker.md` | regras de cache |

## 14. Ordem segura para organizar o projeto

### Etapa 1 — Limpeza sem risco

1. Apagar `tmp-login-test.mjs`.
2. Apagar `tmp-vite.log` e `tmp-vite.err.log`.
3. Confirmar que `git status` não mostra temporários.

### Etapa 2 — Índices de documentação

1. Criar `README.md` na raiz.
2. Criar `docs/README.md`.
3. Criar `docs/ai-context.md`.
4. Criar `docs/operations/env-vars.md` sem segredos.

### Etapa 3 — Mover documentação

1. Criar pastas `docs/audits`, `docs/product`, `docs/technical`, `docs/business`, `docs/archive`.
2. Mover auditorias para `docs/audits`.
3. Mover docs antigas para `docs/archive`.
4. Atualizar links internos.

### Etapa 4 — Revisar código órfão

1. Confirmar se `src/agent/` é usado.
2. Se não for usado, remover junto com docs/scripts/deps relacionados.
3. Rodar `npx tsc --noEmit`.
4. Rodar `npm run build`.

### Etapa 5 — Organização avançada

Só depois de estabilizar produção:

- reorganizar `src/` por feature;
- reorganizar assets;
- renomear arquivos com "gemini" para nome neutro;
- criar ADRs em `docs/decisions/`.

## 15. Lista curta de decisão

Antes de mexer, decidir:

1. O agente CLI OpenRouter fica ou sai?
2. `docs/` deve ser versionado ou continuar ignorado?
3. Auditorias antigas devem ser arquivadas ou removidas?
4. Prints SVG e PNG precisam dos dois formatos?
5. Landing page fica separada em `landing-page/` ou entra em `docs/marketing/` apenas como material estático?

## 16. Resultado esperado

Depois da organização, uma IA deve conseguir abrir:

1. `README.md`
2. `docs/ai-context.md`
3. `docs/technical/architecture.md`
4. `docs/operations/env-vars.md`
5. `docs/audits/2026-06-01-auditoria-completa.md`

E entender rapidamente:

- o que o app faz;
- como roda;
- onde ficam backend, banco, IA e pagamentos;
- quais arquivos não deve tocar;
- quais problemas estão pendentes;
- quais decisões comerciais já foram tomadas.
