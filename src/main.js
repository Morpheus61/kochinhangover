import { createClient } from '@supabase/supabase-js'
import { Html5QrcodeScanner } from 'html5-qrcode'
import QRCode from 'qrcode'

// Initialize Supabase client
const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg'
const supabase = createClient(supabaseUrl, supabaseKey)

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

// Initialize app
async function initializeApp() {
    if (!checkDOMElements()) {
        console.error('Cannot initialize app - missing critical UI elements')
        return
    }

    // Initialize all sections as hidden first
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

    // Show login screen by default
    showLoginScreen()

    // Initialize forms
    initializeRegistration()
    initializeVerification()

    // Check for existing session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (session?.user) {
        await handleLogin(session.user)
    }
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    if (!checkDOMElements()) {
        console.error('Cannot process login - missing critical UI elements')
        return
    }
    
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value
    
    try {
        console.log('Attempting login with:', username)
        
        // For Admin bypass
        if (username === 'Admin' && password === 'Kochin2025') {
            console.log('Admin login attempt')
            currentUser = { 
                id: 'admin',
                username: 'Admin',
                role: 'admin'
            }
            await handleLogin(currentUser)
            return
        }
        
        throw new Error('Invalid credentials')
    } catch (error) {
        console.error('Login error:', error)
        const errorElement = document.getElementById('loginError')
        if (errorElement) {
            errorElement.textContent = error.message || 'Invalid username or password'
            errorElement.classList.remove('hidden')
        }
    }
})

// Handle login
async function handleLogin(user) {
    try {
        if (!checkDOMElements()) {
            console.error('Cannot handle login - missing critical UI elements')
            return
        }

        console.log('Login user:', user)
        
        if (!user) {
            throw new Error('No user provided')
        }
        
        currentUser = {
            ...user,
            role: 'admin'
        }
        
        console.log('Setting current user:', currentUser)
        
        // First hide all content sections
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
        
        // Then hide login screen
        const loginScreen = document.getElementById('loginScreen')
        if (loginScreen) {
            loginScreen.classList.add('hidden')
        }
        
        // Show main app
        const mainApp = document.getElementById('mainApp')
        if (mainApp) {
            mainApp.classList.remove('hidden')
        }
        
        // Finally show registration content
        const registrationContent = document.getElementById('registrationContent')
        if (registrationContent) {
            registrationContent.classList.remove('hidden')
        }
        
    } catch (error) {
        console.error('Login handling error:', error)
        const errorElement = document.getElementById('loginError')
        if (errorElement) {
            errorElement.textContent = error.message || 'Failed to log in'
            errorElement.classList.remove('hidden')
        }
        showLoginScreen()
    }
}

// Show login screen
function showLoginScreen() {
    // First hide all content sections
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
    
    // Then show login screen and hide main app
    const loginScreen = document.getElementById('loginScreen')
    const mainApp = document.getElementById('mainApp')
    
    if (loginScreen) {
        loginScreen.classList.remove('hidden')
    }
    
    if (mainApp) {
        mainApp.classList.add('hidden')
    }
}

// Show app
function showApp() {
    const loginScreen = document.getElementById('loginScreen')
    const mainApp = document.getElementById('mainApp')
    
    if (!loginScreen || !mainApp) {
        console.error('Cannot show app - missing critical UI elements')
        return
    }
    
    loginScreen.classList.add('hidden')
    mainApp.classList.remove('hidden')
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
}

// Show specific tab
window.showTab = function(tabName) {
    // Hide all content sections
    const sections = ['registration', 'verification', 'guests', 'stats']
    sections.forEach(section => {
        document.getElementById(`${section}Content`)?.classList.add('hidden')
    })
    
    // Show selected section
    document.getElementById(`${tabName}Content`)?.classList.remove('hidden')
    
    // Update active tab styling
    const tabs = document.querySelectorAll('.kochin-tab')
    tabs.forEach(tab => {
        if (tab.getAttribute('onclick') === `showTab('${tabName}')`) {
            tab.classList.add('bg-opacity-100', 'border-primary')
        } else {
            tab.classList.remove('bg-opacity-100', 'border-primary')
        }
    })
    
    // Initialize specific tab functionality
    if (tabName === 'verification') {
        initializeQRScanner()
    } else if (tabName === 'guests') {
        loadGuestList()
    } else if (tabName === 'stats') {
        loadStats()
    }
}

// Initialize QR Scanner
function initializeQRScanner() {
    const qrReader = document.getElementById('qr-reader')
    if (!qrReader) return
    
    // Clear previous instance if any
    qrReader.innerHTML = ''
    
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader", { fps: 10, qrbox: 250 }
    )
    
    html5QrcodeScanner.render((decodedText) => {
        try {
            const guestData = JSON.parse(decodedText)
            showVerificationResult(guestData)
        } catch (error) {
            console.error('Invalid QR code:', error)
            alert('Invalid QR code format')
        }
    })
}

// Show verification result
function showVerificationResult(guestData) {
    const result = document.getElementById('verificationResult')
    if (!result) return
    
    document.getElementById('verificationGuestName').textContent = guestData.guest_name
    document.getElementById('verificationEntryType').textContent = guestData.entry_type
    document.getElementById('verificationMobile').textContent = guestData.mobile_number
    document.getElementById('verificationStatus').textContent = guestData.status
    
    result.classList.remove('hidden')
}

// Verify guest entry
window.verifyGuest = async function(approved) {
    try {
        const guestId = currentGuestData.id
        const { data, error } = await supabase
            .from('guests')
            .update({ 
                status: approved ? 'verified' : 'denied',
                verification_date: new Date().toISOString()
            })
            .eq('id', guestId)
            .select()
        
        if (error) throw error
        
        alert(`Guest ${approved ? 'verified' : 'denied'} successfully!`)
        document.getElementById('verificationResult').classList.add('hidden')
        
    } catch (error) {
        console.error('Verification error:', error)
        alert(error.message || 'Failed to verify guest')
    }
}

// Load guest list
async function loadGuestList() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('registration_date', { ascending: false })
        
        if (error) throw error
        
        const guestList = document.getElementById('guestList')
        if (!guestList) return
        
        if (guests.length === 0) {
            guestList.innerHTML = `
                <tr>
                    <td colspan="6" class="py-4 px-4 text-center text-gray-400">No guests registered yet</td>
                </tr>
            `
            return
        }
        
        guestList.innerHTML = guests.map(guest => `
            <tr class="border-t border-gray-700">
                <td class="py-3 px-4">${guest.guest_name}</td>
                <td class="py-3 px-4">${guest.club_name}</td>
                <td class="py-3 px-4">${guest.entry_type}</td>
                <td class="py-3 px-4">₹${guest.paid_amount} / ₹${guest.total_amount}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded text-xs ${getStatusClass(guest.status)}">
                        ${guest.status}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <button onclick="showGuestQR('${guest.id}')" class="text-blue-400 hover:text-blue-300">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </td>
            </tr>
        `).join('')
        
    } catch (error) {
        console.error('Error loading guests:', error)
        alert(error.message || 'Failed to load guest list')
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
        
        const stats = {
            totalRegistrations: guests.length,
            totalAmount: guests.reduce((sum, guest) => sum + guest.paid_amount, 0),
            verifiedEntries: guests.filter(guest => guest.status === 'verified').length,
            pendingVerifications: guests.filter(guest => guest.status !== 'verified' && guest.status !== 'denied').length
        }
        
        document.getElementById('totalRegistrations').textContent = stats.totalRegistrations
        document.getElementById('totalAmount').textContent = `₹${stats.totalAmount}`
        document.getElementById('verifiedEntries').textContent = stats.verifiedEntries
        document.getElementById('pendingVerifications').textContent = stats.pendingVerifications
        
    } catch (error) {
        console.error('Error loading stats:', error)
        alert(error.message || 'Failed to load statistics')
    }
}

// Show guest QR code
window.showGuestQR = async function(guestId) {
    try {
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single()
        
        if (error) throw error
        
        const qrData = {
            id: guest.id,
            guest_name: guest.guest_name,
            entry_type: guest.entry_type,
            mobile_number: guest.mobile_number,
            status: guest.status
        }
        
        const qrCode = await QRCode.toDataURL(JSON.stringify(qrData))
        
        // Show QR code in a modal
        const modal = document.createElement('div')
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'
        modal.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-lg font-bold mb-4">Guest QR Code</h3>
                <img src="${qrCode}" alt="Guest QR Code" class="mb-4">
                <button onclick="this.parentElement.parentElement.remove()" class="kochin-button w-full">
                    Close
                </button>
            </div>
        `
        document.body.appendChild(modal)
        
    } catch (error) {
        console.error('Error showing QR:', error)
        alert(error.message || 'Failed to show QR code')
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
                if (!guestData) throw new Error('Guest not found')
                
                // Update verification result UI
                document.getElementById('verificationGuestName').textContent = guestData.guest_name
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
            
            // Generate QR code
            if (data?.[0]) {
                const qrData = {
                    id: data[0].id,
                    guest_name: data[0].guest_name,
                    entry_type: data[0].entry_type,
                    mobile_number: data[0].mobile_number,
                    status: data[0].status,
                    paid_amount: data[0].paid_amount,
                    total_amount: data[0].total_amount
                }
                
                const qrCode = await QRCode.toDataURL(JSON.stringify(qrData))
                
                // Show success message with QR code
                alert('Registration successful! QR code generated.')
                
                // Reset form
                form.reset()
                updateAmount()
                partialSection?.classList.add('hidden')
                paidAmountInput?.removeAttribute('required')
            }
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
