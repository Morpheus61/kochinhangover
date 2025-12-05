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
    document.getElementById('userRoleBadge').textContent = formatRole(currentUser.role);
    document.getElementById('userRoleBadge').className = `role-badge role-${currentUser.role}`;
    
    // Show first appropriate tab
    showDefaultTab();
    
    // Load data based on role
    await loadRoleData();
}

function formatRole(role) {
    const roles = {
        'super_admin': 'Super Admin',
        'admin': 'Admin',
        'seller': 'Seller',
        'entry_marshall': 'Entry Marshall'
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
        case 'entry_marshall':
            defaultTab = 'entry-scan';
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
        case 'entry_marshall':
            await loadEntryStats();
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
    
    // Update Payment QR Code display for sellers
    const paymentQRDisplay = document.getElementById('paymentQRDisplay');
    const sellerQRImage = document.getElementById('sellerQRImage');
    const downloadQRBtn = document.getElementById('downloadQRBtnContainer');
    
    if (paymentQRDisplay && sellerQRImage && settings.payment_qr_code) {
        sellerQRImage.src = settings.payment_qr_code;
        paymentQRDisplay.classList.remove('hidden');
        if (downloadQRBtn) downloadQRBtn.classList.remove('hidden');
    } else if (paymentQRDisplay) {
        paymentQRDisplay.classList.add('hidden');
        if (downloadQRBtn) downloadQRBtn.classList.add('hidden');
    }
    
    // Update Bank Details display for sellers
    const bankDisplay = document.getElementById('paymentBankDisplay');
    const bankDetails = document.getElementById('displayBankDetails');
    if (bankDisplay && bankDetails && settings.bank_details) {
        bankDetails.textContent = settings.bank_details;
        bankDisplay.classList.remove('hidden');
    } else if (bankDisplay) {
        bankDisplay.classList.add('hidden');
    }
    
    // Update settings form if super admin
    if (currentUser?.role === 'super_admin') {
        document.querySelectorAll('#settingsForm [data-key]').forEach(input => {
            const key = input.dataset.key;
            if (settings[key] !== undefined) {
                input.value = settings[key];
            }
        });
        
        // Show QR code preview in settings
        const qrPreview = document.getElementById('qrCodePreview');
        const qrImage = document.getElementById('qrCodeImage');
        const qrUploadArea = document.getElementById('qrCodeUploadArea');
        
        if (qrPreview && qrImage && settings.payment_qr_code) {
            qrImage.src = settings.payment_qr_code;
            qrPreview.classList.remove('hidden');
            if (qrUploadArea) qrUploadArea.classList.add('hidden');
        } else if (qrPreview) {
            qrPreview.classList.add('hidden');
            if (qrUploadArea) qrUploadArea.classList.remove('hidden');
        }
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

// Payment QR Code Upload Handler
window.handleQRCodeUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be less than 2MB', 'error');
        return;
    }
    
    try {
        showToast('Uploading QR code...', 'info');
        
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // Save to settings
        const { error } = await supabase
            .from('settings')
            .upsert({ 
                setting_key: 'payment_qr_code',
                setting_value: base64,
                description: 'Payment QR Code image (base64)',
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            }, { onConflict: 'setting_key' });
        
        if (error) throw error;
        
        // Reload settings to update UI
        await loadSettings();
        showToast('Payment QR Code uploaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error uploading QR code:', error);
        showToast('Failed to upload QR code', 'error');
    }
    
    // Clear the input
    event.target.value = '';
};

// Remove Payment QR Code
window.removePaymentQR = async function() {
    if (!confirm('Remove the Payment QR Code?')) return;
    
    try {
        const { error } = await supabase
            .from('settings')
            .update({ 
                setting_value: '',
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            })
            .eq('setting_key', 'payment_qr_code');
        
        if (error) throw error;
        
        await loadSettings();
        showToast('Payment QR Code removed', 'success');
        
    } catch (error) {
        console.error('Error removing QR code:', error);
        showToast('Failed to remove QR code', 'error');
    }
};

// Share Payment Info via WhatsApp (for Sellers)
window.sharePaymentInfo = function() {
    const eventName = settings.event_name || 'Rock 4 One';
    const upiId = settings.upi_id || '';
    const bankDetails = settings.bank_details || '';
    const stagPrice = settings.stag_price || '2750';
    const couplePrice = settings.couple_price || '4750';
    
    let message = `🎸 *${eventName.toUpperCase()}* 🎸\n`;
    message += `_Harmony for Humanity_\n\n`;
    message += `💰 *PAYMENT INFORMATION*\n\n`;
    
    message += `🎫 *Ticket Prices:*\n`;
    message += `• Stag: ₹${parseInt(stagPrice).toLocaleString()}\n`;
    message += `• Couple: ₹${parseInt(couplePrice).toLocaleString()}\n\n`;
    
    if (upiId) {
        message += `📱 *UPI ID:*\n`;
        message += `\`${upiId}\`\n\n`;
    }
    
    if (bankDetails) {
        message += `🏦 *Bank Transfer:*\n`;
        message += `${bankDetails}\n\n`;
    }
    
    if (settings.payment_qr_code) {
        message += `📲 *QR Code:* I'll send the payment QR code separately.\n\n`;
    }
    
    message += `✅ After payment, please share:\n`;
    message += `• Your Name\n`;
    message += `• Mobile Number\n`;
    message += `• Payment Screenshot/UTR\n\n`;
    
    message += `Thank you! 🎵`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    // If QR code exists, prompt to download it
    if (settings.payment_qr_code) {
        setTimeout(() => {
            if (confirm('Would you like to download the Payment QR Code to share separately?')) {
                downloadPaymentQR();
            }
        }, 500);
    }
};

// Download Payment QR Code (for Sellers to share)
window.downloadPaymentQR = function() {
    if (!settings.payment_qr_code) {
        showToast('No Payment QR Code available', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = 'rock4one-payment-qr.png';
        link.href = settings.payment_qr_code;
        link.click();
        showToast('QR Code downloaded!', 'success');
    } catch (error) {
        console.error('Error downloading QR:', error);
        showToast('Failed to download QR code', 'error');
    }
};

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
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
    
    // Remove active from all mobile menu items
    document.querySelectorAll('.mobile-menu-item').forEach(item => {
        item.classList.remove('active');
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
    
    // Activate mobile menu item
    const mobileItem = document.querySelector(`.mobile-menu-item[data-tab="${tabId}"]`);
    if (mobileItem) {
        mobileItem.classList.add('active');
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
        case 'entry-scan':
            await loadEntryStats();
            break;
        case 'gate-management':
            await loadGateManagement();
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
            // Handle combined filters
            if (statusFilter === 'verified') {
                // Verified includes payment_verified and pass_generated
                query = query.in('status', ['payment_verified', 'pass_generated']);
            } else {
                query = query.eq('status', statusFilter);
            }
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
                <td class="text-sm">
                    ${u.club_name ? `<span class="text-yellow-400">${escapeHtml(u.club_name)}</span>` : ''}
                    ${u.club_number ? `<br><span class="text-gray-500 text-xs">#${escapeHtml(u.club_number)}</span>` : ''}
                    ${!u.club_name && !u.club_number ? '-' : ''}
                </td>
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
    document.getElementById('userFullName').required = true;
    document.getElementById('userMobile').required = true;
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
        document.getElementById('userFullName').required = true;
        document.getElementById('userMobile').required = true;
        document.getElementById('passwordHint').textContent = 'Leave blank to keep current';
        document.getElementById('userFullName').value = user.full_name || '';
        document.getElementById('userMobile').value = user.mobile_number || '';
        document.getElementById('userClubName').value = user.club_name || '';
        document.getElementById('userClubNumber').value = user.club_number || '';
        document.getElementById('userRoleSelect').value = user.role;
        
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
    
    // Validate required fields
    const fullName = document.getElementById('userFullName').value.trim();
    const mobileNumber = document.getElementById('userMobile').value.trim();
    
    if (!fullName) {
        showToast('Full Name is required', 'error');
        return;
    }
    
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        showToast('Valid 10-digit Mobile Number is required', 'error');
        return;
    }
    
    const userData = {
        username: document.getElementById('userUsername').value.trim(),
        full_name: fullName,
        mobile_number: mobileNumber,
        club_name: document.getElementById('userClubName').value.trim() || null,
        club_number: document.getElementById('userClubNumber').value.trim() || null,
        role: document.getElementById('userRoleSelect').value
    };
    
    // Validate role is selected
    if (!userData.role) {
        showToast('Please select a role', 'error');
        return;
    }
    
    const password = document.getElementById('userPassword').value;
    if (password) {
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
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
            tbody.innerHTML = '<tr><td colspan="11" class="text-center py-8 text-gray-500">No seller data</td></tr>';
            return;
        }
        
        tbody.innerHTML = stats.map(s => `
            <tr>
                <td class="font-semibold">${escapeHtml(s.full_name || s.username)}</td>
                <td class="text-sm">
                    ${s.club_name ? `<span class="text-yellow-400">${escapeHtml(s.club_name)}</span>` : '-'}
                </td>
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
    
    // Mobile menu items
    document.querySelectorAll('.mobile-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            if (tab) {
                showTab(tab);
                toggleMobileMenu(); // Close menu after selection
            }
        });
    });
}

// Mobile Menu Toggle
window.toggleMobileMenu = function() {
    const menu = document.getElementById('mobileSlideMenu');
    const overlay = document.getElementById('mobileMenuOverlay');
    
    if (menu && overlay) {
        menu.classList.toggle('active');
        overlay.classList.toggle('active');
        
        // Update menu role display
        const roleDisplay = document.getElementById('mobileMenuRole');
        if (roleDisplay && currentUser) {
            roleDisplay.textContent = formatRole(currentUser.role);
        }
        
        // Update pending badge in mobile menu
        const pendingBadge = document.getElementById('pendingBadge');
        const mobilePendingBadge = document.getElementById('mobilePendingBadge');
        if (pendingBadge && mobilePendingBadge) {
            mobilePendingBadge.textContent = pendingBadge.textContent;
        }
    }
};

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

// =====================================================
// ENTRY MARSHALL - GATE MANAGEMENT & CHECK-IN
// =====================================================

let qrScanner = null;
let currentDuty = null;
let scanMode = 'entry'; // 'entry' or 'exit'

async function loadEntryStats() {
    try {
        // Display marshall name
        const marshallDisplay = document.getElementById('marshallNameDisplay');
        if (marshallDisplay) {
            marshallDisplay.textContent = `Logged in as: ${currentUser.full_name || currentUser.username}`;
        }
        
        // Load available gates for dropdown
        await loadGatesDropdown();
        
        // Check if marshall is on duty
        await checkDutyStatus();
        
        // Get stats
        const { count: myCheckins } = await supabase
            .from('guest_movements')
            .select('*', { count: 'exact', head: true })
            .eq('marshall_id', currentUser.id)
            .eq('movement_type', 'entry');
        
        const { count: insideVenue } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .eq('is_inside_venue', true);
        
        const { count: totalExpected } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .in('status', ['pass_sent', 'checked_in']);
        
        // Update displays
        const myCheckinsEl = document.getElementById('entryMyCheckins');
        const insideEl = document.getElementById('entryCheckedInCount');
        const expectedEl = document.getElementById('entryTotalExpected');
        
        if (myCheckinsEl) myCheckinsEl.textContent = myCheckins || 0;
        if (insideEl) insideEl.textContent = insideVenue || 0;
        if (expectedEl) expectedEl.textContent = totalExpected || 0;
        
        // Load recent activity
        await loadRecentActivity();
        
    } catch (error) {
        console.error('Error loading entry stats:', error);
    }
}

async function loadGatesDropdown() {
    try {
        const { data: gates, error } = await supabase
            .from('entry_gates')
            .select('*')
            .eq('is_active', true)
            .order('gate_name');
        
        if (error) throw error;
        
        const select = document.getElementById('gateSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Choose Gate --</option>';
        
        if (gates && gates.length > 0) {
            gates.forEach(gate => {
                select.innerHTML += `<option value="${gate.id}">${gate.gate_name} (${gate.gate_code})</option>`;
            });
        }
        
    } catch (error) {
        console.error('Error loading gates:', error);
    }
}

async function checkDutyStatus() {
    try {
        const { data: duty, error } = await supabase
            .from('marshall_duties')
            .select('*, gate:entry_gates(*)')
            .eq('marshall_id', currentUser.id)
            .eq('status', 'on_duty')
            .single();
        
        if (duty && !error) {
            currentDuty = duty;
            showOnDutyUI(duty);
        } else {
            currentDuty = null;
            showOffDutyUI();
        }
        
    } catch (error) {
        // No active duty found
        currentDuty = null;
        showOffDutyUI();
    }
}

function showOnDutyUI(duty) {
    const offDutySection = document.getElementById('offDutySection');
    const onDutySection = document.getElementById('onDutySection');
    const scanSection = document.getElementById('scanSection');
    const notOnDutyMessage = document.getElementById('notOnDutyMessage');
    const currentGateName = document.getElementById('currentGateName');
    const dutyDuration = document.getElementById('dutyDuration');
    
    if (offDutySection) offDutySection.classList.add('hidden');
    if (onDutySection) onDutySection.classList.remove('hidden');
    if (scanSection) scanSection.classList.remove('hidden');
    if (notOnDutyMessage) notOnDutyMessage.classList.add('hidden');
    
    if (currentGateName && duty.gate) {
        currentGateName.textContent = duty.gate.gate_name;
    }
    
    if (dutyDuration && duty.clock_in_at) {
        const clockIn = new Date(duty.clock_in_at);
        dutyDuration.textContent = `Since: ${clockIn.toLocaleTimeString()}`;
    }
}

function showOffDutyUI() {
    const offDutySection = document.getElementById('offDutySection');
    const onDutySection = document.getElementById('onDutySection');
    const scanSection = document.getElementById('scanSection');
    const notOnDutyMessage = document.getElementById('notOnDutyMessage');
    
    if (offDutySection) offDutySection.classList.remove('hidden');
    if (onDutySection) onDutySection.classList.add('hidden');
    if (scanSection) scanSection.classList.add('hidden');
    if (notOnDutyMessage) notOnDutyMessage.classList.remove('hidden');
}

window.clockIn = async function() {
    const gateId = document.getElementById('gateSelect').value;
    
    if (!gateId) {
        showToast('Please select a gate first', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('marshall_duties')
            .insert({
                marshall_id: currentUser.id,
                gate_id: gateId,
                status: 'on_duty',
                clock_in_at: new Date().toISOString()
            })
            .select('*, gate:entry_gates(*)')
            .single();
        
        if (error) throw error;
        
        currentDuty = data;
        showOnDutyUI(data);
        showToast(`Clocked in at ${data.gate.gate_name}`, 'success');
        
    } catch (error) {
        console.error('Error clocking in:', error);
        showToast('Failed to clock in', 'error');
    }
};

window.clockOut = async function() {
    if (!currentDuty) return;
    
    try {
        const { error } = await supabase
            .from('marshall_duties')
            .update({
                status: 'off_duty',
                clock_out_at: new Date().toISOString()
            })
            .eq('id', currentDuty.id);
        
        if (error) throw error;
        
        showToast('Clocked out successfully', 'success');
        currentDuty = null;
        showOffDutyUI();
        
    } catch (error) {
        console.error('Error clocking out:', error);
        showToast('Failed to clock out', 'error');
    }
};

window.setScanMode = function(mode) {
    scanMode = mode;
    
    const btnEntry = document.getElementById('btnModeEntry');
    const btnExit = document.getElementById('btnModeExit');
    const scanModeText = document.getElementById('scanModeText');
    const scanButton = document.getElementById('scanButton');
    
    if (mode === 'entry') {
        btnEntry?.classList.remove('secondary');
        btnExit?.classList.add('secondary');
        if (scanModeText) scanModeText.textContent = 'ENTRY';
        if (scanButton) scanButton.classList.remove('danger');
    } else {
        btnEntry?.classList.add('secondary');
        btnExit?.classList.remove('secondary');
        if (scanModeText) scanModeText.textContent = 'EXIT';
        if (scanButton) scanButton.classList.add('danger');
    }
};

async function loadRecentActivity() {
    try {
        const { data: recent, error } = await supabase
            .from('guest_movements')
            .select('*, guest:guests(guest_name, entry_type)')
            .eq('marshall_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        const container = document.getElementById('recentCheckins');
        if (!container) return;
        
        if (!recent || recent.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No activity yet</p>';
            return;
        }
        
        container.innerHTML = recent.map(m => {
            const isEntry = m.movement_type === 'entry';
            const bgColor = isEntry ? 'bg-green-900/20 border-green-600/30' : 'bg-red-900/20 border-red-600/30';
            const textColor = isEntry ? 'text-green-400' : 'text-red-400';
            const icon = isEntry ? 'fa-sign-in-alt' : 'fa-sign-out-alt';
            
            return `
                <div class="flex justify-between items-center p-2 ${bgColor} rounded border">
                    <div>
                        <i class="fas ${icon} ${textColor} mr-2"></i>
                        <span class="font-semibold">${escapeHtml(m.guest?.guest_name || 'Unknown')}</span>
                        <span class="text-xs text-gray-400 ml-1 capitalize">(${m.guest?.entry_type || ''})</span>
                    </div>
                    <span class="text-xs ${textColor}">${formatTimeAgo(m.created_at)}</span>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(date);
}

// QR Scanner
window.startQRScanner = async function() {
    if (!currentDuty) {
        showToast('Please clock in first', 'error');
        return;
    }
    
    openModal('scannerModal');
    
    const video = document.getElementById('qrVideo');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        video.srcObject = stream;
        video.play();
        
        if (!window.QrScanner) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner.umd.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
        }
        
        qrScanner = new QrScanner(video, result => {
            processQRCode(result.data);
        }, {
            highlightScanRegion: true,
            highlightCodeOutline: true
        });
        
        await qrScanner.start();
        
    } catch (error) {
        console.error('Camera error:', error);
        closeModal('scannerModal');
        showToast('Camera access denied', 'error');
    }
};

window.stopQRScanner = function() {
    if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
        qrScanner = null;
    }
    
    const video = document.getElementById('qrVideo');
    if (video?.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    closeModal('scannerModal');
};

async function processQRCode(qrData) {
    stopQRScanner();
    
    try {
        let guestData;
        try {
            guestData = JSON.parse(qrData);
        } catch {
            showCheckinResult(false, 'Invalid QR Code', 'This is not a valid guest pass.');
            return;
        }
        
        if (!guestData.id) {
            showCheckinResult(false, 'Invalid Pass', 'Invalid guest information.');
            return;
        }
        
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestData.id)
            .single();
        
        if (error || !guest) {
            showCheckinResult(false, 'Guest Not Found', 'No guest found with this pass.');
            return;
        }
        
        if (scanMode === 'entry') {
            await processEntry(guest);
        } else {
            await processExit(guest);
        }
        
    } catch (error) {
        console.error('Error processing QR:', error);
        showCheckinResult(false, 'Error', 'An error occurred.');
    }
}

async function processEntry(guest) {
    // Check if already inside
    if (guest.is_inside_venue) {
        showCheckinResult(false, 'Already Inside', 
            `<strong>${guest.guest_name}</strong> is already inside the venue.`, 'warning');
        return;
    }
    
    // Check if pass is valid
    if (!['pass_sent', 'checked_in'].includes(guest.status)) {
        showCheckinResult(false, 'Invalid Pass', 
            `This pass is not valid. Status: ${guest.status}`, 'warning');
        return;
    }
    
    try {
        // Update guest status
        await supabase
            .from('guests')
            .update({
                status: 'checked_in',
                is_inside_venue: true,
                last_gate_id: currentDuty.gate_id,
                entry_count: (guest.entry_count || 0) + 1,
                last_movement_at: new Date().toISOString(),
                checked_in_by: currentUser.id
            })
            .eq('id', guest.id);
        
        // Log movement
        await supabase
            .from('guest_movements')
            .insert({
                guest_id: guest.id,
                gate_id: currentDuty.gate_id,
                marshall_id: currentUser.id,
                movement_type: 'entry'
            });
        
        const entryNum = (guest.entry_count || 0) + 1;
        const reentryNote = entryNum > 1 ? `<br><span class="text-sm text-yellow-400">(Re-entry #${entryNum})</span>` : '';
        
        showCheckinResult(true, 'Entry Successful!', 
            `<strong>${guest.guest_name}</strong><br>
            <span class="text-sm text-gray-400 capitalize">${guest.entry_type} Entry</span>${reentryNote}`, 'success');
        
        await loadEntryStats();
        
    } catch (error) {
        console.error('Error processing entry:', error);
        showCheckinResult(false, 'Entry Failed', 'An error occurred.');
    }
}

async function processExit(guest) {
    // Check if inside venue
    if (!guest.is_inside_venue) {
        showCheckinResult(false, 'Not Inside', 
            `<strong>${guest.guest_name}</strong> is not currently inside the venue.`, 'warning');
        return;
    }
    
    try {
        // Update guest status
        await supabase
            .from('guests')
            .update({
                is_inside_venue: false,
                last_movement_at: new Date().toISOString()
            })
            .eq('id', guest.id);
        
        // Log movement
        await supabase
            .from('guest_movements')
            .insert({
                guest_id: guest.id,
                gate_id: currentDuty.gate_id,
                marshall_id: currentUser.id,
                movement_type: 'exit'
            });
        
        showCheckinResult(true, 'Exit Recorded', 
            `<strong>${guest.guest_name}</strong> has exited.<br>
            <span class="text-sm text-gray-400">They can re-enter by scanning again.</span>`, 'success');
        
        await loadEntryStats();
        
    } catch (error) {
        console.error('Error processing exit:', error);
        showCheckinResult(false, 'Exit Failed', 'An error occurred.');
    }
}

window.manualLookup = async function() {
    const mobile = document.getElementById('manualMobile')?.value.trim();
    
    if (!mobile || mobile.length !== 10) {
        showToast('Please enter a valid 10-digit mobile number', 'error');
        return;
    }
    
    if (!currentDuty) {
        showToast('Please clock in first', 'error');
        return;
    }
    
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .eq('mobile_number', mobile);
        
        if (error) throw error;
        
        if (!guests || guests.length === 0) {
            showCheckinResult(false, 'Guest Not Found', `No guest found with mobile ${mobile}.`);
            return;
        }
        
        const guest = guests[0];
        showGuestLookup(guest);
        
    } catch (error) {
        console.error('Error in manual lookup:', error);
        showToast('An error occurred', 'error');
    }
};

function showGuestLookup(guest) {
    const content = document.getElementById('guestLookupContent');
    if (!content) return;
    
    const statusColor = guest.is_inside_venue ? 'green' : 'gray';
    const statusText = guest.is_inside_venue ? 'Inside Venue' : 'Outside Venue';
    
    content.innerHTML = `
        <div class="text-center mb-4">
            <h4 class="text-xl font-bold">${escapeHtml(guest.guest_name)}</h4>
            <p class="text-sm text-gray-400 capitalize">${guest.entry_type} Entry</p>
            <span class="inline-block mt-2 px-3 py-1 rounded-full text-sm bg-${statusColor}-900/30 text-${statusColor}-400 border border-${statusColor}-600/30">
                ${statusText}
            </span>
        </div>
        <div class="space-y-2 text-sm mb-4">
            <div class="flex justify-between">
                <span class="text-gray-400">Mobile:</span>
                <span>${guest.mobile_number}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-400">Entry Count:</span>
                <span>${guest.entry_count || 0}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-400">Status:</span>
                <span>${guest.status}</span>
            </div>
        </div>
        <div class="flex gap-2">
            ${!guest.is_inside_venue ? `
                <button onclick="processEntryFromLookup('${guest.id}')" class="rock4one-button success flex-1">
                    <i class="fas fa-sign-in-alt mr-1"></i>Entry
                </button>
            ` : `
                <button onclick="processExitFromLookup('${guest.id}')" class="rock4one-button danger flex-1">
                    <i class="fas fa-sign-out-alt mr-1"></i>Exit
                </button>
            `}
            <button onclick="closeModal('guestLookupModal')" class="rock4one-button secondary flex-1">Cancel</button>
        </div>
    `;
    
    openModal('guestLookupModal');
}

window.processEntryFromLookup = async function(guestId) {
    closeModal('guestLookupModal');
    const { data: guest } = await supabase.from('guests').select('*').eq('id', guestId).single();
    if (guest) await processEntry(guest);
    document.getElementById('manualMobile').value = '';
};

window.processExitFromLookup = async function(guestId) {
    closeModal('guestLookupModal');
    const { data: guest } = await supabase.from('guests').select('*').eq('id', guestId).single();
    if (guest) await processExit(guest);
    document.getElementById('manualMobile').value = '';
};

function showCheckinResult(success, title, message, type = null) {
    const resultType = type || (success ? 'success' : 'error');
    const icon = resultType === 'success' ? 'fa-check-circle text-green-400' : 
                 resultType === 'warning' ? 'fa-exclamation-triangle text-yellow-400' : 
                 'fa-times-circle text-red-400';
    const bgColor = resultType === 'success' ? 'bg-green-900/30 border-green-600' : 
                    resultType === 'warning' ? 'bg-yellow-900/30 border-yellow-600' :
                    'bg-red-900/30 border-red-600';
    
    const content = document.getElementById('checkinResultContent');
    if (content) {
        content.innerHTML = `
            <div class="p-6 ${bgColor} border-2 rounded-xl mb-4">
                <i class="fas ${icon} text-6xl mb-4"></i>
                <h3 class="text-2xl font-bold mb-2">${title}</h3>
                <p class="text-gray-300">${message}</p>
            </div>
        `;
    }
    
    openModal('checkinResultModal');
    
    if (success) {
        setTimeout(() => closeModal('checkinResultModal'), 3000);
    }
}

// =====================================================
// GATE MANAGEMENT (Super Admin)
// =====================================================

async function loadGates() {
    try {
        const { data: gates, error } = await supabase
            .from('entry_gates')
            .select('*')
            .order('gate_name');
        
        if (error) throw error;
        
        const container = document.getElementById('gatesListSettings');
        if (!container) return;
        
        if (!gates || gates.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No gates configured</p>';
            return;
        }
        
        container.innerHTML = gates.map(gate => `
            <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div>
                    <span class="font-semibold">${escapeHtml(gate.gate_name)}</span>
                    <span class="text-xs text-yellow-400 ml-2">(${gate.gate_code})</span>
                    ${!gate.is_active ? '<span class="text-xs text-red-400 ml-2">[Inactive]</span>' : ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="editGate('${gate.id}')" class="text-blue-400 hover:text-blue-300 text-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteGate('${gate.id}')" class="text-red-400 hover:text-red-300 text-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading gates:', error);
    }
}

window.openGateModal = function(gateId = null) {
    document.getElementById('editGateId').value = '';
    document.getElementById('gateName').value = '';
    document.getElementById('gateCode').value = '';
    document.getElementById('gateDescription').value = '';
    document.getElementById('gateActive').checked = true;
    document.getElementById('gateModalTitle').textContent = 'Add Entry Gate';
    
    openModal('gateModal');
};

window.editGate = async function(gateId) {
    try {
        const { data: gate, error } = await supabase
            .from('entry_gates')
            .select('*')
            .eq('id', gateId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('editGateId').value = gate.id;
        document.getElementById('gateName').value = gate.gate_name;
        document.getElementById('gateCode').value = gate.gate_code;
        document.getElementById('gateDescription').value = gate.description || '';
        document.getElementById('gateActive').checked = gate.is_active;
        document.getElementById('gateModalTitle').textContent = 'Edit Entry Gate';
        
        openModal('gateModal');
        
    } catch (error) {
        console.error('Error loading gate:', error);
        showToast('Failed to load gate', 'error');
    }
};

window.deleteGate = async function(gateId) {
    if (!confirm('Are you sure you want to delete this gate?')) return;
    
    try {
        const { error } = await supabase
            .from('entry_gates')
            .delete()
            .eq('id', gateId);
        
        if (error) throw error;
        
        showToast('Gate deleted', 'success');
        await loadGates();
        
    } catch (error) {
        console.error('Error deleting gate:', error);
        showToast('Failed to delete gate', 'error');
    }
};

// Gate form submission
document.getElementById('gateForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const gateId = document.getElementById('editGateId').value;
    const gateData = {
        gate_name: document.getElementById('gateName').value,
        gate_code: document.getElementById('gateCode').value.toUpperCase(),
        description: document.getElementById('gateDescription').value || null,
        is_active: document.getElementById('gateActive').checked
    };
    
    try {
        if (gateId) {
            const { error } = await supabase
                .from('entry_gates')
                .update(gateData)
                .eq('id', gateId);
            if (error) throw error;
        } else {
            gateData.created_by = currentUser?.id;
            const { error } = await supabase
                .from('entry_gates')
                .insert(gateData);
            if (error) throw error;
        }
        
        showToast('Gate saved successfully', 'success');
        closeModal('gateModal');
        await loadGates();
        
    } catch (error) {
        console.error('Error saving gate:', error);
        showToast('Failed to save gate: ' + error.message, 'error');
    }
});

// =====================================================
// VENUE STATUS (Admin/Super Admin Statistics)
// =====================================================

window.refreshGateManagement = async function() {
    await loadGateManagement();
    showToast('Gate management refreshed', 'success');
};

async function loadGateManagement() {
    try {
        // Get guests inside venue
        const { count: insideCount } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .eq('is_inside_venue', true);
        
        // Get guests who have exited
        const { count: checkedInCount } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'checked_in');
        
        const exitedCount = (checkedInCount || 0) - (insideCount || 0);
        
        // Get marshalls on duty
        const { count: marshallCount } = await supabase
            .from('marshall_duties')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'on_duty');
        
        // Get active gates
        const { count: gateCount } = await supabase
            .from('entry_gates')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        
        // Update displays for Gate Management tab
        const insideEl = document.getElementById('gateVenueInside');
        const exitedEl = document.getElementById('gateVenueExited');
        const marshallsEl = document.getElementById('gateMarshallCount');
        const gatesEl = document.getElementById('gateActiveCount');
        
        if (insideEl) insideEl.textContent = insideCount || 0;
        if (exitedEl) exitedEl.textContent = exitedCount >= 0 ? exitedCount : 0;
        if (marshallsEl) marshallsEl.textContent = marshallCount || 0;
        if (gatesEl) gatesEl.textContent = gateCount || 0;
        
        // Load gate cards
        await loadGateCards();
        
        // Load marshalls on duty list
        await loadGateMarshallsList();
        
        // Load gate configuration (for super admin)
        await loadGateConfig();
        
    } catch (error) {
        console.error('Error loading gate management:', error);
    }
}

async function loadGateCards() {
    try {
        const { data: gates, error } = await supabase
            .from('entry_gates')
            .select('*')
            .eq('is_active', true);
        
        if (error) throw error;
        
        const container = document.getElementById('gateCardsContainer');
        if (!container) return;
        
        if (!gates || gates.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm col-span-full text-center py-4">No gates configured. Add gates in Settings.</p>';
            return;
        }
        
        let html = '';
        
        for (const gate of gates) {
            // Get marshalls at this gate
            const { data: marshalls } = await supabase
                .from('marshall_duties')
                .select('*, marshall:users(full_name)')
                .eq('gate_id', gate.id)
                .eq('status', 'on_duty');
            
            // Get entries at this gate
            const { count: entryCount } = await supabase
                .from('guest_movements')
                .select('*', { count: 'exact', head: true })
                .eq('gate_id', gate.id)
                .eq('movement_type', 'entry');
            
            // Get exits at this gate
            const { count: exitCount } = await supabase
                .from('guest_movements')
                .select('*', { count: 'exact', head: true })
                .eq('gate_id', gate.id)
                .eq('movement_type', 'exit');
            
            const marshallNames = marshalls?.map(m => m.marshall?.full_name).filter(Boolean).join(', ') || 'No marshalls';
            const hasMarshall = marshalls && marshalls.length > 0;
            
            html += `
                <div class="p-4 bg-gray-800/50 rounded-lg border ${hasMarshall ? 'border-green-600/30' : 'border-gray-700'}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h5 class="font-semibold text-yellow-400">${escapeHtml(gate.gate_name)}</h5>
                            <span class="text-xs text-gray-500">${gate.gate_code}</span>
                        </div>
                        ${hasMarshall ? '<span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">Active</span>' : '<span class="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded">Unmanned</span>'}
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div class="text-center p-2 bg-green-900/20 rounded">
                            <span class="block text-lg font-bold text-green-400">${entryCount || 0}</span>
                            <span class="text-xs text-gray-400">Entries</span>
                        </div>
                        <div class="text-center p-2 bg-red-900/20 rounded">
                            <span class="block text-lg font-bold text-red-400">${exitCount || 0}</span>
                            <span class="text-xs text-gray-400">Exits</span>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400">
                        <i class="fas fa-user-shield mr-1"></i>${marshallNames}
                    </p>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading gate cards:', error);
    }
}

async function loadGateMarshallsList() {
    try {
        const { data: duties, error } = await supabase
            .from('marshall_duties')
            .select('*, marshall:users(full_name, mobile_number), gate:entry_gates(gate_name, gate_code)')
            .eq('status', 'on_duty')
            .order('clock_in_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('gateMarshallsList');
        if (!container) return;
        
        if (!duties || duties.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No marshalls on duty</p>';
            return;
        }
        
        container.innerHTML = duties.map(d => {
            const clockIn = new Date(d.clock_in_at);
            const duration = Math.floor((Date.now() - clockIn.getTime()) / 60000);
            const durationText = duration < 60 ? `${duration}m` : `${Math.floor(duration/60)}h ${duration%60}m`;
            
            return `
                <div class="flex items-center justify-between p-3 bg-green-900/20 rounded-lg border border-green-600/30">
                    <div>
                        <span class="font-semibold">${escapeHtml(d.marshall?.full_name || 'Unknown')}</span>
                        <span class="text-xs text-gray-400 ml-2">${d.marshall?.mobile_number || ''}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-sm text-yellow-400">${d.gate?.gate_name || 'Unknown Gate'}</span>
                        <span class="block text-xs text-gray-500">${durationText} on duty</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading gate marshalls list:', error);
    }
}

async function loadGateConfig() {
    try {
        const { data: gates, error } = await supabase
            .from('entry_gates')
            .select('*')
            .order('gate_name');
        
        if (error) throw error;
        
        const container = document.getElementById('gateConfigList');
        if (!container) return;
        
        if (!gates || gates.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No gates configured</p>';
            return;
        }
        
        container.innerHTML = gates.map(gate => `
            <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div>
                    <span class="font-semibold">${escapeHtml(gate.gate_name)}</span>
                    <span class="text-xs text-yellow-400 ml-2">(${gate.gate_code})</span>
                    ${!gate.is_active ? '<span class="text-xs text-red-400 ml-2">[Inactive]</span>' : '<span class="text-xs text-green-400 ml-2">[Active]</span>'}
                </div>
                <div class="flex gap-2">
                    <button onclick="editGate('${gate.id}')" class="text-blue-400 hover:text-blue-300 text-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteGate('${gate.id}')" class="text-red-400 hover:text-red-300 text-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading gate config:', error);
    }
}

window.refreshVenueStatus = async function() {
    await loadVenueStatus();
    showToast('Venue status refreshed', 'success');
};

async function loadVenueStatus() {
    try {
        // Get guests inside venue
        const { count: insideCount } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .eq('is_inside_venue', true);
        
        // Get guests who have exited
        const { count: checkedInCount } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'checked_in');
        
        const exitedCount = (checkedInCount || 0) - (insideCount || 0);
        
        // Get marshalls on duty
        const { count: marshallCount } = await supabase
            .from('marshall_duties')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'on_duty');
        
        // Get active gates
        const { count: gateCount } = await supabase
            .from('entry_gates')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        
        // Update displays
        const insideEl = document.getElementById('venueGuestsInside');
        const exitedEl = document.getElementById('venueGuestsExited');
        const marshallsEl = document.getElementById('venueMarshallsOnDuty');
        const gatesEl = document.getElementById('venueActiveGates');
        
        if (insideEl) insideEl.textContent = insideCount || 0;
        if (exitedEl) exitedEl.textContent = exitedCount >= 0 ? exitedCount : 0;
        if (marshallsEl) marshallsEl.textContent = marshallCount || 0;
        if (gatesEl) gatesEl.textContent = gateCount || 0;
        
        // Load gate stats
        await loadGateStats();
        
        // Load marshalls on duty list
        await loadMarshallsOnDuty();
        
    } catch (error) {
        console.error('Error loading venue status:', error);
    }
}

async function loadGateStats() {
    try {
        const { data: gates, error } = await supabase
            .from('entry_gates')
            .select('*')
            .eq('is_active', true);
        
        if (error) throw error;
        
        const container = document.getElementById('gateStatsContainer');
        if (!container) return;
        
        if (!gates || gates.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm col-span-full text-center py-4">No gates configured</p>';
            return;
        }
        
        let html = '';
        
        for (const gate of gates) {
            // Get marshalls at this gate
            const { data: marshalls } = await supabase
                .from('marshall_duties')
                .select('*, marshall:users(full_name)')
                .eq('gate_id', gate.id)
                .eq('status', 'on_duty');
            
            // Get entries at this gate
            const { count: entryCount } = await supabase
                .from('guest_movements')
                .select('*', { count: 'exact', head: true })
                .eq('gate_id', gate.id)
                .eq('movement_type', 'entry');
            
            // Get exits at this gate
            const { count: exitCount } = await supabase
                .from('guest_movements')
                .select('*', { count: 'exact', head: true })
                .eq('gate_id', gate.id)
                .eq('movement_type', 'exit');
            
            const marshallNames = marshalls?.map(m => m.marshall?.full_name).filter(Boolean).join(', ') || 'No marshalls';
            const hasMarshall = marshalls && marshalls.length > 0;
            
            html += `
                <div class="p-4 bg-gray-800/50 rounded-lg border ${hasMarshall ? 'border-green-600/30' : 'border-gray-700'}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h5 class="font-semibold text-yellow-400">${escapeHtml(gate.gate_name)}</h5>
                            <span class="text-xs text-gray-500">${gate.gate_code}</span>
                        </div>
                        ${hasMarshall ? '<span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">Active</span>' : '<span class="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded">Unmanned</span>'}
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div class="text-center p-2 bg-green-900/20 rounded">
                            <span class="block text-lg font-bold text-green-400">${entryCount || 0}</span>
                            <span class="text-xs text-gray-400">Entries</span>
                        </div>
                        <div class="text-center p-2 bg-red-900/20 rounded">
                            <span class="block text-lg font-bold text-red-400">${exitCount || 0}</span>
                            <span class="text-xs text-gray-400">Exits</span>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400">
                        <i class="fas fa-user-shield mr-1"></i>${marshallNames}
                    </p>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading gate stats:', error);
    }
}

async function loadMarshallsOnDuty() {
    try {
        const { data: duties, error } = await supabase
            .from('marshall_duties')
            .select('*, marshall:users(full_name, mobile_number), gate:entry_gates(gate_name, gate_code)')
            .eq('status', 'on_duty')
            .order('clock_in_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('marshallsOnDutyList');
        if (!container) return;
        
        if (!duties || duties.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No marshalls on duty</p>';
            return;
        }
        
        container.innerHTML = duties.map(d => {
            const clockIn = new Date(d.clock_in_at);
            const duration = Math.floor((Date.now() - clockIn.getTime()) / 60000);
            const durationText = duration < 60 ? `${duration}m` : `${Math.floor(duration/60)}h ${duration%60}m`;
            
            return `
                <div class="flex items-center justify-between p-3 bg-green-900/20 rounded-lg border border-green-600/30">
                    <div>
                        <span class="font-semibold">${escapeHtml(d.marshall?.full_name || 'Unknown')}</span>
                        <span class="text-xs text-gray-400 ml-2">${d.marshall?.mobile_number || ''}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-sm text-yellow-400">${d.gate?.gate_name || 'Unknown Gate'}</span>
                        <span class="block text-xs text-gray-500">${durationText} on duty</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading marshalls on duty:', error);
    }
}

// Load gates and venue status when statistics tab is shown
const originalLoadStatistics = loadStatistics;
loadStatistics = async function() {
    await originalLoadStatistics();
    await loadVenueStatus();
    await loadGates();
};

// Make functions globally available
window.loadMySales = loadMySales;
window.loadVerificationQueue = loadVerificationQueue;
window.loadAllRegistrations = loadAllRegistrations;
window.loadSellers = loadSellers;
window.loadStatistics = loadStatistics;
window.loadEntryStats = loadEntryStats;
window.loadVenueStatus = loadVenueStatus;
window.loadGates = loadGates;
window.loadGateManagement = loadGateManagement;