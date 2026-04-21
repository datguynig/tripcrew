-- ============================================================
-- Trip hero — admin upload override.
--
-- `hero_image_user_url` wins over `hero_image_url` (the Places
-- photo set at lock time) when present. Reset = null this column.
--
-- New storage bucket `trip-hero-images` mirrors the post-images
-- RLS: public read, owner-path write. Admin gating is enforced
-- server-side by setTripHeroImage before persisting the URL to
-- trips; storage is just the transport.
--
-- Additive + idempotent. No destructive ops.
-- ============================================================

alter table trips
  add column if not exists hero_image_user_url text;

insert into storage.buckets (id, name, public)
values ('trip-hero-images', 'trip-hero-images', true)
on conflict (id) do nothing;

drop policy if exists "trip_hero_images_public_read" on storage.objects;
create policy "trip_hero_images_public_read" on storage.objects
  for select to public using (bucket_id = 'trip-hero-images');

drop policy if exists "trip_hero_images_owner_insert" on storage.objects;
create policy "trip_hero_images_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'trip-hero-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_hero_images_owner_update" on storage.objects;
create policy "trip_hero_images_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'trip-hero-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_hero_images_owner_delete" on storage.objects;
create policy "trip_hero_images_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'trip-hero-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
