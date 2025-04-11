// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';

const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize app state
let currentUser = null;
let guests = [];
let users = [];
let qrScanner = null;

// Constants for entry prices
const ENTRY_PRICES = {
    stag: 2750,
    couple: 4750
};

// Show login screen
function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
}

// Show main app
function showApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
}

// Handle login
async function handleLogin(user) {
    try {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        showApp();
        await setupNavigation();
        await showTab('registration');
    } catch (error) {
        console.error("Login handling failed:", error);
        showLoginScreen();
    }
}

// Handle logout
async function handleLogout() {
    try {
        // No need to call Supabase Auth signOut since we're using direct database authentication
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        showLoginScreen();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Initialize app
async function initializeApp() {
    // Check for existing session
    const session = JSON.parse(sessionStorage.getItem('currentUser'));
    
    if (session) {
        // Use the stored user directly since we're using database authentication
        currentUser = session;
        await handleLogin(currentUser);
        return;
    }
    
    showLoginScreen();
}

// Setup navigation based on user role
async function setupNavigation() {
    if (!currentUser) return;

    const { data: userRole, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        console.error('Error fetching user role:', error);
        return;
    }

    const isStaff = userRole?.role === 'staff';
    const isAdmin = userRole?.role === 'admin';
    const isDoorman = userRole?.role === 'doorman';

    // Show/hide navigation buttons based on role
    document.getElementById('usersBtn')?.classList.toggle('hidden', !isAdmin);
    
    // Restrict staff to only Registered Guests and Stats
    if (isStaff) {
        document.getElementById('newRegistrationBtn')?.classList.add('hidden');
        document.getElementById('entryVerificationBtn')?.classList.add('hidden');
        
        // Auto-navigate to guests tab for staff users
        showTab('guests');
    }
    
    // Restrict doorman to only Entry Verification
    if (isDoorman) {
        document.getElementById('newRegistrationBtn')?.classList.add('hidden');
        document.getElementById('guestListBtn')?.classList.add('hidden');
        document.getElementById('statsBtn')?.classList.add('hidden');
        
        // Auto-navigate to verification tab for doorman users
        showTab('verification');
    }
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
        await loadGuestList();
    } else if (tabId === 'stats') {
        await loadStats();
    } else if (tabId === 'verification') {
        initQRScanner();
    }
}

// Load guest list
async function loadGuestList() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('guestListTableBody');
        if (!tbody) return;
        
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
        `).join('');

        // Re-attach event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error loading guest list:', error);
    }
}

// Initialize QR Scanner
function initQRScanner() {
    if (qrScanner) {
        qrScanner.clear();
        qrScanner = null;
    }

    qrScanner = new Html5QrcodeScanner(
        "qr-reader", 
        {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            defaultZoomValueIfSupported: 2
        }
    );
    
    qrScanner.render(async (decodedText) => {
        try {
            // Parse the QR code data
            const guestData = JSON.parse(decodedText);
            
            // Get the latest guest data from Supabase
            const { data: guest, error } = await supabase
                .from('guests')
                .select('*')
                .eq('id', guestData.id)
                .single();
            
            if (error) throw error;
            
            if (!guest) {
                throw new Error('Guest not found');
            }
            
            // Calculate expected amount and payment status
            const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
            const isFullyPaid = guest.paid_amount >= expectedAmount;
            
            // Show verification result modal
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4';
            modal.innerHTML = `
                <div class="bg-[#2a0e3a] p-6 rounded-lg max-w-md w-full">
                    <div class="text-center mb-6">
                        <i class="fas ${isFullyPaid ? 'fa-check-circle text-green-400' : 'fa-exclamation-triangle text-yellow-400'} text-5xl"></i>
                        <h3 class="text-2xl font-bold mt-4 ${isFullyPaid ? 'text-green-400' : 'text-yellow-400'}">
                            ${isFullyPaid ? 'VERIFIED' : 'PAYMENT PENDING'}
                        </h3>
                    </div>
                    
                    <div class="space-y-4 mb-6">
                        <div class="flex justify-between">
                            <span class="text-gray-300">Full Name</span>
                            <span class="font-bold">${guest.guest_name}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Club Name</span>
                            <span class="font-bold">${guest.club_name || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Mobile Number</span>
                            <span class="font-bold">${guest.mobile_number || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Entry Type</span>
                            <span class="font-bold">${guest.entry_type}</span>
                        </div>
                        ${!isFullyPaid ? `
                        <div class="flex justify-between">
                            <span class="text-gray-300">Amount Due</span>
                            <span class="font-bold text-red-400">₹${expectedAmount - guest.paid_amount}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="flex space-x-4">
                        ${isFullyPaid ? 
                            `<button onclick="verifyGuest('${guest.id}')" class="kochin-button flex-1 bg-green-600">
                                <i class="fas fa-check mr-2"></i> Allow Entry
                            </button>` : 
                            `<button class="kochin-button bg-yellow-600 flex-1 cursor-not-allowed" disabled>
                                <i class="fas fa-ban mr-2"></i> Entry Denied
                            </button>`
                        }
                        <button onclick="this.closest('.fixed').remove(); qrScanner.resume();" class="kochin-button bg-gray-700 flex-1">
                            Close
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Stop scanning
            qrScanner.pause();
            
        } catch (error) {
            console.error('Error verifying guest:', error);
            alert(error.message || 'Failed to verify guest');
        }
    });
}

// Verify guest entry
window.verifyGuest = async function(guestId) {
    try {
        // First check if the guest has fully paid
        const { data: guestCheck, error: checkError } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();
            
        if (checkError) throw checkError;
        
        // Verify that guest has paid in full (Stag: 2750 and Couple: 4750)
        const expectedAmount = guestCheck.entry_type === 'stag' ? 2750 : 4750;
        
        if (guestCheck.paid_amount < expectedAmount) {
            throw new Error(`Cannot verify guest. Full payment required (₹${expectedAmount}). Current payment: ₹${guestCheck.paid_amount}`);
        }
        
        // Update guest status to verified
        const { data: guest, error } = await supabase
            .from('guests')
            .update({ status: 'verified', verified_at: new Date().toISOString() })
            .eq('id', guestId)
            .select()
            .single();
        
        if (error) throw error;
        
        // Show success message
        alert('Guest verified successfully!');
        
        // Remove verification modal
        document.querySelector('.fixed').remove();
        
        // Resume scanning
        if (qrScanner) {
            qrScanner.resume();
        }
        
    } catch (error) {
        console.error('Error verifying guest:', error);
        alert(error.message || 'Failed to verify guest');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorText = document.getElementById('loginError');

        try {
            // Check credentials against users table
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password);

            if (error) throw error;
            if (!users || users.length === 0) {
                throw new Error('Invalid username or password');
            }

            // Skip Supabase Auth and use the database user directly
            const user = {
                id: users[0].id,
                username: users[0].username,
                role: users[0].role
            };

            // Store user info in session
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            currentUser = user;

            // Show main app and initialize components
            showApp();
            await setupNavigation();
            await showTab('registration');
            
        } catch (error) {
            console.error('Login error:', error);
            if (errorText) {
                errorText.textContent = error.message || 'Invalid credentials';
                errorText.classList.remove('hidden');
            }
        }
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Navigation buttons
    document.getElementById('newRegistrationBtn')?.addEventListener('click', () => showTab('registration'));
    document.getElementById('entryVerificationBtn')?.addEventListener('click', () => showTab('verification'));
    document.getElementById('guestListBtn')?.addEventListener('click', () => showTab('guests'));
    document.getElementById('statsBtn')?.addEventListener('click', () => showTab('stats'));
    document.getElementById('usersBtn')?.addEventListener('click', () => showTab('users'));

    // Registration form
    document.getElementById('registrationForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const formData = {
                guest_name: document.getElementById('guestName').value,
                club_name: document.getElementById('clubName').value,
                mobile_number: document.getElementById('mobileNumber').value,
                entry_type: document.getElementById('entryType').value,
                payment_mode: document.getElementById('paymentMode').value,
                total_amount: document.getElementById('entryType').value === 'stag' ? 2750 : 4750,
                paid_amount: document.getElementById('paymentMode').value === 'partial' ? 
                    Number(document.getElementById('paidAmount').value) : 
                    (document.getElementById('entryType').value === 'stag' ? 2750 : 4750),
                status: document.getElementById('paymentMode').value === 'partial' ? 'partially_paid' : 'paid'
            };

            // Validate required fields
            if (!formData.guest_name || !formData.mobile_number || !formData.entry_type || !formData.payment_mode) {
                throw new Error('Please fill in all required fields');
            }

            // Insert into Supabase
            const { data, error } = await supabase
                .from('guests')
                .insert([formData])
                .select();

            if (error) throw error;

            // Reset form
            e.target.reset();
            updateAmount();
            document.getElementById('partialPaymentSection').classList.add('hidden');
            document.getElementById('paidAmount').removeAttribute('required');
            
            // Refresh lists
            await loadGuestList();
            await loadStats();
            
            alert('Guest registered successfully!');
            
        } catch (error) {
            console.error('Registration error:', error);
            alert(error.message || 'Failed to register guest');
        }
    });

    // Payment mode change handler
    document.getElementById('paymentMode')?.addEventListener('change', function() {
        const partialSection = document.getElementById('partialPaymentSection');
        const paidAmountInput = document.getElementById('paidAmount');
        
        if (this.value === 'partial') {
            partialSection.classList.remove('hidden');
            paidAmountInput.setAttribute('required', 'required');
        } else {
            partialSection.classList.add('hidden');
            paidAmountInput.removeAttribute('required');
        }
    });

    // Entry type change handler
    document.getElementById('entryType')?.addEventListener('change', updateAmount);

    // Download buttons
    document.getElementById('downloadGuestsPDFBtn')?.addEventListener('click', downloadGuestsPDF);
    document.getElementById('downloadGuestsCSVBtn')?.addEventListener('click', downloadGuestsCSV);
    document.getElementById('downloadStatsPDFBtn')?.addEventListener('click', downloadStatsPDF);
    document.getElementById('downloadStatsCSVBtn')?.addEventListener('click', downloadStatsCSV);
    
    // WhatsApp share buttons
    document.addEventListener('click', async function(e) {
        if (e.target.closest('.whatsapp-share')) {
            const button = e.target.closest('.whatsapp-share');
            const guestId = button.getAttribute('data-guest-id');
            
            try {
                // Get guest data
                const { data: guest, error } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('id', guestId)
                    .single();
                
                if (error) throw error;
                
                // Format the mobile number for WhatsApp
                let mobileNumber = guest.mobile_number;
                
                // Remove any spaces, dashes, or parentheses
                mobileNumber = mobileNumber.replace(/[\s\-()]/g, '');
                
                // If the number doesn't start with '+', add the India country code
                if (!mobileNumber.startsWith('+')) {
                    // If it starts with 0, replace the 0 with +91
                    if (mobileNumber.startsWith('0')) {
                        mobileNumber = '+91' + mobileNumber.substring(1);
                    } else {
                        // Otherwise, just add +91
                        mobileNumber = '+91' + mobileNumber;
                    }
                }
                
                // Create guest pass data for QR code
                const qrData = JSON.stringify({
                    id: guest.id,
                    name: guest.guest_name,
                    timestamp: new Date().toISOString()
                });
                
                // Generate QR code
                const qrCodeDataURL = await QRCode.toDataURL(qrData, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#2a0e3a',
                        light: '#ffffff'
                    }
                });
                
                // Create a temporary div to generate the guest pass image
                const tempDiv = document.createElement('div');
                tempDiv.className = 'kochin-container p-6 bg-white text-[#2a0e3a]';
                tempDiv.style.width = '600px';
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.innerHTML = `
                    <div class="flex flex-col items-center">
                        <h2 class="text-3xl font-bold mb-2 text-[#e83283]">KOCHIN HANGOVER</h2>
                        <h3 class="text-xl mb-6">Guest Pass</h3>
                        
                        <div class="flex w-full mb-6">
                            <div class="w-1/2 pr-4">
                                <div class="mb-4">
                                    <p class="text-gray-600 text-sm">Full Name</p>
                                    <p class="text-xl font-bold">${guest.guest_name}</p>
                                </div>
                                <div class="mb-4">
                                    <p class="text-gray-600 text-sm">Club Name</p>
                                    <p class="text-xl font-bold">${guest.club_name || 'N/A'}</p>
                                </div>
                                <div class="mb-4">
                                    <p class="text-gray-600 text-sm">Mobile Number</p>
                                    <p class="text-xl font-bold">${guest.mobile_number}</p>
                                </div>
                                <div class="mb-4">
                                    <p class="text-gray-600 text-sm">Entry Type</p>
                                    <p class="text-xl font-bold">${guest.entry_type.toUpperCase()}</p>
                                </div>
                                <div class="mb-4">
                                    <p class="text-gray-600 text-sm">Status</p>
                                    <p class="text-xl font-bold ${guest.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}">
                                        ${guest.status === 'paid' ? 'PAID' : 'PARTIALLY PAID'}
                                    </p>
                                </div>
                            </div>
                            <div class="w-1/2 flex flex-col items-center justify-center">
                                <img src="${qrCodeDataURL}" alt="QR Code" class="w-48 h-48 mb-2">
                                <p class="text-sm text-center text-gray-600">Scan this QR code at the entrance</p>
                            </div>
                        </div>
                        
                        <div class="w-full pt-4 border-t border-gray-300 text-center">
                            <p class="text-sm text-gray-600">Date: ${new Date().toLocaleDateString()}</p>
                            <p class="text-sm text-gray-600 mt-1">Venue: Kochin Club, Marine Drive</p>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(tempDiv);
                
                // Use html2canvas to convert the div to an image
                const canvas = await html2canvas(tempDiv);
                const imageDataURL = canvas.toDataURL('image/png');
                
                // Remove the temporary div
                document.body.removeChild(tempDiv);
                
                // Create WhatsApp share message
                const message = `*KOCHIN HANGOVER - GUEST PASS*\n\n` +
                    `*Name:* ${guest.guest_name}\n` +
                    `*Club:* ${guest.club_name || 'N/A'}\n` +
                    `*Mobile:* ${guest.mobile_number}\n` +
                    `*Entry Type:* ${guest.entry_type.toUpperCase()}\n\n` +
                    `Please show this pass at the entrance. Your QR code is attached.`;
                
                // Create a blob from the image data URL
                const blob = await (await fetch(imageDataURL)).blob();
                
                // Create a File object from the blob
                const file = new File([blob], 'guest-pass.png', { type: 'image/png' });
                
                // Open WhatsApp chat directly with the guest
                // Remove the + sign if present for the WhatsApp API
                const whatsappNumber = mobileNumber.replace('+', '');
                const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
                
                // Open WhatsApp in a new tab
                window.open(whatsappUrl, '_blank');
                
            } catch (error) {
                console.error('Error sharing guest pass:', error);
                alert('Failed to share guest pass. Please try again.');
            }
        }
    });
}

// Update amount based on entry type
window.updateAmount = function() {
    const entryType = document.getElementById('entryType').value;
    const totalAmountDisplay = document.getElementById('totalAmountDisplay');
    const paidAmountInput = document.getElementById('paidAmount');
    const totalAmount = entryType === 'stag' ? 2750 : 4750;
    
    if (totalAmountDisplay) {
        totalAmountDisplay.textContent = `/ ₹${totalAmount} total`;
    }
    
    if (paidAmountInput) {
        paidAmountInput.max = totalAmount - 100;
    }
}

// Load statistics
async function loadStats() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) throw error;
        
        // Calculate total stats
        const stats = {
            totalRegistrations: guests.length,
            totalAmount: guests.reduce((sum, guest) => sum + guest.total_amount, 0),
            paidAmount: guests.reduce((sum, guest) => sum + guest.paid_amount, 0)
        };
        
        document.getElementById('totalRegistrations').textContent = stats.totalRegistrations;
        document.getElementById('totalAmount').textContent = `₹${stats.totalAmount}`;
        
        // Calculate club-wise stats
        const clubStats = {};
        guests.forEach(guest => {
            if (!clubStats[guest.club_name]) {
                clubStats[guest.club_name] = {
                    totalGuests: 0,
                    totalAmount: 0
                };
            }
            clubStats[guest.club_name].totalGuests++;
            clubStats[guest.club_name].totalAmount += guest.total_amount;
        });
        
        // Sort clubs by total guests
        const sortedClubs = Object.entries(clubStats)
            .sort((a, b) => b[1].totalGuests - a[1].totalGuests);
        
        // Update club stats table
        const clubStatsTable = document.getElementById('clubStats');
        if (clubStatsTable) {
            clubStatsTable.innerHTML = sortedClubs.map(([club, stats]) => `
                <tr class="border-t border-gray-700">
                    <td class="py-3 px-4">${club || 'No club specified'}</td>
                    <td class="py-3 px-4">${stats.totalGuests}</td>
                    <td class="py-3 px-4">₹${stats.totalAmount}</td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Download functions
async function downloadGuestsPDF() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Define theme colors
        const primaryColor = '#e83283';
        const secondaryColor = '#34dbdb';
        const darkColor = '#2a0e3a';
        const accentColor = '#f7d046';
        
        // Add header with logo and title
        doc.setFillColor(darkColor);
        doc.rect(0, 0, 210, 40, 'F');
        
        // Add gradient effect
        for (let i = 0; i < 20; i++) {
            const alpha = 0.1 - (i * 0.005);
            doc.setFillColor(232, 50, 131, alpha);
            doc.circle(30, 20, 40 - i, 'F');
            doc.setFillColor(52, 219, 219, alpha);
            doc.circle(180, 20, 40 - i, 'F');
        }
        
        // Add title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text('KOCHIN HANGOVER', 105, 20, { align: 'center' });
        doc.setFontSize(16);
        doc.text('Guest List', 105, 30, { align: 'center' });
        
        // Add date
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 37, { align: 'center' });
        
        // Table header
        const startY = 50;
        const colWidths = [10, 50, 30, 30, 30, 40];
        const headers = ['#', 'Guest Name', 'Club', 'Entry Type', 'Amount', 'Status'];
        
        // Draw table header
        doc.setFillColor(darkColor);
        doc.rect(10, startY, 190, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        
        let xPos = 10;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 2, startY + 7);
            xPos += colWidths[i];
        });
        
        // Draw table rows
        let yPos = startY + 10;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        guests.forEach((guest, index) => {
            // Add new page if needed
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                
                // Add mini header on new pages
                doc.setFillColor(darkColor);
                doc.rect(10, yPos - 10, 190, 10, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                
                xPos = 10;
                headers.forEach((header, i) => {
                    doc.text(header, xPos + 2, yPos - 3);
                    xPos += colWidths[i];
                });
                
                doc.setTextColor(50, 50, 50);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
            }
            
            // Alternating row colors
            if (index % 2 === 0) {
                doc.setFillColor(240, 240, 250);
                doc.rect(10, yPos, 190, 10, 'F');
            }
            
            // Row data
            xPos = 10;
            
            // Row number
            doc.text((index + 1).toString(), xPos + 2, yPos + 7);
            xPos += colWidths[0];
            
            // Guest name
            doc.text(guest.guest_name || '', xPos + 2, yPos + 7);
            xPos += colWidths[1];
            
            // Club
            doc.text(guest.club_name || 'N/A', xPos + 2, yPos + 7);
            xPos += colWidths[2];
            
            // Entry type
            doc.text(guest.entry_type || '', xPos + 2, yPos + 7);
            xPos += colWidths[3];
            
            // Amount
            doc.text(`₹${guest.paid_amount} / ₹${guest.total_amount}`, xPos + 2, yPos + 7);
            xPos += colWidths[4];
            
            // Status
            const statusColor = 
                guest.status === 'verified' ? [0, 150, 0] :
                guest.status === 'paid' ? [0, 100, 200] :
                guest.status === 'partially_paid' ? [200, 150, 0] :
                [200, 0, 0];
            
            doc.setTextColor(...statusColor);
            doc.text(guest.status || 'pending', xPos + 2, yPos + 7);
            doc.setTextColor(50, 50, 50);
            
            yPos += 10;
        });
        
        // Add footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer rectangle
            doc.setFillColor(darkColor);
            doc.rect(0, 287, 210, 10, 'F');
            
            // Page number
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text(`Page ${i} of ${pageCount}`, 105, 293, { align: 'center' });
            
            // Kochin Hangover text
            doc.setFontSize(8);
            doc.text('Kochin Hangover - Entry Management System', 10, 293);
        }
        
        // Save the PDF
        doc.save('kochin-hangover-guest-list.pdf');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

async function downloadGuestsCSV() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Convert to CSV
        const headers = ['Guest Name', 'Club Name', 'Mobile Number', 'Entry Type', 'Paid Amount', 'Total Amount', 'Status', 'Created At'];
        const csvData = guests.map(guest => [
            guest.guest_name,
            guest.club_name || 'N/A',
            guest.mobile_number,
            guest.entry_type,
            guest.paid_amount,
            guest.total_amount,
            guest.status,
            new Date(guest.created_at).toLocaleString()
        ]);
        
        // Use PapaParse to generate CSV
        const csv = Papa.unparse({
            fields: headers,
            data: csvData
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'kochin-hangover-guest-list.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        alert('Failed to generate CSV. Please try again.');
    }
}

async function downloadStatsPDF() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) throw error;
        
        // Calculate stats
        const stats = {
            totalRegistrations: guests.length,
            totalAmount: guests.reduce((sum, guest) => sum + guest.total_amount, 0),
            paidAmount: guests.reduce((sum, guest) => sum + guest.paid_amount, 0),
            pendingAmount: guests.reduce((sum, guest) => sum + (guest.total_amount - guest.paid_amount), 0),
            verifiedCount: guests.filter(guest => guest.status === 'verified').length,
            paidCount: guests.filter(guest => guest.status === 'paid').length,
            partiallyPaidCount: guests.filter(guest => guest.status === 'partially_paid').length,
            pendingCount: guests.filter(guest => guest.status === 'pending').length
        };
        
        // Calculate club-wise stats
        const clubStats = {};
        guests.forEach(guest => {
            const clubName = guest.club_name || 'No Club';
            if (!clubStats[clubName]) {
                clubStats[clubName] = {
                    totalGuests: 0,
                    totalAmount: 0,
                    paidAmount: 0
                };
            }
            clubStats[clubName].totalGuests++;
            clubStats[clubName].totalAmount += guest.total_amount;
            clubStats[clubName].paidAmount += guest.paid_amount;
        });
        
        // Sort clubs by total guests
        const sortedClubs = Object.entries(clubStats)
            .sort((a, b) => b[1].totalGuests - a[1].totalGuests);
        
        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Define theme colors
        const primaryColor = '#e83283';
        const secondaryColor = '#34dbdb';
        const darkColor = '#2a0e3a';
        const accentColor = '#f7d046';
        
        // Add header with logo and title
        doc.setFillColor(darkColor);
        doc.rect(0, 0, 210, 40, 'F');
        
        // Add gradient effect
        for (let i = 0; i < 20; i++) {
            const alpha = 0.1 - (i * 0.005);
            doc.setFillColor(232, 50, 131, alpha);
            doc.circle(30, 20, 40 - i, 'F');
            doc.setFillColor(52, 219, 219, alpha);
            doc.circle(180, 20, 40 - i, 'F');
        }
        
        // Add title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text('KOCHIN HANGOVER', 105, 20, { align: 'center' });
        doc.setFontSize(16);
        doc.text('Event Statistics', 105, 30, { align: 'center' });
        
        // Add date
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 37, { align: 'center' });
        
        // Overall stats section
        let yPos = 50;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Overall Statistics', 105, yPos, { align: 'center' });
        
        // Draw stats cards
        yPos += 10;
        const cardWidth = 90;
        const cardHeight = 30;
        const margin = 10;
        
        // First row of cards
        doc.setFillColor(232, 50, 131, 0.1);
        doc.roundedRect(margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
        doc.setFillColor(52, 219, 219, 0.1);
        doc.roundedRect(margin + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
        
        // Card content
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total Registrations', margin + cardWidth/2, yPos + 10, { align: 'center' });
        doc.text('Total Amount', margin + cardWidth + margin + cardWidth/2, yPos + 10, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text(stats.totalRegistrations.toString(), margin + cardWidth/2, yPos + 20, { align: 'center' });
        doc.text(`₹${stats.totalAmount.toLocaleString()}`, margin + cardWidth + margin + cardWidth/2, yPos + 20, { align: 'center' });
        
        // Second row of cards
        yPos += cardHeight + margin;
        doc.setFillColor(247, 208, 70, 0.1);
        doc.roundedRect(margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
        doc.setFillColor(232, 50, 131, 0.1);
        doc.roundedRect(margin + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
        
        // Card content
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Collected Amount', margin + cardWidth/2, yPos + 10, { align: 'center' });
        doc.text('Pending Amount', margin + cardWidth + margin + cardWidth/2, yPos + 10, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text(`₹${stats.paidAmount.toLocaleString()}`, margin + cardWidth/2, yPos + 20, { align: 'center' });
        doc.text(`₹${stats.pendingAmount.toLocaleString()}`, margin + cardWidth + margin + cardWidth/2, yPos + 20, { align: 'center' });
        
        // Status breakdown
        yPos += cardHeight + margin + 10;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Registration Status', 105, yPos, { align: 'center' });
        
        // Draw status chart (simple bar representation)
        yPos += 10;
        const chartWidth = 190;
        const chartHeight = 30;
        const totalCount = stats.totalRegistrations;
        
        if (totalCount > 0) {
            const verifiedWidth = (stats.verifiedCount / totalCount) * chartWidth;
            const paidWidth = (stats.paidCount / totalCount) * chartWidth;
            const partialWidth = (stats.partiallyPaidCount / totalCount) * chartWidth;
            const pendingWidth = (stats.pendingCount / totalCount) * chartWidth;
            
            // Draw bars
            let xPos = margin;
            
            if (stats.verifiedCount > 0) {
                doc.setFillColor(0, 150, 0);
                doc.rect(xPos, yPos, verifiedWidth, chartHeight, 'F');
                xPos += verifiedWidth;
            }
            
            if (stats.paidCount > 0) {
                doc.setFillColor(0, 100, 200);
                doc.rect(xPos, yPos, paidWidth, chartHeight, 'F');
                xPos += paidWidth;
            }
            
            if (stats.partiallyPaidCount > 0) {
                doc.setFillColor(200, 150, 0);
                doc.rect(xPos, yPos, partialWidth, chartHeight, 'F');
                xPos += partialWidth;
            }
            
            if (stats.pendingCount > 0) {
                doc.setFillColor(200, 0, 0);
                doc.rect(xPos, yPos, pendingWidth, chartHeight, 'F');
            }
            
            // Add legend
            yPos += chartHeight + 5;
            doc.setFontSize(10);
            
            let legendX = margin;
            if (stats.verifiedCount > 0) {
                doc.setFillColor(0, 150, 0);
                doc.rect(legendX, yPos, 5, 5, 'F');
                doc.text(`Verified (${stats.verifiedCount})`, legendX + 8, yPos + 4);
                legendX += 50;
            }
            
            if (stats.paidCount > 0) {
                doc.setFillColor(0, 100, 200);
                doc.rect(legendX, yPos, 5, 5, 'F');
                doc.text(`Paid (${stats.paidCount})`, legendX + 8, yPos + 4);
                legendX += 50;
            }
            
            if (stats.partiallyPaidCount > 0) {
                doc.setFillColor(200, 150, 0);
                doc.rect(legendX, yPos, 5, 5, 'F');
                doc.text(`Partial (${stats.partiallyPaidCount})`, legendX + 8, yPos + 4);
                legendX += 50;
            }
            
            if (stats.pendingCount > 0) {
                doc.setFillColor(200, 0, 0);
                doc.rect(legendX, yPos, 5, 5, 'F');
                doc.text(`Pending (${stats.pendingCount})`, legendX + 8, yPos + 4);
            }
        }
        
        // Club-wise statistics
        yPos += 20;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Club-wise Statistics', 105, yPos, { align: 'center' });
        
        // Table header
        yPos += 10;
        const colWidths = [80, 35, 35, 35];
        const headers = ['Club Name', 'Guests', 'Total (₹)', 'Paid (₹)'];
        
        // Draw table header
        doc.setFillColor(darkColor);
        doc.rect(margin, yPos, chartWidth, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        
        let xPos = margin;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 2, yPos + 7);
            xPos += colWidths[i];
        });
        
        // Draw table rows
        yPos += 10;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        sortedClubs.forEach((club, index) => {
            // Add new page if needed
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                
                // Add mini header on new pages
                doc.setFillColor(darkColor);
                doc.rect(10, yPos - 10, 190, 10, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                
                xPos = 10;
                headers.forEach((header, i) => {
                    doc.text(header, xPos + 2, yPos - 3);
                    xPos += colWidths[i];
                });
                
                doc.setTextColor(50, 50, 50);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
            }
            
            // Alternating row colors
            if (index % 2 === 0) {
                doc.setFillColor(240, 240, 250);
                doc.rect(margin, yPos, chartWidth, 10, 'F');
            }
            
            // Row data
            xPos = margin;
            
            // Club name
            doc.text(club[0], xPos + 2, yPos + 7);
            xPos += colWidths[0];
            
            // Total guests
            doc.text(club[1].totalGuests.toString(), xPos + 2, yPos + 7);
            xPos += colWidths[1];
            
            // Total amount
            doc.text(`₹${club[1].totalAmount.toLocaleString()}`, xPos + 2, yPos + 7);
            xPos += colWidths[2];
            
            // Paid amount
            doc.text(`₹${club[1].paidAmount.toLocaleString()}`, xPos + 2, yPos + 7);
            
            yPos += 10;
        });
        
        // Add footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer rectangle
            doc.setFillColor(darkColor);
            doc.rect(0, 287, 210, 10, 'F');
            
            // Page number
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text(`Page ${i} of ${pageCount}`, 105, 293, { align: 'center' });
            
            // Kochin Hangover text
            doc.setFontSize(8);
            doc.text('Kochin Hangover - Entry Management System', 10, 293);
        }
        
        // Save the PDF
        doc.save('kochin-hangover-statistics.pdf');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

async function downloadStatsCSV() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) throw error;
        
        // Calculate club-wise stats
        const clubStats = {};
        guests.forEach(guest => {
            const clubName = guest.club_name || 'No Club';
            if (!clubStats[clubName]) {
                clubStats[clubName] = {
                    totalGuests: 0,
                    totalAmount: 0,
                    paidAmount: 0,
                    pendingAmount: 0
                };
            }
            clubStats[clubName].totalGuests++;
            clubStats[clubName].totalAmount += guest.total_amount;
            clubStats[clubName].paidAmount += guest.paid_amount;
            clubStats[clubName].pendingAmount += (guest.total_amount - guest.paid_amount);
        });
        
        // Convert to CSV
        const headers = ['Club Name', 'Total Guests', 'Total Amount (₹)', 'Paid Amount (₹)', 'Pending Amount (₹)'];
        const csvData = Object.entries(clubStats).map(([club, stats]) => [
            club,
            stats.totalGuests,
            stats.totalAmount,
            stats.paidAmount,
            stats.pendingAmount
        ]);
        
        // Add summary row
        csvData.push([
            'TOTAL',
            guests.length,
            guests.reduce((sum, guest) => sum + guest.total_amount, 0),
            guests.reduce((sum, guest) => sum + guest.paid_amount, 0),
            guests.reduce((sum, guest) => sum + (guest.total_amount - guest.paid_amount), 0)
        ]);
        
        // Use PapaParse to generate CSV
        const csv = Papa.unparse({
            fields: headers,
            data: csvData
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'kochin-hangover-statistics.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        alert('Failed to generate CSV. Please try again.');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
        showLoginScreen();
    });
    setupEventListeners();
});