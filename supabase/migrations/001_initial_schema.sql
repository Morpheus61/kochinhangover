-- Create profiles table for users
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE,
    username TEXT UNIQUE,
    role TEXT CHECK (role IN ('admin', 'counter')) NOT NULL DEFAULT 'counter',
    mpin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id)
);

-- Create guests table
CREATE TABLE guests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    club_name TEXT,
    mobile_number TEXT NOT NULL,
    entry_type TEXT CHECK (entry_type IN ('standard', 'vip', 'guest')) NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00,
    mpin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create transactions table
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('topup', 'purchase', 'refund')) NOT NULL,
    category TEXT CHECK (category IN ('entry', 'food', 'beverage', 'merchandise', 'other')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'card', 'upi', 'other')),
    processed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create beverage_transactions table
CREATE TABLE beverage_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    beverage_type TEXT CHECK (beverage_type IN ('beer', 'wine', 'whiskey', 'cocktail', 'softdrink', 'other')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    processed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beverage_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Guests policies
CREATE POLICY "Guests are viewable by authenticated users" ON guests
    FOR SELECT USING (auth.role() IN ('authenticated'));

CREATE POLICY "Only admins can insert guests" ON guests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Only admins can update guests" ON guests
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Transactions policies
CREATE POLICY "Transactions are viewable by authenticated users" ON transactions
    FOR SELECT USING (auth.role() IN ('authenticated'));

CREATE POLICY "Only admins can insert transactions" ON transactions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Beverage transactions policies
CREATE POLICY "Beverage transactions are viewable by authenticated users" ON beverage_transactions
    FOR SELECT USING (auth.role() IN ('authenticated'));

CREATE POLICY "Authenticated users can insert beverage transactions" ON beverage_transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create functions
CREATE OR REPLACE FUNCTION update_guest_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type = 'topup' THEN
            UPDATE guests SET balance = balance + NEW.amount WHERE id = NEW.guest_id;
        ELSE
            UPDATE guests SET balance = balance - NEW.amount WHERE id = NEW.guest_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_guest_balance_after_transaction
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_balance();

CREATE TRIGGER update_guest_balance_after_beverage
    AFTER INSERT ON beverage_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_balance();
