// Initialize the application
async function initializeApp() {
    // Check if we're on the login page
    if (window.location.pathname.includes('login')) {
        // Already on login page, no need to check auth
        return;
    }

    // Get user from session
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) {
        // No user in session, redirect to login
        window.location.href = 'login';
        return;
    }

    // Set current user
    currentUser = user;

    // Show main app
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    await setupNavigation();
    await showTab('registration');
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorText = document.getElementById('loginError');

    try {
        console.log('Attempting login with:', username);
        
        // Check credentials against users table
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password);

        console.log('Login response:', { users, error });

        if (error) {
            console.error('Database error:', error);
            throw new Error('Login failed');
        }

        if (!users || users.length === 0) {
            throw new Error('Invalid username or password');
        }

        const user = users[0];
        
        // Store user info in session
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        console.log('User stored in session:', user);

        // Set current user
        currentUser = user;

        // Hide login screen and show main app
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');

        // Initialize app components
        await setupNavigation();
        await showTab('registration');
        
    } catch (error) {
        console.error('Login error:', error);
        if (errorText) {
            errorText.textContent = 'Invalid credentials';
            errorText.classList.remove('hidden');
        } else {
            alert('Invalid credentials');
        }
    }
}

// Handle logout
async function handleLogout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login';
}

// Initialize Supabase client
import { createClient } from '@supabase/supabase-js'
import { Html5QrcodeScanner } from 'html5-qrcode'
import QRCode from 'qrcode'

const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg'
const supabase = createClient(supabaseUrl, supabaseKey)

// Initialize app state
let currentUser = null
let guests = []
let users = []

// Constants for entry prices
const ENTRY_PRICES = {
    single: 2750,
    couple: 4750
}

// Check if user is admin
function isAdmin() {
    return currentUser?.role === 'admin' || false
}

// DOM element checks
function checkDOMElements() {
    const elements = {
        loginScreen: document.getElementById('loginScreen'),
        mainApp: document.getElementById('mainApp'),
        loginForm: document.getElementById('loginForm'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        loginError: document.getElementById('loginError')
    }
    
    console.log('DOM elements check:', elements)
    
    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Critical UI element missing: ${name}`)
            return false
        }
    }
    return true
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('Found login form, attaching handler');
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.log('Login form not found');
        // Try finding the form by class
        const loginFormByClass = document.querySelector('form.login-form');
        if (loginFormByClass) {
            console.log('Found login form by class, attaching handler');
            loginFormByClass.addEventListener('submit', handleLogin);
        }
    }

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout)

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
                club: formData.get('club_name'),       // TEXT
                phone: formData.get('mobile_number'),         // TEXT
                entry_type: formData.get('entry_type'), // TEXT NOT NULL
                payment: formData.get('payment_mode'), // TEXT NOT NULL
                status: 'pending',                     // TEXT DEFAULT 'pending'
                club_number: formData.get('club_number') // TEXT - exact casing as in Supabase
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

            if (error) throw error

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
    document.querySelector('select[name="payment_mode"]')?.addEventListener('change', (e) => {
        const partialPaymentField = document.getElementById('partialPaymentField')
        if (e.target.value === 'partial') {
            partialPaymentField?.classList.remove('hidden')
            partialPaymentField?.querySelector('input')?.setAttribute('required', 'required')
        } else {
            partialPaymentField?.classList.add('hidden')
            partialPaymentField?.querySelector('input')?.removeAttribute('required')
        }
    })

    // Verification section
    document.getElementById('verificationTab')?.addEventListener('click', () => {
        showVerification()
    })

    // QR code scanner
    let html5QrcodeScanner = null;

    document.getElementById('startScan')?.addEventListener('click', () => {
        document.getElementById('startScan').classList.add('hidden');
        document.getElementById('stopScan').classList.remove('hidden');
        
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
        document.getElementById('startScan').classList.remove('hidden');
        document.getElementById('stopScan').classList.add('hidden');
        document.getElementById('qr-reader-results').innerHTML = '';
    });

    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tabId = btn.getAttribute('data-tab');
            await showTab(tabId);
        });
    });

    // Download buttons
    document.getElementById('downloadGuestsPDFBtn')?.addEventListener('click', downloadGuestsPDF);
    document.getElementById('downloadGuestsCSVBtn')?.addEventListener('click', downloadGuestsCSV);
    document.getElementById('downloadStatsPDFBtn')?.addEventListener('click', downloadStatsPDF);
    document.getElementById('downloadStatsCSVBtn')?.addEventListener('click', downloadStatsCSV);

    // WhatsApp share button
    document.getElementById('shareWhatsAppBtn')?.addEventListener('click', () => {
        const selectedGuest = document.querySelector('tr.selected-guest');
        if (selectedGuest) {
            const guestId = selectedGuest.getAttribute('data-guest-id');
            shareOnWhatsApp(guestId);
        } else {
            alert('Please select a guest first');
        }
    });

    // WhatsApp share buttons
    document.querySelectorAll('.whatsapp-share').forEach(button => {
        button.addEventListener('click', (e) => {
            const guestId = e.currentTarget.dataset.guestId
            if (guestId) {
                shareGuestPass(guestId)
            }
        })
    })

    // Download buttons
    document.getElementById('downloadGuestsPDF')?.addEventListener('click', downloadGuestsPDF);
    document.getElementById('downloadGuestsCSV')?.addEventListener('click', downloadGuestsCSV);
    document.getElementById('downloadStatsPDF')?.addEventListener('click', downloadStatsPDF);
    document.getElementById('downloadStatsCSV')?.addEventListener('click', downloadStatsCSV);
}

// Show specific tab
async function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabId)?.classList.remove('hidden');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

    // Special handling for specific tabs
    if (tabId === 'guests') {
        await refreshGuestList();
    } else if (tabId === 'stats') {
        await updateStats();
    }
}

// Initialize QR Scanner
function initQRScanner() {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader", 
        {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            defaultZoomValueIfSupported: 2
        }
    )
    
    html5QrcodeScanner.render(async (decodedText) => {
        try {
            // Parse the QR code data
            const guestData = JSON.parse(decodedText)
            
            // Get the latest guest data from Supabase
            const { data: guest, error } = await supabase
                .from('guests')
                .select('*')
                .eq('id', guestData.id)
                .single()
            
            if (error) throw error
            
            if (!guest) {
                throw new Error('Guest not found')
            }
            
            // Show verification result modal
            const modal = document.createElement('div')
            modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4'
            modal.innerHTML = `
                <div class="bg-[#2a0e3a] p-6 rounded-lg max-w-md w-full">
                    <div class="text-center mb-6">
                        <i class="fas fa-check-circle text-4xl ${guest.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}"></i>
                        <h3 class="text-2xl font-bold mt-2">Guest Details</h3>
                    </div>
                    
                    <div class="space-y-4 mb-6">
                        <div class="flex justify-between">
                            <span class="text-gray-300">Name</span>
                            <span class="font-bold">${guest.guest_name}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Club</span>
                            <span class="font-bold">${guest.club_name}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Entry Type</span>
                            <span class="font-bold">${guest.entry_type}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Status</span>
                            <span class="font-bold ${guest.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}">
                                ${guest.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                        </div>
                    </div>
                    
                    <div class="flex space-x-4">
                        <button onclick="verifyGuest('${guest.id}')" class="kochin-button flex-1">
                            <i class="fas fa-check mr-2"></i> Verify Entry
                        </button>
                        <button onclick="this.closest('.fixed').remove()" class="kochin-button bg-gray-700 flex-1">
                            Close
                        </button>
                    </div>
                </div>
            `
            document.body.appendChild(modal)
            
            // Stop scanning
            html5QrcodeScanner.pause()
            
        } catch (error) {
            console.error('Error verifying guest:', error)
            alert(error.message || 'Failed to verify guest')
        }
    })
    
    // Store scanner instance for cleanup
    window.qrScanner = html5QrcodeScanner
}

// Verify guest entry
window.verifyGuest = async function(guestId) {
    try {
        const { data: guest, error } = await supabase
            .from('guests')
            .update({ verified: true, verified_at: new Date().toISOString() })
            .eq('id', guestId)
            .select()
            .single()
        
        if (error) throw error
        
        // Show success message
        alert('Guest verified successfully!')
        
        // Remove verification modal
        document.querySelector('.fixed').remove()
        
        // Resume scanning
        window.qrScanner.resume()
        
    } catch (error) {
        console.error('Error verifying guest:', error)
        alert(error.message || 'Failed to verify guest')
    }
}

// Cleanup QR scanner when switching views
function cleanupQRScanner() {
    if (window.qrScanner) {
        window.qrScanner.clear()
        window.qrScanner = null
    }
}

// Load guest list
async function loadGuestList() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (error) throw error
        
        const tbody = document.getElementById('guestListTableBody')
        if (!tbody) return
        
        tbody.innerHTML = guests.map(guest => `
            <tr class="border-b border-gray-700">
                <td class="py-3 px-4">${guest.guest_name || ''}</td>
                <td class="py-3 px-4">${guest.club_name || ''}</td>
                <td class="py-3 px-4">${guest.entry_type || ''}</td>
                <td class="py-3 px-4">₹${guest.paid_amount} / ₹${guest.total_amount}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs ${
                        guest.status === 'verified' ? 'bg-green-500' :
                        guest.status === 'paid' ? 'bg-blue-500' :
                        guest.status === 'partially_paid' ? 'bg-yellow-500' :
                        'bg-red-500'
                    }">
                        ${guest.status || 'pending'}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <button class="text-blue-400 hover:text-blue-600 mr-2" onclick="editGuest('${guest.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-400 hover:text-red-600 mr-2" onclick="deleteGuest('${guest.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="whatsapp-share text-green-400 hover:text-green-600" data-guest-id="${guest.id}">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                </td>
            </tr>
        `).join('')

        // Re-attach WhatsApp share event listeners
        setupEventListeners()
        
    } catch (error) {
        console.error('Error loading guest list:', error)
    }
}

// Get status class for styling
function getStatusClass(status) {
    switch (status) {
        case 'paid':
            return 'bg-green-900 text-green-300'
        case 'partially_paid':
            return 'bg-yellow-900 text-yellow-300'
        case 'verified':
            return 'bg-blue-900 text-blue-300'
        case 'denied':
            return 'bg-red-900 text-red-300'
        default:
            return 'bg-gray-900 text-gray-300'
    }
}

// Load statistics
async function loadStats() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
        
        if (error) throw error
        
        // Calculate total stats
        const stats = {
            totalRegistrations: guests.length,
            totalAmount: guests.reduce((sum, guest) => sum + guest.paid_amount, 0)
        }
        
        document.getElementById('totalRegistrations').textContent = stats.totalRegistrations
        document.getElementById('totalAmount').textContent = `₹${stats.totalAmount}`
        
        // Calculate club-wise stats
        const clubStats = {}
        guests.forEach(guest => {
            if (!clubStats[guest.club_name]) {
                clubStats[guest.club_name] = {
                    totalGuests: 0,
                    totalAmount: 0
                }
            }
            clubStats[guest.club_name].totalGuests++
            clubStats[guest.club_name].totalAmount += guest.paid_amount
        })
        
        // Sort clubs by total guests
        const sortedClubs = Object.entries(clubStats)
            .sort((a, b) => b[1].totalGuests - a[1].totalGuests)
        
        // Update club stats table
        const clubStatsTable = document.getElementById('clubStats')
        if (clubStatsTable) {
            clubStatsTable.innerHTML = sortedClubs.map(([club, stats]) => `
                <tr class="border-t border-gray-700">
                    <td class="py-3 px-4">${club}</td>
                    <td class="py-3 px-4">${stats.totalGuests}</td>
                    <td class="py-3 px-4">₹${stats.totalAmount}</td>
                </tr>
            `).join('')
        }
        
    } catch (error) {
        console.error('Error loading stats:', error)
    }
}

// Edit guest
window.editGuest = async function(guestId) {
    try {
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single()
        
        if (error) throw error
        
        // Show edit modal
        const modal = document.createElement('div')
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'
        modal.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md">
                <h3 class="text-lg font-bold mb-4">Edit Guest</h3>
                <form id="editGuestForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Name</label>
                        <input type="text" id="editGuestName" value="${guest.guest_name}" class="kochin-input w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Club Name</label>
                        <input type="text" id="editClubName" value="${guest.club_name}" class="kochin-input w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Mobile Number</label>
                        <input type="tel" id="editMobileNumber" value="${guest.mobile_number}" class="kochin-input w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Entry Type</label>
                        <select id="editEntryType" class="kochin-input w-full">
                            <option value="stag" ${guest.entry_type === 'stag' ? 'selected' : ''}>Stag (₹2750)</option>
                            <option value="couple" ${guest.entry_type === 'couple' ? 'selected' : ''}>Couple (₹4750)</option>
                        </select>
                    </div>
                    <div class="flex space-x-4">
                        <button type="submit" class="kochin-button flex-1">Save Changes</button>
                        <button type="button" onclick="this.closest('.fixed').remove()" class="kochin-button bg-gray-700 flex-1">Cancel</button>
                    </div>
                </form>
            </div>
        `
        document.body.appendChild(modal)
        
        // Handle form submission
        document.getElementById('editGuestForm').addEventListener('submit', async (e) => {
            e.preventDefault()
            
            const updates = {
                guest_name: document.getElementById('editGuestName').value,
                club_name: document.getElementById('editClubName').value,
                mobile_number: document.getElementById('editMobileNumber').value,
                entry_type: document.getElementById('editEntryType').value,
                total_amount: document.getElementById('editEntryType').value === 'stag' ? 2750 : 4750
            }
            
            const { error: updateError } = await supabase
                .from('guests')
                .update(updates)
                .eq('id', guestId)
            
            if (updateError) throw updateError
            
            modal.remove()
            loadGuestList() // Refresh the list
            alert('Guest updated successfully!')
        })
        
    } catch (error) {
        console.error('Error editing guest:', error)
        alert(error.message || 'Failed to edit guest')
    }
}

// Delete guest
window.deleteGuest = async function(guestId) {
    if (!confirm('Are you sure you want to delete this guest? This action cannot be undone.')) {
        return
    }
    
    try {
        const { error } = await supabase
            .from('guests')
            .delete()
            .eq('id', guestId)
        
        if (error) throw error
        
        loadGuestList() // Refresh the list
        alert('Guest deleted successfully!')
        
    } catch (error) {
        console.error('Error deleting guest:', error)
        alert(error.message || 'Failed to delete guest')
    }
}

// Share guest pass on WhatsApp
async function shareGuestPass(guestId) {
    try {
        // Get guest details
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single()
        
        if (error) throw error
        if (!guest) throw new Error('Guest not found')
        
        // Generate QR code
        const qrData = {
            id: guest.id,
            guest_name: guest.guest_name,
            entry_type: guest.entry_type,
            mobile_number: guest.mobile_number,
            status: guest.status,
            paid_amount: guest.paid_amount,
            total_amount: guest.total_amount
        }
        
        const qrCode = await QRCode.toDataURL(JSON.stringify(qrData))
        
        // Create pass message
        const message = `🎉 *KOCHIN HANGOVER PASS* 🎉\n\n` +
            `Name: ${guest.guest_name}\n` +
            `Entry Type: ${guest.entry_type}\n` +
            `Amount: ₹${guest.paid_amount} / ₹${guest.total_amount}\n` +
            `Status: ${guest.status}\n\n` +
            `Show this QR code at entry:`
        
        // Open WhatsApp with message
        const whatsappUrl = `https://wa.me/${guest.mobile_number}?text=${encodeURIComponent(message)}`
        window.open(whatsappUrl, '_blank')
        
    } catch (error) {
        console.error('Share pass error:', error)
        alert('Failed to share pass: ' + error.message)
    }
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

// Show verification section
function showVerification() {
    hideAllSections()
    const verificationContent = document.getElementById('verificationContent')
    if (verificationContent) {
        verificationContent.classList.remove('hidden')
    }
}

// Hide all sections
function hideAllSections() {
    const sections = [
        'registrationContent',
        'verificationContent',
        'guestListContent',
        'statsContent'
    ]
    
    sections.forEach(id => {
        const element = document.getElementById(id)
        if (element) {
            element.classList.add('hidden')
        }
    })
}

// Initialize verification scanner
function initializeVerification() {
    let html5QrcodeScanner = null
    const startButton = document.getElementById('startVerificationScan')
    const stopButton = document.getElementById('stopVerificationScan')
    const resultDiv = document.getElementById('verificationResult')
    
    startButton?.addEventListener('click', () => {
        startButton.classList.add('hidden')
        stopButton.classList.remove('hidden')
        resultDiv.classList.add('hidden')
        
        html5QrcodeScanner = new Html5QrcodeScanner(
            "verification-qr-reader",
            { fps: 10, qrbox: {width: 250, height: 250} }
        )
        
        html5QrcodeScanner.render(async (decodedText) => {
            try {
                // Parse QR data
                const qrData = JSON.parse(decodedText)
                
                // Fetch guest details from Supabase
                const { data: guestData, error } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('id', qrData.id)
                    .single()

                if (error) throw error

                const resultsDiv = document.getElementById('verificationGuestName').textContent = guestData.guest_name
                document.getElementById('verificationEntryType').textContent = guestData.entry_type
                document.getElementById('verificationMobile').textContent = guestData.mobile_number
                document.getElementById('verificationStatus').textContent = guestData.status
                
                // Show verification result
                resultDiv.classList.remove('hidden')
                
                // Stop scanner
                if (html5QrcodeScanner) {
                    html5QrcodeScanner.clear()
                    html5QrcodeScanner = null
                }
                startButton.classList.remove('hidden')
                stopButton.classList.add('hidden')
                
                // Add verify/deny handlers
                document.getElementById('verifyEntry')?.addEventListener('click', async () => {
                    try {
                        const { data, error } = await supabase
                            .from('guests')
                            .update({ status: 'verified', verified_at: new Date().toISOString() })
                            .eq('id', qrData.id)
                        
                        if (error) throw error
                        
                        alert('Guest entry verified successfully!')
                        resultDiv.classList.add('hidden')
                    } catch (error) {
                        console.error('Verification error:', error)
                        alert('Failed to verify guest entry')
                    }
                })
                
                document.getElementById('denyEntry')?.addEventListener('click', async () => {
                    try {
                        const { data, error } = await supabase
                            .from('guests')
                            .update({ status: 'denied', denied_at: new Date().toISOString() })
                            .eq('id', qrData.id)
                        
                        if (error) throw error
                        
                        alert('Guest entry denied')
                        resultDiv.classList.add('hidden')
                    } catch (error) {
                        console.error('Deny error:', error)
                        alert('Failed to deny guest entry')
                    }
                })
                
            } catch (error) {
                console.error('QR code error:', error)
                alert('Invalid or expired QR code')
            }
        })
    })
    
    stopButton?.addEventListener('click', () => {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear()
            html5QrcodeScanner = null
        }
        startButton.classList.remove('hidden')
        stopButton.classList.add('hidden')
        resultDiv.classList.add('hidden')
    })
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
                    <p>Name: ${guest.guest_name}</p>
                    <p>Entry Type: ${guest.entry_type}</p>
                </div>
            `;
            
            // Update guest status to verified
            await verifyGuest(guest.id);
        } else {
            resultsDiv.innerHTML = `
                <div class="bg-red-600 text-white p-4 rounded">
                    <h3 class="font-bold">✗ NOT PAID</h3>
                    <p>Name: ${guest.guest_name}</p>
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
                guest_name: guest.guest_name,
                entry_type: guest.entry_type,
                mobile_number: guest.mobile_number
            });

            return `
                <tr class="border-b border-gray-700">
                    <td class="py-3 px-4">${guest.guest_name || ''}</td>
                    <td class="py-3 px-4">${guest.club_name || ''}</td>
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

// Initialize users management
async function initializeUsers() {
    const usersList = document.getElementById('usersList')
    const addUserForm = document.getElementById('addUserForm')
    const addUserError = document.getElementById('addUserError')

    // Load existing users
    await loadUsers()

    // Handle add user form submission
    addUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault()
        
        const username = document.getElementById('newUsername').value
        const password = document.getElementById('newPassword').value
        const role = document.getElementById('newRole').value
        
        try {
            const { data, error } = await supabase
                .from('users')
                .insert([
                    { username, password, role }
                ])
                .select()
            
            if (error) throw error
            
            // Clear form and reload users
            addUserForm.reset()
            await loadUsers()
            addUserError.textContent = ''
            addUserError.classList.add('hidden')
            
        } catch (error) {
            console.error('Add user error:', error)
            addUserError.textContent = error.message
            addUserError.classList.remove('hidden')
        }
    })
}

// Load users list
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('username')
        
        if (error) throw error
        
        // Update users list UI
        const usersList = document.getElementById('usersList')
        usersList.innerHTML = ''
        
        users.forEach(user => {
            const row = document.createElement('tr')
            row.innerHTML = `
                <td class="px-4 py-2">${user.username}</td>
                <td class="px-4 py-2">${user.role}</td>
                <td class="px-4 py-2">
                    <button class="delete-user bg-red-500 text-white px-2 py-1 rounded" data-id="${user.id}">
                        Delete
                    </button>
                </td>
            `
            usersList.appendChild(row)
        })
        
        // Add delete event listeners
        document.querySelectorAll('.delete-user').forEach(button => {
            button.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this user?')) return
                
                const userId = button.dataset.id
                
                try {
                    const { error } = await supabase
                        .from('users')
                        .delete()
                        .eq('id', userId)
                    
                    if (error) throw error
                    
                    // Reload users list
                    await loadUsers()
                    
                } catch (error) {
                    console.error('Delete user error:', error)
                    alert('Failed to delete user: ' + error.message)
                }
            })
        })
        
    } catch (error) {
        console.error('Load users error:', error)
    }
}

// Initialize registration form
function initializeRegistration() {
    const form = document.getElementById('registrationForm')
    if (!form) return
    
    // Set initial amount display
    updateAmount()
    
    // Handle payment mode changes
    const paymentMode = document.getElementById('paymentMode')
    const partialSection = document.getElementById('partialPaymentSection')
    const paidAmountInput = document.getElementById('paidAmount')
    
    paymentMode?.addEventListener('change', () => {
        if (paymentMode.value === 'partial') {
            partialSection?.classList.remove('hidden')
            paidAmountInput?.setAttribute('required', 'required')
        } else {
            partialSection?.classList.add('hidden')
            paidAmountInput?.removeAttribute('required')
        }
    })
    
    // Update amount when entry type changes
    document.getElementById('entryType')?.addEventListener('change', updateAmount)
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        
        try {
            // Get form data
            const entryType = document.getElementById('entryType').value
            const paymentMode = document.getElementById('paymentMode').value
            const totalAmount = entryType === 'stag' ? 2750 : 4750
            
            let paidAmount = totalAmount // Default to full amount
            if (paymentMode === 'partial') {
                paidAmount = Number(document.getElementById('paidAmount').value)
                if (!paidAmount || paidAmount <= 0 || paidAmount >= totalAmount) {
                    alert('Please enter a valid partial payment amount (greater than 0 and less than total amount)')
                    return
                }
            }
            
            const formData = {
                guest_name: document.getElementById('guestName').value,
                club_name: document.getElementById('clubName').value,
                mobile_number: document.getElementById('mobileNumber').value,
                entry_type: entryType,
                payment_mode: paymentMode,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                registration_date: new Date().toISOString(),
                status: paymentMode === 'partial' ? 'partially_paid' : 'paid'
            }
            
            // Validate required fields
            const requiredFields = ['guest_name', 'mobile_number', 'entry_type', 'payment_mode']
            const missingFields = requiredFields.filter(field => !formData[field])
            
            if (missingFields.length > 0) {
                alert('Please fill in all required fields')
                return
            }
            
            // Validate mobile number
            if (!/^[0-9]{10}$/.test(formData.mobile_number)) {
                alert('Please enter a valid 10-digit mobile number')
                return
            }
            
            // Insert into Supabase
            const { data, error } = await supabase
                .from('guests')
                .insert([formData])
                .select()

            if (error) throw error

            console.log('Guest registered:', data)
            
            // Reset form
            form.reset()
            updateAmount()
            partialSection?.classList.add('hidden')
            paidAmountInput?.removeAttribute('required')
            
            // Refresh guest list immediately
            await loadGuestList()
            await loadStats()
            
        } catch (error) {
            console.error('Registration error:', error)
            alert(error.message || 'Failed to register guest')
        }
    })
}

// Update amount based on entry type
window.updateAmount = function() {
    const entryType = document.getElementById('entryType').value
    const totalAmountDisplay = document.getElementById('totalAmountDisplay')
    const paidAmountInput = document.getElementById('paidAmount')
    const totalAmount = entryType === 'stag' ? 2750 : 4750
    
    if (totalAmountDisplay) {
        totalAmountDisplay.textContent = `/ ₹${totalAmount} total`
    }
    
    if (paidAmountInput) {
        paidAmountInput.max = totalAmount - 100 // At least ₹100 should be paid at entry
    }
}

// Download functions
async function downloadGuestsPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set theme colors
        const primary = '#e83283';
        const secondary = '#34dbdb';
        const dark = '#2a0e3a';
        
        // Add header
        doc.setFillColor(hexToRgb(dark).r, hexToRgb(dark).g, hexToRgb(dark).b);
        doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
        
        doc.setTextColor(hexToRgb(primary).r, hexToRgb(primary).g, hexToRgb(primary).b);
        doc.setFontSize(24);
        doc.text('Kochin Hangover', 105, 20, { align: 'center' });
        
        doc.setTextColor(hexToRgb(secondary).r, hexToRgb(secondary).g, hexToRgb(secondary).b);
        doc.setFontSize(16);
        doc.text('Guest List', 105, 30, { align: 'center' });
        
        // Add current date
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(new Date().toLocaleDateString(), 195, 20, { align: 'right' });
        
        // Get guest data
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Add table headers
        const headers = ['Name', 'Club', 'Entry Type', 'Amount', 'Status'];
        let yPos = 50;
        const cellWidth = 38;
        
        doc.setFillColor(hexToRgb(dark).r, hexToRgb(dark).g, hexToRgb(dark).b);
        doc.rect(10, yPos - 5, doc.internal.pageSize.width - 20, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        headers.forEach((header, i) => {
            doc.text(header, 15 + (i * cellWidth), yPos);
        });
        
        // Add guest rows
        yPos += 10;
        doc.setTextColor(40);
        
        guests.forEach((guest, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
            const row = [
                guest.guest_name,
                guest.club_name,
                guest.entry_type,
                `₹${guest.paid_amount} / ₹${guest.total_amount}`,
                guest.status
            ];
            
            // Alternate row background
            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(10, yPos - 5, doc.internal.pageSize.width - 20, 10, 'F');
            }
            
            row.forEach((cell, i) => {
                doc.text(String(cell || ''), 15 + (i * cellWidth), yPos);
            });
            
            yPos += 10;
        });
        
        // Save the PDF
        doc.save('kochin-hangover-guests.pdf');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF');
    }
}

async function downloadGuestsCSV() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const csvData = guests.map(guest => ({
            Name: guest.guest_name,
            Club: guest.club_name,
            'Entry Type': guest.entry_type,
            'Total Amount': guest.total_amount,
            'Paid Amount': guest.paid_amount,
            Status: guest.status,
            'Registration Date': new Date(guest.created_at).toLocaleString()
        }));
        
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'kochin-hangover-guests.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        alert('Failed to generate CSV');
    }
}

async function downloadStatsPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set theme colors
        const primary = '#e83283';
        const secondary = '#34dbdb';
        const dark = '#2a0e3a';
        
        // Add header
        doc.setFillColor(hexToRgb(dark).r, hexToRgb(dark).g, hexToRgb(dark).b);
        doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
        
        doc.setTextColor(hexToRgb(primary).r, hexToRgb(primary).g, hexToRgb(primary).b);
        doc.setFontSize(24);
        doc.text('Kochin Hangover', 105, 20, { align: 'center' });
        
        doc.setTextColor(hexToRgb(secondary).r, hexToRgb(secondary).g, hexToRgb(secondary).b);
        doc.setFontSize(16);
        doc.text('Event Statistics', 105, 30, { align: 'center' });
        
        // Add current date
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(new Date().toLocaleDateString(), 195, 20, { align: 'right' });
        
        // Get stats data
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) throw error;
        
        // Calculate statistics
        const totalGuests = guests.length;
        const totalAmount = guests.reduce((sum, guest) => sum + guest.total_amount, 0);
        const paidAmount = guests.reduce((sum, guest) => sum + guest.paid_amount, 0);
        
        // Club-wise statistics
        const clubStats = {};
        guests.forEach(guest => {
            if (!clubStats[guest.club_name]) {
                clubStats[guest.club_name] = {
                    guests: 0,
                    amount: 0
                };
            }
            clubStats[guest.club_name].guests++;
            clubStats[guest.club_name].amount += guest.total_amount;
        });
        
        // Add summary
        let yPos = 50;
        
        doc.setFontSize(14);
        doc.setTextColor(hexToRgb(primary).r, hexToRgb(primary).g, hexToRgb(primary).b);
        doc.text('Summary', 15, yPos);
        
        yPos += 10;
        doc.setFontSize(12);
        doc.setTextColor(40);
        doc.text(`Total Registrations: ${totalGuests}`, 20, yPos);
        yPos += 10;
        doc.text(`Total Amount: ₹${totalAmount}`, 20, yPos);
        yPos += 10;
        doc.text(`Collected Amount: ₹${paidAmount}`, 20, yPos);
        yPos += 10;
        doc.text(`Pending Amount: ₹${totalAmount - paidAmount}`, 20, yPos);
        
        // Add club statistics
        yPos += 20;
        doc.setFontSize(14);
        doc.setTextColor(hexToRgb(primary).r, hexToRgb(primary).g, hexToRgb(primary).b);
        doc.text('Club-wise Statistics', 15, yPos);
        
        yPos += 10;
        const headers = ['Club Name', 'Guests', 'Amount'];
        const cellWidth = 60;
        
        doc.setFillColor(hexToRgb(dark).r, hexToRgb(dark).g, hexToRgb(dark).b);
        doc.rect(10, yPos - 5, doc.internal.pageSize.width - 20, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        headers.forEach((header, i) => {
            doc.text(header, 15 + (i * cellWidth), yPos);
        });
        
        // Add club rows
        yPos += 10;
        doc.setTextColor(40);
        
        Object.entries(clubStats).forEach(([club, stats], index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
            const row = [
                club,
                stats.guests.toString(),
                `₹${stats.amount}`
            ];
            
            // Alternate row background
            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(10, yPos - 5, doc.internal.pageSize.width - 20, 10, 'F');
            }
            
            row.forEach((cell, i) => {
                doc.text(String(cell || ''), 15 + (i * cellWidth), yPos);
            });
            
            yPos += 10;
        });
        
        // Save the PDF
        doc.save('kochin-hangover-stats.pdf');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF');
    }
}

async function downloadStatsCSV() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) throw error;
        
        // Calculate club statistics
        const clubStats = {};
        guests.forEach(guest => {
            if (!clubStats[guest.club_name]) {
                clubStats[guest.club_name] = {
                    guests: 0,
                    amount: 0
                };
            }
            clubStats[guest.club_name].guests++;
            clubStats[guest.club_name].amount += guest.total_amount;
        });
        
        const csvData = Object.entries(clubStats).map(([club, stats]) => ({
            'Club Name': club,
            'Total Guests': stats.guests,
            'Total Amount': `₹${stats.amount}`
        }));
        
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'kochin-hangover-stats.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        alert('Failed to generate CSV');
    }
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Setup navigation based on user role
async function setupNavigation() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    const { data: userRole } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    const isStaff = userRole?.role === 'staff';
    const isAdmin = userRole?.role === 'admin';

    // Show/hide navigation buttons based on role
    document.getElementById('registrationBtn')?.classList.toggle('hidden', isStaff);
    document.getElementById('scannerBtn')?.classList.toggle('hidden', isStaff);
    document.getElementById('usersBtn')?.classList.toggle('hidden', !isAdmin);

    // Set initial tab based on role
    if (isStaff) {
        showTab('guests');
        // Remove registration and scanner tabs for staff
        document.getElementById('registration')?.remove();
        document.getElementById('scanner')?.remove();
        document.getElementById('users')?.remove();
    } else {
        showTab('registration');
    }
}

// Function to update the guest list
async function refreshGuestList() {
    const guestList = document.getElementById('guestList');
    if (!guestList) return;

    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        guestList.innerHTML = guests.map(guest => `
            <tr class="hover:bg-gray-100 cursor-pointer" data-guest-id="${guest.id}">
                <td class="px-6 py-4 whitespace-nowrap">${guest.guest_name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${guest.club_name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${guest.entry_type}</td>
                <td class="px-6 py-4 whitespace-nowrap">₹${guest.paid_amount} / ₹${guest.total_amount}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        guest.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        guest.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                    }">
                        ${guest.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-3" onclick="editGuest('${guest.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-green-600 hover:text-green-900" onclick="shareOnWhatsApp('${guest.id}')">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Add click event to select guest
        document.querySelectorAll('#guestList tr').forEach(row => {
            row.addEventListener('click', () => {
                document.querySelectorAll('#guestList tr').forEach(r => r.classList.remove('selected-guest', 'bg-blue-50'));
                row.classList.add('selected-guest', 'bg-blue-50');
            });
        });

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load guest list');
    }
}

// When the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
        alert('Failed to initialize application');
    });
});
