-- SQL script to add room booking columns to the guests table

-- Add has_room_booking column if it doesn't exist
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS has_room_booking BOOLEAN DEFAULT false;

-- Add room_booking_amount column if it doesn't exist
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS room_booking_amount NUMERIC DEFAULT 0;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'guests' 
AND column_name IN ('has_room_booking', 'room_booking_amount');
