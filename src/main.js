// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';

const supabaseUrl = 'https://rcedawlruorpkzzrvkqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZWRhd2xydW9ycGt6enJ2a3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxOTU4MDQsImV4cCI6MjA1OTc3MTgwNH0.opF31e2g9ZGIJBAR6McDvBEXPtSOhrmW1c_QQh_u1yg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Constants for entry prices
const ENTRY_PRICES = {
    stag: 2750,
    couple: 4750
};

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
        console.log('Handling login for user:', user);
        
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        showApp();
        await loadGuests();
        
        // Show initial tab
        showTab('registration');
        
    } catch (error) {
        console.error('Login handling error:', error);
        showLoginError(error.message || 'Login failed');
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
        
        // Reset UI
        showLoginScreen();
        resetQRScanner();
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

// Show login error
function showLoginError(message) {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
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
        
        // Map database column names to our expected property names
        guests = (data || []).map(guest => ({
            id: guest.id,
            name: guest.guest_name,
            mobile: guest.mobile_number,
            entry_type: guest.entry_type,
            verified: guest.status === 'verified',
            created_at: guest.created_at,
            club_name: guest.club_name,
            payment_method: guest.payment_method,
            amount: guest.amount,
            paid_amount: guest.paid_amount
        }));
        
        renderGuestList();
        updateStatistics();
        
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
                <button class="text-green-400 hover:text-green-600 mr-2" onclick="generateQR('${guest.id}')">
                    <i class="fas fa-qrcode"></i>
                </button>
                <button class="text-purple-400 hover:text-purple-600 mr-2" onclick="shareGuestPass('${guest.id}')">
                    <i class="fab fa-whatsapp"></i>
                </button>
                <button class="text-red-400 hover:text-red-600" onclick="deleteGuest('${guest.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Update statistics
function updateStatistics() {
    const totalElement = document.getElementById('totalRegistrations');
    const verifiedElement = document.getElementById('verifiedEntries');
    const pendingElement = document.getElementById('pendingEntries');
    
    if (totalElement) totalElement.textContent = guests.length;
    if (verifiedElement) verifiedElement.textContent = guests.filter(g => g.verified).length;
    if (pendingElement) pendingElement.textContent = guests.filter(g => !g.verified).length;
}

// Register new guest
async function registerGuest(guestData) {
    try {
        updateDataStatus('Registering guest...');
        
        const { data, error } = await supabase
            .from('guests')
            .insert([{
                guest_name: guestData.name,
                mobile_number: guestData.mobile,
                entry_type: guestData.entryType,
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        await loadGuests();
        registrationForm.reset();
        updateDataStatus('Guest registered successfully');
        
        // Generate QR code for the new guest
        if (data && data.length > 0) {
            generateQR(data[0].id);
        }
        
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
            .update({ status: 'verified' })
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

// Generate QR code for a guest
window.generateQR = async function(guestId) {
    try {
        // Find the guest
        const guest = guests.find(g => g.id === guestId);
        if (!guest) throw new Error('Guest not found');
        
        // Create QR code data
        const qrData = JSON.stringify({
            id: guest.id,
            name: guest.name,
            mobile: guest.mobile,
            entry_type: guest.entry_type,
            verified: guest.verified
        });
        
        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(qrData);
        
        // Create modal to display QR code
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg max-w-sm w-full">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">Guest QR Code</h3>
                    <button class="text-gray-400 hover:text-white" id="closeQRModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="text-center mb-4">
                    <p class="mb-2"><strong>Name:</strong> ${guest.name}</p>
                    <p class="mb-4"><strong>Entry Type:</strong> ${guest.entry_type === 'couple' ? 'Couple' : 'Stag'}</p>
                    <div class="bg-white p-4 rounded-lg inline-block">
                        <img src="${qrCodeDataURL}" alt="Guest QR Code" class="mx-auto">
                    </div>
                </div>
                <div class="flex justify-between">
                    <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" id="downloadQR">
                        <i class="fas fa-download mr-2"></i> Download
                    </button>
                    <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded" id="shareQR">
                        <i class="fas fa-share-alt mr-2"></i> Share
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal
        document.getElementById('closeQRModal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Download QR code
        document.getElementById('downloadQR').addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = qrCodeDataURL;
            link.download = `kochin-hangover-qr-${guest.name}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        
        // Share QR code (if mobile)
        document.getElementById('shareQR').addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Kochin Hangover QR Code',
                    text: `QR Code for ${guest.name}`,
                    url: qrCodeDataURL
                }).catch(console.error);
            } else {
                alert('Sharing is not supported on this device');
            }
        });
        
    } catch (error) {
        console.error('QR generation error:', error);
        alert('Failed to generate QR code: ' + error.message);
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
    
    try {
        // Parse QR code data
        const guestData = JSON.parse(decodedText);
        
        // Display guest info
        qrReaderResults.innerHTML = `
            <div class="bg-gray-700 p-4 rounded">
                <h3 class="font-bold text-lg mb-2">Guest Information</h3>
                <p><strong>Name:</strong> ${guestData.name || 'N/A'}</p>
                <p><strong>Entry Type:</strong> ${guestData.entry_type === 'couple' ? 'Couple' : 'Stag'}</p>
                <p><strong>Status:</strong> ${guestData.verified ? 'Verified' : 'Not Verified'}</p>
                <div class="mt-4">
                    <button onclick="verifyGuestFromQR('${guestData.id}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                        <i class="fas fa-check mr-2"></i> Verify Entry
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('QR parse error:', error);
        qrReaderResults.innerHTML = `
            <div class="bg-red-500 text-white p-3 rounded">
                <p>Invalid QR Code: ${error.message}</p>
            </div>
        `;
    }
}

function onScanError(error) {
    console.error('QR Scan error:', error);
    qrReaderResults.innerHTML = `
        <div class="bg-red-500 text-white p-3 rounded">
            <p>Scan error: ${error}</p>
        </div>
    `;
}

// Verify guest from QR code
window.verifyGuestFromQR = async function(guestId) {
    try {
        const { error } = await supabase
            .from('guests')
            .update({ status: 'verified' })
            .eq('id', guestId);
        
        if (error) throw error;
        
        await loadGuests();
        updateDataStatus('Guest verified successfully');
        
    } catch (error) {
        console.error('Error verifying guest from QR:', error);
        updateDataStatus('Failed to verify guest');
    }
    
    // Reset QR scanner after verification
    resetQRScanner();
};

// Share guest pass via WhatsApp
window.shareGuestPass = async function(guestId) {
    try {
        // Find the guest
        const guest = guests.find(g => g.id === guestId);
        if (!guest) throw new Error('Guest not found');
        
        // Create QR code data
        const qrData = JSON.stringify({
            id: guest.id,
            name: guest.name,
            mobile: guest.mobile,
            entry_type: guest.entry_type,
            verified: guest.verified
        });
        
        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(qrData);
        
        // Create message
        const message = `
🎉 *KOCHIN HANGOVER - GUEST PASS* 🎉

Hello ${guest.name},

Your entry pass for Kochin Hangover is ready!

*Details:*
- Name: ${guest.name}
- Entry Type: ${guest.entry_type === 'couple' ? 'Couple' : 'Stag'}
- Date: May 3rd, 2025
- Venue: Angels 153 Club

Please show this message and QR code at the entrance.

Thank you!
`;
        
        // Format mobile number
        let mobileNumber = guest.mobile;
        if (!mobileNumber.startsWith('+')) {
            mobileNumber = '+91' + mobileNumber; // Assuming India country code
        }
        
        // Open WhatsApp with the message
        const whatsappURL = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappURL, '_blank');
        
        updateDataStatus('WhatsApp share initiated');
        
    } catch (error) {
        console.error('Error sharing guest pass:', error);
        alert('Failed to share guest pass: ' + error.message);
    }
};

// Users Management
async function loadUsers() {
    try {
        updateDataStatus('Loading users...');
        
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('username');
        
        if (error) throw error;
        
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        usersList.innerHTML = users.map(user => `
            <tr class="border-b border-gray-700">
                <td class="py-3 px-4">${user.username}</td>
                <td class="py-3 px-4">${user.role}</td>
                <td class="py-3 px-4">
                    <button class="text-blue-400 hover:text-blue-600 mr-2" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-400 hover:text-red-600" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        updateDataStatus(`${users.length} users loaded`);
        
    } catch (error) {
        console.error('Error loading users:', error);
        updateDataStatus('Failed to load users');
    }
}

// Add new user
async function addUser(userData) {
    try {
        updateDataStatus('Adding user...');
        
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username: userData.username,
                password: userData.password,
                role: userData.role
            }])
            .select();
        
        if (error) throw error;
        
        await loadUsers();
        updateDataStatus('User added successfully');
        
        return true;
        
    } catch (error) {
        console.error('Error adding user:', error);
        updateDataStatus('Failed to add user: ' + error.message);
        return false;
    }
}

// Edit user
window.editUser = async function(userId) {
    try {
        // Get user data
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">Edit User</h3>
                    <button class="text-gray-400 hover:text-white" id="closeEditModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="editUserForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Username</label>
                        <input type="text" id="editUsername" value="${user.username}" class="kochin-input w-full" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Password</label>
                        <input type="password" id="editPassword" placeholder="Leave blank to keep current" class="kochin-input w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Role</label>
                        <select id="editRole" class="kochin-input w-full" required>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" id="cancelEditUser" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                            Cancel
                        </button>
                        <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal handlers
        document.getElementById('closeEditModal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.getElementById('cancelEditUser').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Form submission
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('editUsername').value;
            const password = document.getElementById('editPassword').value;
            const role = document.getElementById('editRole').value;
            
            const updates = {
                username,
                role
            };
            
            // Only update password if provided
            if (password) {
                updates.password = password;
            }
            
            try {
                const { error: updateError } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', userId);
                
                if (updateError) throw updateError;
                
                document.body.removeChild(modal);
                await loadUsers();
                updateDataStatus('User updated successfully');
                
            } catch (error) {
                console.error('Error updating user:', error);
                alert('Failed to update user: ' + error.message);
            }
        });
        
    } catch (error) {
        console.error('Error editing user:', error);
        alert('Failed to edit user: ' + error.message);
    }
};

// Delete user
window.deleteUser = async function(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        updateDataStatus('Deleting user...');
        
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        await loadUsers();
        updateDataStatus('User deleted successfully');
        
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
    }
};

// Show specific tab
function showTab(tabId) {
    // Update active tab button
    tabButtons.forEach(button => {
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Show selected content
    tabContents.forEach(content => {
        if (content.id === `${tabId}Content`) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
    
    // Special handling for verification tab
    if (tabId === 'verification') {
        resetQRScanner();
    }
}

// Update amount based on entry type
function updateAmount() {
    const entryType = document.getElementById('entryType').value;
    const amount = ENTRY_PRICES[entryType];
    updateDataStatus(`Entry price: ₹${amount}`);
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
            // Check credentials against Supabase users table
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
    
    // Export buttons
    document.getElementById('exportCSV')?.addEventListener('click', exportToCSV);
    document.getElementById('exportPDF')?.addEventListener('click', exportToPDF);
    
    // Tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            showTab(tabId);
        });
    });
    
    // Entry type change
    document.getElementById('entryType')?.addEventListener('change', updateAmount);
    
    // Users management
    document.getElementById('usersBtn')?.addEventListener('click', () => {
        showTab('users');
        loadUsers();
    });
    
    // Add user form
    document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            username: document.getElementById('newUsername').value,
            password: document.getElementById('newPassword').value,
            role: document.getElementById('newRole').value
        };
        
        const success = await addUser(userData);
        
        if (success) {
            document.getElementById('addUserForm').reset();
        }
    });
}

// Export functions
function exportToCSV() {
    try {
        const csvData = guests.map(guest => ({
            Name: guest.name,
            Mobile: guest.mobile,
            'Entry Type': guest.entry_type === 'couple' ? 'Couple' : 'Stag',
            Status: guest.verified ? 'Verified' : 'Not Verified',
            'Registration Date': new Date(guest.created_at).toLocaleString()
        }));
        
        const csv = Papa.unparse(csvData);
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

function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add header
        doc.setFontSize(18);
        doc.text('Kochin Hangover Guest List', 105, 15, { align: 'center' });
        
        // Add date
        doc.setFontSize(12);
        doc.text(new Date().toLocaleString(), 195, 15, { align: 'right' });
        
        // Add table header
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        
        const headers = ['Name', 'Mobile', 'Entry Type', 'Status'];
        let y = 25;
        
        // Draw header
        headers.forEach((header, i) => {
            doc.text(header, 15 + (i * 45), y);
        });
        
        y += 10;
        
        // Add guest rows
        guests.forEach(guest => {
            const row = [
                guest.name || 'N/A',
                guest.mobile || 'N/A',
                guest.entry_type === 'couple' ? 'Couple' : 'Stag',
                guest.verified ? 'Verified' : 'Not Verified'
            ];
            
            row.forEach((cell, i) => {
                doc.text(cell, 15 + (i * 45), y);
            });
            
            y += 10;
            
            // Add new page if needed
            if (y > 280) {
                doc.addPage();
                y = 25;
            }
        });
        
        doc.save('kochin-hangover-guests.pdf');
        updateDataStatus('PDF exported successfully');
    } catch (error) {
        console.error('PDF export error:', error);
        updateDataStatus('Failed to export PDF');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

// Make functions available globally
window.verifyGuest = verifyGuest;
window.deleteGuest = deleteGuest;
window.generateQR = generateQR;
window.verifyGuestFromQR = verifyGuestFromQR;
window.showTab = showTab;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.shareGuestPass = shareGuestPass;