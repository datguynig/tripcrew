-- Crew chat: extend posts for reply-to + 5-minute edit window, add
-- post_likes reactions table. Non-destructive — all existing rows
-- keep working because the new columns are nullable and the relaxed
-- check constraint is a superset of the old one.

-- ---------- Posts: new columns ----------

alter table posts
  add column if not exists reply_to_post_id uuid references posts(id) on delete set null,
  add column if not exists edited_at timestamptz;

create index if not exists posts_reply_to_post_id_idx
  on posts(reply_to_post_id)
  where reply_to_post_id is not null;

-- Relax the "must have image or caption" check to also permit plain
-- reply-to messages (a 👍 reply is a valid post with no body of its
-- own). The old constraint was auto-named, so look it up instead of
-- hard-coding the name.

do $$
declare
  c_name text;
begin
  select conname into c_name
  from pg_constraint
  where conrelid = 'public.posts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%image_url%caption%'
    and pg_get_constraintdef(oid) not ilike '%reply_to_post_id%';
  if c_name is not null then
    execute format('alter table posts drop constraint %I', c_name);
  end if;
end $$;

alter table posts
  add constraint posts_has_body_check
  check (image_url is not null or caption is not null or reply_to_post_id is not null);

-- Tighten update policy: author-only, within 5 minutes of creation,
-- and only the caption/edited_at columns can change. RLS gates the
-- row; column-level GRANT gates which fields may mutate.

drop policy if exists posts_update_author on posts;

create policy "posts_update_author_within_edit_window" on posts
  for update to authenticated
  using (
    author_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  )
  with check (
    author_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  );

-- Keep blanket INSERT/DELETE grants as-is. Restrict UPDATE so clients
-- cannot pivot a post onto another trip or rewrite the image.
revoke update on posts from authenticated;
grant update (caption, edited_at) on posts to authenticated;

-- ---------- Post likes ----------

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_id_idx on post_likes(user_id);

alter table post_likes enable row level security;

create policy "post_likes_read_if_trip_member" on post_likes
  for select to authenticated using (
    is_trip_member((select trip_id from posts where id = post_id))
  );

create policy "post_likes_insert_self" on post_likes
  for insert to authenticated with check (
    user_id = auth.uid()
    and is_trip_member((select trip_id from posts where id = post_id))
  );

create policy "post_likes_delete_self" on post_likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------- Realtime ----------

alter publication supabase_realtime add table post_likes;
