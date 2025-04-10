import { createClient } from '@supabase/supabase-js'
import { Html5QrcodeScanner } from 'html5-qrcode'
import QRCode from 'qrcode'

// Initialize Supabase client
const supabase = createClient(
    'https://rcedawlruorpkzzrvkqn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg'
)

// Initialize app state
let guests = []
let currentUser = null

// Constants for entry prices
const ENTRY_PRICES = {
    stag: 2750,
    couple: 4750
}

// Check if user is admin
function isAdmin() {
    return currentUser?.role === 'admin' || false
}

// Initialize app
async function initializeApp() {
    // Check if user is already logged in
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (session) {
        await handleLogin(session.user)
    } else {
        showLoginScreen()
    }
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value

    try {
        if (username === 'Admin' && password === 'Kochin2025') {
            currentUser = {
                id: 'admin',
                username: 'Admin',
                role: 'admin'
            }
            await handleLogin(currentUser)
        } else {
            throw new Error('Invalid credentials')
        }
    } catch (error) {
        console.error('Login error:', error)
        document.getElementById('loginError').textContent = 'Invalid username or password'
        document.getElementById('loginError').classList.remove('hidden')
    }
})

// Handle login
async function handleLogin(user) {
    try {
        currentUser = {
            ...user,
            role: 'admin' // For Admin user
        }
        
        showApp()
        showRegistration()
    } catch (error) {
        console.error('Error handling login:', error)
        document.getElementById('loginError').textContent = 'Failed to log in'
        document.getElementById('loginError').classList.remove('hidden')
        showLoginScreen()
    }
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden')
    document.getElementById('mainApp').classList.add('hidden')
}

// Show app
function showApp() {
    document.getElementById('loginScreen').classList.add('hidden')
    document.getElementById('mainApp').classList.remove('hidden')
}

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
    initializeApp()
    setupEventListeners()
})

// Setup event listeners
function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut()
        currentUser = null
        showLoginScreen()
    })

    // Tab buttons
    document.querySelectorAll('[id$="Tab"]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.id.replace('Tab', '')
            showTab(tabName)
        })
    })

    // Registration form
    document.getElementById('registrationForm')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        try {
            // Match the exact SQL structure and casing
            const guestData = {
                name: formData.get('name'),           // TEXT NOT NULL
                club: formData.get('clubName'),       // TEXT
                phone: formData.get('phone'),         // TEXT
                entry_type: formData.get('entryType'), // TEXT NOT NULL
                payment: formData.get('paymentStatus'), // TEXT NOT NULL
                status: 'pending',                     // TEXT DEFAULT 'pending'
                club_number: formData.get('clubNumber') // TEXT - exact casing as in Supabase
            }

            // Validate required fields
            if (!guestData.name || !guestData.entry_type || !guestData.payment) {
                throw new Error('Please fill in all required fields')
            }

            console.log('Attempting to insert guest:', guestData)

            const { data, error } = await supabase
                .from('guests')
                .insert([guestData])
                .select()

            if (error) {
                console.error('Insert error:', error)
                throw error
            }

            console.log('Guest registered:', data)
            
            // Reset form and reload guests
            e.target.reset()
            await loadGuests()
            
            // Show success message
            alert('Guest registered successfully!')
        } catch (error) {
            console.error('Error registering guest:', error)
            alert('Error: ' + error.message)
        }
    })

    // Show/hide partial payment field based on payment status
    document.querySelector('select[name="paymentStatus"]')?.addEventListener('change', (e) => {
        const partialPaymentField = document.getElementById('partialPaymentField')
        if (e.target.value === 'partial') {
            partialPaymentField?.classList.remove('hidden')
            partialPaymentField?.querySelector('input')?.setAttribute('required', 'required')
        } else {
            partialPaymentField?.classList.add('hidden')
            partialPaymentField?.querySelector('input')?.removeAttribute('required')
        }
    })

    // Beverage form
    document.getElementById('beverageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert([{
                    guest_code: formData.get('guestCode'),
                    beverage_type: formData.get('beverageType'),
                    served_by: currentUser.username
                }])
            
            if (error) throw error
            
            // Reset form and update transactions
            e.target.reset()
            await loadRecentTransactions()
        } catch (error) {
            console.error('Error adding beverage:', error)
            alert('Failed to add beverage')
        }
    })

    // Verification section
    document.getElementById('verificationTab')?.addEventListener('click', () => {
        showVerification()
    })

    // QR code scanner
    let html5QrcodeScanner = null;

    document.getElementById('startScan')?.addEventListener('click', () => {
        document.getElementById('startScan').style.display = 'none';
        document.getElementById('stopScan').style.display = 'inline-flex';
        
        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: {width: 250, height: 250} }
        );
        
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    });

    document.getElementById('stopScan')?.addEventListener('click', () => {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }
        document.getElementById('startScan').style.display = 'inline-flex';
        document.getElementById('stopScan').style.display = 'none';
        document.getElementById('qr-reader-results').innerHTML = '';
    });
}

// Show specific tab
function showTab(tabName) {
    // Hide all content sections
    document.querySelectorAll('[id$="Content"]').forEach(content => {
        content.classList.add('hidden')
    })
    
    // Remove active class from all tabs
    document.querySelectorAll('[id$="Tab"]').forEach(tab => {
        tab.classList.remove('active')
    })
    
    // Show selected content and activate tab
    document.getElementById(`${tabName}Content`)?.classList.remove('hidden')
    document.getElementById(`${tabName}Tab`)?.classList.add('active')
}

// Load guests from Supabase
async function loadGuests() {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (error) throw error
        
        guests = data
        updateGuestList()
    } catch (error) {
        console.error('Error loading guests:', error)
    }
}

// Update guest list in the UI
function updateGuestList() {
    const tbody = document.getElementById('guestsTableBody')
    if (!tbody) return

    tbody.innerHTML = guests.map(guest => `
        <tr>
            <td class="py-3 px-4">${guest.name || ''}</td>
            <td class="py-3 px-4">${guest.club || ''}</td>
            <td class="py-3 px-4">${guest.phone || ''}</td>
            <td class="py-3 px-4">${guest.entry_type || ''}</td>
            <td class="py-3 px-4">${guest.payment || ''}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-full text-xs ${
                    guest.status === 'checked_in' ? 'bg-green-500' : 'bg-yellow-500'
                }">
                    ${guest.status || 'pending'}
                </span>
            </td>
            <td class="py-3 px-4">
                <button class="text-blue-400 hover:text-blue-600 mr-2" onclick="viewGuest('${guest.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="text-green-400 hover:text-green-600" onclick="checkInGuest('${guest.id}')">
                    <i class="fas fa-check-circle"></i>
                </button>
            </td>
        </tr>
    `).join('')
}

// Load recent transactions
async function loadRecentTransactions() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)
        
        if (error) throw error
        
        updateTransactionList(data)
    } catch (error) {
        console.error('Error loading transactions:', error)
    }
}

// Update transaction list in the UI
function updateTransactionList(transactions) {
    const container = document.getElementById('recentTransactions')
    if (!container) return

    container.innerHTML = transactions.map(tx => `
        <div class="transaction-item">
            <div class="details">
                <div class="font-medium">${tx.guest_code}</div>
                <div class="time">${new Date(tx.created_at).toLocaleString()}</div>
            </div>
            <div class="amount">${tx.beverage_type}</div>
        </div>
    `).join('')
}

// Initialize the application
window.viewGuest = async (id) => {
    // Implement guest details view
}

window.checkInGuest = async (id) => {
    try {
        const { error } = await supabase
            .from('guests')
            .update({ status: 'checked_in' })
            .eq('id', id)
        
        if (error) throw error
        
        await loadGuests()
    } catch (error) {
        console.error('Error checking in guest:', error)
        alert('Failed to check in guest')
    }
}

// Show verification section
function showVerification() {
    document.getElementById('registrationSection').style.display = 'none';
    document.getElementById('verificationSection').style.display = 'block';
    loadVerificationList();
}

// Show registration section
function showRegistration() {
    document.getElementById('registrationSection').style.display = 'block';
    document.getElementById('verificationSection').style.display = 'none';
}

// Load verification list with QR codes
async function loadVerificationList() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('verificationTableBody');
        if (!tbody) return;

        tbody.innerHTML = guests.map(guest => {
            // Generate QR code data
            const qrData = JSON.stringify({
                id: guest.id,
                name: guest.name,
                entry_type: guest.entry_type,
                payment: guest.payment
            });

            return `
                <tr class="border-b border-gray-700">
                    <td class="py-3 px-4">${guest.name || ''}</td>
                    <td class="py-3 px-4">${guest.club || ''}</td>
                    <td class="py-3 px-4">${guest.entry_type || ''}</td>
                    <td class="py-3 px-4">${guest.payment || ''}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded-full text-xs ${
                            guest.status === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
                        }">
                            ${guest.status || 'pending'}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="qr-code" data-qr="${encodeURIComponent(qrData)}"></div>
                    </td>
                    <td class="py-3 px-4">
                        <button class="text-blue-400 hover:text-blue-600" onclick="verifyGuest('${guest.id}')">
                            <i class="fas fa-check-circle"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Generate QR codes for each guest
        document.querySelectorAll('.qr-code').forEach(qrDiv => {
            const qrData = decodeURIComponent(qrDiv.dataset.qr);
            new QRCode(qrDiv, {
                text: qrData,
                width: 64,
                height: 64
            });
        });
    } catch (error) {
        console.error('Error loading verification list:', error);
    }
}

// Handle successful QR code scan
async function onScanSuccess(decodedText) {
    try {
        const guestData = JSON.parse(decodedText);
        
        // Verify guest in database
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestData.id)
            .single();

        if (error) throw error;

        const resultsDiv = document.getElementById('qr-reader-results');
        
        if (guest.payment === 'Paid') {
            resultsDiv.innerHTML = `
                <div class="bg-green-600 text-white p-4 rounded">
                    <h3 class="font-bold">✓ VERIFIED</h3>
                    <p>Name: ${guest.name}</p>
                    <p>Entry Type: ${guest.entry_type}</p>
                </div>
            `;
            
            // Update guest status to verified
            await verifyGuest(guest.id);
        } else {
            resultsDiv.innerHTML = `
                <div class="bg-red-600 text-white p-4 rounded">
                    <h3 class="font-bold">✗ NOT PAID</h3>
                    <p>Name: ${guest.name}</p>
                    <p>Payment Status: ${guest.payment}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error processing QR code:', error);
        document.getElementById('qr-reader-results').innerHTML = `
            <div class="bg-red-600 text-white p-4 rounded">
                <h3 class="font-bold">✗ Invalid QR Code</h3>
                <p>Please try again</p>
            </div>
        `;
    }
}

function onScanFailure(error) {
    // Handle scan failure silently
    console.warn(`QR code scanning failed: ${error}`);
}

// Verify a guest's entry
async function verifyGuest(guestId) {
    try {
        const { error } = await supabase
            .from('guests')
            .update({ status: 'verified' })
            .eq('id', guestId);

        if (error) throw error;

        // Refresh the verification list
        await loadVerificationList();
    } catch (error) {
        console.error('Error verifying guest:', error);
        alert('Failed to verify guest');
    }
}
