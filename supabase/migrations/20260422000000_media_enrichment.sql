-- ============================================================
-- Media enrichment — Part A of the Places/Maps utilisation push.
--
-- Surfaces real venue imagery + ratings across Destinations, the
-- Trip overview hero, and the Shortlist activity cards. The AI
-- draft already fetches most of these fields from Google Places
-- during generation and discards them; this migration opens a
-- persistent slot on each row so enrichment can land on write.
--
-- Photos come from Google Places Photo API, downloaded server-side
-- into the new `place-photos` storage bucket. Keeping images on
-- our domain avoids hotlinking Google's 1-hour-TTL redirect URLs
-- and satisfies their caching guidance.
--
-- Additive + idempotent. No destructive ops.
-- ============================================================

-- Trip hero image (locked destination). `hero_image_attribution`
-- stores the Google-required photographer display name shown as
-- a small chip over the hero.
alter table trips
  add column if not exists hero_image_url text,
  add column if not exists hero_image_attribution text;

-- Destination candidate preview photo. Enriched asynchronously
-- after proposeCandidate and copied to trips.hero_image_url on
-- lockDestination when the winner is chosen.
alter table destination_candidates
  add column if not exists photo_url text,
  add column if not exists photo_attribution text;

-- Activity row: photo + venue detail from Places. `rating` is the
-- Places-reported aggregate (1.0-5.0), `price_level` is the Places
-- integer (1-4) rendered as $/$$/$$$/$$$$, `website_url` surfaces
-- an outlink icon on the card.
alter table activities
  add column if not exists photo_url text,
  add column if not exists photo_attribution text,
  add column if not exists rating numeric(2, 1),
  add column if not exists price_level smallint,
  add column if not exists website_url text;

-- Place-photos storage bucket — public-read so <img> tags work
-- in every render context (RSC, client, notification email if
-- we add one). Writes are service-role only; the enrichment
-- action runs server-side with the service client, so no
-- authenticated insert/update policies are needed.
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

drop policy if exists "place_photos_public_read" on storage.objects;
create policy "place_photos_public_read" on storage.objects
  for select to public using (bucket_id = 'place-photos');
