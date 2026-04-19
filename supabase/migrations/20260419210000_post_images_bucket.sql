-- ============================================================
-- Feed image uploads — Storage bucket + RLS.
--
-- Replaces the "paste URL" affordance on /trips/[slug]/feed with
-- direct uploads. Bucket is public-read because feed posts render
-- via <img>; authenticated trip members write into their own
-- prefix so one user can't overwrite another user's uploads.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Public read: feed images are visible to anyone with the URL.
-- This matches the prior "paste a public URL" behavior.
drop policy if exists "post_images_public_read" on storage.objects;
create policy "post_images_public_read" on storage.objects
  for select to public using (bucket_id = 'post-images');

-- Write: authenticated user, and path must start with their user id.
-- Convention: post-images/<user_id>/<uuid>.<ext>
drop policy if exists "post_images_owner_insert" on storage.objects;
create policy "post_images_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_images_owner_update" on storage.objects;
create policy "post_images_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_images_owner_delete" on storage.objects;
create policy "post_images_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
