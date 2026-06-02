# Auditoria Completa — Destravaí

Data da atualização: 2026-06-01

Escopo: nova revisão do estado atual do projeto após alterações recentes. Foram analisados frontend React/Vite, funções Netlify, Edge Function Supabase, migrations, serviços, PWA, landing page, documentos novos e arquivos temporários. Nenhum valor de credencial foi registrado neste documento.

Validações executadas:

- Leitura de código e documentos atualizados.
- `git status --short` para identificar alterações atuais.
- `npx tsc --noEmit` passou sem erros.
- Checagem de padrões sensíveis no repositório, sem repetir valores.
- RLS ao vivo não foi reexecutado porque `SUPABASE_ACCESS_TOKEN` não estava carregado no ambiente; não escrevi token em comando.
- Nenhum arquivo de código, configuração, migration ou deploy foi alterado por esta auditoria. Apenas os documentos solicitados foram atualizados.

Estado atual do Git observado:

- `src/lib/supabase/client.ts` modificado.
- Arquivos novos: `auditoria-codex-plano-unico-openrouter.md`, `CHECKOUT_PLANO_UNICO.md`, `OPENROUTER_AGENT.md`, `tmp-login-test.mjs`, `auditoria-completa-destravai.md`, `resumo-melhorias-destravai.html`.
- Novas migrations: `202606010009_single_subscription_offer.sql` e `202606010010_cancel_at_period_end.sql`.

## 1. Resumo executivo

O projeto evoluiu bastante desde a auditoria anterior. As mudanças recentes resolvem parte importante do fluxo comercial:

- A oferta foi simplificada para plano único: `destravai_completo`.
- O checkout agora cobra primeiro mês promocional e cria recorrência após pagamento confirmado.
- O cancelamento fora da garantia agora preserva acesso até o fim do período pago.
- A IA passou a suportar OpenRouter de verdade, com Edge Function Supabase como caminho principal e Netlify Function como fallback.
- O cliente Supabase ganhou lock com timeout para evitar travamento pós-login em PWA/navegadores.
- Type-check passou.

Mesmo assim, ainda existem bloqueios antes de escalar vendas:

- Há um arquivo temporário com credenciais hardcoded. Ele deve ser removido e as credenciais relacionadas devem ser rotacionadas.
- O paywall ainda depende de `VITE_PAYWALL_ENABLED=true`; no `.env.local` local ele está comentado.
- As funções de IA continuam sem validar assinatura ativa no backend.
- O service worker ainda pode cachear chamadas GET para `/.netlify/functions`.
- A migration de `subscriptions` continua incompleta para recriar o banco do zero.
- Os types Supabase locais não refletem as novas colunas usadas por funções em `subscriptions`.
- A decisão comercial agora está clara: não haverá boleto; a landing ainda precisa remover essa menção e corrigir links legais.
- A política de privacidade cita Gemini, mas a IA agora usa OpenRouter/Gemini.

Conclusão: a direção técnica melhorou, principalmente em plano único, OpenRouter e cancelamento. O webhook foi testado e informado como funcionando. O projeto ainda não deve abrir tráfego pago forte sem corrigir segredos temporários, paywall backend, cache de APIs, consistência de migrations/types e monitoramento/reprocessamento operacional do webhook Asaas.

## 2. Segurança

### O que melhorou

- A chave de IA continua fora do frontend.
- OpenRouter é chamado somente no servidor.
- As funções Netlify usam service role apenas no backend.
- O cliente Supabase usa somente URL e chave pública no browser.
- O lock com timeout em `src/lib/supabase/client.ts` reduz risco de tela travada em login/PWA.
- `.env.local`, `.mcp.json`, `dist`, `node_modules`, `.agents` e `.codex` estão ignorados pelo Git.

### Problemas atuais

1. Arquivo temporário com credenciais hardcoded.
   - `tmp-login-test.mjs` contém e-mail/senha de login e chave pública Supabase hardcoded.
   - O arquivo está untracked; o `.gitignore` foi atualizado para cobrir scripts temporários `tmp-*`.
   - Prioridade: crítica.
   - Ação: remover o arquivo local e rotacionar a senha usada no teste.

2. Credenciais operacionais foram compartilhadas durante o trabalho.
   - Não foram registradas neste relatório.
   - Ação: rotacionar tokens/senhas após concluir ajustes operacionais.

3. Paywall depende de flag pública.
   - `src/App.tsx` só bloqueia se `VITE_PAYWALL_ENABLED === 'true'`.
   - No `.env.local` atual essa variável está comentada.
   - Em produção, precisa estar definida no Netlify no momento de cobrar.

4. IA sem validação de assinatura no backend.
   - `supabase/functions/destravai-gemini/index.ts` e `netlify/functions/destravai-gemini.mjs` validam usuário e limite.
   - Elas não validam `hasAccess`, assinatura ativa, cortesia ou cancelamento.
   - Isso permite custo de IA por usuário autenticado mesmo sem pagamento, se ele conseguir chamar a função.

5. Admin definido por e-mail.
   - Decisão operacional atual: admin apenas `assessoriadbe@gmail.com`.
   - Isso é aceitável para operação simples, desde que essa conta seja bem protegida.
   - Role/claim pode ficar como melhoria futura, não bloqueio imediato.

6. RPCs sensíveis seguem em `public`.
   - As permissões foram revogadas, mas funções `SECURITY DEFINER` em schema exposto continuam sendo ponto de atenção em Supabase.

7. Edge Function de IA usa CORS aberto.
   - Há autenticação por JWT, mas a origem deve ser restringida em produção.

## 3. Pagamentos e assinaturas

### O que melhorou

- A oferta única está implementada no servidor e no frontend.
- `asaas-plans.mjs` retorna somente `Destravai Completo`.
- `asaas-create-checkout.mjs` cria cobrança inicial avulsa.
- `asaas-webhook.mjs` cria recorrência mensal após pagamento confirmado.
- `asaas-subscription-status.mjs` considera cortesia e cancelamento com período pago restante.
- `asaas-cancel-subscription.mjs` agora mantém acesso até `current_period_end` fora da garantia.
- `CHECKOUT_PLANO_UNICO.md` documenta o fluxo de preço inicial e recorrente.

### Riscos atuais

1. Webhook é ponto único de liberação.
   - Você informou que testou o webhook e ele estava funcionando.
   - Mesmo funcionando, ele precisa de monitoramento porque continua sendo a peça que transforma pagamento em acesso.
   - O `.env.local` local mostra variáveis Asaas de API/webhook comentadas; isso não invalida produção, mas reforça a necessidade de checklist de envs por ambiente.

2. Recorrência pode falhar após pagamento inicial.
   - O webhook libera acesso mesmo se falhar a criação da recorrência.
   - Isso protege o cliente que pagou, mas cria risco operacional: usuário com acesso e sem cobrança recorrente futura.
   - Precisa de alerta/painel para recorrência não criada.

3. Webhook responde 200 em erro interno.
   - Isso evita retry infinito, mas exige reprocessamento manual e monitoramento.
   - Sem isso, falhas podem ficar invisíveis.

4. Evento pago sem assinatura local ainda é risco.
   - Se `subRow` não for encontrado, o evento é registrado/logado, mas não concede acesso.
   - Precisa de alerta específico.

5. `current_period_end` é calculado como "agora + 1 mês".
   - Em pagamento atrasado, antecipado ou webhook atrasado, o período pode ficar impreciso.
   - Melhor usar dados reais do Asaas, como vencimento/competência do pagamento, ou `max(current_period_end, now) + 1 mês`.

6. Status público de checkout segue sem rate limit.
   - `asaas-checkout-status.mjs` é público por `paymentId`.
   - Retorna pouco dado, mas deveria ter rate limit ou token curto de checkout.

7. CPF/CNPJ é validado só por tamanho.
   - O checkout aceita 11 ou 14 dígitos, mas não valida dígitos verificadores.

8. Landing ainda cita boleto.
   - Decisão comercial: sem boleto.
   - A FAQ da landing precisa remover boleto e manter apenas Pix/cartão.

## 4. Banco de dados

### O que melhorou

- Migrations novas adicionam preço inicial, preço recorrente e `current_period_end`.
- Planos legados são desativados e migrados para `destravai_completo`.
- Cancelamento fora da garantia tem suporte no banco por período pago.

### Problemas atuais

1. `subscriptions` ainda não é criada pelas migrations locais.
   - As migrations alteram `public.subscriptions`, mas não mostram a criação completa da tabela.
   - Isso continua impedindo recriar o banco do zero apenas com o histórico atual.

2. Types Supabase locais estão desatualizados.
   - `src/lib/supabase/database.types.ts` não mostra `first_month_price`, `recurring_price` e `current_period_end` em `subscriptions`.
   - As funções `.mjs` usam essas colunas, então o TypeScript não acusa.
   - Pode significar que as migrations novas ainda não foram aplicadas ao banco vivo ou que os types não foram regenerados.

3. Existem duas tabelas de assinatura nos types.
   - `subscriptions` é a usada pelo app atual.
   - `destravai_subscriptions` ainda aparece nos types e tem campos como `current_period_end`.
   - Decisão operacional: pode ser removida se estiver vazia, sem uso ou duplicada.
   - Próximo passo: consultar uso/dados antes de criar migration de remoção.

4. Geração inicial da biblioteca continua sem trava/idempotência.
   - Múltiplas abas ou sessões podem gerar e salvar duplicado.

5. Criação de grupo continua não transacional.
   - Grupo e membership do owner são criados em etapas separadas.

6. `essence_completed` e versionamento de essência continuam frágeis.
   - O app usa `onboarding_completed` para navegação.
   - A essência pode mudar sem marcar biblioteca como desatualizada.

## 5. Funcionalidades do app

### Melhorias recentes

- Login ganhou proteção contra travamento por lock indefinido.
- Rotas legais existem no app: `/termos` e `/privacidade`.
- Página de sucesso de pagamento trata o caso de usuário anônimo retornando do Asaas.
- Minha Assinatura agora mostra acesso até o fim do período pago quando cancelado fora da garantia.
- Plano único reduziu complexidade de assinatura.

### Problemas que continuam

1. Home ainda não salva na biblioteca.
   - `handleSave` atualiza estado/check-in e mostra toast de biblioteca.
   - Não chama `createLibraryItem`.

2. Biblioteca ainda tem bug de carregar mais.
   - O botão faz `setPage(p => p + 1); loadItems()`.
   - `loadItems()` pode usar o valor antigo de `page`.

3. Geração inicial da Biblioteca continua client-side.
   - Funciona, mas não é idempotente e pode duplicar custo/itens.

4. "Meu roteiro" em Criar ainda deve ser revisado.
   - Na auditoria anterior, a origem podia ser salva como IA mesmo quando o roteiro vinha do usuário.

5. Grupos continuam com risco transacional.
   - Owner pode ficar sem membership se falhar a segunda etapa.
   - Owner pode sair do próprio grupo.

6. Configurações ainda misturam muitas responsabilidades.
   - Conta, avatar, senha, assinatura, admin, notificações e aparência ficam em uma tela densa.

7. Toggle de dicas semanais ainda parece fraco.
   - Precisa persistência real ou remoção.

## 6. Teleprompter e gravação

Sem mudanças críticas observadas nesta nova rodada. A análise anterior permanece:

- O teleprompter é um ponto forte do produto.
- Grava em 9:16 via canvas.
- Tenta MP4 e cai para WebM quando necessário.
- Suporte a salvar em galeria depende do navegador.
- Flash/zoom/codec dependem do dispositivo.

Melhorias ainda recomendadas:

- Mostrar formato final do arquivo.
- Registrar erros de câmera/gravação em backend.
- Testar em iPhone Safari, Android Chrome e desktop Chrome.
- Ajustar copy para não prometer "galeria" como garantia universal.

## 7. UI/UX e design

### O que melhorou

- Oferta única deixa checkout mais simples.
- Assinatura e checkout estão mais diretos.
- O retorno de pagamento está mais claro para checkout anônimo.
- Cancelamento fora da garantia agora tem mensagem de continuidade de acesso.

### O que ainda precisa melhorar

- A landing tem textos com caracteres acentuados que devem ser validados no navegador final. A leitura via terminal mostra mojibake, o que pode ser só interpretação do shell, mas vale verificar.
- A FAQ da landing cita boleto, que não aparece no checkout.
- Links legais da landing continuam como `#`.
- A política de privacidade precisa citar OpenRouter como provedor de IA, além ou no lugar de Gemini conforme configuração real.
- "Período de teste" ainda aparece como label de status `trialing`; como a decisão é garantia legal de 7 dias, trocar esse texto por "Garantia" ou remover o status da UI se não for usado.
- Algumas telas exibem textos sem acento por causa de strings ASCII; isso não quebra, mas reduz polimento.

## 8. Página de vendas

### O que melhorou

- A landing agora apresenta oferta única.
- CTAs principais apontam para `/checkout`.
- Copy de preço inicial e recorrente está mais alinhada ao novo checkout.

### Problemas atuais

1. Links legais ainda não apontam para páginas reais.
   - Footer usa `href="#"` para Termos e Privacidade.
   - Deve apontar para `https://destravai.dbe.digital/termos` e `/privacidade`, ou páginas equivalentes na landing.

2. FAQ cita boleto.
   - Checkout implementado: Pix e cartão.
   - Decisão comercial: remover boleto da copy.

3. Provedor de IA mudou.
   - Se a landing ou legal falarem só em Gemini, atualizar para OpenRouter/Gemini conforme ambiente.

4. Validação visual final ainda é necessária.
   - A landing é estática em `landing-page/`; precisa ser conferida no browser com encoding correto, responsividade e links reais.

## 9. Arquivos, documentos e organização

### Novos documentos úteis

- `CHECKOUT_PLANO_UNICO.md`: explica o fluxo de plano único.
- `OPENROUTER_AGENT.md`: explica o agente CLI OpenRouter.
- `auditoria-codex-plano-unico-openrouter.md`: auditoria específica das alterações recentes.

### Problemas de organização

1. `tmp-login-test.mjs` deve sair do repositório.
   - É temporário, contém credencial e está untracked.

2. `OPENROUTER_AGENT.md` e `src/agent/*` podem confundir.
   - O agente CLI não é o fluxo real de IA do app.
   - O fluxo real está em `supabase/functions/destravai-gemini` e `netlify/functions/destravai-gemini.mjs`.

3. `DESTRAVAI_DATABASE_AI_FLOW.md` continua desatualizado.
   - Ainda fala de Gemini/frontend e funções antigas.
   - Precisa ser arquivado ou reescrito.

4. `CHECKOUT_PLANO_UNICO.md` menciona `server_logs`.
   - O código atual usa `destravai_error_logs` via RPC `destravai_log_error`.
   - Ajustar nome para evitar confusão operacional.

5. Não há `.env.example`.
   - As envs novas de OpenRouter e Asaas deveriam estar documentadas sem valores.

6. `docs/` está no `.gitignore`, mas já havia arquivos rastreados.
   - Decidir se `docs/` é parte do repo ou arquivo local.

## 10. Performance, custos e uso de IA

### O que melhorou

- OpenRouter permite fallback de modelos.
- Supabase Edge Function é caminho principal e evita teto curto da Netlify Function.
- Netlify Function mantém fallback.
- Netlify IA tem rate limit por minuto e limite mensal.
- JSON mode é usado quando o prompt pede JSON.

### Riscos atuais

1. IA continua sem paywall backend.
   - Principal risco de custo.

2. Edge Function Supabase não tem rate limit por minuto.
   - A Netlify Function tem 15/min.
   - A Edge Function tem limite mensal, mas não o mesmo anti-burst.

3. Limite mensal é fixo.
   - `MONTHLY_LIMIT = 1000`.
   - Decisão comercial: 1000 requisições por usuário.
   - O número está alinhado com a decisão; o que falta é validar assinatura/acesso antes de consumir esse limite.

4. Geração da Home pode consumir várias chamadas em um dia.
   - Missão, extra e ritual podem gerar múltiplas chamadas.

5. Biblioteca inicial segue cara e sem idempotência.

6. Dependências possivelmente órfãs.
   - `@anthropic-ai/sdk` e `@google/genai` parecem não ser usados diretamente.
   - `@openrouter/sdk` é usado apenas no agente CLI, não no fluxo do app.

## 11. Logs e monitoramento

### O que existe

- `destravai_error_logs`.
- `destravai_ai_generations`.
- `destravai_execution_events`.
- `asaas_webhook_events`.
- `serverLog()` em funções críticas.

### Lacunas atuais

- Não há painel operacional de pagamentos.
- Não há reprocessamento de webhook documentado.
- Recorrência Asaas não criada após pagamento precisa de alerta.
- Evento pago sem assinatura local precisa de alerta.
- `asaas-checkout-status` e `asaas-subscription-status` ainda dependem muito de console em erros.
- Erros de frontend, câmera e gravação não são enviados ao backend.
- `tmp-login-test.mjs` mostra que testes manuais podem gerar arquivos perigosos; criar padrão seguro de scripts temporários.

## 12. Problemas críticos encontrados

1. Arquivo temporário com credencial hardcoded.
   - Prioridade: crítica.
   - Ação: remover, ignorar padrão temporário e rotacionar senha/chaves relacionadas.

2. Backend de IA não valida assinatura ativa.
   - Prioridade: crítica.
   - Ação: funções de IA devem consultar assinatura/acesso antes de chamar provedor.

3. Paywall depende de flag pública e está comentado localmente.
   - Prioridade: crítica.
   - Ação: validar `VITE_PAYWALL_ENABLED=true` em produção e considerar bloqueio server-side.

4. Migration de `subscriptions` segue incompleta.
   - Prioridade: crítica.
   - Ação: baseline/migration completa para recriar banco.

5. Types Supabase desatualizados para `subscriptions`.
   - Prioridade: alta.
   - Ação: aplicar migrations e rodar `npm run gen:types`.

6. Service worker pode cachear funções Netlify.
   - Prioridade: alta.
   - Ação: bypass explícito para `/.netlify/functions/`.

7. Webhook sem rotina de reprocessamento/alerta.
   - Prioridade: alta.
   - Ação: painel ou script de reprocessamento.

8. Landing legal e boleto inconsistentes.
   - Prioridade: média/alta.
   - Ação: links reais e remover boleto da copy.

9. Política de privacidade desatualizada quanto ao provedor de IA.
   - Prioridade: média/alta.
   - Ação: atualizar OpenRouter/Gemini.

10. Home promete salvar na biblioteca, mas não salva.
   - Prioridade: média/alta.
   - Ação: chamar `createLibraryItem` ou mudar copy.

## 13. Melhorias recomendadas

### Segurança

- Remover `tmp-login-test.mjs`.
- Rotacionar credenciais usadas em testes temporários.
- Criar `.env.example` sem segredos.
- Ligar paywall em produção.
- Adicionar validação de assinatura nas funções de IA.
- Manter admin pelo e-mail definido e proteger a conta; role/claim fica como melhoria futura.
- Restringir CORS da Edge Function.

### Pagamentos

- Webhook já testado e informado como funcionando; documentar o teste e manter monitoramento.
- Criar alerta de evento pago sem assinatura.
- Criar alerta de recorrência não criada.
- Criar reprocessamento manual seguro.
- Corrigir `current_period_end` com base em dados reais do pagamento.
- Rate limit em checkout status.
- CPF/CNPJ com validação real.

### Banco

- Criar migration/baseline completa de `subscriptions`.
- Aplicar migrations 009/010 no banco vivo.
- Regenerar `database.types.ts`.
- Verificar se `destravai_subscriptions` está vazia/sem uso/duplicada; se estiver, remover por migration.
- RPC transacional para criação de grupo.
- Idempotência na geração inicial da biblioteca.

### Produto

- Corrigir salvar na biblioteca na Home.
- Corrigir carregar mais da Biblioteca.
- Atualizar política de privacidade.
- Corrigir links legais da landing.
- Remover boleto da copy.
- Trocar linguagem de trial/período de teste por garantia legal de 7 dias.

### IA

- Rate limit por minuto também na Edge Function.
- Limite já definido em 1000 requisições por usuário; falta validar acesso antes de gerar.
- Dashboard de consumo por usuário.
- Remover dependências/agent CLI se não houver uso.
- Renomear arquivos "gemini" para nome neutro no futuro, se quiser reduzir confusão.

## 14. O que pode ser excluído futuramente

Não excluir sem confirmação, mas os candidatos são:

- `tmp-login-test.mjs`: deve ser removido agora, não futuramente.
- `src/agent/`, `OPENROUTER_AGENT.md`, `agent:headless`, `@openrouter/sdk` e `eventemitter3`, se o agente CLI não tiver uso real.
- `@anthropic-ai/sdk` e `@google/genai`, se confirmado que não são usados.
- `destravai_subscriptions`, se a consulta confirmar que está vazia, sem uso ou duplicada.
- `DESTRAVAI_DATABASE_AI_FLOW.md`, movendo para arquivo histórico ou reescrevendo.
- Auditorias antigas duplicadas, mantendo só histórico intencional.
- Fallbacks estáticos de planos, se o backend for fonte única também para exibição.

## 15. Plano de ação sugerido

### Fazer primeiro

1. Remover `tmp-login-test.mjs` e rotacionar credenciais envolvidas.
2. Garantir `VITE_PAYWALL_ENABLED=true` no Netlify antes de vender.
3. Adicionar validação de assinatura/acesso nas funções de IA.
4. Fazer bypass de `/.netlify/functions/` no service worker.
5. Aplicar migrations novas e regenerar types.
6. Criar baseline/migration completa de `subscriptions`.
7. Atualizar landing para remover boleto e corrigir links legais.

### Fazer depois

1. Criar reprocessamento de webhook.
2. Criar alertas de pagamento sem acesso e acesso sem recorrência.
3. Corrigir Home salvar na biblioteca.
4. Corrigir carregar mais da Biblioteca.
5. Documentar o teste do webhook e checklist de envs de produção.
6. Atualizar Política de Privacidade para OpenRouter/Gemini.
7. Criar `.env.example`.
8. Verificar `destravai_subscriptions` e remover se vazia/sem uso/duplicada.

### Pode esperar

1. Limpeza de dependências.
2. Renomear artefatos "gemini".
3. Arquivar docs antigas.
4. Refinos visuais.
5. Separar Configurações em subtelas.

### Decisões já respondidas

1. O produto é garantia legal de 7 dias, não trial grátis real.
2. Sem boleto.
3. Limite definido: 1000 requisições por usuário.
4. Admin apenas: `assessoriadbe@gmail.com`.
5. `destravai_subscriptions` pode ser removida se estiver vazia, sem uso ou duplicada.
6. Webhook foi testado e informado como funcionando.

### Ainda precisa de decisão humana antes

1. O agente CLI OpenRouter tem uso real ou pode ser removido?
2. Qual será o formato operacional do reprocessamento de webhook?
3. A conta admin terá MFA/política de senha e recuperação definida?

## 16. Tabela final de prioridades

| Prioridade | Item | Área | Status atual |
|---|---|---|---|
| Crítica | Remover arquivo temporário com credencial | Segurança | Novo achado |
| Crítica | Validar assinatura nas funções de IA | Segurança/Custo | Pendente |
| Crítica | Ativar paywall em produção | Receita | Pendente por env |
| Crítica | Criar baseline de `subscriptions` | Banco | Pendente |
| Alta | Regenerar types após migrations | Banco | Pendente |
| Alta | Ignorar Netlify Functions no service worker | PWA/Pagamento | Pendente |
| Alta | Documentar teste do webhook e envs produção | Pagamento | Testado pelo usuário; falta checklist |
| Alta | Reprocessamento/alerta de webhook | Operação | Pendente |
| Média/Alta | Corrigir Home salvar na biblioteca | Produto | Pendente |
| Média/Alta | Atualizar landing legal e remover boleto | Comercial | Decisão tomada; falta ajuste |
| Média/Alta | Atualizar política para OpenRouter | Legal/Privacidade | Pendente |
| Média | Rate limit na Edge Function | IA | Pendente |
| Média | Criar `.env.example` | Operação | Pendente |
| Média | Limpar agente/deps órfãs | Organização | Depende de decisão |
| Baixa | Renomear "gemini" para nome neutro | Manutenção | Opcional |

Esta auditoria atualizou apenas os documentos solicitados. Nenhum arquivo de código, configuração, migration, banco ou deploy foi alterado.
