-- Endurecimento de segurança (resolve avisos do linter do Supabase).
-- Idempotente e conservador: NÃO altera o corpo de nenhuma função, só metadados
-- (search_path) e permissões. RODE NO PROJETO DO APP (fddxaozosrlqddthvqhn).

-- 1) Fixa search_path das funções (evita "function_search_path_mutable") --------
-- São funções existentes; só anexamos a config de search_path.
alter function public.destravai_set_updated_at()  set search_path = public, pg_temp;
alter function public.destravai_touch_updated_at() set search_path = public, pg_temp;
alter function public.handle_destravai_new_user()  set search_path = public, pg_temp;
alter function public.rls_auto_enable()            set search_path = public, pg_temp;

-- 2) Triggers não devem ser chamáveis via API REST (RPC) -----------------------
-- handle_destravai_new_user e rls_auto_enable são funções de trigger; ninguém
-- deve invocá-las diretamente. Revogamos o EXECUTE de anon/authenticated.
-- Revoga de PUBLIC (que inclui anon e authenticated) — triggers não são RPC.
revoke execute on function public.handle_destravai_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()           from public, anon, authenticated;

-- 3) Bucket avatars: não permitir LISTAR todos os arquivos ---------------------
-- O acesso por URL pública continua funcionando (bucket é público e o getPublicUrl
-- não depende de RLS). Restringimos a policy de SELECT para que, via API, cada
-- usuário só consiga LISTAR a própria pasta — em vez de listar o bucket inteiro.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars owner list" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);

-- 4) asaas_webhook_events: tabela escrita só pelo service role (webhook) -------
-- RLS ligado sem policy já bloqueia anon/authenticated, mas deixamos a negação
-- explícita para documentar a intenção e limpar o aviso do linter.
drop policy if exists "asaas webhook no client access" on public.asaas_webhook_events;
create policy "asaas webhook no client access" on public.asaas_webhook_events
  for all to anon, authenticated
  using (false) with check (false);
