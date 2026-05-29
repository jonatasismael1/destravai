# Auditoria 2 - Destravai / DBE Pulse

**Data:** 29/05/2026  
**Branch auditada no GitHub:** `origin/master`  
**Commit auditado:** `9e1276eff36bc2081436a65324a5220efa876311`  
**Repositório remoto:** `https://github.com/jonatasismael1/destravai.git`

---

## 0. Atualização de implementação (29/05/2026)

> Esta seção registra o que já foi **resolvido** depois da auditoria original. O restante do documento permanece como o diagnóstico histórico.

### 🟢 RESUMO — Feito vs. Falta

**JÁ FEITO:** IA no servidor (Edge Function) · limite mensal · log de gerações · migrations versionadas · jornada do usuário no Supabase · checkout próprio (Pix/cartão) · webhook libera acesso + e-mail · CORS restrito nas funções Asaas · landing publicada · progresso dentro de Meu Espaço · frase do dia · checkout rolável + upsell por plano · **eventos de execução (teleprompter/gravou/postei/planejou/voltou) + régua de ativação + modo postei** · **admin cria testadores grátis** · **status de assinatura claros (inclui trialing) e cancelamento com estorno automático dentro da garantia** · **webhook reaproveita assinatura pendente** · **biblioteca (busca com escape, confirmação inline, editar título/categoria/tags, mover p/ calendário)** · **calendário (status planejado/gravado/postado + visão mensal)** · **Criar salva tudo na biblioteca** · **teleprompter (metadados, renomear vídeo, modo postei)**.

**AINDA FALTA:** limite **por plano** (hoje 1.000/mês p/ todos) · CORS `*` na Edge `destravai-gemini` · gerar os **types automáticos** do Supabase (hoje manuais) · **suíte de testes** de RLS · ligar o **paywall** em produção · revisar textos de privacidade/legais · rodar o SQL de `destravai_execution_events` no projeto certo · régua D0/D1/D3/D7 como **mensageria/notificação** (hoje é indicador visual) · campanhas semanais, WhatsApp de missão e área agência/multi-cliente (novas oportunidades).

### ✅ Concluído

- **IA fora do frontend.** A geração agora passa pela Edge Function `destravai-gemini` (deployada no Supabase). `src/lib/ai/googleGemini.ts` chama essa função com o JWT do usuário; a chave do Gemini não vai mais no bundle. *(Resolve 6.2 e parte de 8 / 9.)*
- **Limite de uso.** A Edge Function aplica limite mensal de **1000 gerações por usuário**, contando `destravai_ai_generations` no mês corrente, com mensagem amigável ao atingir. *(Resolve a base de 6.4.)*
- **Registro de gerações.** Toda geração (sucesso e erro) é registrada em `destravai_ai_generations`, inclusive o modelo usado. *(Resolve parte de 6.5.)*
- **Migrations versionadas.** Criada a pasta `supabase/migrations/` com: `202605290001_user_journey.sql`, `202605290002_base_schema.sql` e `202605290003_checkout_plans.sql`. *(Resolve a falta de migrations citada em 8.)*
- **Jornada do usuário no Supabase.** Missões, progresso, check-ins diários, calendário, Meu Espaço, diário, humor e ideias pessoais passaram a ser persistidos no banco (migration `user_journey` + serviços). A maior parte do item 3 (dados no aparelho) está superada — sobram apenas preferências locais aceitáveis (tema, dismiss de PWA). *(Resolve o núcleo de 3 e 6.1.)*
- **Checkout próprio (Asaas + Supabase).** Tela `/checkout` pública (vinda da landing), com Pix in-app (QR + copia e cola) e cartão via Asaas. Preço sempre revalidado no servidor a partir da tabela `destravai_plans` (fonte da verdade dos planos). Pagamento confirmado pelo webhook cria/garante a conta no Supabase Auth, libera acesso e envia e-mail nativo para o usuário definir a senha (`/definir-senha`). Modelo "paga primeiro, acesso depois".
- **CORS restrito nas funções Asaas.** `netlify/functions/_shared.mjs` usa a origem do app (`APP_URL`) em vez de `*`. *(Resolve parte de 8 / Netlify.)*
- **Landing alinhada e publicada.** Os CTAs de plano apontam para `/checkout?plan=...` (não mais `href="#"` nem links crus do Asaas). Planos espelham `destravai_plans`. Landing publicada em **https://lpdestravai.netlify.app**. *(Resolve parte de 10.)*
- **Progresso reposicionado.** A antiga página `Progresso` virou um painel dentro de **Meu Espaço** (abas "Meu espaço" / "Meu progresso"), num lugar único e sincronizado. Rota `/progresso` removida.
- **Configurações.** Removido o número de versão; adicionados "Alterar senha", "Gerenciar assinatura" e "Falar com o suporte".
- **Home.** Frase motivacional do dia restaurada (troca automaticamente a cada dia).
- **Biblioteca.** Cada item tem botão de câmera para gravar a ideia direto no teleprompter; busca com escape de caracteres, confirmação inline (sem `confirm()` nativo), edição de título/categoria/tags e botão "mover para o calendário".
- **Métrica de execução.** Tabela `destravai_execution_events` + serviço tolerante; registra abrir teleprompter, iniciar/salvar gravação, **postei / vou postar / só gravei**, planejar no calendário e retorno. Régua de ativação (1/3/7 dias + nº de postados) na Home.
- **Admin / testadores.** O admin (`assessoriadbe@gmail.com`) tem seção em Configurações para criar testadores com **acesso de cortesia** (function `admin-create-tester`: valida o admin, cria conta + assinatura ativa grátis + e-mail de senha). Não usa senha padrão.
- **Assinatura.** Status claros (active, **trialing**, pending, past_due, canceled, refunded, failed). **Cancelamento: dentro da garantia (≤ 7 dias e pago) estorna automaticamente; fora da garantia apenas cancela.** Só marca "reembolsada" se o Asaas confirmar o estorno. Copy "ilimitada" → "ampliada".
- **Checkout/webhook.** Reaproveita a assinatura **pendente** do usuário em vez de criar uma nova linha a cada tentativa.
- **Calendário.** Status planejado → gravado → postado (toque pra alternar; "postado" registra evento) e **visão mensal** com indicadores por dia.
- **Criar.** Toda ideia gerada é **salva automaticamente na biblioteca** (Supabase), com feedback "salvo".
- **Teleprompter.** Registra metadados (formato + duração), permite **renomear o vídeo** antes de salvar e abre o **modo postei**.

### ⏳ Pendências / a confirmar

- **Rodar o SQL de `destravai_execution_events`** no projeto certo (`fddxaozosrlqddthvqhn`). O MCP estava preso no projeto da clínica e não criou a tabela; o código já tolera a ausência. SQL em `supabase/migrations/202605290004_execution_events.sql`. **Sem isso, os eventos/régua/modo postei não gravam.**
- **Limite por plano.** Hoje o limite é único (1.000/mês para todos). Ainda falta diferenciar Starter / Pro / Expert. *(6.4.)*
- **CORS da Edge Function de IA.** `destravai-gemini` ainda responde com `Access-Control-Allow-Origin: *`; restringir ao domínio do app.
- **Types do Supabase automáticos.** Ainda são interfaces manuais (a geração via MCP ficou bloqueada pelo projeto errado). *(8.)*
- **Suíte de testes de RLS.** As policies existem nas migrations, mas não há testes automatizados (o projeto não tem runner de testes). *(8.)*
- **Régua D0/D1/D3/D7 como mensageria.** Hoje é um indicador visual de constância; falta a régua de ativação por notificação/WhatsApp. *(13 / 14.)*
- **Paywall** (`VITE_PAYWALL_ENABLED`) precisa ser ligado em produção quando o fluxo for validado ponta a ponta.
- **Textos legais/privacidade.** Revisar a Política de Privacidade e Termos (linguagem e consentimento) antes de tráfego pago. *(9 / 11.)*
- **Novas oportunidades** (não obrigatórias): campanhas semanais, WhatsApp de missão, área agência/multi-cliente, biblioteca por nicho, score de constância. *(13.)*

> **Já confirmado pelo usuário:** Supabase Auth (Redirect URL `/definir-senha`), webhook do Asaas e o secret do Gemini já estão configurados.

---

## 1. Escopo da auditoria

Analisei a estrutura principal do projeto, incluindo:

- aplicação React/Vite em `src`;
- componentes, páginas, contexto global, serviços e bibliotecas auxiliares;
- integração Supabase, tipos e serviços de banco;
- funções Netlify de assinatura/Asaas;
- PWA, manifest e service worker;
- landing page estática em `landing-page`;
- documentos estratégicos e técnicos locais;
- configuração de build, Tailwind, TypeScript, Netlify e Git.

Não tratei `node_modules` e `dist` como fonte de verdade, porque são dependências e build gerado. Também não reproduzi valores de `.env.local`, por conter segredos.

## 2. Resumo executivo

O produto já tem uma proposta forte: ele não é apenas um gerador de roteiro, mas um sistema diário para tirar o cliente da indecisão e levá-lo até a gravação. O fluxo mais valioso é:

**Essência -> missão do dia -> roteiro -> teleprompter -> vídeo salvo -> constância.**

Esse encaixe é bom para o dia a dia do cliente final, principalmente profissionais que sabem atender, mas travam ao transformar rotina em conteúdo. O app tem clareza de uso mobile, teleprompter funcional, geração de ideias, legenda, biblioteca e calendário. A experiência central está no caminho certo.

O principal ponto cego agora é que o projeto já usa Supabase em partes importantes, mas ainda mantém pedaços relevantes da experiência presos ao aparelho. No GitHub principal (`origin/master`), ainda existe `localStorage` para progresso, calendário, missão/check-in do dia e perfil local legado. Isso significa que parte do histórico não acompanha a conta do usuário em outro celular.

Minha nota geral atual:

**Produto/UX:** 8/10  
**Prontidão para cliente pagante:** 6,5/10  
**Arquitetura de dados:** 6/10  
**Potencial comercial:** 8,5/10

## 3. Confirmação sobre dados ficarem no aparelho

Sim. No projeto principal do GitHub ainda existe dado importante ficando no aparelho.

### O que ainda está no aparelho

| Área | Arquivo | Situação | Risco |
|---|---|---|---|
| Progresso | `src/context/AppContext.tsx` | `destravai-progress` em `localStorage` | Usuário troca de celular e perde streak, missões concluídas e nível |
| Semana atual | `src/context/AppContext.tsx` | `destravai-week` em `localStorage` | Métrica semanal muda por aparelho |
| Perfil local legado | `src/context/AppContext.tsx` | `destravai-local-profile` em `localStorage` | Compatibilidade com IA antiga, mas pode divergir do Supabase |
| Missão/check-in do dia | `src/pages/Home.tsx` | `destravai-checkin-{data}` em `localStorage` | Missão diária não sincroniza entre aparelhos |
| Trava de geração diária | `src/pages/Home.tsx` | `destravai-daily-{data}` em `localStorage` | Controle de missão é por aparelho, não por usuário |
| Calendário | `src/pages/Calendario.tsx` | `destravai-calendar` em `localStorage` | Planejamento semanal some ao trocar dispositivo |
| Tema | `src/context/ThemeContext.tsx` | `localStorage` | Aceitável, é preferência local |
| Prompt de instalar PWA | `src/components/InstallPrompt.tsx` | `localStorage` | Aceitável, é preferência local |

### O que já está no Supabase

Estas partes já caminham corretamente para conta/servidor:

- `destravai_profiles`;
- `destravai_brand_essence`;
- `destravai_library_items`;
- `destravai_ai_conversations`;
- `destravai_ai_messages`;
- `destravai_ai_generations`;
- autenticação via Supabase Auth;
- assinatura via funções Netlify consultando tabelas `subscriptions` e `asaas_webhook_events`.

### Conclusão desse ponto

O app não está mais 100% local, mas ainda não está 100% baseado em conta. Para o cliente final, isso cria uma experiência híbrida:

- a essência e biblioteca tendem a acompanhar a conta;
- progresso, calendário e missão do dia ainda ficam no aparelho;
- Meu Espaço, pelo estado atual do `AppContext`, parece ainda mais frágil: fica em memória durante a sessão e não tem persistência clara no Supabase.

**Recomendação:** migrar para Supabase tudo que representa jornada do usuário:

- missões;
- progresso;
- check-ins diários;
- calendário;
- diário/humor/ideias pessoais;
- histórico de execuções e vídeos gerados, mesmo que o arquivo de vídeo não seja salvo ainda.

Tema, PWA dismiss e pequenos ajustes visuais podem continuar locais.

## 4. Como o produto se encaixa no dia a dia do cliente final

O melhor caso de uso é o profissional que abre o app entre atendimentos, antes de começar o expediente ou no fim do dia e quer responder uma pergunta simples: **"o que eu posto agora?"**

O app funciona melhor quando ele vira rotina curta:

1. Cliente abre a tela Hoje.
2. Escolhe contexto: tenho 2 minutos, quero vender, estou no trabalho, quero educar.
3. Recebe uma missão simples.
4. Grava no teleprompter sem decorar.
5. Salva o vídeo e posta no Instagram.
6. Marca como feito e vê progresso.

Esse fluxo conversa muito bem com profissionais de saúde, beleza, estética, terapia, advocacia, fitness, fotografia, arquitetura, consultoria e pequenos negócios locais. O valor real não é "ter uma ideia bonita"; é reduzir a fricção entre intenção e publicação.

O ponto mais importante: seu cliente não quer uma biblioteca infinita. Ele quer uma decisão tomada por ele. A tela Hoje é, portanto, a tela mais importante do produto.

## 5. O que deixar

### Deixar a tela Hoje como centro do produto

É a parte com maior aderência ao hábito diário. Missão diária, check-in e geração rápida resolvem uma dor real. A Home deve continuar sendo a primeira tela depois do login.

### Deixar o teleprompter

O Studio/teleprompter é um diferencial forte. Poucos produtos levam o usuário da ideia até a gravação dentro do mesmo fluxo. Depois da correção de vídeo vertical, ele virou peça central da proposta.

### Deixar a Essência

A Essência é o motor de personalização. Sem ela, o app vira um ChatGPT com botões bonitos. Com ela, o app tem memória, tom, nicho, limites e contexto.

### Deixar a Biblioteca

A biblioteca faz sentido como repositório de ideias reutilizáveis. O usuário pode salvar, copiar, editar, favoritar e buscar. Ela deve ser mais "arquivo útil" do que feed infinito.

### Deixar o Calendário

Calendário semanal é útil, principalmente para cliente que quer constância. Mas precisa sair do localStorage para virar parte real da conta.

### Deixar o Meu Espaço, mas reposicionar

Meu Espaço é uma boa ideia porque humaniza a IA. Diário, humor e ideias pessoais podem gerar conteúdo com mais identidade. Mas hoje ele parece secundário e tecnicamente frágil. Deve ser mantido, desde que seus dados sejam persistidos e que sua função fique clara: alimentar autenticidade.

### Deixar PWA

O produto é mobile-first e deve ser usado como app. Manifest, service worker e install prompt fazem sentido. O PWA deve ser tratado como canal principal até haver app nativo.

## 6. O que melhorar com prioridade alta

### 6.1 Persistência por conta

Este é o principal ajuste estrutural.

Migrar para Supabase:

- `missions`;
- `progress`;
- `calendar`;
- `daily_checkins`;
- `personal_space_context`;
- `journal_entries`;
- `personal_ideas`;
- `mood_logs`.

Benefício direto:

- troca de celular sem perder jornada;
- suporte consegue entender o que aconteceu;
- métricas reais de uso;
- paywall e limites por usuário;
- base para notificações e reativação.

### 6.2 Remover a dependência de IA no frontend

O projeto ainda tem chamadas diretas usando `VITE_GEMINI_API_KEY` em `src/lib/ai/googleGemini.ts` e bridge legada em `src/services/aiService.ts`. O modelo está correto como `gemini-flash-latest`, mas a chave no frontend continua sendo risco.

O documento técnico já reconhece isso como temporário. Para produção, mover tudo para Edge Function ou Netlify Function:

- gerar conteúdo;
- gerar biblioteca;
- gerar resumo de essência;
- gerar legenda;
- gerar CTAs;
- gerar sugestões do Meu Espaço;
- missão diária.

### 6.3 Unificar banco de assinatura

Há uma diferença de nomenclatura importante:

- docs falam em `destravai_subscriptions`;
- funções Netlify usam `subscriptions`;
- webhook usa `asaas_webhook_events`.

Isso pode estar correto se o banco real foi criado assim, mas precisa estar documentado como fonte da verdade. Se houver tabelas duplicadas, padronizar. Se não houver, atualizar docs para não confundir manutenção futura.

### 6.4 Resolver limites de uso

Existe tipo/documentação para `destravai_usage_limits`, mas o fluxo de IA ainda não usa limite real por plano. Isso é essencial antes de abrir para público.

Sugestão:

- Starter: limite diário/ mensal mais baixo;
- Pro: limite confortável;
- Expert: limite alto, mas não infinito sem proteção;
- registrar cada geração no banco;
- bloquear por usuário, não por aparelho;
- fallback amigável quando o limite for atingido.

### 6.5 Criar tabela de eventos de execução

Hoje o produto sabe gerar ideias, mas precisa saber se o cliente executou.

Criar eventos:

- abriu missão;
- copiou roteiro;
- abriu teleprompter;
- iniciou gravação;
- salvou vídeo;
- marcou missão como feita;
- planejou no calendário;
- voltou no dia seguinte.

Isso vira métrica de produto e prova de valor.

## 7. O que melhorar em UX e fluxo

### Home

Manter como foco. Melhorias:

- mostrar claramente a missão atual e uma ação principal;
- evitar excesso de cards concorrendo pela atenção;
- se a missão falhar por IA, oferecer missão fallback sem quebrar o dia;
- salvar a missão no Supabase assim que gerada;
- permitir "já postei" com registro simples.

### Criar

Boa tela para uso sob demanda. Melhorias:

- salvar toda geração diretamente na biblioteca do Supabase, não apenas estado local;
- deixar mais claro quando a ideia foi salva;
- separar "gerar roteiro" de "gerar variação" com limites e feedback;
- evitar erro técnico na tela final.

### Teleprompter

Está como diferencial. Melhorias futuras:

- salvar metadados da gravação: formato, duração, codec, câmera usada;
- permitir renomear vídeo antes de salvar;
- guardar no histórico que aquele roteiro foi gravado;
- se possível, oferecer checklist pós-gravação: salvar, copiar legenda, marcar como feito.

### Biblioteca

Boa base. Melhorias:

- busca precisa escapar caracteres especiais antes do `.or(...)` no Supabase;
- botões de excluir devem trocar `confirm()` nativo por modal do design system;
- editar título, categoria e tags, não só conteúdo;
- permitir mover item para calendário diretamente.

### Calendário

Boa ideia, mas hoje é uma das áreas mais presas ao aparelho. Melhorias:

- persistir no Supabase;
- usar itens reais da biblioteca, não só `state.ideas`;
- permitir criar ideia diretamente no dia;
- marcar status: planejado, gravado, postado;
- visão mensal simples depois da visão semanal.

### Meu Espaço

É uma oportunidade grande, mas precisa de clareza. Melhorias:

- persistir diário, humor e ideias no Supabase;
- mostrar como isso influencia a IA;
- permitir transformar uma entrada de diário em roteiro;
- criar "histórias pessoais que viram conteúdo";
- deixar o setup opcional, mas com benefício claro.

### Configurações

Há textos desatualizados:

- fala em chave Anthropic, mas o app usa Gemini;
- fala "seus dados ficam no dispositivo", mas o app já usa Supabase;
- plano gratuito/demo pode conflitar com assinatura real.

Revisar textos para não gerar desconfiança.

### Assinatura

A integração com Asaas está bem encaminhada. Melhorias:

- confirmar se paywall está ativo em produção;
- alinhar plano exibido com estado real da assinatura;
- evitar "gerações ilimitadas" se ainda não existe controle de custo;
- diferenciar trial, pendente, ativo, cancelado e reembolsado com mensagens claras.

## 8. Integrações e banco de dados

### Supabase

Pontos bons:

- Supabase Auth está integrado;
- profile e essência estão no banco;
- biblioteca usa tabela `destravai_library_items`;
- serviços estão separados por responsabilidade;
- há preocupação explícita com RLS nos documentos;
- não encontrei service role no frontend.

Pontos de atenção:

- não há migrations SQL no repositório principal;
- não há tipos gerados automaticamente do banco, apenas interfaces manuais;
- dependência de RLS é alta, mas não há validação local das policies;
- update/delete em biblioteca usam `id` e confiam no RLS, sem filtro adicional por `user_id`;
- conversas/mensagens dependem de RLS para isolamento;
- busca da biblioteca com `.or()` pode quebrar ou se comportar mal com caracteres especiais.

Recomendação:

- adicionar pasta `supabase/migrations`;
- versionar schema real;
- gerar types do Supabase;
- criar testes simples de RLS;
- documentar quais tabelas oficiais existem: com ou sem prefixo `destravai_`.

### Netlify Functions / Asaas

Pontos bons:

- service role fica em serverless;
- webhook valida token;
- webhook tenta idempotência com `asaas_webhook_events`;
- cancelamento e reembolso dentro da garantia estão previstos;
- frontend envia JWT para funções autenticadas.

Pontos de atenção:

- CORS está com `Access-Control-Allow-Origin: *`; para produção, restringir ao domínio;
- criar assinatura sempre insere nova linha, podendo acumular múltiplas pendentes;
- cancelamento bloqueia acesso imediatamente fora da garantia, decisão que precisa ser validada comercialmente;
- webhook responde `200` mesmo em erro interno não crítico. Isso evita reenvio infinito, mas exige painel/manual de reprocessamento;
- docs ainda citam Stripe em alguns pontos, enquanto implementação usa Asaas.

### IA Gemini

Pontos bons:

- modelo configurado como `gemini-flash-latest`;
- prompts são detalhados e orientados a JSON;
- há parser de JSON resiliente;
- há fallback em algumas funções.

Pontos de atenção:

- chave no frontend ainda é risco;
- geração de biblioteca inicial ainda acontece no cliente;
- missão diária depende de `localStorage` para não repetir;
- logs de geração existem como conceito, mas não cobrem as chamadas legadas de `src/lib/ai.ts`;
- faltam limites por plano e por usuário;
- mensagens de erro para quota já melhoraram, mas a arquitetura ainda precisa evitar abuso.

## 9. Segurança, privacidade e confiança

Pontos críticos:

- não expor chave de IA no bundle;
- revisar textos que dizem que dados ficam só no dispositivo;
- garantir RLS em todas as tabelas com `user_id`;
- confirmar que tabelas de assinatura não podem ser lidas por outro usuário;
- evitar decisões de autorização baseadas em dados editáveis pelo usuário;
- registrar consentimento de política/termos se o produto for cobrado.

Ponto de confiança para o cliente final:

O app coleta informações pessoais, rotina, diário e contexto emocional. Mesmo que não sejam dados financeiros, são sensíveis para percepção do usuário. A comunicação precisa ser clara: o que é usado para personalizar, onde fica salvo e como apagar.

## 10. Landing page e comunicação

A landing comunica bem a tese:

- presença no Instagram sem travar;
- rotina vira conteúdo;
- app não para na ideia;
- teleprompter e missão diária são diferenciais.

Pontos de atenção:

- CTAs dos planos usam `href="#"`, então não fecham o fluxo para cadastro/pagamento;
- preços da landing podem divergir dos planos do app e das funções Netlify;
- há textos com encoding quebrado em vários arquivos, o que pode aparecer dependendo do build/servidor;
- prova social parece placeholder e deve ser tratada como fictícia até haver depoimentos reais.

Recomendação:

- alinhar preço único entre landing, `src/lib/plans.ts` e `netlify/functions/_shared.mjs`;
- ligar CTAs para `/login` ou `/assinatura`;
- revisar encoding UTF-8;
- trocar depoimentos por reais antes de tráfego pago.

## 11. O que apagar ou reduzir

### Apagar ou arquivar depois de confirmar

- documentos antigos que contradizem a arquitetura atual;
- referências antigas a Anthropic;
- referências a Stripe se Asaas for o caminho oficial;
- textos dizendo "sem servidor" ou "dados ficam no dispositivo";
- qualquer arquivo gerado que não precisa estar no Git.

### Não apagar agora

- `docs/`: apesar de estar no `.gitignore`, tem contexto útil;
- `Progresso`: a tela ainda é valiosa, só está subaproveitada;
- `Meu Espaço`: precisa persistência, não remoção;
- teleprompter: manter.

## 12. Pontos cegos atuais

1. **Troca de aparelho:** parte da jornada some.
2. **Métrica real de sucesso:** ainda não há tracking confiável de conteúdo executado.
3. **Limite de custo de IA:** sem uso por plano, um usuário pode gerar custo alto.
4. **Divergência de fonte da verdade:** local state, localStorage e Supabase convivem.
5. **Confiança:** textos de privacidade não refletem exatamente a arquitetura atual.
6. **Banco não versionado:** sem migrations no repo, manutenção futura fica arriscada.
7. **Assinatura:** implementação usa Asaas, mas docs ainda misturam planos futuros/Stripe.
8. **Calendário:** parece feature central, mas é local.
9. **Meu Espaço:** pode ser o diferencial de autenticidade, mas hoje perde dados ao recarregar/sair.
10. **PWA:** se o usuário reinstalar, dados locais desaparecem.

## 13. Oportunidades novas

### 13.1 Modo "postei"

Depois de salvar vídeo, perguntar:

- postei agora;
- vou postar depois;
- só gravei.

Isso cria métrica de execução.

### 13.2 WhatsApp de missão diária

Para o público brasileiro, WhatsApp pode ser mais forte que push:

"Sua missão de hoje está pronta: grave 1 story de 30s sobre X."

### 13.3 Campanhas semanais

Além da missão do dia:

- semana de autoridade;
- semana de venda leve;
- semana de bastidores;
- semana de reativação de clientes.

### 13.4 Transformar diário em conteúdo

No Meu Espaço:

"Transformar essa história em story/reels."

Isso conecta vida real à autoridade e cria um diferencial mais difícil de copiar.

### 13.5 Área agência/multi-cliente

Muito forte para DBE:

- agência cria essência de cada cliente;
- gera calendário semanal;
- cliente grava com teleprompter;
- agência acompanha execução.

### 13.6 Biblioteca por nicho

Criar presets:

- estética;
- psicologia;
- nutrição;
- advocacia;
- fotografia;
- arquitetura;
- personal trainer;
- clínicas locais.

Mas o preset deve alimentar a essência, não substituir personalização.

### 13.7 Score de constância

Uma métrica simples:

- dias ativos;
- conteúdos gravados;
- equilíbrio entre autoridade, bastidor, venda e conexão;
- próximo melhor conteúdo.

## 14. Plano recomendado

### Próximos 7 dias

1. Migrar calendário para Supabase.
2. Migrar progresso e missões para Supabase.
3. Persistir Meu Espaço no banco.
4. Corrigir textos desatualizados de Configurações.
5. Alinhar preços entre app, landing e funções.

### Próximos 15 dias

1. Mover chamadas Gemini para backend/Edge Functions.
2. Implementar `usage_limits`. (até 1000 requisições por mês)
3. Registrar eventos de execução.
4. Criar migrations reais do Supabase.
5. Revisar RLS e gerar types do banco.

### Próximos 30 dias

1. Fechar paywall real com Asaas.
2. Criar régua de ativação: D0, D1, D3, D7.
3. Implementar notificações ou WhatsApp de missão.
4. Ajustar landing para cadastro/pagamento real.
5. Preparar piloto com 10 a 30 clientes.

## 15. Veredito

O Destravai está muito perto de ser um produto vendável porque já resolve a parte mais difícil da experiência: transformar ideia em ação gravável no celular. O teleprompter, a missão diária e a essência formam uma combinação forte.

O que ainda separa o app de um SaaS confiável não é visual nem roteiro. É infraestrutura de produto:

- dados importantes precisam sair do aparelho;
- IA precisa sair do frontend;
- limites por plano precisam existir;
- banco precisa estar versionado;
- assinatura, textos e fonte da verdade precisam estar alinhados.

Minha recomendação central é: **não adicionar muitas features agora**. O melhor próximo passo é consolidar dados por conta e medir execução. Se o cliente troca de celular e continua a jornada exatamente de onde parou, o produto passa de "app bonito que ajuda" para "sistema de presença digital".
