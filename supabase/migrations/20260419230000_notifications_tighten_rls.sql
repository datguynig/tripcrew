-- ============================================================
-- Tighten notifications RLS.
--
-- The prior policy (20260419220000_notifications.sql) allowed
-- authenticated users to update their own rows via PostgREST.
-- The intent is that users can only mark `read_at`; all other
-- columns should be server-authoritative. But the policy permitted
-- arbitrary column updates as long as user_id stayed the owner,
-- which means a user could self-inject spoofed notification
-- content ("You were promoted to admin of X") — low-impact but
-- violates the data contract.
--
-- Fix: drop the update policy entirely. markAsRead / markAllRead
-- now run under the service role in the server action, scoped by
-- `user_id = auth.uid()` in the query itself. The select policy
-- (read own rows only) is unchanged.
-- ============================================================

drop policy if exists "notifications_update_own" on notifications;
