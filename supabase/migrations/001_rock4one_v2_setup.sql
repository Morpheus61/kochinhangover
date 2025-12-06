-- =====================================================
-- ROCK 4 ONE - Complete Database Setup Script v2.2
-- Multi-Seller Workflow + Gate Management System
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Drop existing tables if they exist (fresh start)
DROP TABLE IF EXISTS guest_movements CASCADE;
DROP TABLE IF EXISTS marshall_duties CASCADE;
DROP TABLE IF EXISTS entry_gates CASCADE;
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
    ('bank_details', '', 'Bank account details for transfers'),
    ('payment_qr_code', '', 'Payment QR Code image (base64)');

-- =====================================================
-- USERS TABLE - With four roles and club info
-- =====================================================
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    club_name TEXT,
    club_number TEXT,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'seller', 'entry_marshall')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID
);

-- Insert default Super Admin
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO users (username, password, full_name, mobile_number, role) 
VALUES ('SuperAdmin', 'Rock4One@2025', 'Super Administrator', '0000000000', 'super_admin');

-- =====================================================
-- ENTRY GATES TABLE - Physical entry points
-- =====================================================
CREATE TABLE entry_gates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gate_name TEXT NOT NULL,
    gate_code TEXT UNIQUE NOT NULL,  -- e.g., 'MAIN', 'VIP', 'SIDE-A'
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES users(id)
);

-- Insert default gates
INSERT INTO entry_gates (gate_name, gate_code, description) VALUES 
    ('Main Entrance', 'MAIN', 'Primary entry point'),
    ('VIP Entrance', 'VIP', 'VIP and special guests'),
    ('Side Gate A', 'SIDE-A', 'Side entrance near parking');

-- =====================================================
-- GUESTS TABLE - With seller tracking & gate management
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
    
    -- Gate Management - Venue Tracking
    is_inside_venue BOOLEAN DEFAULT false,
    last_gate_id UUID REFERENCES entry_gates(id),
    entry_count INTEGER DEFAULT 0,
    last_movement_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- MARSHALL DUTIES TABLE - Clock In/Out Records
-- =====================================================
CREATE TABLE marshall_duties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    marshall_id UUID NOT NULL REFERENCES users(id),
    gate_id UUID NOT NULL REFERENCES entry_gates(id),
    clock_in_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    clock_out_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'on_duty' CHECK (status IN ('on_duty', 'off_duty')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- GUEST MOVEMENTS TABLE - Entry/Exit Log
-- =====================================================
CREATE TABLE guest_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guest_id UUID NOT NULL REFERENCES guests(id),
    gate_id UUID NOT NULL REFERENCES entry_gates(id),
    marshall_id UUID REFERENCES users(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marshall_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_movements ENABLE ROW LEVEL SECURITY;

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

-- ENTRY GATES POLICIES
CREATE POLICY "Anyone can view gates" ON entry_gates FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can insert gates" ON entry_gates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can update gates" ON entry_gates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete gates" ON entry_gates FOR DELETE TO anon USING (true);

-- MARSHALL DUTIES POLICIES
CREATE POLICY "Anyone can view duties" ON marshall_duties FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can insert duties" ON marshall_duties FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can update duties" ON marshall_duties FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- GUEST MOVEMENTS POLICIES
CREATE POLICY "Anyone can view movements" ON guest_movements FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can insert movements" ON guest_movements FOR INSERT TO anon WITH CHECK (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Guests indexes
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_guests_registered_by ON guests(registered_by);
CREATE INDEX idx_guests_payment_mode ON guests(payment_mode);
CREATE INDEX idx_guests_created_at ON guests(created_at DESC);
CREATE INDEX idx_guests_inside_venue ON guests(is_inside_venue);
CREATE INDEX idx_guests_checked_in_by ON guests(checked_in_by);

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Settings indexes
CREATE INDEX idx_settings_key ON settings(setting_key);

-- Gate Management indexes
CREATE INDEX idx_marshall_duties_status ON marshall_duties(status);
CREATE INDEX idx_marshall_duties_marshall ON marshall_duties(marshall_id);
CREATE INDEX idx_marshall_duties_gate ON marshall_duties(gate_id);
CREATE INDEX idx_guest_movements_guest ON guest_movements(guest_id);
CREATE INDEX idx_guest_movements_gate ON guest_movements(gate_id);
CREATE INDEX idx_guest_movements_type ON guest_movements(movement_type);
CREATE INDEX idx_guest_movements_time ON guest_movements(created_at);

-- =====================================================
-- VIEWS FOR EASY REPORTING
-- =====================================================

-- View: Sales by Seller
CREATE OR REPLACE VIEW seller_stats AS
SELECT 
    u.id as seller_id,
    u.username,
    u.full_name,
    u.mobile_number,
    u.club_name,
    u.club_number,
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
GROUP BY u.id, u.username, u.full_name, u.mobile_number, u.club_name, u.club_number;

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

-- View: Marshalls currently on duty
CREATE OR REPLACE VIEW active_marshalls AS
SELECT 
    md.id as duty_id,
    md.marshall_id,
    u.full_name as marshall_name,
    u.mobile_number as marshall_mobile,
    md.gate_id,
    eg.gate_name,
    eg.gate_code,
    md.clock_in_at,
    EXTRACT(EPOCH FROM (NOW() - md.clock_in_at))/3600 as hours_on_duty
FROM marshall_duties md
JOIN users u ON md.marshall_id = u.id
JOIN entry_gates eg ON md.gate_id = eg.id
WHERE md.status = 'on_duty';

-- View: Gate statistics
CREATE OR REPLACE VIEW gate_statistics AS
SELECT 
    eg.id as gate_id,
    eg.gate_name,
    eg.gate_code,
    COUNT(DISTINCT CASE WHEN md.status = 'on_duty' THEN md.marshall_id END) as marshalls_on_duty,
    COUNT(DISTINCT CASE WHEN g.is_inside_venue = true AND g.last_gate_id = eg.id THEN g.id END) as guests_entered,
    COUNT(DISTINCT CASE WHEN gm.movement_type = 'entry' AND gm.created_at > NOW() - INTERVAL '24 hours' THEN gm.id END) as entries_today,
    COUNT(DISTINCT CASE WHEN gm.movement_type = 'exit' AND gm.created_at > NOW() - INTERVAL '24 hours' THEN gm.id END) as exits_today
FROM entry_gates eg
LEFT JOIN marshall_duties md ON eg.id = md.gate_id AND md.status = 'on_duty'
LEFT JOIN guests g ON eg.id = g.last_gate_id
LEFT JOIN guest_movements gm ON eg.id = gm.gate_id
WHERE eg.is_active = true
GROUP BY eg.id, eg.gate_name, eg.gate_code;

-- View: Current venue status
CREATE OR REPLACE VIEW venue_status AS
SELECT 
    (SELECT COUNT(*) FROM guests WHERE is_inside_venue = true) as guests_inside,
    (SELECT COUNT(*) FROM guests WHERE status = 'checked_in') as total_checked_in,
    (SELECT COUNT(*) FROM guests WHERE status IN ('pass_sent', 'checked_in')) as total_expected,
    (SELECT COUNT(*) FROM marshall_duties WHERE status = 'on_duty') as marshalls_on_duty,
    (SELECT COUNT(*) FROM entry_gates WHERE is_active = true) as active_gates;

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
--   super_admin    - Full access, verify payments, manage gates
--   admin          - Read-only access to all data + gate status
--   seller         - Register guests, view own sales
--   entry_marshall - Scan QR codes, manage entry/exit at gates
--
-- Gate Management Features:
--   - entry_gates: Configure physical entry points
--   - marshall_duties: Track clock in/out at gates
--   - guest_movements: Log every entry/exit with timestamps
--   - is_inside_venue: Track if guest is currently inside
--   - entry_count: Track re-entries
-- =====================================================

SELECT 'Rock 4 One v2.2 Database Setup Complete!' as status;