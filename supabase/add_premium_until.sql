-- Add premium_until column to users profile table
alter table if exists public.users
  add column if not exists premium_until timestamp with time zone;

-- Optional: comment for clarity
comment on column public.users.premium_until is 'Premium expiration timestamp; null means not premium';






