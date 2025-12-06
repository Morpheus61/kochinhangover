import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAuthUsers() {
    try {
        // Create Committee user
        const { data: committeeUser, error: committeeError } = await supabase.auth.signUp({
            email: 'Committee@kochinhangover.com',
            password: 'Kochin2025'
        });

        if (committeeError) throw committeeError;
        console.log('Created Committee user:', committeeUser);

        // Create Admin user
        const { data: adminUser, error: adminError } = await supabase.auth.signUp({
            email: 'Admin@kochinhangover.com',
            password: 'Kochin2025'
        });

        if (adminError) throw adminError;
        console.log('Created Admin user:', adminUser);

    } catch (error) {
        console.error('Error creating users:', error);
    }
}

createAuthUsers();
