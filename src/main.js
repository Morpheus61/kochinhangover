// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';

// Supabase configuration
const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg';
const supabase = createClient(supabaseUrl, supabaseKey);

// App state
let currentUser = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');

// Initialize the application
async function initializeApp() {
    console.log('Initializing application...');
    
    // Check for existing session
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        console.log('Found stored user session:', currentUser);
        showApp();
        return;
    }

    // Check Supabase auth session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Session check error:', error);
    }

    if (session?.user) {
        console.log('Valid session found:', session.user);
        await handleLogin(session.user);
        return;
    }

    showLoginScreen();
}

// Show login screen
function showLoginScreen() {
    console.log('Showing login screen');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
}

// Show main application
function showApp() {
    console.log('Showing main application');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
}

// Handle login
async function handleLogin(user) {
    try {
        console.log('Handling login for user:', user);
        
        // Store user in session
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        showApp();
        
    } catch (error) {
        console.error('Login handling error:', error);
        showLoginError(error.message || 'Login failed');
        showLoginScreen();
    }
}

// Handle logout
async function handleLogout() {
    try {
        console.log('Logging out user:', currentUser);
        
        // Sign out from Supabase
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear local session
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        
        showLoginScreen();
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

// Show login error
function showLoginError(message) {
    if (loginError) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                console.log('Attempting login with credentials');
                
                // Check against users table (replace with your actual auth logic)
                const { data: users, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .eq('password', password);
                
                if (error) throw error;
                
                if (!users || users.length === 0) {
                    throw new Error('Invalid username or password');
                }
                
                const user = users[0];
                await handleLogin(user);
                
            } catch (error) {
                console.error('Login error:', error);
                showLoginError(error.message || 'Login failed');
            }
        });
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    console.log(`Auth state changed: ${event}`, session);
    
    switch(event) {
        case 'SIGNED_IN':
            if (session?.user) {
                handleLogin(session.user);
            }
            break;
            
        case 'SIGNED_OUT':
            handleLogout();
            break;
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

// Make functions available globally if needed
window.showLoginScreen = showLoginScreen;
window.showApp = showApp;
window.handleLogout = handleLogout;