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
