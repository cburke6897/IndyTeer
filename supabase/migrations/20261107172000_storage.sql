-- Publicly readable image buckets with owner/member-scoped writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('org-logos', 'org-logos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('org-covers', 'org-covers', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('opportunity-images', 'opportunity-images', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('post-images', 'post-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set name = excluded.name, public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The avatar policies may have been installed manually in the shared project.
drop policy if exists "Users upload their own avatars" on storage.objects;
drop policy if exists "Users update their own avatars" on storage.objects;
drop policy if exists "Users delete their own avatars" on storage.objects;
drop policy if exists "Organization admins upload brand images" on storage.objects;
drop policy if exists "Organization admins update brand images" on storage.objects;
drop policy if exists "Organization admins delete brand images" on storage.objects;
drop policy if exists "Organization admins upload opportunity images" on storage.objects;
drop policy if exists "Organization admins update opportunity images" on storage.objects;
drop policy if exists "Organization admins delete opportunity images" on storage.objects;
drop policy if exists "Organization admins upload post images" on storage.objects;
drop policy if exists "Organization admins update post images" on storage.objects;
drop policy if exists "Organization admins delete post images" on storage.objects;

create policy "Users upload their own avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update their own avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Organization admins upload brand images" on storage.objects for insert to authenticated
  with check (bucket_id in ('org-logos','org-covers')
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Organization admins update brand images" on storage.objects for update to authenticated
  using (bucket_id in ('org-logos','org-covers') and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text)
  with check (bucket_id in ('org-logos','org-covers') and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Organization admins delete brand images" on storage.objects for delete to authenticated
  using (bucket_id in ('org-logos','org-covers') and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "Organization admins upload opportunity images" on storage.objects for insert to authenticated
  with check (bucket_id = 'opportunity-images' and exists (
    select 1 from public.opportunities o where o.id = ((storage.foldername(name))[1])::uuid
      and public.is_org_admin(o.organization_id)) and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Organization admins update opportunity images" on storage.objects for update to authenticated
  using (bucket_id = 'opportunity-images' and exists (
    select 1 from public.opportunities o where o.id = ((storage.foldername(name))[1])::uuid
      and public.is_org_admin(o.organization_id)) and (storage.foldername(name))[2] = (select auth.uid())::text)
  with check (bucket_id = 'opportunity-images' and exists (
    select 1 from public.opportunities o where o.id = ((storage.foldername(name))[1])::uuid
      and public.is_org_admin(o.organization_id)) and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Organization admins delete opportunity images" on storage.objects for delete to authenticated
  using (bucket_id = 'opportunity-images' and exists (
    select 1 from public.opportunities o where o.id = ((storage.foldername(name))[1])::uuid
      and public.is_org_admin(o.organization_id)) and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "Organization admins upload post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Organization admins update post images" on storage.objects for update to authenticated
  using (bucket_id = 'post-images' and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text)
  with check (bucket_id = 'post-images' and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "Organization admins delete post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and public.is_org_admin(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);
