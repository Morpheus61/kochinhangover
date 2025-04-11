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

    // Show/hide user management button based on role
    document.getElementById('usersBtn')?.classList.toggle('hidden', !isAdmin);
    
    // Update user role display
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    if (userRoleDisplay) {
        if (isAdmin) {
            userRoleDisplay.textContent = 'Logged in as Admin';
            userRoleDisplay.classList.add('bg-purple-700');
            userRoleDisplay.classList.remove('bg-blue-600', 'bg-green-600');
        } else if (isStaff) {
            userRoleDisplay.textContent = 'Logged in as Committee Member';
            userRoleDisplay.classList.add('bg-blue-600');
            userRoleDisplay.classList.remove('bg-purple-700', 'bg-green-600');
        } else if (isDoorman) {
            userRoleDisplay.textContent = 'Logged in as Entry Checker';
            userRoleDisplay.classList.add('bg-green-600');
            userRoleDisplay.classList.remove('bg-purple-700', 'bg-blue-600');
        }
    }
    
    // Reset all navigation buttons and tabs visibility first
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    // Admin: Full Access to all features
    if (isAdmin) {
        // Show all navigation buttons
        document.getElementById('newRegistrationBtn')?.classList.remove('hidden');
        document.getElementById('entryVerificationBtn')?.classList.remove('hidden');
        document.getElementById('guestListBtn')?.classList.remove('hidden');
        document.getElementById('statsBtn')?.classList.remove('hidden');
        
        // Auto-navigate to registration tab for admin users
        showTab('registration');
    }
    
    // Staff: Access ONLY to Registered Guests and Stats
    else if (isStaff) {
        // Show only guests and stats buttons
        document.getElementById('guestListBtn')?.classList.remove('hidden');
        document.getElementById('statsBtn')?.classList.remove('hidden');
        
        // Auto-navigate to guests tab for staff users
        showTab('guests');
    }
    
    // Doorman: Access to Verification and Registered Guest List
    else if (isDoorman) {
        // Show only verification and guest list buttons
        document.getElementById('entryVerificationBtn')?.classList.remove('hidden');
        document.getElementById('guestListBtn')?.classList.remove('hidden');
        
        // Auto-navigate to verification tab for doorman users
        showTab('verification');
    }
}

// Show specific tab
async function showTab(tabId) {
    // Get current user role
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

    // Role-based access control for tabs
    if (isStaff && !['guests', 'stats'].includes(tabId)) {
        // Staff can only access guests and stats tabs
        tabId = 'guests';
    } else if (isDoorman && !['verification', 'guests'].includes(tabId)) {
        // Doorman can only access verification and guests tabs
        tabId = 'verification';
    }

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
    } else if (tabId === 'users') {
        await loadUsers();
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

// Load users list
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*');
        
        if (error) throw error;
        
        const tbody = document.getElementById('usersList');
        if (!tbody) return;
        
        tbody.innerHTML = users.map(user => `
            <tr class="border-b border-gray-700">
                <td class="py-3 px-4">${user.username || ''}</td>
                <td class="py-3 px-4">${user.role || ''}</td>
                <td class="py-3 px-4">
                    <button class="text-blue-400 hover:text-blue-600 mr-2 edit-user-btn" data-user-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-400 hover:text-red-600 mr-2 delete-user-btn" data-user-id="${user.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Attach event listeners to the edit and delete buttons
        document.querySelectorAll('.edit-user-btn').forEach(button => {
            button.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                editUser(userId);
            });
        });
        
        document.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                deleteUser(userId);
            });
        });
        
    } catch (error) {
        console.error('Error loading users list:', error);
    }
}

// Add user function
async function addUser(username, password, role) {
    try {
        // Check if username already exists
        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username);
        
        if (checkError) throw checkError;
        
        if (existingUsers && existingUsers.length > 0) {
            throw new Error('Username already exists');
        }
        
        // Insert new user
        const { data, error } = await supabase
            .from('users')
            .insert([{ username, password, role }])
            .select();
        
        if (error) throw error;
        
        // Reload users list
        await loadUsers();
        
        return data;
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

// Edit user function
async function editUser(userId) {
    try {
        // Get user data
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        // Create edit form modal
        const modal = document.createElement('div');
        modal.className = 'modal flex items-center justify-center';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold kochin-header">Edit User</h3>
                    <button class="text-gray-300 hover:text-white close-modal-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="editUserForm">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Username</label>
                            <input type="text" id="editUsername" class="kochin-input w-full" value="${user.username}" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Password</label>
                            <input type="password" id="editPassword" class="kochin-input w-full" placeholder="Leave blank to keep current password">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Role</label>
                            <select id="editRole" class="kochin-input w-full" required>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
                                <option value="doorman" ${user.role === 'doorman' ? 'selected' : ''}>Doorman</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex space-x-4">
                        <button type="submit" class="kochin-button flex-1">
                            <i class="fas fa-save mr-2"></i> Save Changes
                        </button>
                        <button type="button" class="kochin-button bg-gray-600 flex-1 close-modal-btn">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener to close modal
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });
        
        // Add event listener to form submit
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('editUsername').value;
            const password = document.getElementById('editPassword').value;
            const role = document.getElementById('editRole').value;
            
            try {
                // Update user
                const updateData = { username, role };
                
                // Only update password if it's not empty
                if (password) {
                    updateData.password = password;
                }
                
                const { error: updateError } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('id', userId);
                
                if (updateError) throw updateError;
                
                // Remove modal
                document.body.removeChild(modal);
                
                // Reload users list
                await loadUsers();
                
                alert('User updated successfully!');
            } catch (error) {
                console.error('Error updating user:', error);
                alert('Error updating user: ' + error.message);
            }
        });
        
    } catch (error) {
        console.error('Error editing user:', error);
        alert('Error editing user: ' + error.message);
    }
}

// Delete user function
async function deleteUser(userId) {
    try {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }
        
        // Delete user
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        // Reload users list
        await loadUsers();
        
        alert('User deleted successfully!');
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    }
}

// Edit guest function
async function editGuest(guestId) {
    try {
        // Get guest data
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();
        
        if (error) throw error;
        
        // Create edit form modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75';
        modal.innerHTML = `
            <div class="kochin-container p-6 max-w-md mx-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold kochin-header">Edit Guest</h3>
                    <button class="text-gray-300 hover:text-white close-modal-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="editGuestForm">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Name</label>
                            <input type="text" id="editGuestName" class="kochin-input w-full" value="${guest.guest_name}" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Club Name</label>
                            <input type="text" id="editClubName" class="kochin-input w-full" value="${guest.club_name || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Mobile Number</label>
                            <input type="tel" id="editMobileNumber" class="kochin-input w-full" value="${guest.mobile_number}" required pattern="[0-9]{10}" title="Please enter a valid 10-digit mobile number">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Entry Type</label>
                            <select id="editEntryType" class="kochin-input w-full" required>
                                <option value="stag" ${guest.entry_type === 'stag' ? 'selected' : ''}>Stag (₹2750)</option>
                                <option value="couple" ${guest.entry_type === 'couple' ? 'selected' : ''}>Couple (₹4750)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Status</label>
                            <select id="editStatus" class="kochin-input w-full" required>
                                <option value="paid" ${guest.status === 'paid' ? 'selected' : ''}>Paid</option>
                                <option value="partially_paid" ${guest.status === 'partially_paid' ? 'selected' : ''}>Partially Paid</option>
                                <option value="verified" ${guest.status === 'verified' ? 'selected' : ''}>Verified</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Paid Amount (₹)</label>
                            <input type="number" id="editPaidAmount" class="kochin-input w-full" value="${guest.paid_amount}" min="0" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Total Amount (₹)</label>
                            <input type="number" id="editTotalAmount" class="kochin-input w-full" value="${guest.total_amount}" min="0" required>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex space-x-4">
                        <button type="submit" class="kochin-button flex-1">
                            <i class="fas fa-save mr-2"></i> Save Changes
                        </button>
                        <button type="button" class="kochin-button bg-gray-600 flex-1 close-modal-btn">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener to close modal
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });
        
        // Add event listener to form submit
        document.getElementById('editGuestForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const guestName = document.getElementById('editGuestName').value;
            const clubName = document.getElementById('editClubName').value;
            const mobileNumber = document.getElementById('editMobileNumber').value;
            const entryType = document.getElementById('editEntryType').value;
            const status = document.getElementById('editStatus').value;
            const paidAmount = Number(document.getElementById('editPaidAmount').value);
            const totalAmount = Number(document.getElementById('editTotalAmount').value);
            
            try {
                // Update guest
                const updateData = {
                    guest_name: guestName,
                    club_name: clubName,
                    mobile_number: mobileNumber,
                    entry_type: entryType,
                    status: status,
                    paid_amount: paidAmount,
                    total_amount: totalAmount
                };
                
                const { error: updateError } = await supabase
                    .from('guests')
                    .update(updateData)
                    .eq('id', guestId);
                
                if (updateError) throw updateError;
                
                // Remove modal
                document.body.removeChild(modal);
                
                // Reload guest list and stats
                await loadGuestList();
                await loadStats();
                
                alert('Guest updated successfully!');
            } catch (error) {
                console.error('Error updating guest:', error);
                alert('Error updating guest: ' + error.message);
            }
        });
        
    } catch (error) {
        console.error('Error editing guest:', error);
        alert('Error editing guest: ' + error.message);
    }
}

// Delete guest function
async function deleteGuest(guestId) {
    try {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this guest?')) {
            return;
        }
        
        // Delete guest
        const { error } = await supabase
            .from('guests')
            .delete()
            .eq('id', guestId);
        
        if (error) throw error;
        
        // Reload guest list and stats
        await loadGuestList();
        await loadStats();
        
        alert('Guest deleted successfully!');
    } catch (error) {
        console.error('Error deleting guest:', error);
        alert('Error deleting guest: ' + error.message);
    }
}

// Make the functions available globally
window.editUser = editUser;
window.deleteUser = deleteUser;
window.editGuest = editGuest;
window.deleteGuest = deleteGuest;

// Initialize QR Scanner
function initQRScanner() {
    if (qrScanner) {
        qrScanner.clear();
        qrScanner = null;
    }

    // Get the QR scanner container element
    const qrScannerContainer = document.getElementById('qrScanner');
    
    // If the container doesn't exist, return early
    if (!qrScannerContainer) {
        console.error('QR Scanner container not found');
        return;
    }
    
    // Clear any existing content
    qrScannerContainer.innerHTML = '<div id="qr-reader"></div>';

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
            console.error('QR code verification error:', error);
            alert('Error verifying QR code: ' + error.message);
            qrScanner.resume();
        }
    }, (error) => {
        console.error('QR scanner error:', error);
    });
}

// Verify guest entry
window.verifyGuest = async function(guestId) {
    try {
        // Get guest data
        const { data: guest, error: getError } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();
        
        if (getError) throw getError;
        
        // Check if guest has paid in full
        const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
        const isFullyPaid = guest.paid_amount >= expectedAmount;
        
        if (!isFullyPaid) {
            throw new Error('Guest has not paid in full');
        }
        
        // Update guest status to verified
        const { error: updateError } = await supabase
            .from('guests')
            .update({ status: 'verified' })
            .eq('id', guestId);
        
        if (updateError) throw updateError;
        
        // Show success message
        alert('Guest entry verified successfully!');
        
        // Close the modal and resume scanning
        const modal = document.querySelector('.fixed.inset-0.flex.items-center.justify-center.z-50');
        if (modal) {
            modal.remove();
            if (qrScanner) {
                qrScanner.resume();
            }
        }
        
    } catch (error) {
        console.error('Error verifying guest:', error);
        alert('Error verifying guest: ' + error.message);
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
            
            // Clear any existing hash to prevent unauthorized access
            window.location.hash = '';
            
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
        
        // Add a submission lock to prevent multiple submissions
        const submitButton = e.target.querySelector('button[type="submit"]');
        if (submitButton.disabled) return; // If already submitting, exit early
        
        // Disable the button and change text to show processing
        submitButton.disabled = true;
        const originalButtonText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        
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
        } finally {
            // Re-enable the button and restore original text regardless of success/failure
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
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
    
    // Add User form
    document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('createUsername').value;
        const password = document.getElementById('createPassword').value;
        const role = document.getElementById('createRole').value;
        const errorText = document.getElementById('addUserError');
        
        try {
            await addUser(username, password, role);
            
            // Reset form
            e.target.reset();
            
            // Hide error message if visible
            if (errorText) {
                errorText.classList.add('hidden');
            }
            
            alert('User added successfully!');
            
        } catch (error) {
            console.error('Error adding user:', error);
            if (errorText) {
                errorText.textContent = error.message || 'Failed to add user';
                errorText.classList.remove('hidden');
            }
        }
    });
    
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
                tempDiv.className = 'guest-pass-container';
                tempDiv.style.width = '600px';
                tempDiv.style.height = '800px';
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.innerHTML = `
                    <div style="
                        width: 600px;
                        padding: 20px;
                        background: linear-gradient(135deg, #2a0e3a 0%, #3a1e4a 100%);
                        border-radius: 20px;
                        border: 8px solid #e83283;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        color: white;
                        font-family: Arial, sans-serif;
                        position: relative;
                        overflow: hidden;
                    ">
                        <!-- Decorative elements -->
                        <div style="
                            position: absolute;
                            top: -50px;
                            left: -50px;
                            width: 150px;
                            height: 150px;
                            border-radius: 50%;
                            background: rgba(232, 50, 131, 0.2);
                        "></div>
                        <div style="
                            position: absolute;
                            bottom: -50px;
                            right: -50px;
                            width: 150px;
                            height: 150px;
                            border-radius: 50%;
                            background: rgba(52, 219, 219, 0.2);
                        "></div>
                        
                        <!-- Header -->
                        <div style="
                            text-align: center;
                            margin-bottom: 20px;
                            padding-bottom: 15px;
                            border-bottom: 2px solid #e83283;
                        ">
                            <h1 style="
                                font-size: 36px;
                                font-weight: bold;
                                margin: 0;
                                color: #e83283;
                                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                            ">KOCHIN HANGOVER</h1>
                            <h2 style="
                                font-size: 24px;
                                margin: 5px 0 0;
                                color: #34dbdb;
                            ">Guest Pass</h2>
                        </div>
                        
                        <!-- Content -->
                        <div style="display: flex;">
                            <!-- Guest Info -->
                            <div style="width: 60%; padding-right: 20px;">
                                <div style="margin-bottom: 15px;">
                                    <p style="font-size: 14px; margin: 0; color: #f7d046;">Full Name</p>
                                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${guest.guest_name}</p>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <p style="font-size: 14px; margin: 0; color: #f7d046;">Club Name</p>
                                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${guest.club_name || 'N/A'}</p>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <p style="font-size: 14px; margin: 0; color: #f7d046;">Mobile Number</p>
                                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${guest.mobile_number}</p>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <p style="font-size: 14px; margin: 0; color: #f7d046;">Entry Type</p>
                                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${guest.entry_type.toUpperCase()}</p>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <p style="font-size: 14px; margin: 0; color: #f7d046;">Status</p>
                                    <p style="
                                        font-size: 24px; 
                                        font-weight: bold; 
                                        margin: 5px 0 0;
                                        color: ${guest.status === 'paid' || guest.status === 'verified' ? '#4ade80' : '#fcd34d'};
                                    ">
                                        ${guest.status === 'paid' || guest.status === 'verified' ? 'PAID' : 'PAYMENT PENDING'}
                                    </p>
                                </div>
                            </div>
                            
                            <!-- QR Code -->
                            <div style="
                                width: 40%;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                            ">
                                <div style="
                                    background: white;
                                    padding: 10px;
                                    border-radius: 10px;
                                    border: 3px solid #e83283;
                                ">
                                    <img src="${qrCodeDataURL}" alt="QR Code" style="width: 180px; height: 180px;">
                                </div>
                                <p style="
                                    text-align: center;
                                    font-size: 14px;
                                    margin-top: 10px;
                                    color: #34dbdb;
                                ">Scan this QR code at the entrance</p>
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div style="
                            margin-top: 20px;
                            padding-top: 15px;
                            border-top: 2px solid #e83283;
                            text-align: center;
                        ">
                            <p style="font-size: 16px; margin: 5px 0; color: #f7d046;">Date: 3rd May, 2025</p>
                            <p style="font-size: 16px; margin: 5px 0; color: #f7d046;">Venue: Casino Hotel, Wellington Island, Kochi</p>
                        </div>
                        
                        <!-- Decorative icons -->
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            margin-top: 15px;
                            color: #e83283;
                            font-size: 20px;
                        ">
                            <span style="transform: rotate(15deg);">🍸</span>
                            <span style="transform: rotate(-15deg);">🍹</span>
                            <span style="transform: rotate(15deg);">🍸</span>
                            <span style="transform: rotate(-15deg);">🍹</span>
                            <span style="transform: rotate(15deg);">🍸</span>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(tempDiv);
                
                // Use html2canvas to convert the div to an image
                const canvas = await html2canvas(tempDiv);
                const imageDataURL = canvas.toDataURL('image/png');
                
                // Remove the temporary div
                document.body.removeChild(tempDiv);
                
                // Store the image data URL for later use
                const guestPassImageUrl = imageDataURL;
                const guestPassFileName = `kochin-hangover-pass-${guest.guest_name.replace(/\s+/g, '-').toLowerCase()}.png`;
                
                // Create WhatsApp share message
                const message = `*KOCHIN HANGOVER - GUEST PASS*\n\n` +
                    `*Name:* ${guest.guest_name}\n` +
                    `*Club:* ${guest.club_name || 'N/A'}\n` +
                    `*Mobile:* ${guest.mobile_number}\n` +
                    `*Entry Type:* ${guest.entry_type.toUpperCase()}\n\n` +
                    `Please show this pass at the entrance.\n\n` +
                    `Note: Your guest pass image has been downloaded to your device. Please send it as an attachment after this message.`;
                
                // Remove any existing modals first
                const existingModals = document.querySelectorAll('.fixed.inset-0.flex.items-center.justify-center.z-50');
                existingModals.forEach(modal => {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                });
                
                // Create a modal to guide the user
                const modal = document.createElement('div');
                modal.id = 'whatsappShareModal';
                modal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75';
                modal.innerHTML = `
                    <div class="kochin-container p-6 max-w-md mx-auto">
                        <h3 class="text-xl font-bold mb-4 kochin-header">Share Guest Pass</h3>
                        <p class="mb-4">The guest pass image will be downloaded when you continue.</p>
                        <p class="mb-4">After clicking "Continue to WhatsApp", please:</p>
                        <ol class="list-decimal pl-6 mb-6">
                            <li class="mb-2">Send the text message first</li>
                            <li class="mb-2">Tap the attachment icon in WhatsApp</li>
                            <li class="mb-2">Select "Gallery" or "Documents"</li>
                            <li class="mb-2">Find and select the downloaded guest pass image</li>
                        </ol>
                        <div class="flex justify-between">
                            <button id="continueToWhatsAppBtn" class="kochin-button bg-green-600">
                                <i class="fab fa-whatsapp mr-2"></i> Continue to WhatsApp
                            </button>
                            <button id="closeShareModalBtn" class="kochin-button bg-gray-600">
                                Close
                            </button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Flag to track if download has been triggered
                let downloadTriggered = false;
                
                // Function to trigger download only once
                const triggerDownload = () => {
                    if (!downloadTriggered) {
                        const downloadLink = document.createElement('a');
                        downloadLink.href = guestPassImageUrl;
                        downloadLink.download = guestPassFileName;
                        downloadLink.click();
                        downloadTriggered = true;
                    }
                };
                
                // Add event listeners directly with onclick attributes
                document.getElementById('continueToWhatsAppBtn').onclick = function() {
                    // Remove the modal
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                    
                    // Trigger the download when continuing to WhatsApp
                    triggerDownload();
                    
                    // Open WhatsApp chat directly with the guest
                    // Remove the + sign if present for the WhatsApp API
                    const whatsappNumber = mobileNumber.replace('+', '');
                    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
                    
                    // Open WhatsApp in a new tab
                    window.open(whatsappUrl, '_blank');
                };
                
                document.getElementById('closeShareModalBtn').onclick = function() {
                    // Remove the modal
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                    
                    // Trigger the download when closing the modal
                    triggerDownload();
                };
                
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
        
        if (error) {
            console.error('Error loading stats:', error);
            alert('Failed to load statistics');
            return;
        }
        
        // Calculate total stats
        const totalRegistrations = guests.length;
        
        // Count verified entries based on full payment
        const verifiedEntries = guests.filter(guest => {
            const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
            const paidAmount = parseFloat(guest.paid_amount) || 0; // Ensure paid_amount is a number
            const isPaidInFull = paidAmount >= expectedAmount;
            return isPaidInFull; // Guest has paid in full
        }).length;
        
        const pendingEntries = totalRegistrations - verifiedEntries;
        const totalRevenue = guests.reduce((sum, guest) => sum + (parseFloat(guest.paid_amount) || 0), 0);
        
        // Update summary stats
        document.getElementById('totalRegistrations').textContent = totalRegistrations;
        document.getElementById('verifiedEntries').textContent = verifiedEntries;
        document.getElementById('pendingEntries').textContent = pendingEntries;
        document.getElementById('totalRevenue').textContent = `₹${totalRevenue}`;
        
        // Calculate club-wise stats
        const clubStats = {};
        guests.forEach(guest => {
            const clubName = guest.club_name || 'No Club Specified';
            
            if (!clubStats[clubName]) {
                clubStats[clubName] = {
                    registrations: 0,
                    totalAmount: 0,
                    paidAmount: 0,
                    guests: []
                };
            }
            
            clubStats[clubName].registrations++;
            clubStats[clubName].totalAmount += guest.total_amount || 0;
            clubStats[clubName].paidAmount += guest.paid_amount || 0;
            clubStats[clubName].guests.push(guest);
        });
        
        // Sort clubs by registrations (descending)
        const sortedClubs = Object.entries(clubStats)
            .sort((a, b) => b[1].registrations - a[1].registrations);
        
        // Update club stats table
        const statsTableBody = document.getElementById('statsTableBody');
        if (statsTableBody) {
            statsTableBody.innerHTML = sortedClubs.map(([clubName, stats], index) => `
                <tr class="border-b border-gray-700 club-row" data-club-index="${index}">
                    <td class="py-3 px-4">${clubName}</td>
                    <td class="py-3 px-4">${stats.registrations}</td>
                    <td class="py-3 px-4">₹${stats.totalAmount}</td>
                    <td class="py-3 px-4">₹${stats.paidAmount}</td>
                    <td class="py-3 px-4">
                        <button class="text-blue-400 hover:text-blue-600 view-club-guests">
                            <i class="fas fa-eye"></i> View Guests
                        </button>
                    </td>
                </tr>
                <tr class="club-guests-row hidden" id="club-guests-${index}">
                    <td colspan="5" class="py-3 px-4 bg-gray-800">
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b border-gray-700">
                                        <th class="py-2 px-2 text-left text-sm">Name</th>
                                        <th class="py-2 px-2 text-left text-sm">Mobile</th>
                                        <th class="py-2 px-2 text-left text-sm">Entry Type</th>
                                        <th class="py-2 px-2 text-left text-sm">Status</th>
                                        <th class="py-2 px-2 text-left text-sm">Payment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stats.guests.map(guest => `
                                        <tr class="border-b border-gray-700">
                                            <td class="py-2 px-2 text-sm">${guest.guest_name}</td>
                                            <td class="py-2 px-2 text-sm">${guest.mobile_number}</td>
                                            <td class="py-2 px-2 text-sm">${guest.entry_type}</td>
                                            <td class="py-2 px-2 text-sm">
                                                <span class="px-2 py-1 rounded-full text-xs ${
                                                    guest.status === 'verified' ? 'bg-green-500' :
                                                    guest.status === 'paid' ? 'bg-blue-500' :
                                                    guest.status === 'partially_paid' ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }">
                                                    ${guest.status || 'pending'}
                                                </span>
                                            </td>
                                            <td class="py-2 px-2 text-sm">₹${guest.paid_amount} / ₹${guest.total_amount}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Add event listeners to view club guests buttons
            document.querySelectorAll('.view-club-guests').forEach(button => {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    const row = this.closest('tr');
                    const clubIndex = row.getAttribute('data-club-index');
                    const guestsRow = document.getElementById(`club-guests-${clubIndex}`);
                    
                    // Toggle the visibility of the guests row
                    guestsRow.classList.toggle('hidden');
                    
                    // Update the button icon
                    const icon = this.querySelector('i');
                    if (guestsRow.classList.contains('hidden')) {
                        icon.className = 'fas fa-eye';
                        this.innerHTML = '<i class="fas fa-eye"></i> View Guests';
                    } else {
                        icon.className = 'fas fa-eye-slash';
                        this.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Guests';
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
        alert('Failed to load statistics');
    }
}

// Download functions
async function downloadGuestsPDF() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) {
            console.error('Error fetching guests:', error);
            alert('Error generating PDF: ' + error.message);
            return;
        }
        
        // Create a new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Define theme colors
        const primaryColor = '#e83283';
        const darkColor = '#2a0e3a';
        
        // Simple header with brand colors
        doc.setFillColor(darkColor);
        doc.rect(0, 0, 210, 40, 'F');
        
        // Add title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text('KOCHIN HANGOVER', 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text('Guest List', 105, 30, { align: 'center' });
        
        // Add generation date
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        }).replace(',', '');
        
        doc.setFontSize(10);
        doc.text(`Generated: ${formattedDate}`, 105, 37, { align: 'center' });
        
        // Add table headers
        const startY = 50;
        const colWidths = [10, 70, 30, 40, 40];
        const headers = ['#', 'Guest Details', 'Entry Type', 'Amount', 'Status'];
        
        // Add table header background
        doc.setFillColor(primaryColor);
        doc.rect(10, startY - 6, 190, 10, 'F');
        
        // Add header text
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        
        let xPos = 10;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 2, startY);
            xPos += colWidths[i];
        });
        
        // Draw table rows
        let yPos = startY + 10;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        // Add alternating row colors
        guests.forEach((guest, index) => {
            // Each guest now takes up more vertical space
            const rowHeight = 15;
            
            // Add row background
            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
            } else {
                doc.setFillColor(235, 235, 235);
            }
            doc.rect(10, yPos - 5, 190, rowHeight, 'F');
            
            // Add row data
            doc.setTextColor(darkColor);
            xPos = 10;
            
            // Row number
            doc.text(`${index + 1}`, xPos + 2, yPos);
            xPos += colWidths[0];
            
            // Guest name and club on two lines
            doc.setFont('helvetica', 'bold');
            doc.text(guest.guest_name || '', xPos + 2, yPos - 2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(guest.club_name || '', xPos + 2, yPos + 4);
            doc.setFontSize(10);
            xPos += colWidths[1];
            
            // Entry type
            const entryType = guest.entry_type === 'stag' ? 'Stag' : 'Couple';
            doc.text(entryType, xPos + 2, yPos);
            xPos += colWidths[2];
            
            // Amount - only show amount received
            doc.text(`₹${guest.paid_amount || 0}`, xPos + 2, yPos);
            xPos += colWidths[3];
            
            // Status with colored background
            let statusColor;
            let statusText;
            
            if (guest.status === 'verified') {
                statusColor = '#4ade80'; // green
                statusText = 'VERIFIED';
            } else if (guest.status === 'paid') {
                statusColor = '#3b82f6'; // blue
                statusText = 'PAID';
            } else if (guest.status === 'partially_paid') {
                statusColor = '#f59e0b'; // yellow
                statusText = 'PARTIAL';
            } else {
                statusColor = '#ef4444'; // red
                statusText = 'PENDING';
            }
            
            // Add status background
            doc.setFillColor(statusColor);
            doc.rect(xPos, yPos - 4, 30, 8, 'F');
            
            // Add status text
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(statusText, xPos + 2, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(darkColor);
            
            yPos += rowHeight;
            
            // Add a new page if needed
            if (yPos > 280) {
                doc.addPage();
                
                // Add header to new page
                doc.setFillColor(darkColor);
                doc.rect(0, 0, 210, 20, 'F');
                
                // Add title to new page
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text('KOCHIN HANGOVER - Guest List (Continued)', 105, 15, { align: 'center' });
                
                // Reset for new page
                yPos = 30;
            }
        });
        
        // Add footer
        const footerY = 280;
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.5);
        doc.line(10, footerY, 200, footerY);
        
        doc.setFontSize(8);
        doc.setTextColor(darkColor);
        doc.text('Kochin Hangover - May 3rd, 2025 - Casino Hotel, Wellington Island, Kochi', 105, footerY + 5, { align: 'center' });
        
        // Save the PDF
        doc.save('kochin-hangover-guest-list.pdf');
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF: ' + error.message);
    }
}

async function downloadGuestsCSV() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) {
            console.error('Error fetching guests:', error);
            alert('Error generating CSV: ' + error.message);
            return;
        }
        
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
        alert('Failed to generate CSV');
    }
}

async function downloadStatsPDF() {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) {
            console.error('Error fetching guests for stats:', error);
            alert('Error generating stats PDF: ' + error.message);
            return;
        }
        
        // Create a new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Define theme colors
        const primaryColor = '#e83283';
        const darkColor = '#2a0e3a';
        
        // Simple header with brand colors
        doc.setFillColor(darkColor);
        doc.rect(0, 0, 210, 40, 'F');
        
        // Add title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text('KOCHIN HANGOVER', 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text('Event Statistics', 105, 30, { align: 'center' });
        
        // Add generation date
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        }).replace(',', '');
        
        doc.setFontSize(10);
        doc.text(`Generated: ${formattedDate}`, 105, 37, { align: 'center' });
        
        // Calculate statistics
        const totalGuests = guests.length;
        let totalRevenue = 0;
        let verifiedEntries = 0;
        let pendingEntries = 0;
        let stagEntries = 0;
        let coupleEntries = 0;
        
        guests.forEach(guest => {
            totalRevenue += Number(guest.paid_amount || 0);
            
            // Count verified entries based on payment amount
            const expectedAmount = Number(guest.total_amount || 0);
            const amountPaid = Number(guest.paid_amount || 0);
            
            if (amountPaid >= expectedAmount) {
                verifiedEntries++;
            } else {
                pendingEntries++;
            }
            
            // Count entry types
            if (guest.entry_type === 'stag') {
                stagEntries++;
            } else if (guest.entry_type === 'couple') {
                coupleEntries++;
            }
        });
        
        // Add overall stats section
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
        
        // First row of cards - simple styling
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, cardWidth, cardHeight, 'F');
        doc.setFillColor(245, 245, 245);
        doc.rect(margin + cardWidth + margin, yPos, cardWidth, cardHeight, 'F');
        
        // Card content
        doc.setTextColor(primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total Registrations', margin + cardWidth/2, yPos + 10, { align: 'center' });
        doc.text('Total Revenue', margin + cardWidth + margin + cardWidth/2, yPos + 10, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setTextColor(darkColor);
        doc.text(totalGuests.toString(), margin + cardWidth/2, yPos + 20, { align: 'center' });
        doc.text(`₹${totalRevenue.toLocaleString()}`, margin + cardWidth + margin + cardWidth/2, yPos + 20, { align: 'center' });
        
        // Second row of cards - simple styling
        yPos += cardHeight + margin;
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, cardWidth, cardHeight, 'F');
        doc.setFillColor(245, 245, 245);
        doc.rect(margin + cardWidth + margin, yPos, cardWidth, cardHeight, 'F');
        
        // Card content
        doc.setTextColor(primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Verified Entries', margin + cardWidth/2, yPos + 10, { align: 'center' });
        doc.text('Pending Entries', margin + cardWidth + margin + cardWidth/2, yPos + 10, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setTextColor(darkColor);
        doc.text(verifiedEntries.toString(), margin + cardWidth/2, yPos + 20, { align: 'center' });
        doc.text(pendingEntries.toString(), margin + cardWidth + margin + cardWidth/2, yPos + 20, { align: 'center' });
        
        // Entry type distribution
        yPos += cardHeight + margin + 10;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Entry Type Distribution', 105, yPos, { align: 'center' });
        
        // Simple table for entry types
        yPos += 10;
        doc.setFillColor(primaryColor);
        doc.rect(50, yPos, 110, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Entry Type', 70, yPos + 7);
        doc.text('Count', 140, yPos + 7);
        
        // Stag row
        yPos += 10;
        doc.setFillColor(245, 245, 245);
        doc.rect(50, yPos, 110, 10, 'F');
        doc.setTextColor(darkColor);
        doc.text('Stag', 70, yPos + 7);
        doc.text(stagEntries.toString(), 140, yPos + 7);
        
        // Couple row
        yPos += 10;
        doc.setFillColor(235, 235, 235);
        doc.rect(50, yPos, 110, 10, 'F');
        doc.setTextColor(darkColor);
        doc.text('Couple', 70, yPos + 7);
        doc.text(coupleEntries.toString(), 140, yPos + 7);
        
        // Add club-wise statistics
        yPos += 30;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Club-wise Statistics', 105, yPos, { align: 'center' });
        yPos += 10;
        
        // Create a table for club statistics
        const clubStats = {};
        guests.forEach(guest => {
            const clubName = guest.club_name || 'No Club';
            if (!clubStats[clubName]) {
                clubStats[clubName] = {
                    totalGuests: 0,
                    paidAmount: 0,
                    stag: 0,
                    couple: 0
                };
            }
            clubStats[clubName].totalGuests++;
            clubStats[clubName].paidAmount += Number(guest.paid_amount || 0);
            
            if (guest.entry_type === 'stag') {
                clubStats[clubName].stag++;
            } else if (guest.entry_type === 'couple') {
                clubStats[clubName].couple++;
            }
        });
        
        // Table headers
        const clubHeaders = ['Club', 'Guests', 'Stag', 'Couple', 'Amount (₹)'];
        const clubColWidths = [80, 25, 25, 25, 35];
        
        // Add table header background
        doc.setFillColor(primaryColor);
        doc.rect(10, yPos - 6, 190, 10, 'F');
        
        // Add header text
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        
        let xPos = 10;
        clubHeaders.forEach((header, i) => {
            doc.text(header, xPos + 2, yPos);
            xPos += clubColWidths[i];
        });
        
        // Draw table rows
        yPos += 10;
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        let rowIndex = 0;
        for (const [club, stats] of Object.entries(clubStats)) {
            // Add row background
            if (rowIndex % 2 === 0) {
                doc.setFillColor(245, 245, 245);
            } else {
                doc.setFillColor(235, 235, 235);
            }
            doc.rect(10, yPos - 5, 190, 10, 'F');
            
            // Add row data
            xPos = 10;
            
            // Club name
            doc.text(club, xPos + 2, yPos);
            xPos += clubColWidths[0];
            
            // Total guests
            doc.text(stats.totalGuests.toString(), xPos + 2, yPos);
            xPos += clubColWidths[1];
            
            // Stag count
            doc.text(stats.stag.toString(), xPos + 2, yPos);
            xPos += clubColWidths[2];
            
            // Couple count
            doc.text(stats.couple.toString(), xPos + 2, yPos);
            xPos += clubColWidths[3];
            
            // Amount - only show amount received
            doc.text(`₹${stats.paidAmount.toLocaleString()}`, xPos + 2, yPos);
            
            yPos += 10;
            rowIndex++;
            
            // Add a new page if needed
            if (yPos > 250) {
                doc.addPage();
                
                // Add header to new page
                doc.setFillColor(darkColor);
                doc.rect(0, 0, 210, 20, 'F');
                
                // Add title to new page
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text('KOCHIN HANGOVER - Statistics (Continued)', 105, 15, { align: 'center' });
                
                // Reset for new page
                yPos = 30;
            }
        }
        
        // Add footer
        const footerY = 280;
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.5);
        doc.line(10, footerY, 200, footerY);
        
        doc.setFontSize(8);
        doc.setTextColor(darkColor);
        doc.text('Kochin Hangover - May 3rd, 2025 - Casino Hotel, Wellington Island, Kochi', 105, footerY + 5, { align: 'center' });
        
        // Save the PDF
        doc.save('kochin-hangover-statistics.pdf');
    } catch (error) {
        console.error('Error generating statistics PDF:', error);
        alert('Failed to generate statistics PDF: ' + error.message);
    }
}

async function downloadStatsCSV() {
    try {
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) {
            console.error('Error fetching guests for stats:', error);
            alert('Error generating stats CSV: ' + error.message);
            return;
        }
        
        // Calculate club-wise stats
        const clubStats = {};
        guests.forEach(guest => {
            const clubName = guest.club_name || 'No Club';
            if (!clubStats[clubName]) {
                clubStats[clubName] = {
                    totalGuests: 0,
                    paidAmount: 0
                };
            }
            clubStats[clubName].totalGuests++;
            clubStats[clubName].paidAmount += Number(guest.paid_amount || 0);
        });
        
        // Convert to CSV
        const headers = ['Club Name', 'Total Guests', 'Paid Amount (₹)'];
        const csvData = Object.entries(clubStats).map(([club, stats]) => [
            club,
            stats.totalGuests,
            stats.paidAmount
        ]);
        
        // Add summary row
        csvData.push([
            'TOTAL',
            guests.length,
            guests.reduce((sum, guest) => sum + guest.paid_amount, 0)
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
        alert('Failed to generate CSV');
    }
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
        showLoginScreen();
    });
    setupEventListeners();
    
    // Handle hash-based navigation with role-based security
    window.addEventListener('hashchange', async function() {
        if (!currentUser) return;
        
        const hash = window.location.hash.substring(1);
        if (hash) {
            await showTab(hash);
        }
    });
});