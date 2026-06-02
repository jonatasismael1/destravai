# E-mails de autenticação — Supabase Auth + Resend (SMTP)

Como o Destravaí envia e-mails transacionais e o que precisa estar configurado.

## Visão geral

- **Domínio de produção:** https://destravai.dbe.digital
- **Domínio de envio (Resend):** destravai.dbe.digital
- **Remetente (configurado no painel do Supabase → SMTP):** `noreply@destravai.dbe.digital`
  (pode ser `suporte@destravai.dbe.digital` — o valor real fica só no painel do Supabase).
- **Como funciona:** o **Supabase Auth** envia todos os e-mails de autenticação usando o
  **SMTP personalizado do Resend**. As credenciais SMTP do Resend ficam **somente** no
  painel do Supabase (Authentication → Emails → SMTP Settings). **Nenhuma chave do
  Resend/SMTP fica no código ou no frontend.**
- O app **não** chama a API do Resend diretamente — toda a comunicação por e-mail
  passa pelo Supabase Auth. Isso mantém tudo transacional e sem chaves expostas.

## Fluxos de e-mail que existem hoje

| Fluxo | Quando dispara | Link leva para |
|---|---|---|
| **Confirmação de cadastro** (se ativa no Supabase) | Cadastro direto pelo app (`signUp`) | `/` (raiz, já logado) — via `emailRedirectTo` |
| **Recuperação de senha** | Botão "Recuperar" na tela de login (`resetPasswordForEmail`) | `/definir-senha` |
| **Acesso liberado após pagamento** | Webhook do Asaas confirma o pagamento (`sendAccessEmail`) | `/definir-senha` (usuário cria a senha e entra) |
| **Acesso de cortesia (testador)** | Admin cria testador (`admin-create-tester`) | `/definir-senha` |

> Os três últimos usam o mesmo mecanismo do Supabase (`resetPasswordForEmail` → tipo
> "recovery"). A página `/definir-senha` detecta o token na URL, cria a sessão de
> recuperação e deixa o usuário definir a senha.

## URLs que precisam estar no Supabase

Em **Authentication → URL Configuration**:

- **Site URL:**
  `https://destravai.dbe.digital`
- **Redirect URLs (allowlist)** — adicione todas:
  - `https://destravai.dbe.digital/definir-senha`
  - `https://destravai.dbe.digital/`
  - (desenvolvimento local, se usar) `http://localhost:5173/definir-senha` e `http://localhost:5173/`

> Importante: se a URL de `redirectTo` não estiver na allowlist, o Supabase ignora e usa
> a Site URL — o usuário cairia na raiz em vez de `/definir-senha`. As rotas reais do app
> são **`/login`** e **`/definir-senha`** (não existe `/auth/callback` nem `/reset-password`).

## Como testar

### Cadastro
1. Acesse `/login`, aba **Criar conta**, cadastre um e-mail real.
2. Se a confirmação de e-mail estiver **ativa**: o app mostra "Enviamos um e-mail de
   confirmação para …". Confirme pelo link (chega via Resend) → cai na raiz já logado.
3. Se estiver **desativada**: o login acontece direto após o cadastro.

### Recuperação de senha
1. Em `/login`, digite o e-mail e clique em **Recuperar**.
2. O app mostra "Enviamos um e-mail com o link para você redefinir sua senha."
3. Abra o e-mail (Resend) → clique no link → cai em `/definir-senha` → defina a nova senha
   → mensagem "Senha criada!".
4. **Link expirado/ inválido / sem token:** `/definir-senha` mostra "Link inválido ou
   expirado" e oferece voltar ao login para pedir um novo.

### Acesso após pagamento (Asaas)
1. Pague o checkout (Pix/cartão). O webhook confirma e dispara `sendAccessEmail`.
2. O e-mail (Resend) leva a `/definir-senha` para o cliente criar a senha e entrar.

## Cuidados de segurança

- A chave do Resend e a senha SMTP ficam **apenas** no painel do Supabase. Nunca no
  código, nunca no frontend, nunca em log.
- O frontend usa só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (públicas por design).
- A `SUPABASE_SERVICE_ROLE_KEY` é usada **só no backend** (Netlify Functions / Edge).
- Redefinição de senha exige **sessão de recuperação válida** (token do e-mail). Sem
  token válido, `/definir-senha` não permite trocar a senha.
- Nenhum log imprime token, link mágico, senha ou dado sensível.

## Variáveis de ambiente necessárias (sem valores reais)

**Frontend (build do Vite — Netlify):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Backend (Netlify Functions):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL` (ex.: `https://destravai.dbe.digital`) — usado no `redirectTo` do e-mail de acesso.

**Resend / SMTP:** não há variável de ambiente no app. As credenciais ficam no painel do
Supabase (Authentication → SMTP Settings).

## Evoluções recomendadas (não implementadas — manter transacional)

Se um dia quiser e-mails além dos de autenticação (pagamento aprovado com mais detalhes,
falha de pagamento, cancelamento confirmado), a abordagem segura é criar uma Netlify
Function que chama a **API do Resend** com a chave em env **do servidor** (`RESEND_API_KEY`),
reusando o padrão das funções atuais. Manter **somente transacional** — sem newsletter,
sem sequência de vendas, sem disparo em massa.
