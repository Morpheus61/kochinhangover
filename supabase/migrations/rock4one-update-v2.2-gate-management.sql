-- =====================================================
-- ROCK 4 ONE - Database Update Script v2.2
-- Entry Gate Management System
-- =====================================================

-- =====================================================
-- 1. UPDATE USERS TABLE ROLE CONSTRAINT (if not done)
-- =====================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'admin', 'seller', 'entry_marshall'));

-- =====================================================
-- 2. ENTRY GATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS entry_gates (
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
    ('Side Gate A', 'SIDE-A', 'Side entrance near parking')
ON CONFLICT (gate_code) DO NOTHING;

-- =====================================================
-- 3. MARSHALL DUTY SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS marshall_duties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    marshall_id UUID NOT NULL REFERENCES users(id),
    gate_id UUID NOT NULL REFERENCES entry_gates(id),
    clock_in_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    clock_out_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'on_duty' CHECK (status IN ('on_duty', 'off_duty')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_marshall_duties_status ON marshall_duties(status);
CREATE INDEX IF NOT EXISTS idx_marshall_duties_marshall ON marshall_duties(marshall_id);
CREATE INDEX IF NOT EXISTS idx_marshall_duties_gate ON marshall_duties(gate_id);

-- =====================================================
-- 4. GUEST MOVEMENTS TABLE (Entry/Exit Log)
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guest_id UUID NOT NULL REFERENCES guests(id),
    gate_id UUID NOT NULL REFERENCES entry_gates(id),
    marshall_id UUID REFERENCES users(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_guest_movements_guest ON guest_movements(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_movements_gate ON guest_movements(gate_id);
CREATE INDEX IF NOT EXISTS idx_guest_movements_type ON guest_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_guest_movements_time ON guest_movements(created_at);

-- =====================================================
-- 5. UPDATE GUESTS TABLE
-- =====================================================

-- Add new columns for venue tracking
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_inside_venue BOOLEAN DEFAULT false;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_gate_id UUID REFERENCES entry_gates(id);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS entry_count INTEGER DEFAULT 0;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_movement_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES users(id);

-- Index for venue tracking
CREATE INDEX IF NOT EXISTS idx_guests_inside_venue ON guests(is_inside_venue);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);

-- =====================================================
-- 6. VIEWS FOR EASY REPORTING
-- =====================================================

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
-- 7. RLS POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE entry_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marshall_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_movements ENABLE ROW LEVEL SECURITY;

-- Policies for entry_gates (everyone can read, only super_admin can modify)
DROP POLICY IF EXISTS "Anyone can view gates" ON entry_gates;
CREATE POLICY "Anyone can view gates" ON entry_gates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert gates" ON entry_gates;
CREATE POLICY "Anyone can insert gates" ON entry_gates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update gates" ON entry_gates;
CREATE POLICY "Anyone can update gates" ON entry_gates FOR UPDATE USING (true);

-- Policies for marshall_duties
DROP POLICY IF EXISTS "Anyone can view duties" ON marshall_duties;
CREATE POLICY "Anyone can view duties" ON marshall_duties FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert duties" ON marshall_duties;
CREATE POLICY "Anyone can insert duties" ON marshall_duties FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update duties" ON marshall_duties;
CREATE POLICY "Anyone can update duties" ON marshall_duties FOR UPDATE USING (true);

-- Policies for guest_movements
DROP POLICY IF EXISTS "Anyone can view movements" ON guest_movements;
CREATE POLICY "Anyone can view movements" ON guest_movements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert movements" ON guest_movements;
CREATE POLICY "Anyone can insert movements" ON guest_movements FOR INSERT WITH CHECK (true);

-- =====================================================
-- COMPLETE!
-- =====================================================

SELECT 'Database update v2.2 completed - Entry Gate Management System added!' as status;
