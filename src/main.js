// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';

const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg';
const supabase = createClient(supabaseUrl, supabaseKey);

// App state
let currentUser = null;
let guests = [];
let qrScanner = null;

// Initialize the application
async function initializeApp() {
    console.log('Initializing application...');
    
    // Check for existing session
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        console.log('Found stored user session:', currentUser);
        showApp();
        await loadGuests();
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

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const registrationForm = document.getElementById('registrationForm');
const guestList = document.getElementById('guestList');
const dataStatus = document.getElementById('dataStatus');

// Tab elements
const tabButtons = document.querySelectorAll('[data-tab]');
const tabContents = document.querySelectorAll('[id$="Content"]');

// QR Scanner elements
const startScanBtn = document.getElementById('startScan');
const stopScanBtn = document.getElementById('stopScan');
const qrReaderResults = document.getElementById('qr-reader-results');

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
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        showApp();
        await loadGuests();
        
    } catch (error) {
        console.error('Login handling error:', error);
        showLoginError(error.message || 'Login failed');
    }
}

// Handle logout
async function handleLogout() {
    try {
        // Sign out from Supabase
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear local session
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        
        // Reset UI
        showLoginScreen();
        resetQRScanner();
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

// Load guests from Supabase
async function loadGuests() {
    try {
        updateDataStatus('Loading guest data...');
        
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        guests = data || [];
        renderGuestList();
        
        if (guests.length === 0) {
            updateDataStatus('No guest data found');
        } else {
            updateDataStatus(`${guests.length} guests loaded`);
        }
        
    } catch (error) {
        console.error('Error loading guests:', error);
        updateDataStatus('Failed to load guests');
    }
}

// Render guest list
function renderGuestList() {
    if (!guestList) return;
    
    guestList.innerHTML = guests.map(guest => `
        <tr class="border-b border-gray-700">
            <td class="py-3 px-4">${guest.name || 'N/A'}</td>
            <td class="py-3 px-4">${guest.mobile || 'N/A'}</td>
            <td class="py-3 px-4">${guest.entry_type === 'couple' ? 'Couple' : 'Stag'}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-full text-xs ${
                    guest.verified ? 'bg-green-500' : 'bg-yellow-500'
                }">
                    ${guest.verified ? 'Verified' : 'Pending'}
                </span>
            </td>
            <td class="py-3 px-4">
                <button class="text-blue-400 hover:text-blue-600 mr-2" onclick="verifyGuest('${guest.id}')">
                    <i class="fas fa-check"></i>
                </button>
                <button class="text-red-400 hover:text-red-600" onclick="deleteGuest('${guest.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Register new guest
async function registerGuest(guestData) {
    try {
        updateDataStatus('Registering guest...');
        
        const { data, error } = await supabase
            .from('guests')
            .insert([{
                name: guestData.name,
                mobile: guestData.mobile,
                entry_type: guestData.entryType,
                verified: false,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        await loadGuests();
        registrationForm.reset();
        updateDataStatus('Guest registered successfully');
        
    } catch (error) {
        console.error('Registration error:', error);
        updateDataStatus('Failed to register guest');
    }
}

// Verify guest
window.verifyGuest = async function(guestId) {
    try {
        updateDataStatus('Verifying guest...');
        
        const { error } = await supabase
            .from('guests')
            .update({ verified: true })
            .eq('id', guestId);
        
        if (error) throw error;
        
        await loadGuests();
        updateDataStatus('Guest verified');
        
    } catch (error) {
        console.error('Verification error:', error);
        updateDataStatus('Failed to verify guest');
    }
};

// Delete guest
window.deleteGuest = async function(guestId) {
    if (!confirm('Are you sure you want to delete this guest?')) return;
    
    try {
        updateDataStatus('Deleting guest...');
        
        const { error } = await supabase
            .from('guests')
            .delete()
            .eq('id', guestId);
        
        if (error) throw error;
        
        await loadGuests();
        updateDataStatus('Guest deleted');
        
    } catch (error) {
        console.error('Deletion error:', error);
        updateDataStatus('Failed to delete guest');
    }
};

// QR Code Scanner
function initializeQRScanner() {
    qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
    );
    
    qrScanner.render(onScanSuccess, onScanError);
    
    startScanBtn.classList.add('hidden');
    stopScanBtn.classList.remove('hidden');
}

function resetQRScanner() {
    if (qrScanner) {
        qrScanner.clear();
        qrScanner = null;
    }
    
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
    qrReaderResults.innerHTML = '';
}

function onScanSuccess(decodedText) {
    console.log('QR Code scanned:', decodedText);
    qrReaderResults.innerHTML = `
        <div class="bg-green-500 text-white p-3 rounded">
            <p>Scanned: ${decodedText}</p>
        </div>
    `;
    
    // Here you would typically verify the guest ID from the QR code
    // For now we just display the scanned content
}

function onScanError(error) {
    console.error('QR Scan error:', error);
    qrReaderResults.innerHTML = `
        <div class="bg-red-500 text-white p-3 rounded">
            <p>Scan error: ${error}</p>
        </div>
    `;
}

// Export functions
document.getElementById('exportCSV')?.addEventListener('click', exportToCSV);
document.getElementById('exportPDF')?.addEventListener('click', exportToPDF);

async function exportToCSV() {
    try {
        const csv = Papa.unparse(guests);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = 'kochin-hangover-guests.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        updateDataStatus('CSV exported successfully');
    } catch (error) {
        console.error('CSV export error:', error);
        updateDataStatus('Failed to export CSV');
    }
}

async function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.text('Kochin Hangover Guest List', 10, 10);
        doc.text(new Date().toLocaleString(), 180, 10, { align: 'right' });
        
        let y = 20;
        guests.forEach(guest => {
            doc.text(`${guest.name} - ${guest.mobile} (${guest.entry_type})`, 10, y);
            y += 10;
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
        });
        
        doc.save('kochin-hangover-guests.pdf');
        updateDataStatus('PDF exported successfully');
    } catch (error) {
        console.error('PDF export error:', error);
        updateDataStatus('Failed to export PDF');
    }
}

// Tab switching
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show corresponding content
            tabContents.forEach(content => content.classList.add('hidden'));
            document.getElementById(`${tabId}Content`)?.classList.remove('hidden');
            
            // Handle scanner when switching tabs
            if (tabId !== 'verification') {
                resetQRScanner();
            }
        });
    });
}

// Update data status message
function updateDataStatus(message) {
    if (dataStatus) {
        dataStatus.textContent = message;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            // In a real app, use proper authentication
            // This is just for demo purposes
            if (username === 'admin' && password === 'admin123') {
                await handleLogin({ id: 1, username: 'admin' });
            } else {
                throw new Error('Invalid credentials');
            }
        } catch (error) {
            showLoginError(error.message || 'Login failed');
        }
    });
    
    // Logout button
    logoutBtn?.addEventListener('click', handleLogout);
    
    // Registration form
    registrationForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const guestData = {
            name: document.getElementById('guestName').value,
            mobile: document.getElementById('mobileNumber').value,
            entryType: document.getElementById('entryType').value
        };
        
        await registerGuest(guestData);
    });
    
    // QR Scanner buttons
    startScanBtn?.addEventListener('click', initializeQRScanner);
    stopScanBtn?.addEventListener('click', resetQRScanner);
    
    // Setup tabs
    setupTabs();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

// Make functions available globally
window.verifyGuest = verifyGuest;
window.deleteGuest = deleteGuest;