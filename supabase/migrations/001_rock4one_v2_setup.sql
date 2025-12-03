-- =====================================================
-- ROCK 4 ONE - Database Setup Script v2.0
-- Multi-Seller Workflow with Payment Verification
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Drop existing tables if they exist (fresh start)
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- =====================================================
-- SETTINGS TABLE - For configurable ticket prices
-- =====================================================
CREATE TABLE settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_by UUID
);

-- Insert default ticket prices (Super Admin can change these)
INSERT INTO settings (setting_key, setting_value, description) VALUES
    ('stag_price', '2750', 'Ticket price for Stag entry'),
    ('couple_price', '4750', 'Ticket price for Couple entry'),
    ('event_name', 'Rock 4 One', 'Event name'),
    ('event_tagline', 'Harmony for Humanity', 'Event tagline'),
    ('event_date', 'TBD', 'Event date'),
    ('event_venue', 'TBD', 'Event venue'),
    ('upi_id', '', 'UPI ID for payments (shown to sellers)'),
    ('bank_details', '', 'Bank account details for transfers');

-- =====================================================
-- USERS TABLE - With three roles
-- =====================================================
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    mobile_number TEXT,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'seller')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID
);

-- Insert default Super Admin
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO users (username, password, full_name, role) 
VALUES ('SuperAdmin', 'Rock4One@2025', 'Super Administrator', 'super_admin');

-- =====================================================
-- GUESTS TABLE - With seller tracking & payment verification
-- =====================================================
CREATE TABLE guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Guest Information (captured by Seller)
    guest_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('stag', 'couple')),
    
    -- Payment Information (captured by Seller)
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer')),
    payment_reference TEXT,  -- UTR number for UPI, Reference for Bank Transfer
    ticket_price NUMERIC NOT NULL,
    
    -- Seller Information
    registered_by UUID NOT NULL REFERENCES users(id),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- Verification Information (by Super Admin)
    status TEXT DEFAULT 'pending_verification' CHECK (status IN (
        'pending_verification',  -- Awaiting payment verification
        'payment_verified',      -- Payment confirmed by Super Admin
        'pass_generated',        -- QR Pass generated
        'pass_sent',             -- WhatsApp sent to guest
        'checked_in',            -- Guest arrived at event
        'rejected'               -- Payment rejected/invalid
    )),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    
    -- Pass Information
    pass_generated_at TIMESTAMP WITH TIME ZONE,
    pass_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Entry Information (at event)
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- SETTINGS POLICIES
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update settings" ON settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- USERS POLICIES
CREATE POLICY "Anyone can view users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete users" ON users FOR DELETE TO anon USING (true);

-- GUESTS POLICIES
CREATE POLICY "Anyone can view guests" ON guests FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can insert guests" ON guests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can update guests" ON guests FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete guests" ON guests FOR DELETE TO anon USING (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_guests_registered_by ON guests(registered_by);
CREATE INDEX idx_guests_payment_mode ON guests(payment_mode);
CREATE INDEX idx_guests_created_at ON guests(created_at DESC);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_settings_key ON settings(setting_key);

-- =====================================================
-- VIEWS FOR EASY REPORTING
-- =====================================================

-- View: Sales by Seller
CREATE OR REPLACE VIEW seller_stats AS
SELECT 
    u.id as seller_id,
    u.username,
    u.full_name,
    COUNT(g.id) as total_registrations,
    COUNT(CASE WHEN g.status = 'pending_verification' THEN 1 END) as pending_count,
    COUNT(CASE WHEN g.status IN ('payment_verified', 'pass_generated', 'pass_sent', 'checked_in') THEN 1 END) as verified_count,
    COUNT(CASE WHEN g.status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN g.entry_type = 'stag' THEN 1 END) as stag_count,
    COUNT(CASE WHEN g.entry_type = 'couple' THEN 1 END) as couple_count,
    COALESCE(SUM(CASE WHEN g.status IN ('payment_verified', 'pass_generated', 'pass_sent', 'checked_in') THEN g.ticket_price ELSE 0 END), 0) as total_verified_amount,
    COALESCE(SUM(CASE WHEN g.payment_mode = 'cash' AND g.status IN ('payment_verified', 'pass_generated', 'pass_sent', 'checked_in') THEN g.ticket_price ELSE 0 END), 0) as cash_collected,
    COALESCE(SUM(CASE WHEN g.payment_mode = 'upi' AND g.status IN ('payment_verified', 'pass_generated', 'pass_sent', 'checked_in') THEN g.ticket_price ELSE 0 END), 0) as upi_collected,
    COALESCE(SUM(CASE WHEN g.payment_mode = 'bank_transfer' AND g.status IN ('payment_verified', 'pass_generated', 'pass_sent', 'checked_in') THEN g.ticket_price ELSE 0 END), 0) as bank_collected
FROM users u
LEFT JOIN guests g ON u.id = g.registered_by
WHERE u.role = 'seller'
GROUP BY u.id, u.username, u.full_name;

-- View: Overall Statistics
CREATE OR REPLACE VIEW overall_stats AS
SELECT 
    COUNT(*) as total_registrations,
    COUNT(CASE WHEN status = 'pending_verification' THEN 1 END) as pending_verification,
    COUNT(CASE WHEN status = 'payment_verified' THEN 1 END) as payment_verified,
    COUNT(CASE WHEN status = 'pass_generated' THEN 1 END) as pass_generated,
    COUNT(CASE WHEN status = 'pass_sent' THEN 1 END) as pass_sent,
    COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
    COUNT(CASE WHEN entry_type = 'stag' THEN 1 END) as stag_count,
    COUNT(CASE WHEN entry_type = 'couple' THEN 1 END) as couple_count,
    COUNT(CASE WHEN entry_type = 'stag' THEN 1 END) + (COUNT(CASE WHEN entry_type = 'couple' THEN 1 END) * 2) as total_pax,
    COALESCE(SUM(CASE WHEN status NOT IN ('pending_verification', 'rejected') THEN ticket_price ELSE 0 END), 0) as total_verified_revenue,
    COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND status NOT IN ('pending_verification', 'rejected') THEN ticket_price ELSE 0 END), 0) as cash_revenue,
    COALESCE(SUM(CASE WHEN payment_mode = 'upi' AND status NOT IN ('pending_verification', 'rejected') THEN ticket_price ELSE 0 END), 0) as upi_revenue,
    COALESCE(SUM(CASE WHEN payment_mode = 'bank_transfer' AND status NOT IN ('pending_verification', 'rejected') THEN ticket_price ELSE 0 END), 0) as bank_revenue
FROM guests;

-- =====================================================
-- SETUP COMPLETE!
-- 
-- Default Super Admin Login:
--   Username: SuperAdmin
--   Password: Rock4One@2025
-- 
-- IMPORTANT: Change the password after first login!
--
-- Roles:
--   super_admin - Full access, verify payments, send passes
--   admin       - Read-only access to all data
--   seller      - Register guests, view own sales
-- =====================================================
