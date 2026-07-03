-- Run this in your Supabase SQL editor
-- Go to: supabase.com → your project → SQL Editor → New Query

create table redirects (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  client_name text not null,
  google_url text not null,
  created_at timestamp with time zone default now()
);

-- Example: add a client
-- insert into redirects (slug, client_name, google_url)
-- values ('marios-pizza', 'Mario''s Pizza', 'https://g.page/r/YOUR_GOOGLE_REVIEW_LINK');
