import { createClient } from '@supabase/supabase-js'
import { Html5QrcodeScanner } from 'html5-qrcode'
import QRCode from 'qrcode'

// Initialize Supabase client
const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg'
const supabase = createClient(supabaseUrl, supabaseKey)

// Initialize app state
let currentUser = null
let guests = []

// Constants for entry prices
const ENTRY_PRICES = {
    stag: 2750,
    couple: 4750
}

// Initialize app
async function initializeApp() {
    const loginForm = document.getElementById('loginForm')
    const loginScreen = document.getElementById('loginScreen')
    const mainApp = document.getElementById('mainApp')
    
    // Test database connection
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('count(*)')
            .single()
            
        if (error) {
            console.error('Database connection error:', error)
            throw error
        }
        
        console.log('Database connected successfully')
    } catch (error) {
        console.error('Failed to connect to database:', error)
    }
    
    // Handle login form submission
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault()
        
        const username = document.getElementById('username').value
        const password = document.getElementById('password').value
        const loginError = document.getElementById('loginError')
        
        try {
            // Check credentials against users table
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single()
            
            if (error) throw error
            
            if (!user) {
                throw new Error('Invalid username or password')
            }
            
            // Store user info
            currentUser = user
            
            // Hide login, show main app
            loginScreen.classList.add('hidden')
            mainApp.classList.remove('hidden')
            
            // Initialize main app components
            initializeRegistration()
            initializeVerification()
            loadGuestList()
            loadStats()
            
        } catch (error) {
            console.error('Login error:', error)
            loginError.textContent = 'Invalid username or password'
            loginError.classList.remove('hidden')
        }
    })
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
document.addEventListener('DOMContentLoaded', () => {
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
        initQRScanner()
    } else if (tabName === 'guests') {
        loadGuestList()
    } else if (tabName === 'stats') {
        loadStats()
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
                    <div class="flex space-x-2">
                        <button class="text-blue-400 hover:text-blue-300" onclick="editGuest('${guest.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-400 hover:text-red-300" onclick="deleteGuest('${guest.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="text-green-400 hover:text-green-300" onclick="sendWhatsAppPass('${guest.id}')" title="Send Pass">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </div>
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
        alert(error.message || 'Failed to load statistics')
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
window.shareGuestPass = async function(passElement) {
    try {
        // Convert the pass element to canvas
        const canvas = await html2canvas(passElement, {
            backgroundColor: '#2a0e3a',
            scale: 2, // Higher resolution
            logging: false,
            useCORS: true,
            allowTaint: true
        })
        
        // Get mobile number from the guest data
        const guestId = passElement.querySelector('[data-guest-id]')?.dataset.guestId
        if (!guestId) throw new Error('Guest ID not found')
        
        const { data: guest, error } = await supabase
            .from('guests')
            .select('mobile_number')
            .eq('id', guestId)
            .single()
            
        if (error) throw error
        
        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        // Open WhatsApp with the data URL
        const message = encodeURIComponent('Your Kochin Hangover Guest Pass')
        window.open(`https://wa.me/91${guest.mobile_number}?text=${message}`, '_blank')
        
        // Create a temporary download link for the image
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = 'kochin-hangover-guest-pass.jpg'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Show success message
        alert('Guest pass opened in WhatsApp. Please attach the downloaded image to your WhatsApp message.')
        
    } catch (error) {
        console.error('Error sharing pass:', error)
        alert(error.message || 'Failed to share guest pass')
    }
}

// Send WhatsApp pass
window.sendWhatsAppPass = async function(guestId) {
    try {
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single()
        
        if (error) throw error
        
        // Generate QR code
        const qrData = {
            id: guest.id,
            guest_name: guest.guest_name,
            entry_type: guest.entry_type,
            mobile_number: guest.mobile_number,
            status: guest.status
        }
        
        const qrCode = await QRCode.toDataURL(JSON.stringify(qrData))
        
        // Create a modal with the themed pass
        const modal = document.createElement('div')
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'
        modal.innerHTML = `
            <div id="guestPass" class="relative w-[600px] h-[800px] rounded-lg overflow-hidden" data-guest-id="${guest.id}">
                <!-- Background with gradient -->
                <div class="absolute inset-0 bg-[#2a0e3a]" style="
                    background-image: radial-gradient(circle at 10% 20%, rgba(232, 50, 131, 0.3) 0%, transparent 30%),
                                    radial-gradient(circle at 90% 30%, rgba(52, 219, 219, 0.3) 0%, transparent 30%),
                                    radial-gradient(circle at 50% 80%, rgba(247, 208, 70, 0.3) 0%, transparent 30%);
                "></div>
                
                <!-- Content -->
                <div class="relative h-full p-8 flex flex-col items-center">
                    <!-- Header -->
                    <div class="text-center mb-8">
                        <i class="bottle-icon fas fa-wine-bottle text-4xl mb-4" style="color: #f7d046; transform: rotate(15deg);"></i>
                        <h1 class="text-4xl font-bold mb-2" style="
                            background: linear-gradient(90deg, #e83283, #34dbdb);
                            -webkit-background-clip: text;
                            background-clip: text;
                            color: transparent;
                            text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
                        ">Kochin Hangover</h1>
                        <div class="text-xl text-white">Guest Pass</div>
                    </div>
                    
                    <!-- Guest Details -->
                    <div class="w-full bg-[#2a0e3a] bg-opacity-70 rounded-lg p-6 mb-8 border-2" style="border-color: rgba(232, 50, 131, 0.5);">
                        <div class="space-y-4 text-white">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-300">Name</span>
                                <span class="font-bold text-lg">${guest.guest_name}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-300">Club</span>
                                <span class="font-bold text-lg">${guest.club_name}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-300">Entry Type</span>
                                <span class="font-bold text-lg">${guest.entry_type}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- QR Code -->
                    <div class="bg-white p-6 rounded-lg">
                        <img src="${qrCode}" alt="Entry QR Code" style="width: 200px; height: 200px;" crossorigin="anonymous">
                    </div>
                    
                    <!-- Footer -->
                    <div class="mt-auto text-center text-gray-400">
                        <p>Show this pass at entry</p>
                        <p class="text-sm">Valid for one-time entry only</p>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                <button onclick="shareGuestPass(this.parentElement.previousElementSibling)" class="kochin-button">
                    <i class="fab fa-whatsapp mr-2"></i> Share on WhatsApp
                </button>
                <button onclick="this.closest('.fixed').remove()" class="kochin-button bg-gray-700">
                    Close
                </button>
            </div>
        `
        document.body.appendChild(modal)
        
    } catch (error) {
        console.error('Error creating pass:', error)
        alert(error.message || 'Failed to create guest pass')
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
