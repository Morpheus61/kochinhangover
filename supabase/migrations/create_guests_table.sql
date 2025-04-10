-- Create the guests table with the exact structure needed
CREATE TABLE guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    club TEXT,
    phone TEXT,
    entry_type TEXT NOT NULL,
    payment TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    club_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create the users table with admin credentials
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert admin user
INSERT INTO users (username, password, role) 
VALUES ('Admin', 'Kochin2025', 'admin');
