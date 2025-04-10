-- Create the guests table with the exact structure needed
CREATE TABLE guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guestName TEXT NOT NULL,
    clubName TEXT,
    mobileNumber TEXT NOT NULL,
    entryType TEXT NOT NULL,
    paymentMode TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    registrationDate TIMESTAMP WITH TIME ZONE,
    verifiedAt TIMESTAMP WITH TIME ZONE,
    deniedAt TIMESTAMP WITH TIME ZONE,
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

-- Create RLS policies
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert guests
CREATE POLICY "Allow anyone to insert guests"
ON guests FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anyone to view guests
CREATE POLICY "Allow anyone to view guests"
ON guests FOR SELECT
TO anon
USING (true);

-- Allow anyone to update guests
CREATE POLICY "Allow anyone to update guests"
ON guests FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
