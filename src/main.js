// =====================================================
// ROCK 4 ONE - Main Application v2.0
// Multi-Seller Workflow with Payment Verification
// =====================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm';

// Supabase Configuration
const supabaseUrl = 'https://nybbovgdsvbwabuqthbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55YmJvdmdkc3Zid2FidXF0aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTU5NTIsImV4cCI6MjA4MDMzMTk1Mn0.g-1eRhGpiiOICp0tTPjsvAcuIUYur1NIqw1AOt1tugw';
const supabase = createClient(supabaseUrl, supabaseKey);

// Global State
let currentUser = null;
let settings = {};
let currentGuestForPass = null;

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check for existing session
    const savedUser = sessionStorage.getItem('rock4one_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        await initializeApp();
    }
    
    // Setup event listeners
    setupEventListeners();
});

async function initializeApp() {
    if (!currentUser) return;
    
    // Load settings
    await loadSettings();
    
    // Update UI for role
    document.body.className = `rock4one-bg role-${currentUser.role}`;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Update user display
    document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;
    document.getElementById('userRole').textContent = formatRole(currentUser.role);
    document.getElementById('userRole').className = `role-badge role-${currentUser.role}`;
    
    // Show first appropriate tab
    showDefaultTab();
    
    // Load data based on role
    await loadRoleData();
}

function formatRole(role) {
    const roles = {
        'super_admin': 'Super Admin',
        'admin': 'Admin',
        'seller': 'Seller'
    };
    return roles[role] || role;
}

function showDefaultTab() {
    let defaultTab;
    switch(currentUser.role) {
        case 'seller':
            defaultTab = 'register';
            break;
        case 'super_admin':
            defaultTab = 'verification-queue';
            break;
        case 'admin':
            defaultTab = 'view-registrations';
            break;
        default:
            defaultTab = 'register';
    }
    showTab(defaultTab);
}

async function loadRoleData() {
    switch(currentUser.role) {
        case 'seller':
            await loadMySales();
            updateRegistrationForm();
            break;
        case 'super_admin':
            await Promise.all([
                loadVerificationQueue(),
                loadAllRegistrations(),
                loadSellers(),
                loadStatistics()
            ]);
            updateRegistrationForm();
            break;
        case 'admin':
            await Promise.all([
                loadAdminRegistrations(),
                loadAdminSellerStats(),
                loadStatistics()
            ]);
            break;
    }
}

// =====================================================
// SETTINGS MANAGEMENT
// =====================================================

async function loadSettings() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*');
        
        if (error) throw error;
        
        // Convert to key-value object
        settings = {};
        data.forEach(s => {
            settings[s.setting_key] = s.setting_value;
        });
        
        // Update UI with settings
        updateUIWithSettings();
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function updateUIWithSettings() {
    // Update entry type options with prices
    const stagPrice = settings.stag_price || '2750';
    const couplePrice = settings.couple_price || '4750';
    
    const entryTypeSelect = document.getElementById('entryType');
    if (entryTypeSelect) {
        entryTypeSelect.innerHTML = `
            <option value="">Select entry type</option>
            <option value="stag">Stag - ₹${stagPrice}</option>
            <option value="couple">Couple - ₹${couplePrice}</option>
        `;
    }
    
    // Update UPI display for sellers
    const upiDisplay = document.getElementById('displayUpiId');
    if (upiDisplay) {
        upiDisplay.textContent = settings.upi_id || 'Not configured';
    }
    
    // Update settings form if super admin
    if (currentUser?.role === 'super_admin') {
        document.querySelectorAll('#settingsForm [data-key]').forEach(input => {
            const key = input.dataset.key;
            if (settings[key] !== undefined) {
                input.value = settings[key];
            }
        });
    }
}

async function saveSettings(e) {
    e.preventDefault();
    
    try {
        const updates = [];
        document.querySelectorAll('#settingsForm [data-key]').forEach(input => {
            updates.push({
                setting_key: input.dataset.key,
                setting_value: input.value,
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            });
        });
        
        for (const update of updates) {
            const { error } = await supabase
                .from('settings')
                .update({ 
                    setting_value: update.setting_value,
                    updated_at: update.updated_at,
                    updated_by: update.updated_by
                })
                .eq('setting_key', update.setting_key);
            
            if (error) throw error;
        }
        
        await loadSettings();
        showToast('Settings saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    }
}

// =====================================================
// AUTHENTICATION
// =====================================================

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .eq('is_active', true);
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            throw new Error('Invalid username or password');
        }
        
        currentUser = users[0];
        sessionStorage.setItem('rock4one_user', JSON.stringify(currentUser));
        
        errorDiv.classList.add('hidden');
        await initializeApp();
        
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = error.message || 'Login failed';
        errorDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('rock4one_user');
    document.body.className = 'rock4one-bg';
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginForm').reset();
}

// =====================================================
// NAVIGATION
// =====================================================

function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active from all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('secondary');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
    // Activate nav button
    const navBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
        navBtn.classList.remove('secondary');
    }
    
    // Refresh data for certain tabs
    refreshTabData(tabId);
}

async function refreshTabData(tabId) {
    switch(tabId) {
        case 'verification-queue':
            await loadVerificationQueue();
            break;
        case 'all-registrations':
            await loadAllRegistrations();
            break;
        case 'my-sales':
            await loadMySales();
            break;
        case 'seller-management':
            await loadSellers();
            break;
        case 'statistics':
            await loadStatistics();
            break;
        case 'view-registrations':
            await loadAdminRegistrations();
            break;
        case 'view-sellers':
            await loadAdminSellerStats();
            break;
    }
}

// =====================================================
// SELLER: REGISTRATION FORM
// =====================================================

function updateRegistrationForm() {
    const entryType = document.getElementById('entryType');
    const paymentMode = document.getElementById('paymentMode');
    const priceDisplay = document.getElementById('priceDisplay');
    const ticketPrice = document.getElementById('ticketPrice');
    const paymentRefSection = document.getElementById('paymentRefSection');
    const paymentReference = document.getElementById('paymentReference');
    const refLabel = document.getElementById('refLabel');
    
    // Update price display
    if (entryType.value) {
        const price = entryType.value === 'stag' 
            ? (settings.stag_price || '2750') 
            : (settings.couple_price || '4750');
        ticketPrice.textContent = price;
        priceDisplay.classList.remove('hidden');
    } else {
        priceDisplay.classList.add('hidden');
    }
    
    // Show/hide payment reference based on mode
    if (paymentMode.value === 'upi' || paymentMode.value === 'bank_transfer') {
        paymentRefSection.classList.remove('hidden');
        paymentReference.required = true;
        refLabel.textContent = paymentMode.value === 'upi' ? 'UTR Number' : 'Transaction Reference';
    } else {
        paymentRefSection.classList.add('hidden');
        paymentReference.required = false;
    }
}

async function handleRegistration(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
    
    try {
        const entryType = document.getElementById('entryType').value;
        const ticketPrice = entryType === 'stag' 
            ? parseInt(settings.stag_price || 2750) 
            : parseInt(settings.couple_price || 4750);
        
        const guestData = {
            guest_name: document.getElementById('guestName').value.trim(),
            mobile_number: document.getElementById('guestMobile').value.trim(),
            entry_type: entryType,
            payment_mode: document.getElementById('paymentMode').value,
            payment_reference: document.getElementById('paymentReference')?.value.trim() || null,
            ticket_price: ticketPrice,
            registered_by: currentUser.id,
            status: 'pending_verification'
        };
        
        const { data, error } = await supabase
            .from('guests')
            .insert([guestData])
            .select();
        
        if (error) throw error;
        
        // Reset form
        e.target.reset();
        document.getElementById('priceDisplay').classList.add('hidden');
        document.getElementById('paymentRefSection').classList.add('hidden');
        
        showToast('Registration submitted successfully!', 'success');
        
        // Refresh my sales
        await loadMySales();
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Failed to submit registration: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Registration';
    }
}

// =====================================================
// SELLER: MY SALES
// =====================================================

async function loadMySales() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .eq('registered_by', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Update stats
        const total = guests.length;
        const pending = guests.filter(g => g.status === 'pending_verification').length;
        const verified = guests.filter(g => !['pending_verification', 'rejected'].includes(g.status)).length;
        const totalAmount = guests
            .filter(g => !['pending_verification', 'rejected'].includes(g.status))
            .reduce((sum, g) => sum + (g.ticket_price || 0), 0);
        
        document.getElementById('myTotalCount').textContent = total;
        document.getElementById('myPendingCount').textContent = pending;
        document.getElementById('myVerifiedCount').textContent = verified;
        document.getElementById('myTotalAmount').textContent = `₹${totalAmount.toLocaleString()}`;
        
        // Render table
        const tbody = document.getElementById('mySalesTableBody');
        if (guests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No registrations yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = guests.map(g => `
            <tr>
                <td class="font-semibold">${escapeHtml(g.guest_name)}</td>
                <td>${g.mobile_number}</td>
                <td class="capitalize">${g.entry_type}</td>
                <td>₹${g.ticket_price?.toLocaleString()}</td>
                <td class="capitalize">${formatPaymentMode(g.payment_mode)}</td>
                <td>${getStatusBadge(g.status)}</td>
                <td class="text-sm text-gray-400">${formatDate(g.created_at)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading my sales:', error);
    }
}

// =====================================================
// SUPER ADMIN: VERIFICATION QUEUE
// =====================================================

async function loadVerificationQueue(filter = 'all') {
    try {
        let query = supabase
            .from('guests')
            .select(`
                *,
                seller:registered_by(username, full_name)
            `)
            .eq('status', 'pending_verification')
            .order('created_at', { ascending: true });
        
        if (filter !== 'all') {
            query = query.eq('payment_mode', filter);
        }
        
        const { data: guests, error } = await query;
        
        if (error) throw error;
        
        // Update pending badge
        const pendingBadge = document.getElementById('pendingBadge');
        if (pendingBadge) {
            pendingBadge.textContent = guests.length;
            pendingBadge.style.display = guests.length > 0 ? 'inline' : 'none';
        }
        
        const tbody = document.getElementById('verificationQueueBody');
        if (guests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">No pending verifications 🎉</td></tr>';
            return;
        }
        
        tbody.innerHTML = guests.map(g => `
            <tr data-payment="${g.payment_mode}">
                <td class="font-semibold">${escapeHtml(g.guest_name)}</td>
                <td>${g.mobile_number}</td>
                <td class="capitalize">${g.entry_type}</td>
                <td class="font-semibold text-yellow-400">₹${g.ticket_price?.toLocaleString()}</td>
                <td>${formatPaymentMode(g.payment_mode)}</td>
                <td class="text-sm">${g.payment_reference || '-'}</td>
                <td class="text-sm">${g.seller?.full_name || g.seller?.username || 'Unknown'}</td>
                <td>
                    <button onclick="showVerifyModal('${g.id}')" class="rock4one-button success text-xs py-1 px-2 mr-1">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="quickReject('${g.id}')" class="rock4one-button danger text-xs py-1 px-2">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading verification queue:', error);
    }
}

window.showVerifyModal = async function(guestId) {
    try {
        const { data: guest, error } = await supabase
            .from('guests')
            .select(`*, seller:registered_by(username, full_name)`)
            .eq('id', guestId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('verifyGuestId').value = guestId;
        document.getElementById('verifyGuestInfo').innerHTML = `
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-400">Guest:</span>
                    <span class="font-semibold">${escapeHtml(guest.guest_name)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Mobile:</span>
                    <span>${guest.mobile_number}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Entry:</span>
                    <span class="capitalize">${guest.entry_type}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Amount:</span>
                    <span class="text-yellow-400 font-bold">₹${guest.ticket_price?.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Payment:</span>
                    <span>${formatPaymentMode(guest.payment_mode)}</span>
                </div>
                ${guest.payment_reference ? `
                <div class="flex justify-between">
                    <span class="text-gray-400">Reference:</span>
                    <span class="font-mono text-sm">${guest.payment_reference}</span>
                </div>
                ` : ''}
                <div class="flex justify-between">
                    <span class="text-gray-400">Seller:</span>
                    <span>${guest.seller?.full_name || guest.seller?.username}</span>
                </div>
            </div>
        `;
        
        document.getElementById('verifyNotes').value = '';
        openModal('verifyModal');
        
    } catch (error) {
        console.error('Error loading guest for verification:', error);
        showToast('Failed to load guest details', 'error');
    }
};

async function handleVerification(e) {
    e.preventDefault();
    
    const guestId = document.getElementById('verifyGuestId').value;
    const notes = document.getElementById('verifyNotes').value;
    
    try {
        const { error } = await supabase
            .from('guests')
            .update({
                status: 'payment_verified',
                verified_by: currentUser.id,
                verified_at: new Date().toISOString(),
                verification_notes: notes || null
            })
            .eq('id', guestId);
        
        if (error) throw error;
        
        closeModal('verifyModal');
        showToast('Payment verified successfully!', 'success');
        await loadVerificationQueue();
        
        // Ask to generate pass
        if (confirm('Generate and send guest pass now?')) {
            await generateAndShowPass(guestId);
        }
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        showToast('Failed to verify payment', 'error');
    }
}

window.rejectPayment = async function() {
    const guestId = document.getElementById('verifyGuestId').value;
    const notes = document.getElementById('verifyNotes').value;
    
    if (!confirm('Are you sure you want to reject this payment?')) return;
    
    try {
        const { error } = await supabase
            .from('guests')
            .update({
                status: 'rejected',
                verified_by: currentUser.id,
                verified_at: new Date().toISOString(),
                verification_notes: notes || 'Payment rejected'
            })
            .eq('id', guestId);
        
        if (error) throw error;
        
        closeModal('verifyModal');
        showToast('Payment rejected', 'warning');
        await loadVerificationQueue();
        
    } catch (error) {
        console.error('Error rejecting payment:', error);
        showToast('Failed to reject payment', 'error');
    }
};

window.quickReject = async function(guestId) {
    if (!confirm('Reject this registration?')) return;
    
    try {
        const { error } = await supabase
            .from('guests')
            .update({
                status: 'rejected',
                verified_by: currentUser.id,
                verified_at: new Date().toISOString(),
                verification_notes: 'Quick rejected'
            })
            .eq('id', guestId);
        
        if (error) throw error;
        
        showToast('Registration rejected', 'warning');
        await loadVerificationQueue();
        
    } catch (error) {
        console.error('Error rejecting:', error);
        showToast('Failed to reject', 'error');
    }
};

// =====================================================
// SUPER ADMIN: ALL REGISTRATIONS
// =====================================================

let allRegistrationsCache = [];
let currentStatusFilter = 'all';

async function loadAllRegistrations(statusFilter = 'all') {
    currentStatusFilter = statusFilter;
    
    try {
        let query = supabase
            .from('guests')
            .select(`*, seller:registered_by(username, full_name)`)
            .order('created_at', { ascending: false });
        
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }
        
        const { data: guests, error } = await query;
        
        if (error) throw error;
        
        allRegistrationsCache = guests;
        renderAllRegistrations(guests);
        
    } catch (error) {
        console.error('Error loading all registrations:', error);
    }
}

function renderAllRegistrations(guests) {
    const tbody = document.getElementById('allRegistrationsBody');
    
    if (guests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">No registrations found</td></tr>';
        return;
    }
    
    tbody.innerHTML = guests.map(g => `
        <tr>
            <td class="font-semibold">${escapeHtml(g.guest_name)}</td>
            <td>${g.mobile_number}</td>
            <td class="capitalize">${g.entry_type}</td>
            <td>₹${g.ticket_price?.toLocaleString()}</td>
            <td>${formatPaymentMode(g.payment_mode)}</td>
            <td class="text-sm">${g.seller?.full_name || g.seller?.username || '-'}</td>
            <td>${getStatusBadge(g.status)}</td>
            <td>
                ${getActionButtons(g)}
            </td>
        </tr>
    `).join('');
}

function getActionButtons(guest) {
    const buttons = [];
    
    if (guest.status === 'pending_verification') {
        buttons.push(`<button onclick="showVerifyModal('${guest.id}')" class="rock4one-button success text-xs py-1 px-2" title="Verify"><i class="fas fa-check"></i></button>`);
    }
    
    if (['payment_verified', 'pass_generated'].includes(guest.status)) {
        buttons.push(`<button onclick="generateAndShowPass('${guest.id}')" class="rock4one-button text-xs py-1 px-2" title="Generate Pass"><i class="fas fa-qrcode"></i></button>`);
    }
    
    if (guest.status === 'pass_sent') {
        buttons.push(`<button onclick="resendPass('${guest.id}')" class="rock4one-button secondary text-xs py-1 px-2" title="Resend"><i class="fab fa-whatsapp"></i></button>`);
    }
    
    return buttons.join(' ') || '-';
}

// =====================================================
// PASS GENERATION & WHATSAPP
// =====================================================

window.generateAndShowPass = async function(guestId) {
    try {
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();
        
        if (error) throw error;
        
        currentGuestForPass = guest;
        
        // Generate QR Code
        const qrData = JSON.stringify({
            id: guest.id,
            name: guest.guest_name,
            type: guest.entry_type,
            ts: Date.now()
        });
        
        const qrCodeDataURL = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2,
            color: { dark: '#0a0a0a', light: '#ffffff' }
        });
        
        // Render pass preview
        const eventName = settings.event_name || 'Rock 4 One';
        const eventTagline = settings.event_tagline || 'Harmony for Humanity';
        const eventDate = settings.event_date || 'TBD';
        const eventVenue = settings.event_venue || 'TBD';
        
        document.getElementById('guestPassPreview').innerHTML = `
            <div id="passForDownload" style="
                width: 100%;
                max-width: 400px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
                border: 4px solid #d4a853;
                border-radius: 16px;
                color: white;
                font-family: Arial, sans-serif;
            ">
                <div style="text-align: center; border-bottom: 2px solid #d4a853; padding-bottom: 15px; margin-bottom: 15px;">
                    <h1 style="
                        font-size: 28px;
                        font-weight: bold;
                        margin: 0;
                        background: linear-gradient(135deg, #d4a853, #f5d76e);
                        -webkit-background-clip: text;
                        background-clip: text;
                        color: transparent;
                        letter-spacing: 2px;
                    ">${eventName.toUpperCase()}</h1>
                    <p style="color: #d4a853; font-size: 12px; letter-spacing: 2px; margin: 5px 0 0;">${eventTagline}</p>
                    <p style="color: #f5d76e; font-size: 18px; margin: 10px 0 0;">🎫 GUEST PASS</p>
                </div>
                
                <div style="display: flex; gap: 20px;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 12px;">
                            <p style="color: #d4a853; font-size: 11px; margin: 0;">NAME</p>
                            <p style="font-size: 18px; font-weight: bold; margin: 2px 0 0;">${escapeHtml(guest.guest_name)}</p>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <p style="color: #d4a853; font-size: 11px; margin: 0;">MOBILE</p>
                            <p style="font-size: 16px; margin: 2px 0 0;">${guest.mobile_number}</p>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <p style="color: #d4a853; font-size: 11px; margin: 0;">ENTRY TYPE</p>
                            <p style="font-size: 16px; font-weight: bold; margin: 2px 0 0; text-transform: uppercase;">${guest.entry_type}</p>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="background: white; padding: 8px; border-radius: 8px; border: 2px solid #d4a853;">
                            <img src="${qrCodeDataURL}" alt="QR Code" style="width: 120px; height: 120px;">
                        </div>
                        <p style="color: #888; font-size: 10px; margin-top: 5px;">Scan at entry</p>
                    </div>
                </div>
                
                <div style="border-top: 2px solid #d4a853; margin-top: 15px; padding-top: 15px; text-align: center;">
                    <p style="color: #d4a853; font-size: 12px; margin: 0;">📅 ${eventDate}</p>
                    <p style="color: #d4a853; font-size: 12px; margin: 5px 0 0;">📍 ${eventVenue}</p>
                </div>
                
                <div style="text-align: center; margin-top: 15px; color: #666; font-size: 20px;">
                    🎸 🎵 🎸 🎵 🎸
                </div>
            </div>
        `;
        
        // Update guest status
        await supabase
            .from('guests')
            .update({
                status: 'pass_generated',
                pass_generated_at: new Date().toISOString()
            })
            .eq('id', guestId);
        
        openModal('passModal');
        
    } catch (error) {
        console.error('Error generating pass:', error);
        showToast('Failed to generate pass', 'error');
    }
};

window.sendWhatsApp = async function() {
    if (!currentGuestForPass) return;
    
    try {
        // Download pass first
        await downloadPass();
        
        // Format phone number
        let phone = currentGuestForPass.mobile_number.replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;
        
        const eventName = settings.event_name || 'Rock 4 One';
        const eventDate = settings.event_date || 'TBD';
        const eventVenue = settings.event_venue || 'TBD';
        
        const message = `🎸 *${eventName.toUpperCase()} - GUEST PASS* 🎸

Hello ${currentGuestForPass.guest_name}!

Your registration is confirmed! ✅

📋 *Details:*
• Name: ${currentGuestForPass.guest_name}
• Entry: ${currentGuestForPass.entry_type.toUpperCase()}
• Mobile: ${currentGuestForPass.mobile_number}

📅 Date: ${eventDate}
📍 Venue: ${eventVenue}

Please show this pass and QR code at the entrance.

See you at the event! 🎵

_Harmony for Humanity_`;
        
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        // Update status
        await supabase
            .from('guests')
            .update({
                status: 'pass_sent',
                pass_sent_at: new Date().toISOString()
            })
            .eq('id', currentGuestForPass.id);
        
        closeModal('passModal');
        showToast('Pass sent via WhatsApp!', 'success');
        
        // Refresh data
        await loadAllRegistrations(currentStatusFilter);
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        showToast('Failed to send WhatsApp', 'error');
    }
};

window.downloadPass = async function() {
    const passElement = document.getElementById('passForDownload');
    if (!passElement || !currentGuestForPass) return;
    
    try {
        const canvas = await html2canvas(passElement, {
            backgroundColor: '#0a0a0a',
            scale: 2
        });
        
        const link = document.createElement('a');
        link.download = `rock4one-pass-${currentGuestForPass.guest_name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
    } catch (error) {
        console.error('Error downloading pass:', error);
        showToast('Failed to download pass', 'error');
    }
};

window.resendPass = async function(guestId) {
    await generateAndShowPass(guestId);
};

// =====================================================
// SUPER ADMIN: SELLER MANAGEMENT
// =====================================================

async function loadSellers() {
    try {
        // Get all users
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (userError) throw userError;
        
        // Get seller stats
        const { data: stats, error: statsError } = await supabase
            .from('seller_stats')
            .select('*');
        
        // Merge data
        const usersWithStats = users.map(u => {
            const stat = stats?.find(s => s.seller_id === u.id) || {};
            return { ...u, ...stat };
        });
        
        const tbody = document.getElementById('sellersTableBody');
        tbody.innerHTML = usersWithStats.map(u => `
            <tr>
                <td class="font-semibold">${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.full_name || '-')}</td>
                <td>${u.mobile_number || '-'}</td>
                <td><span class="role-badge role-${u.role}">${formatRole(u.role)}</span></td>
                <td>${u.total_registrations || 0}</td>
                <td class="text-green-400">₹${(u.total_verified_amount || 0).toLocaleString()}</td>
                <td>
                    <span class="text-xs px-2 py-1 rounded ${u.is_active ? 'bg-green-600' : 'bg-red-600'}">
                        ${u.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button onclick="editUser('${u.id}')" class="rock4one-button secondary text-xs py-1 px-2 mr-1">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="toggleUserStatus('${u.id}', ${!u.is_active})" class="rock4one-button ${u.is_active ? 'danger' : 'success'} text-xs py-1 px-2">
                        <i class="fas fa-${u.is_active ? 'ban' : 'check'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading sellers:', error);
    }
}

window.showAddUserModal = function() {
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('userForm').reset();
    document.getElementById('editUserId').value = '';
    document.getElementById('userPassword').required = true;
    document.getElementById('passwordHint').textContent = 'Min 6 characters';
    openModal('userModal');
};

window.editUser = async function(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('userModalTitle').textContent = 'Edit User';
        document.getElementById('editUserId').value = userId;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').required = false;
        document.getElementById('passwordHint').textContent = 'Leave blank to keep current';
        document.getElementById('userFullName').value = user.full_name || '';
        document.getElementById('userMobile').value = user.mobile_number || '';
        document.getElementById('userRole').value = user.role;
        
        openModal('userModal');
        
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Failed to load user', 'error');
    }
};

async function handleUserForm(e) {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const isEdit = !!userId;
    
    const userData = {
        username: document.getElementById('userUsername').value.trim(),
        full_name: document.getElementById('userFullName').value.trim() || null,
        mobile_number: document.getElementById('userMobile').value.trim() || null,
        role: document.getElementById('userRole').value
    };
    
    const password = document.getElementById('userPassword').value;
    if (password) {
        userData.password = password;
    }
    
    try {
        if (isEdit) {
            const { error } = await supabase
                .from('users')
                .update(userData)
                .eq('id', userId);
            
            if (error) throw error;
            showToast('User updated successfully!', 'success');
        } else {
            if (!password) {
                showToast('Password is required for new users', 'error');
                return;
            }
            userData.password = password;
            userData.created_by = currentUser.id;
            
            const { error } = await supabase
                .from('users')
                .insert([userData]);
            
            if (error) throw error;
            showToast('User created successfully!', 'success');
        }
        
        closeModal('userModal');
        await loadSellers();
        
    } catch (error) {
        console.error('Error saving user:', error);
        showToast('Failed to save user: ' + error.message, 'error');
    }
}

window.toggleUserStatus = async function(userId, newStatus) {
    const action = newStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
        const { error } = await supabase
            .from('users')
            .update({ is_active: newStatus })
            .eq('id', userId);
        
        if (error) throw error;
        
        showToast(`User ${action}d successfully!`, 'success');
        await loadSellers();
        
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast('Failed to update user', 'error');
    }
};

// =====================================================
// ADMIN: READ-ONLY VIEWS
// =====================================================

async function loadAdminRegistrations() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select(`*, seller:registered_by(username, full_name)`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('adminRegTableBody');
        if (guests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">No registrations found</td></tr>';
            return;
        }
        
        tbody.innerHTML = guests.map(g => `
            <tr>
                <td class="font-semibold">${escapeHtml(g.guest_name)}</td>
                <td>${g.mobile_number}</td>
                <td class="capitalize">${g.entry_type}</td>
                <td>₹${g.ticket_price?.toLocaleString()}</td>
                <td>${formatPaymentMode(g.payment_mode)}</td>
                <td class="text-sm">${g.seller?.full_name || g.seller?.username || '-'}</td>
                <td>${getStatusBadge(g.status)}</td>
                <td class="text-sm text-gray-400">${formatDate(g.created_at)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading admin registrations:', error);
    }
}

async function loadAdminSellerStats() {
    try {
        const { data: stats, error } = await supabase
            .from('seller_stats')
            .select('*');
        
        if (error) throw error;
        
        const tbody = document.getElementById('adminSellerStatsBody');
        if (!stats || stats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-gray-500">No seller data</td></tr>';
            return;
        }
        
        tbody.innerHTML = stats.map(s => `
            <tr>
                <td class="font-semibold">${escapeHtml(s.full_name || s.username)}</td>
                <td>${s.total_registrations}</td>
                <td class="text-orange-400">${s.pending_count}</td>
                <td class="text-green-400">${s.verified_count}</td>
                <td>${s.stag_count}</td>
                <td>${s.couple_count}</td>
                <td>₹${s.cash_collected?.toLocaleString()}</td>
                <td>₹${s.upi_collected?.toLocaleString()}</td>
                <td>₹${s.bank_collected?.toLocaleString()}</td>
                <td class="font-semibold text-yellow-400">₹${s.total_verified_amount?.toLocaleString()}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading admin seller stats:', error);
    }
}

// =====================================================
// STATISTICS
// =====================================================

async function loadStatistics() {
    try {
        const { data: stats, error } = await supabase
            .from('overall_stats')
            .select('*')
            .single();
        
        if (error) throw error;
        
        // Update stat displays
        document.getElementById('statTotalReg').textContent = stats.total_registrations || 0;
        document.getElementById('statTotalPax').textContent = stats.total_pax || 0;
        document.getElementById('statTotalRevenue').textContent = `₹${(stats.total_verified_revenue || 0).toLocaleString()}`;
        document.getElementById('statCheckedIn').textContent = stats.checked_in || 0;
        
        document.getElementById('statPending').textContent = stats.pending_verification || 0;
        document.getElementById('statVerified').textContent = stats.payment_verified || 0;
        document.getElementById('statGenerated').textContent = stats.pass_generated || 0;
        document.getElementById('statSent').textContent = stats.pass_sent || 0;
        document.getElementById('statChecked').textContent = stats.checked_in || 0;
        document.getElementById('statRejected').textContent = stats.rejected || 0;
        
        document.getElementById('statCash').textContent = `₹${(stats.cash_revenue || 0).toLocaleString()}`;
        document.getElementById('statUpi').textContent = `₹${(stats.upi_revenue || 0).toLocaleString()}`;
        document.getElementById('statBank').textContent = `₹${(stats.bank_revenue || 0).toLocaleString()}`;
        document.getElementById('statTotalVerified').textContent = `₹${(stats.total_verified_revenue || 0).toLocaleString()}`;
        
        document.getElementById('statStagCount').textContent = stats.stag_count || 0;
        document.getElementById('statCoupleCount').textContent = stats.couple_count || 0;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

window.downloadRegistrationsCSV = async function() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select(`*, seller:registered_by(username, full_name)`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const csvData = guests.map(g => ({
            'Guest Name': g.guest_name,
            'Mobile': g.mobile_number,
            'Entry Type': g.entry_type,
            'Amount': g.ticket_price,
            'Payment Mode': g.payment_mode,
            'Payment Ref': g.payment_reference || '',
            'Seller': g.seller?.full_name || g.seller?.username || '',
            'Status': g.status,
            'Registered At': formatDate(g.created_at),
            'Verified At': g.verified_at ? formatDate(g.verified_at) : ''
        }));
        
        const csv = Papa.unparse(csvData);
        downloadFile(csv, `rock4one-registrations-${formatDateForFile()}.csv`, 'text/csv');
        
    } catch (error) {
        console.error('Error downloading CSV:', error);
        showToast('Failed to download CSV', 'error');
    }
};

window.downloadStatsReport = async function() {
    // Similar to CSV but with summary stats
    showToast('Generating report...', 'info');
    await downloadRegistrationsCSV();
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });
    
    // Registration form
    document.getElementById('registrationForm')?.addEventListener('submit', handleRegistration);
    document.getElementById('entryType')?.addEventListener('change', updateRegistrationForm);
    document.getElementById('paymentMode')?.addEventListener('change', updateRegistrationForm);
    
    // Settings form
    document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
    
    // User form
    document.getElementById('userForm')?.addEventListener('submit', handleUserForm);
    
    // Verification form
    document.getElementById('verifyForm')?.addEventListener('submit', handleVerification);
    
    // Queue filters
    document.querySelectorAll('.queue-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.queue-filter').forEach(b => {
                b.classList.remove('active');
                b.classList.add('secondary');
            });
            btn.classList.add('active');
            btn.classList.remove('secondary');
            loadVerificationQueue(btn.dataset.filter);
        });
    });
    
    // Registration filters
    document.querySelectorAll('.reg-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.reg-filter').forEach(b => {
                b.classList.remove('active');
                b.classList.add('secondary');
            });
            btn.classList.add('active');
            btn.classList.remove('secondary');
            loadAllRegistrations(btn.dataset.status);
        });
    });
    
    // Search
    document.getElementById('searchRegistrations')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allRegistrationsCache.filter(g => 
            g.guest_name.toLowerCase().includes(term) ||
            g.mobile_number.includes(term) ||
            (g.seller?.full_name || '').toLowerCase().includes(term)
        );
        renderAllRegistrations(filtered);
    });
}

function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

window.closeModal = closeModal;

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    const types = {
        success: { bg: 'bg-green-600', icon: 'fa-check-circle' },
        error: { bg: 'bg-red-600', icon: 'fa-times-circle' },
        warning: { bg: 'bg-yellow-600', icon: 'fa-exclamation-circle' },
        info: { bg: 'bg-blue-600', icon: 'fa-info-circle' }
    };
    
    const config = types[type] || types.info;
    
    toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${config.bg}`;
    icon.className = `fas ${config.icon} text-xl`;
    msg.textContent = message;
    
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.transform = 'translateY(100%)';
        toast.style.opacity = '0';
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateForFile() {
    return new Date().toISOString().slice(0, 10);
}

function formatPaymentMode(mode) {
    const modes = {
        'cash': '💵 Cash',
        'upi': '📱 UPI',
        'bank_transfer': '🏦 Bank'
    };
    return modes[mode] || mode;
}

function getStatusBadge(status) {
    const statuses = {
        'pending_verification': { class: 'status-pending', text: 'Pending' },
        'payment_verified': { class: 'status-verified', text: 'Verified' },
        'pass_generated': { class: 'status-generated', text: 'Pass Ready' },
        'pass_sent': { class: 'status-sent', text: 'Sent' },
        'checked_in': { class: 'status-checked', text: 'Checked In' },
        'rejected': { class: 'status-rejected', text: 'Rejected' }
    };
    const s = statuses[status] || { class: '', text: status };
    return `<span class="status-badge ${s.class}">${s.text}</span>`;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// Make functions globally available
window.loadMySales = loadMySales;
window.loadVerificationQueue = loadVerificationQueue;
window.loadAllRegistrations = loadAllRegistrations;
window.loadSellers = loadSellers;
window.loadStatistics = loadStatistics;