# Auditoria de Segurança e Reputação — `destravai.dbe.digital`

- **Data:** 2026-06-03
- **Domínio auditado:** `https://destravai.dbe.digital`
- **Infraestrutura:** Netlify (CNAME → `destravai.netlify.app`, IPs `54.232.119.62` / `2600:1f1e:7c1:c300::258`)
- **Backend:** Netlify Functions (same-origin) + Supabase + Asaas (pagamentos)
- **Tipo de app:** SPA (Vite/React) com fallback `/* → /index.html 200`
- **Escopo:** verificação externa (rede) + revisão do código/config no repositório. **Nenhuma alteração foi aplicada** — este é um relatório somente-leitura.

---

## Resumo executivo

A postura de segurança do domínio é **boa**. HTTPS é forçado, o certificado é válido, os 5 headers de segurança pedidos estão presentes e bem calibrados, não há mixed content e não há scripts de terceiros suspeitos. **Nenhum arquivo sensível está realmente exposto** (`.env`, `.git/config`, `package.json` etc. retornam apenas o HTML do SPA, não o arquivo real).

Foram encontrados **0 problemas críticos/altos**. Os achados são de risco **médio/baixo**: um endpoint de manutenção acessível sem autenticação, HSTS sem `includeSubDomains`/`preload`, ausência de `robots.txt`/`security.txt`, e verificações de reputação (Search Console / Safe Browsing) que dependem de acesso às contas e precisam ser confirmadas manualmente.

| # | Item verificado | Resultado | Risco |
|---|-----------------|-----------|-------|
| 1 | Redirect HTTP → HTTPS | ✅ OK (301) | — |
| 2 | Certificado SSL | ✅ Válido | — |
| 3 | Mixed content | ✅ Nenhum | — |
| 4 | Scripts externos suspeitos | ✅ Nenhum (só Google Fonts) | — |
| 5a | Arquivos sensíveis expostos | ✅ Nenhum | — |
| 5b | Endpoint de manutenção sem auth (`asaas-monitor`) | ⚠️ Exposto | **Médio** |
| 5c | `robots.txt` / `sitemap.xml` / `security.txt` | ⚠️ Ausentes | Baixo |
| 5d | Soft-404 (todas as rotas devolvem 200) | ⚠️ | Baixo |
| 6 | Headers de segurança | ✅ Presentes | — |
| 6b | HSTS sem `includeSubDomains`/`preload` | ⚠️ | Baixo |
| 7 | Cadastro no Google Search Console | ❓ Não confirmado | Médio |
| 8 | Alertas Safe Browsing / Search Console | ❓ Requer acesso à conta | Info |
| 9 | Checkout / login / páginas públicas só HTTPS | ✅ OK | — |

---

## Detalhamento por item

### 1. Redirect HTTP → HTTPS ✅
`http://destravai.dbe.digital/` responde **`301 Moved Permanently`** com `Location: https://destravai.dbe.digital/`. Redirecionamento permanente e correto, gerenciado pela Netlify. **OK.**

### 2. Certificado SSL ✅
```
Subject: CN=destravai.dbe.digital
Issuer:  Let's Encrypt (CN=YE1)
Válido:  28/05/2026 → 26/08/2026 (~84 dias restantes)
SAN:     DNS:destravai.dbe.digital
```
Cadeia válida, sem erro de domínio (CN e SAN batem com o host), sem expiração próxima. Renovação automática pela Netlify. **OK.**

### 3. Mixed content ✅
Nenhum recurso `http://` carregado. O único recurso externo é o Google Fonts, servido por `https://`. Além disso, a CSP (`img-src 'self' data: blob: https:`, sem `http:`) e a HSTS bloqueariam qualquer tentativa de mixed content. **OK.**

### 4. Scripts externos suspeitos ✅
O `index.html` carrega **apenas**:
- O bundle próprio do app (`/src/main.tsx`, same-origin).
- Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`).

**Nenhum** script de analytics, tag manager, pixel de anúncio, chat de terceiros ou CDN de JS desconhecida. A CSP `script-src 'self'` impede qualquer script externo ou inline de executar. **OK.**

### 5. Páginas antigas, rotas de teste e arquivos expostos

**5a — Arquivos sensíveis: ✅ NÃO expostos.**
Por ser um SPA com fallback `/* → /index.html 200`, **toda** rota inexistente devolve o HTML do app (1540 bytes, `text/html`). Confirmado que `/.env`, `/.git/config`, `/package.json`, `/src/main.tsx` retornam o HTML do SPA — **não** o conteúdo real do arquivo. `/netlify.toml` retorna `404`. Não há vazamento de código-fonte, segredos ou histórico git.

**5b — `asaas-monitor` acessível sem autenticação: ⚠️ Médio.**
`GET https://destravai.dbe.digital/.netlify/functions/asaas-monitor` executa de fato a rotina de manutenção e retorna:
```json
{"ok":true,"report":{"reprocessed":0,"stillBroken":0,"orphanLinked":0,"orphanAlerts":0}}
```
A função ([netlify/functions/asaas-monitor.mjs](../../netlify/functions/asaas-monitor.mjs)) roda queries com a *service role* do Supabase a cada chamada. Ela é **idempotente** e **não vaza dados pessoais** (só devolve contadores), o que limita bastante o impacto. Ainda assim, é superfície de ataque desnecessária: qualquer pessoa pode disparar a rotina repetidamente (abuso/DoS de baixo custo, carga no banco).
> Observação: os endpoints realmente sensíveis estão protegidos — `admin-create-tester` exige `getUser` + `isAdminUser`, e `asaas-webhook` valida o header `asaas-access-token`. O `asaas-monitor` é a exceção.

**5c — Ausência de `robots.txt` / `sitemap.xml` / `.well-known/security.txt`: Baixo.**
Esses caminhos também caem no fallback do SPA (devolvem HTML, não os arquivos). Não é falha de segurança, mas: (a) sem `robots.txt`/`sitemap.xml` o controle de indexação fica limitado; (b) sem `security.txt` não há canal padrão para report de vulnerabilidades.

**5d — Soft-404 (todas as rotas → 200): Baixo.**
Inclusive `/.netlify/functions/inexistente` retorna `200` (cai no fallback). Esperado em SPA, mas gera "soft 404" para crawlers e pode diluir SEO/reputação por conteúdo duplicado.

### 6. Headers de segurança ✅ (com 1 ajuste recomendado)
Resposta real de `https://destravai.dbe.digital/`:

| Header | Valor | Status |
|--------|-------|--------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` | ✅ Forte |
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(), payment=(), usb=()` | ✅ |
| `Strict-Transport-Security` | `max-age=31536000` | ⚠️ sem `includeSubDomains`/`preload` |

CSP de ótima qualidade: `script-src 'self'` (sem `unsafe-inline`/`unsafe-eval`), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (defesa em profundidade junto ao `X-Frame-Options`). Não expõe `Server` detalhado além de `Netlify`, sem `X-Powered-By`.

**6b — HSTS incompleto: Baixo.** O `max-age` de 1 ano é bom, mas falta `includeSubDomains` e `preload`. Único ponto realmente "incompleto" entre os headers.
**Nota menor:** `style-src 'unsafe-inline'` é necessário pelos estilos inline do React + Google Fonts — risco baixo e aceitável; já está documentado no [netlify.toml](../../netlify.toml).

### 7. Cadastro no Google Search Console ❓ (não confirmado → Médio)
- **Nenhuma** meta `google-site-verification` no HTML.
- **Nenhum** registro TXT de verificação em `destravai.dbe.digital` nem no apex `dbe.digital`.

Não foi possível confirmar o cadastro externamente (verificação pode ter sido feita por arquivo HTML — mascarado pelo SPA — ou simplesmente não existe). **Provavelmente o site não está verificado no Search Console**, o que significa que não há monitoramento de alertas de segurança/indexação do Google para este domínio. Requer confirmação manual na conta.

### 8. Alertas Safe Browsing / Search Console ❓ (Info — requer acesso à conta)
- A consulta automatizada ao Google Safe Browsing Transparency Report depende de JavaScript e não pôde ser lida programaticamente.
- **Nenhum indicador de comprometimento** foi encontrado na revisão de código (sem scripts injetados, sem domínios estranhos, sem ofuscação).
- O status oficial de Safe Browsing e eventuais alertas do Search Console só podem ser confirmados manualmente (ver "Como confirmar manualmente" abaixo).

### 9. Checkout, login e páginas públicas em HTTPS ✅
Todo o fluxo é same-origin sob `https://destravai.dbe.digital` e o HTTP é redirecionado para HTTPS (item 1). O checkout usa a function `asaas-create-checkout` (same-origin) e a `APP_ORIGIN`/`APP_URL` no backend está fixada em `https://destravai.dbe.digital` ([netlify/functions/_shared.mjs](../../netlify/functions/_shared.mjs)). A CSP `form-action 'self'` impede submissão de formulários para domínios externos. **OK.**

---

## Plano de correção sugerido (priorizado)

> Nenhuma correção foi aplicada. Sugestões abaixo, da maior para a menor prioridade.

### 🟠 Médio

**C1. Proteger ou restringir o `asaas-monitor`.**
A função só deveria ser disparada pelo agendador da Netlify (`@hourly`), não manualmente por qualquer um. Opções:
- Exigir um segredo no disparo manual (ex.: header/`?token=` comparado a `process.env.MONITOR_TOKEN`); ou
- Verificar que a invocação vem do scheduler (Netlify envia o header `x-netlify-event: schedule` nas scheduled functions) e rejeitar GETs externos; ou
- Restringir por IP/origem no `netlify.toml`.

**C2. Confirmar/cadastrar o domínio no Google Search Console.**
Verificar via DNS TXT (no apex `dbe.digital` ou no subdomínio) ou meta tag. Habilita monitoramento de alertas de segurança, problemas de indexação e ação manual do Google — importante para reputação.

### 🟡 Baixo

**C3. Completar o HSTS.** Em [netlify.toml](../../netlify.toml), evoluir para
`Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"`
(confirmar antes que **todos** os subdomínios de `dbe.digital` suportam HTTPS, pois `includeSubDomains` é abrangente; só então considerar o `preload`).

**C4. Adicionar `robots.txt` e `sitemap.xml`** em `public/` (servidos como arquivos reais, antes do fallback do SPA) para controlar indexação.

**C5. Adicionar `.well-known/security.txt`** com canal de contato para report de vulnerabilidades (boa prática de reputação).

**C6. (Opcional) Servir um 404 real** para rotas de função/arquivo inexistentes, evitando soft-404 que devolve `200`.

### ✅ Já bem feito (manter)
- Redirect HTTP→HTTPS, SSL válido com renovação automática.
- CSP restritiva sem `unsafe-eval`/`unsafe-inline` em scripts.
- Endpoints sensíveis com autenticação (`admin-create-tester`) e validação de token (`asaas-webhook`).
- Sem scripts de terceiros, sem mixed content, sem vazamento de arquivos.

---

## Como confirmar manualmente os itens que exigem acesso a contas

1. **Safe Browsing:** abrir `https://transparencyreport.google.com/safe-browsing/search?url=destravai.dbe.digital` no navegador e conferir o status.
2. **Search Console:** entrar em [search.google.com/search-console](https://search.google.com/search-console), verificar se o domínio está listado/verificado e checar a aba "Segurança e ações manuais".
3. **Painel Netlify:** conferir em *Domain settings* se o certificado está com auto-renew ativo e se há outros domínios/aliases configurados.

---

## Adendo (2026-06-03) — Exposição de chaves no frontend e RLS

Verificação extra solicitada: confirmar que nenhuma chave fica exposta no frontend a ponto de permitir vazamento de dados.

**Resultado: nenhuma chave sensível exposta. Dados protegidos.**

- ✅ O frontend (Vite) só usa variáveis `VITE_*` **públicas por design**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYWALL_ENABLED`, `VITE_ADMIN_EMAIL`. Confirmado em [src/lib/supabase/client.ts](../../src/lib/supabase/client.ts), [src/lib/ai/googleGemini.ts](../../src/lib/ai/googleGemini.ts), [src/App.tsx](../../src/App.tsx).
- ✅ Os segredos reais (`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `OPENROUTER_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) são **backend-only** (Netlify Functions / Edge Function), nunca prefixados com `VITE_`. O Vite não embute variáveis sem `VITE_` no bundle.
- ✅ Nenhum segredo hardcoded no `src/` (busca por `service_role`, JWT, `sk-…`, `AIza…`, `aact_…`: 0 resultados).
- ✅ Bundle compilado (`dist/`) varrido: **nenhum segredo backend**; só a referência pública ao Supabase.
- ✅ `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`; só `.env.example` (sem valores) está versionado.
- ✅ **RLS habilitada nas 24 tabelas** do schema `public` (confirmado via Supabase). Como a anon key é pública, é a RLS que impede um terceiro de ler dados alheios — e ela está ativa em tudo.

**Achados do linter de segurança do Supabase (não impedem o ponto acima, mas valem ação):**
- ⚠️ **Médio** — 5 funções `SECURITY DEFINER` chamáveis pelo papel `authenticated` via `/rest/v1/rpc/…`: `destravai_group_member_profile`, `destravai_group_messages_list`, `destravai_group_ranking`, `destravai_is_group_member`, `destravai_join_group_by_code`. Por rodarem como *definer*, ignoram RLS — **é preciso garantir que cada uma cheque internamente se o usuário é membro do grupo** antes de retornar dados, senão um usuário logado pode ler grupos de que não participa. Verificar/ajustar manualmente (não alterei funções de banco nesta rodada). Ref.: [database-linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- ⚠️ **Baixo** — Proteção contra senha vazada (HaveIBeenPwned) desativada no Supabase Auth. Habilitar em *Authentication → Policies*. Ref.: [password-security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Correções aplicadas nesta rodada (2026-06-03)

| Item | O que foi feito | Arquivo |
|------|------------------|---------|
| C1 | `asaas-monitor` agora exige invocação agendada (`next_run`) **ou** `MONITOR_TOKEN`; GET público anônimo retorna 401 | [netlify/functions/asaas-monitor.mjs](../../netlify/functions/asaas-monitor.mjs) |
| C3 | HSTS evoluído para `max-age=31536000; includeSubDomains` | [netlify.toml](../../netlify.toml) |
| C4 | `robots.txt` + `sitemap.xml` reais | [public/robots.txt](../../public/robots.txt), [public/sitemap.xml](../../public/sitemap.xml) |
| C5 | `.well-known/security.txt` (RFC 9116) | [public/.well-known/security.txt](../../public/.well-known/security.txt) |
| — | Documentado `MONITOR_TOKEN` | [.env.example](../../.env.example) |

Build validado (`npm run build` ✓) e arquivos confirmados em `dist/`. **Pendências manuais:** definir `MONITOR_TOKEN` no painel da Netlify; revisar as 5 funções `SECURITY DEFINER`; habilitar proteção de senha vazada; confirmar cadastro no Search Console (C2); avaliar `preload` do HSTS no apex.

---

## Evidências (comandos executados)

```
# Redirect HTTP→HTTPS
curl -I http://destravai.dbe.digital/          → 301, Location: https://...

# Headers HTTPS (resposta real)
curl -D - https://destravai.dbe.digital/        → CSP, XFO, XCTO, Referrer-Policy,
                                                   Permissions-Policy, HSTS presentes

# Certificado
openssl s_client -connect destravai.dbe.digital:443 → Let's Encrypt, válido até 26/08/2026

# Exposição de arquivos (todos caem no SPA = não expostos)
/.env /.git/config /package.json /src/main.tsx  → text/html 1540b (HTML do SPA)
/netlify.toml                                    → 404

# Endpoint de manutenção sem auth
GET /.netlify/functions/asaas-monitor            → 200 {"ok":true,"report":{...}}

# DNS / verificação
nslookup destravai.dbe.digital                   → CNAME destravai.netlify.app
nslookup -type=TXT (subdomínio e apex)           → sem TXT de verificação Google
```
