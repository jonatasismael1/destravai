# Destravaí — Arquitetura de Banco, IA e Fluxo

Documento técnico do sistema Destravaí: tabelas criadas, fluxos de dados, Edge Functions, variáveis de ambiente e como testar.

---

## Tabelas criadas no Supabase

Todas as tabelas usam prefixo `destravai_` para não conflitar com outros projetos no mesmo banco.
RLS (Row Level Security) está ativo em todas. Cada usuário só acessa seus próprios dados.

| Tabela | Descrição |
|--------|-----------|
| `destravai_profiles` | Perfil do usuário: nome, e-mail, plano, status do onboarding e da essência |
| `destravai_brand_essence` | Essência estratégica: profissão, nicho, público, tom de voz, serviços, restrições, resumo gerado pela IA |
| `destravai_library_items` | Biblioteca personalizada: roteiros, ganchos, CTAs, sequências de stories, etc. |
| `destravai_ai_conversations` | Cabeçalho de conversas com a IA |
| `destravai_ai_messages` | Mensagens de cada conversa (usuário + assistente) |
| `destravai_ai_generations` | Registro técnico de cada geração: prompt, modelo, tokens, status |
| `destravai_usage_limits` | Controle de uso por período (preparado para limitar por plano) |
| `destravai_subscriptions` | Planos futuros (preparado para Stripe ou similar) |

### Trigger automático
Ao criar um usuário no Supabase Auth, o trigger `on_auth_user_created_destravai` cria automaticamente uma linha em `destravai_profiles`.

---

## Fluxo da Minha Essência

```
Usuário acessa /essencia
  ↓
Frontend busca getBrandEssence() do banco
  ↓
Se existe → carrega formulário preenchido + resumo da IA
Se não existe → mostra formulário vazio
  ↓
Usuário preenche e clica "Salvar"
  → saveBrandEssence() → salva no banco SEM chamar IA
  ↓
Usuário clica "Gerar com IA"
  → saveEssenceAndGenerateSummary() → Edge Function destravai-save-essence
      1. Salva/atualiza destravai_brand_essence
      2. Chama Gemini com as respostas
      3. Gera ai_summary (texto corrido) + ai_positioning (JSON estruturado)
      4. Atualiza destravai_brand_essence.ai_summary e ai_positioning
      5. Marca destravai_profiles.essence_completed = true
      6. Registra em destravai_ai_generations
  ↓
Frontend atualiza exibição com resumo gerado
```

**Se a IA falhar:** os dados já foram salvos no passo anterior. O usuário pode tentar de novo sem perder as respostas.

---

## Fluxo da Biblioteca

```
Usuário acessa /biblioteca
  ↓
Frontend verifica se existe brand_essence
  ↓
NÃO TEM ESSÊNCIA
  → Mostra tela de bloqueio com botão "Preencher Minha Essência"
  → Não gera nada
  ↓
TEM ESSÊNCIA, não tem itens na biblioteca
  → Chama generateInitialLibrary() → Edge Function destravai-generate-library
      1. Verifica autenticação
      2. Busca brand_essence ativa do usuário
      3. Verifica se já existem library_items (se sim, retorna os existentes)
      4. Gera biblioteca com Gemini (~72 itens)
      5. Salva cada item em destravai_library_items
      6. Registra em destravai_ai_generations
      7. Retorna os itens
  ↓
TEM ESSÊNCIA e TEM itens
  → Carrega do banco (paginado, 30 por vez)
  → Não gera novamente
```

**A biblioteca nunca é gerada duas vezes automaticamente.** Se o usuário quiser regenerar, será uma ação explícita futura.

---

## Onde as conversas são salvas

- **Cabeçalho**: `destravai_ai_conversations` (id, title, context_type, timestamps)
- **Mensagens**: `destravai_ai_messages` (role: user/assistant/system, content, metadata)
- **Fluxo**:
  1. Usuário envia mensagem
  2. Frontend chama `chatWithAI()` → Edge Function `destravai-chat`
  3. Edge Function cria/recupera conversa, salva mensagem do usuário
  4. Busca histórico das últimas 10 mensagens
  5. Chama Gemini com contexto da essência + histórico
  6. Salva resposta da IA em `destravai_ai_messages`
  7. Registra em `destravai_ai_generations`
  8. Retorna resposta ao frontend

---

## Onde os conteúdos são salvos

Todos os conteúdos gerados ficam em `destravai_library_items`.

### Tipos disponíveis
| type | Descrição |
|------|-----------|
| `content_idea` | Ideia de conteúdo (story, reels, post) |
| `story_sequence` | Sequência de 3+ stories encadeados |
| `reels_script` | Roteiro completo de reels |
| `caption` | Legenda para Instagram |
| `hook` | Gancho de abertura |
| `cta` | Chamada para ação |
| `objection_answer` | Resposta para objeções/dúvidas do público |
| `routine_prompt` | Ideia rápida para a rotina de gravação |
| `daily_prompt` | Prompt diário contextualizado |
| `carousel_idea` | Estrutura de carrossel |
| `static_post_idea` | Ideia de post estático |

---

## Edge Functions implantadas

| Função | Endpoint | O que faz |
|--------|----------|-----------|
| `destravai-save-essence` | `POST /functions/v1/destravai-save-essence` | Salva essência + gera resumo IA |
| `destravai-generate-library` | `POST /functions/v1/destravai-generate-library` | Gera biblioteca inicial (uma vez) |
| `destravai-generate-content` | `POST /functions/v1/destravai-generate-content` | Gera conteúdo sob demanda |
| `destravai-chat` | `POST /functions/v1/destravai-chat` | Conversa com IA contextualizada |

Todas requerem JWT válido no header `Authorization: Bearer <token>`.

---

## Variáveis de ambiente

### Frontend (`.env.local`)
```env
VITE_SUPABASE_URL=https://fddxaozosrlqddthvqhn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

# Apenas durante migração — remover quando todas as chamadas forem para Edge Functions
VITE_GEMINI_API_KEY=...
```

### Edge Functions (configurar no Supabase Dashboard → Settings → Edge Functions → Secrets)
```
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
```

As Edge Functions recebem automaticamente do Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Como configurar o secret da IA nas Edge Functions

**Via Supabase Dashboard:**
1. Acesse https://supabase.com/dashboard → seu projeto
2. Vá em Settings → Edge Functions → Secrets
3. Adicione: `GOOGLE_GENERATIVE_AI_API_KEY` = sua chave do Gemini

**Via Supabase CLI (quando disponível):**
```bash
supabase secrets set GOOGLE_GENERATIVE_AI_API_KEY=sua_chave_aqui
```

---

## Arquitetura de arquivos criados

```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts          ← Cliente Supabase (singleton)
│   │   └── types.ts           ← Interfaces TypeScript das tabelas
│   └── ai/
│       └── prompts/
│           ├── essenceSummary.ts      ← Prompt: gerar resumo da essência
│           ├── initialLibrary.ts      ← Prompt: biblioteca inicial
│           ├── contentGeneration.ts   ← Prompt: conteúdo sob demanda
│           └── chatAssistant.ts       ← Prompt: conversa com IA
├── services/
│   ├── profileService.ts      ← CRUD de destravai_profiles
│   ├── essenceService.ts      ← CRUD de destravai_brand_essence
│   ├── libraryService.ts      ← CRUD de destravai_library_items
│   ├── conversationService.ts ← CRUD de conversas e mensagens
│   └── aiService.ts           ← Bridge para Edge Functions de IA
```

---

## Segurança implementada

- **RLS ativo** em todas as 8 tabelas
- **Políticas por usuário**: `auth.uid() = user_id` em todas as operações
- **Chaves de IA nunca no frontend**: as 4 Edge Functions recebem `GOOGLE_GENERATIVE_AI_API_KEY` do ambiente seguro do Supabase
- **`VITE_GEMINI_API_KEY` é temporária**: usada apenas por funções legadas em `lib/ai.ts` durante a migração; será removida quando todas as chamadas migrarem para Edge Functions
- **JWT obrigatório** em todas as Edge Functions (`verify_jwt: true`)
- **Trigger com `SECURITY DEFINER`** para criar profile automaticamente, evitando exposição do service role

---

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Criar .env.local com as variáveis (já configurado)
# Verificar se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão corretos

# 3. Iniciar o servidor de desenvolvimento
npm run dev

# 4. Acessar em http://localhost:5173
```

---

## Como testar o fluxo completo

### 1. Primeiro acesso (novo usuário)
1. Abra o app e clique em "Criar conta"
2. Preencha nome, e-mail e senha (mínimo 6 caracteres)
3. O sistema cria automaticamente um `destravai_profiles` via trigger
4. Você é redirecionado para o Onboarding
5. Complete as 8 etapas e clique em "Começar"
6. O app salva a essência básica em `destravai_brand_essence` e marca `onboarding_completed = true`

### 2. Minha Essência
1. Acesse `/essencia`
2. Preencha todos os campos das abas
3. Clique "Salvar" → salva imediatamente sem IA
4. Clique "Gerar com IA" → chama a Edge Function, gera resumo e posicionamento
5. Verifique no Supabase Dashboard que `ai_summary` e `ai_positioning` foram salvos

### 3. Biblioteca
1. Acesse `/biblioteca`
2. Se não tiver essência → verá a tela de bloqueio
3. Com essência e sem itens → vê loading "Organizando sua biblioteca..."
4. Aguarde a geração (~10-30 segundos)
5. A biblioteca deve aparecer com 60-72 itens agrupados por seção
6. Teste favoritar, excluir, duplicar e editar

### 4. Isolamento de dados (teste com 2 usuários)
1. Abra em aba normal (Usuário A) e aba anônima (Usuário B)
2. Crie contas diferentes em cada aba
3. Preencha essências diferentes
4. Verifique que a biblioteca de A não aparece para B e vice-versa

---

## O que ainda pode ser evoluído

1. **Remover `VITE_GEMINI_API_KEY` do frontend**: mover todas as chamadas de `lib/ai.ts` para Edge Functions (Home, Criar, MeuEspaco ainda usam chamadas diretas)
2. **pgvector para busca semântica**: buscar itens da biblioteca por similaridade de conteúdo
3. **Planos e limites de uso**: ativar a tabela `destravai_usage_limits` para limitar gerações por plano
4. **Stripe/pagamentos**: integrar com `destravai_subscriptions`
5. **Atualização da biblioteca**: permitir ao usuário regenerar seções específicas após atualizar a essência
6. **Notificações push**: integrar para lembretes de gravação
7. **Analytics de conteúdo**: rastrear quais tipos de conteúdo mais usados por nicho

---

## Estrutura de dados no banco (simplificada)

```
auth.users (Supabase Auth)
    ↓ trigger automático
destravai_profiles (user_id = auth.uid)
    ↓
destravai_brand_essence (user_id, ai_summary, ai_positioning)
    ↓
destravai_library_items (user_id, essence_id, type, title, content)
destravai_ai_conversations (user_id)
    ↓
destravai_ai_messages (conversation_id, user_id, role, content)
destravai_ai_generations (user_id, prompt_type, model, status)
destravai_usage_limits (user_id, period_start, period_end, counts)
destravai_subscriptions (user_id, plan, status)
```
