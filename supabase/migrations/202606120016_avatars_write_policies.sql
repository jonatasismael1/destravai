-- Versiona as policies de ESCRITA do bucket avatars (achado da auditoria
-- 2026-06-12: só a policy de SELECT estava nas migrations; a escrita dependia de
-- policy criada no painel, fora do versionamento).
--
-- Estas policies são PERMISSIVAS (somam com as existentes via OR): aplicá-las não
-- quebra upload nenhum que já funcione. Cada usuário só escreve/edita/apaga
-- arquivos na PRÓPRIA pasta (avatars/<auth.uid()>/...), que é como o app já salva.
--
-- AÇÃO MANUAL DEPOIS DE APLICAR: conferir no painel do Supabase (Storage →
-- Policies) se existe alguma policy de escrita MAIS FROUXA criada à mão (ex.: sem
-- filtro de pasta) e removê-la — estas aqui passam a cobrir o caso legítimo.
-- Idempotente. RODE NO PROJETO DO APP.

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
