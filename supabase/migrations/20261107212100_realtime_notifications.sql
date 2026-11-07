-- Deliver notification inserts and read state changes to the signed-in user's client.
alter publication supabase_realtime add table public.notifications;
