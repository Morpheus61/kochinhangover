-- Create users table
create table if not exists public.users (
    id uuid default gen_random_uuid() primary key,
    username text unique not null,
    password text not null,
    role text not null check (role in ('admin', 'staff')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create RLS policies
alter table public.users enable row level security;

-- Allow anyone to select from users table (needed for login)
create policy "Allow anyone to select users"
on users for select
to anon
using (true);

-- Insert default admin user
insert into public.users (username, password, role)
values ('Admin', 'Kochin2025', 'admin')
on conflict (username) do nothing;
