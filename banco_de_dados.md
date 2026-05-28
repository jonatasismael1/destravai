# Implementação completa do banco, IA e fluxo do Destravaí

Você será responsável por implementar a arquitetura completa de dados, autenticação, persistência, geração com IA e fluxo de biblioteca personalizada do sistema **Destravaí**.

O Destravaí é um SaaS/plataforma de criação de conteúdo para profissionais que têm dificuldade de criar stories, roteiros curtos, ideias de conteúdo e manter constância. O sistema deve usar as respostas do usuário na área **Minha Essência** para gerar uma biblioteca personalizada de conteúdos, ideias e sugestões.

Hoje algumas informações estão sendo salvas em `localStorage`, mas isso precisa ser substituído por uma estrutura real em banco de dados, preparada para múltiplos usuários.

## Objetivo principal

Implementar no sistema uma arquitetura completa usando **Supabase/PostgreSQL** para salvar:

* usuários;
* perfil profissional;
* respostas da área Minha Essência;
* resumo estratégico gerado pela IA;
* biblioteca personalizada;
* ideias de stories;
* roteiros;
* legendas;
* conversas com IA;
* histórico de gerações;
* status de onboarding;
* uso de créditos/limites;
* dados necessários para a IA gerar conteúdos de forma contextualizada.

Nada importante deve ficar salvo apenas em `localStorage`.

O `localStorage` só pode ser usado para preferências visuais temporárias, como tema, menu aberto, rascunho temporário ou estado de interface. Dados essenciais devem ser salvos no Supabase.

---

# Chaves e variáveis de ambiente

Use variáveis de ambiente. Nunca exponha chaves no código, no frontend ou em commits.

Crie ou atualize o `.env.local` com:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
# ou, se o projeto estiver usando Gemini:
GOOGLE_GENERATIVE_AI_API_KEY=

APP_URL=
```

Regras:

* `VITE_SUPABASE_URL` pode ser usada no frontend.
* `VITE_SUPABASE_ANON_KEY` pode ser usada no frontend com Row Level Security ativado.
* `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para o frontend.
* Chaves de IA nunca devem ir para o frontend.
* Chamadas para IA devem acontecer em backend/Edge Function/API route.
* Verifique se `.env.local` está no `.gitignore`.
* Verifique se nenhuma chave sensível foi exposta no repositório.

---

# Stack esperada

Usar:

* Supabase PostgreSQL como banco principal;
* Supabase Auth para autenticação;
* Row Level Security em todas as tabelas sensíveis;
* Supabase Storage apenas se houver arquivos no futuro;
* Edge Functions/API routes para chamadas de IA;
* PostgreSQL `jsonb` para respostas flexíveis da área Minha Essência;
* estrutura preparada para `pgvector` no futuro, mas sem tornar obrigatório agora.

---

# Conceito do fluxo do Destravaí

O usuário cria uma conta e entra no sistema.

Ao acessar o app pela primeira vez, ele deve ser direcionado para preencher a área **Minha Essência**.

A área **Minha Essência** é um formulário estratégico que coleta informações como:

* profissão;
* nicho;
* público-alvo;
* tom de voz;
* rotina de gravação;
* nível de exposição;
* assuntos que gosta de abordar;
* assuntos que evita;
* diferenciais;
* serviços/produtos;
* dúvidas frequentes dos clientes/pacientes;
* objeções comuns;
* estilo de comunicação;
* referências;
* frases/bordões;
* objetivos com conteúdo;
* frequência desejada;
* formatos preferidos;
* restrições éticas, profissionais ou comerciais.

Depois que o usuário envia o formulário:

1. As respostas são salvas no banco.
2. A IA recebe essas respostas.
3. A IA organiza as informações.
4. A IA gera um resumo estratégico da essência do usuário.
5. A IA gera uma biblioteca inicial personalizada.
6. Essa biblioteca é salva no banco.
7. A biblioteca passa a ser liberada para uso.

Se o usuário ainda não preencheu a área **Minha Essência**, a Biblioteca deve aparecer bloqueada ou vazia, com uma chamada clara para preencher primeiro.

A Biblioteca só deve funcionar de verdade depois que existir uma `brand_essence` salva para o usuário.

---

# Fluxo obrigatório da Biblioteca

A Biblioteca deve seguir esta lógica:

```txt
Se o usuário não tem brand_essence:
    mostrar tela de bloqueio/empty state
    explicar que é necessário preencher Minha Essência
    botão: "Preencher Minha Essência"

Se o usuário tem brand_essence, mas não tem library_items:
    chamar backend/API/Edge Function
    gerar biblioteca inicial com IA
    salvar itens no banco
    carregar biblioteca

Se o usuário tem brand_essence e já tem library_items:
    apenas carregar itens do banco
    não gerar tudo novamente

Se o usuário atualizar Minha Essência:
    salvar nova versão
    perguntar se deseja atualizar/regenerar biblioteca
    não apagar conteúdos antigos sem confirmação
```

Não gere a biblioteca inteira toda vez que a tela abrir.

Isso evita custo desnecessário de IA e impede que o sistema bagunce os conteúdos já salvos pelo usuário.

---

# Tabelas necessárias

Criar migrations SQL no Supabase para as tabelas abaixo.

Use UUID como padrão.

Ative `created_at` e `updated_at`.

Ative Row Level Security em todas as tabelas.

## 1. profiles

Tabela para dados principais do usuário.

Campos sugeridos:

```sql
id uuid primary key references auth.users(id) on delete cascade,
name text,
email text,
profession text,
avatar_url text,
plan text default 'free',
onboarding_completed boolean default false,
essence_completed boolean default false,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Regras:

* Criar profile automaticamente quando um usuário novo for criado, se isso ainda não existir.
* Cada usuário só pode ler e alterar o próprio profile.
* Admin futuramente poderá ter acesso separado, mas não implementar sem necessidade agora.

---

## 2. brand_essence

Tabela principal da área Minha Essência.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) on delete cascade not null,
profession text,
niche text,
audience text,
tone_of_voice text,
content_goals text,
routine text,
preferred_formats text[],
topics text[],
restrictions text[],
differentials text,
services text[],
frequent_questions text[],
common_objections text[],
phrases text[],
references_text text,
raw_answers_json jsonb,
ai_summary text,
ai_positioning text,
version integer default 1,
is_active boolean default true,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Regras:

* Cada usuário pode ter uma essência ativa.
* Pode ser interessante manter versões antigas no futuro.
* Por enquanto, ao atualizar a essência, manter o mesmo registro e incrementar `version`, ou criar uma nova versão se for mais organizado.
* `raw_answers_json` deve guardar todas as respostas completas do formulário.
* `ai_summary` deve guardar o resumo interpretado pela IA.
* `ai_positioning` pode guardar uma versão organizada para ser usada como contexto em prompts futuros.

---

## 3. library_items

Tabela da biblioteca personalizada.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) on delete cascade not null,
essence_id uuid references brand_essence(id) on delete set null,
type text not null,
title text not null,
content text not null,
category text,
format text,
status text default 'saved',
source text default 'ai',
tags text[],
metadata jsonb,
is_favorite boolean default false,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Tipos possíveis:

```txt
story_sequence
reels_script
caption
hook
cta
content_idea
objection_answer
routine_prompt
daily_prompt
carousel_idea
static_post_idea
```

Regras:

* Cada item pertence a um usuário.
* Cada usuário só acessa seus próprios itens.
* A biblioteca deve ter filtros por tipo, categoria, formato, favoritos e busca textual.
* Os conteúdos gerados pela IA devem ser salvos aqui.
* O usuário deve poder editar, favoritar, excluir ou duplicar itens.

---

## 4. ai_conversations

Tabela para conversas com IA.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) on delete cascade not null,
title text,
context_type text,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Contextos possíveis:

```txt
essence_interview
library_assistant
story_generator
reels_generator
caption_generator
content_planner
```

---

## 5. ai_messages

Tabela para mensagens das conversas.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
conversation_id uuid references ai_conversations(id) on delete cascade not null,
user_id uuid references auth.users(id) on delete cascade not null,
role text not null,
content text not null,
metadata jsonb,
created_at timestamptz default now()
```

Regras:

* `role` deve aceitar `user`, `assistant` e `system`.
* Mensagens devem ser salvas para histórico.
* Cada usuário só pode acessar mensagens das próprias conversas.

---

## 6. ai_generations

Tabela para histórico técnico das gerações.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) on delete cascade not null,
prompt_type text not null,
input_data jsonb,
output_data jsonb,
model text,
tokens_used integer,
status text default 'success',
error_message text,
created_at timestamptz default now()
```

Usar para registrar:

* geração da biblioteca inicial;
* geração de roteiro;
* geração de sequência de stories;
* geração de legenda;
* atualização da essência;
* erro de IA;
* consumo estimado.

---

## 7. usage_limits

Tabela para controle de uso.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) on delete cascade not null,
period_start date not null,
period_end date not null,
ai_generations_count integer default 0,
library_generations_count integer default 0,
scripts_count integer default 0,
stories_count integer default 0,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Regras:

* Preparar sistema para limitar uso por plano.
* Mesmo que não implemente cobrança agora, deixar estrutura pronta.
* Antes de gerar com IA, verificar se o usuário ainda pode gerar.
* Se ainda não houver limitação de plano ativa, deixar os limites configuráveis.

---

## 8. subscriptions

Tabela para planos futuros.

Campos sugeridos:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) on delete cascade not null,
plan text default 'free',
status text default 'active',
trial_ends_at timestamptz,
current_period_start timestamptz,
current_period_end timestamptz,
provider text,
provider_customer_id text,
provider_subscription_id text,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Não precisa implementar Stripe agora, se ainda não estiver no projeto. Mas deixe a tabela preparada.

---

# Segurança

Implementar RLS em todas as tabelas.

Cada tabela com `user_id` deve ter políticas como:

* usuário autenticado pode selecionar apenas linhas onde `user_id = auth.uid()`;
* usuário autenticado pode inserir apenas linhas onde `user_id = auth.uid()`;
* usuário autenticado pode atualizar apenas linhas onde `user_id = auth.uid()`;
* usuário autenticado pode deletar apenas linhas onde `user_id = auth.uid()`.

Para `profiles`, a regra deve usar `id = auth.uid()`.

Nunca usar `service_role` no frontend.

---

# Backend/API para IA

Criar uma camada segura para chamadas de IA.

Pode ser:

* Supabase Edge Function;
* API route do framework atual;
* serverless function no Netlify/Vercel.

A chamada para IA deve receber:

* ID do usuário autenticado;
* tipo de geração;
* dados necessários;
* contexto da essência;
* histórico, quando necessário.

A API deve buscar no banco a `brand_essence` do usuário antes de gerar materiais, em vez de confiar só no frontend.

## Endpoint/função 1: salvar essência e gerar resumo

Criar função/API:

```txt
saveEssenceAndGenerateSummary
```

Fluxo:

1. Receber respostas do formulário.
2. Validar usuário autenticado.
3. Salvar respostas em `brand_essence`.
4. Enviar respostas para IA.
5. Gerar:

   * resumo estratégico;
   * tom de voz organizado;
   * pilares de conteúdo;
   * assuntos recomendados;
   * restrições;
   * direcionamento de comunicação.
6. Salvar resultado em `ai_summary` e `ai_positioning`.
7. Atualizar `profiles.essence_completed = true`.
8. Retornar sucesso.

---

## Endpoint/função 2: gerar biblioteca inicial

Criar função/API:

```txt
generateInitialLibrary
```

Fluxo:

1. Validar usuário autenticado.
2. Buscar `brand_essence` ativa do usuário.
3. Se não existir, retornar erro amigável: precisa preencher Minha Essência.
4. Verificar se já existem `library_items`.
5. Se já existirem, não gerar novamente automaticamente.
6. Se não existirem, chamar IA para gerar biblioteca inicial.
7. Salvar cada item em `library_items`.
8. Registrar geração em `ai_generations`.
9. Retornar os itens criados.

A biblioteca inicial deve gerar, no mínimo:

* 10 ideias de stories;
* 10 ideias de reels curtos;
* 10 ganchos;
* 10 CTAs;
* 5 sequências de stories;
* 5 ideias de carrossel;
* 5 ideias de post estático;
* 10 respostas para objeções/dúvidas comuns;
* 7 prompts de rotina para a pessoa gravar no dia a dia.

Cada item deve ser salvo individualmente em `library_items`, com `type`, `title`, `content`, `category`, `format`, `tags` e `metadata`.

---

## Endpoint/função 3: gerar conteúdo sob demanda

Criar função/API:

```txt
generateContent
```

Tipos possíveis:

```txt
story_sequence
reels_script
caption
carousel_idea
static_post
hook
cta
daily_prompt
```

Fluxo:

1. Validar usuário.
2. Buscar essência ativa.
3. Buscar dados relevantes da biblioteca, se necessário.
4. Montar prompt com contexto da essência.
5. Gerar conteúdo com IA.
6. Salvar resultado em `library_items`, se o usuário pedir para salvar ou se o fluxo já for de geração salva.
7. Registrar em `ai_generations`.
8. Retornar o conteúdo.

---

## Endpoint/função 4: conversa com IA

Criar função/API:

```txt
chatWithAI
```

Fluxo:

1. Validar usuário.
2. Criar ou recuperar `ai_conversation`.
3. Salvar mensagem do usuário em `ai_messages`.
4. Buscar essência ativa do usuário.
5. Enviar mensagem para IA com contexto.
6. Salvar resposta da IA em `ai_messages`.
7. Registrar geração em `ai_generations`.
8. Retornar resposta.

---

# Prompts internos da IA

Criar prompts organizados em arquivos separados, sem hardcode espalhado.

Sugestão de estrutura:

```txt
/src/lib/ai/prompts/essenceSummary.ts
/src/lib/ai/prompts/initialLibrary.ts
/src/lib/ai/prompts/contentGeneration.ts
/src/lib/ai/prompts/chatAssistant.ts
```

A IA deve respeitar o posicionamento do Destravaí:

* linguagem clara;
* conteúdos diretos;
* nada genérico;
* evitar clichês;
* evitar tom de autoajuda rasa;
* evitar textos muito longos;
* gerar ideias práticas;
* adaptar ao nicho do usuário;
* respeitar restrições profissionais;
* gerar conteúdos que caibam na rotina.

Para profissionais da saúde, evitar promessas absolutas, diagnósticos diretos, sensacionalismo ou linguagem antiética.

---

# Comportamento da área Minha Essência

Implementar/ajustar tela **Minha Essência** para:

* carregar respostas existentes do banco;
* permitir editar;
* salvar no banco;
* mostrar status de preenchimento;
* gerar ou atualizar resumo com IA;
* informar quando a biblioteca precisa ser atualizada;
* evitar perda de dados.

Estados esperados:

```txt
Não preenchida:
    mostrar formulário inicial.

Preenchida:
    mostrar resumo da essência + botão editar.

Editada:
    salvar alterações + perguntar se deseja atualizar biblioteca.

Erro:
    mostrar mensagem clara, sem apagar formulário.
```

---

# Comportamento da Biblioteca

Implementar/ajustar tela **Biblioteca** para:

* verificar se o usuário tem `brand_essence`;
* se não tiver, bloquear acesso útil e mandar para Minha Essência;
* se tiver essência e não tiver itens, gerar biblioteca inicial;
* se tiver itens, carregar do banco;
* permitir busca;
* permitir filtro por tipo;
* permitir filtro por formato;
* permitir favoritar;
* permitir editar item;
* permitir excluir item;
* permitir copiar conteúdo;
* permitir gerar novo conteúdo.

Empty state sugerido:

```txt
Sua biblioteca ainda não foi destravada.

Para receber ideias personalizadas, primeiro precisamos entender sua essência: seu tom, sua rotina, seus assuntos, seu público e o que faz sentido para você postar.

Botão: Preencher Minha Essência
```

Loading state:

```txt
Estamos organizando sua biblioteca personalizada com base na sua essência.
Isso só precisa acontecer uma vez.
```

---

# Regras importantes de produto

1. A biblioteca não deve depender de localStorage.
2. A essência não deve depender de localStorage.
3. Conversas com IA não devem depender de localStorage.
4. Conteúdos gerados devem ser salvos no banco.
5. Cada usuário só pode acessar seus próprios dados.
6. A IA não é banco de dados.
7. A IA processa; o Supabase salva.
8. Não gerar biblioteca repetidamente.
9. Não apagar biblioteca antiga sem confirmação.
10. Preparar sistema para múltiplos usuários desde o início.
11. O sistema deve funcionar bem para pelo menos 1.000 usuários iniciais.
12. Criar código organizado, escalável e fácil de manter.

---

# Performance e escala inicial

O sistema deve ser pensado para 1.000 usuários no início.

Boas práticas:

* usar paginação na biblioteca;
* buscar apenas dados necessários;
* não carregar todas as conversas de uma vez;
* não salvar arquivos grandes no banco;
* usar índices em `user_id`, `created_at`, `type`, `status`;
* registrar gerações em `ai_generations`;
* evitar chamadas duplicadas para IA;
* evitar polling desnecessário.

Criar índices:

```sql
create index if not exists idx_brand_essence_user_id on brand_essence(user_id);
create index if not exists idx_library_items_user_id on library_items(user_id);
create index if not exists idx_library_items_type on library_items(type);
create index if not exists idx_library_items_created_at on library_items(created_at desc);
create index if not exists idx_ai_conversations_user_id on ai_conversations(user_id);
create index if not exists idx_ai_messages_conversation_id on ai_messages(conversation_id);
create index if not exists idx_ai_generations_user_id on ai_generations(user_id);
```

---

# Atualização do frontend

Atualizar o frontend para usar Supabase.

Criar camada de serviços:

```txt
/src/lib/supabase/client.ts
/src/lib/supabase/server.ts, se aplicável
/src/services/essenceService.ts
/src/services/libraryService.ts
/src/services/aiService.ts
/src/services/conversationService.ts
```

Funções esperadas:

```txt
getCurrentProfile()
getBrandEssence()
saveBrandEssence()
updateBrandEssence()
getLibraryItems()
generateInitialLibrary()
createLibraryItem()
updateLibraryItem()
deleteLibraryItem()
favoriteLibraryItem()
getConversations()
getConversationMessages()
sendAIMessage()
generateContent()
```

---

# Migração do localStorage

Identifique onde o sistema atualmente usa `localStorage` para salvar dados importantes.

Substitua por Supabase:

* respostas da essência;
* ideias geradas;
* biblioteca;
* roteiros;
* conversas;
* histórico de IA.

Manter em `localStorage` apenas:

* tema;
* estado temporário de UI;
* rascunho não enviado;
* preferências visuais simples.

---

# UX esperada

A experiência precisa ser simples e clara.

## Primeiro acesso

1. Usuário entra.
2. Sistema verifica se tem `profile`.
3. Sistema verifica se `essence_completed = true`.
4. Se não tiver essência, mostrar chamada para preencher.
5. Depois de preencher, liberar biblioteca.

## Biblioteca

A Biblioteca deve parecer um lugar vivo e útil, não uma lista genérica.

Organizar por seções:

* Para postar hoje;
* Ideias de stories;
* Roteiros curtos;
* Ganchos;
* CTAs;
* Dúvidas do público;
* Objeções;
* Favoritos.

Cada item deve ter:

* título;
* tipo;
* conteúdo;
* tags;
* botão copiar;
* botão editar;
* botão favoritar;
* botão salvar/duplicar;
* botão excluir.

---

# Tratamento de erros

Implementar mensagens claras.

Exemplos:

Se não tiver essência:

```txt
Antes de gerar sua biblioteca, precisamos entender sua essência.
```

Se IA falhar:

```txt
Não conseguimos gerar agora. Suas respostas foram salvas, tente gerar novamente em instantes.
```

Se banco falhar:

```txt
Não foi possível salvar. Confira sua conexão e tente novamente.
```

Nunca apagar respostas do formulário se a IA falhar.

A ordem correta é:

1. salvar respostas no banco;
2. chamar IA;
3. se IA falhar, manter respostas salvas;
4. permitir tentar novamente.

---

# Checklist final obrigatório

Ao final da implementação, confira:

* [ ] Supabase configurado corretamente.
* [ ] `.env.local` criado e protegido.
* [ ] Nenhuma chave exposta no código.
* [ ] Migrations SQL criadas.
* [ ] RLS ativado.
* [ ] Políticas de segurança criadas.
* [ ] `profiles` funcionando.
* [ ] `brand_essence` funcionando.
* [ ] `library_items` funcionando.
* [ ] `ai_conversations` funcionando.
* [ ] `ai_messages` funcionando.
* [ ] `ai_generations` funcionando.
* [ ] `usage_limits` preparado.
* [ ] `subscriptions` preparado.
* [ ] Minha Essência salva no banco.
* [ ] Biblioteca só libera após essência.
* [ ] Biblioteca inicial é gerada uma vez.
* [ ] Conteúdos gerados são salvos.
* [ ] Conversas com IA são salvas.
* [ ] localStorage removido para dados importantes.
* [ ] UX com loading, empty state e erro.
* [ ] Sistema preparado para múltiplos usuários.
* [ ] Testar com dois usuários diferentes para garantir isolamento dos dados.
* [ ] Rodar build/lint/test se existirem scripts disponíveis.
* [ ] Documentar o que foi criado em um arquivo `DESTRAVAI_DATABASE_AI_FLOW.md`.

---

# Entrega esperada

Implemente tudo no projeto atual.

Depois, crie um documento chamado:

```txt
DESTRAVAI_DATABASE_AI_FLOW.md
```

Nesse documento, explique:

* quais tabelas foram criadas;
* como funciona o fluxo da Minha Essência;
* como funciona a geração da Biblioteca;
* onde as conversas são salvas;
* onde os conteúdos são salvos;
* quais variáveis de ambiente são necessárias;
* quais partes ainda podem ser evoluídas;
* como testar o fluxo completo.

Também inclua instruções para rodar migrations no Supabase e testar localmente.

Não faça mudanças superficiais. Implemente a estrutura real para o Destravaí funcionar como SaaS multiusuário.


VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui

# NUNCA commitar a service role key — use apenas no servidor