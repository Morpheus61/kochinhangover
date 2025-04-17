// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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

    const isStaff = userRole?.role === 'staff';  // Committee Member login
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
    
    // Handle download buttons visibility
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    
    if (downloadPdfBtn) {
        downloadPdfBtn.classList.toggle('hidden', isDoorman);
        downloadPdfBtn.disabled = isDoorman;
    }
    
    if (downloadCsvBtn) {
        downloadCsvBtn.classList.toggle('hidden', isDoorman);
        downloadCsvBtn.disabled = isDoorman;
    }
    
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
    
    // Staff (Committee Member): Access to Registration, Guests and Stats
    else if (isStaff) {
        // Show registration, guests and stats buttons
        document.getElementById('newRegistrationBtn')?.classList.remove('hidden');
        document.getElementById('guestListBtn')?.classList.remove('hidden');
        document.getElementById('statsBtn')?.classList.remove('hidden');
        
        // Auto-navigate to guests tab for committee members
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

    const isStaff = userRole?.role === 'staff' || userRole?.role === 'committee';
    const isAdmin = userRole?.role === 'admin';
    const isDoorman = userRole?.role === 'doorman';

    // Role-based access control for tabs
    if (isStaff && !['registration', 'guests', 'stats'].includes(tabId)) {
        // Staff/Committee can access registration, guests and stats tabs
        tabId = 'guests';
    } else if (isDoorman && !['verification', 'guests'].includes(tabId)) {
        // Doorman can only access verification and guests tabs
        tabId = 'verification';
    }

    // Clean up QR scanner if we're switching away from verification tab
    if (qrScanner && tabId !== 'verification') {
        console.log('Cleaning up QR scanner when switching tabs');
        try {
            // Stop the scanner
            qrScanner.clear();
            qrScanner = null;
            
            // Stop all video streams
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
                if (video.srcObject) {
                    const tracks = video.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    video.srcObject = null;
                }
            });
            
            // Remove any scanner-related elements
            document.querySelectorAll('.html5-qrcode-element').forEach(el => el.remove());
        } catch (e) {
            console.error('Error cleaning up QR scanner during tab switch:', e);
        }
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
        const hasPermission = await checkCameraPermissions();
        if (hasPermission) {
            initQRScanner();
        } else {
            document.getElementById('qrScanner').innerHTML = `
                <div class="text-center p-8">
                    <i class="fas fa-video-slash text-4xl mb-4 text-red-400"></i>
                    <h3 class="text-xl font-bold mb-2">Camera Access Required</h3>
                    <p class="mb-4">Please enable camera permissions to scan QR codes.</p>
                    <button onclick="showTab('verification')" class="kochin-button">
                        Retry
                    </button>
                </div>
            `;
        }
    } else if (tabId === 'users' && isAdmin) {
        await loadUsers();
    }

    // Update URL hash for navigation
    window.location.hash = tabId;
}

// Load guest list
async function loadGuestList(searchTerm = '') {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('guestListTableBody');
        if (!tbody) return;
        
        // Get current user role
        const { data: userRole, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.id)
            .single();
        
        if (roleError) throw roleError;
        
        const isAdmin = userRole?.role === 'admin';
        const isStaff = userRole?.role === 'staff';  // Committee Member login
        const isDoorman = userRole?.role === 'doorman';

        // Handle download buttons visibility and state for doorman
        const downloadButtons = document.querySelectorAll('#downloadGuestsPDFBtn, #downloadGuestsCSVBtn, #downloadStatsPDFBtn, #downloadStatsCSVBtn');
        downloadButtons.forEach(button => {
            if (isDoorman) {
                button.style.display = 'none';
                button.disabled = true;
            } else {
                button.style.display = '';
                button.disabled = false;
            }
        });

        // Update table headers based on role
        const paymentHeader = document.getElementById('paymentHeader');
        if (paymentHeader) {
            paymentHeader.style.display = isDoorman ? 'none' : '';
        }

        // Update actions header based on role
        const actionsHeader = document.getElementById('actionsHeader');
        if (actionsHeader) {
            actionsHeader.style.display = isAdmin ? '' : 'none';
        }
        
        // Filter guests based on search term if provided
        let filteredGuests = guests;
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filteredGuests = guests.filter(guest => {
                const guestName = guest.guest_name ? guest.guest_name.toLowerCase() : '';
                const clubName = guest.club_name ? guest.club_name.toLowerCase() : '';
                
                return guestName.includes(term) || clubName.includes(term);
            });
        }
        
        tbody.innerHTML = filteredGuests.map(guest => `
            <tr class="border-b border-gray-700">
                <td class="py-3 px-4">${guest.guest_name || ''}</td>
                <td class="py-3 px-4">${guest.club_name || ''}</td>
                <td class="py-3 px-4">${guest.entry_type === 'stag' ? 'Stag' : 'Couple'}${safeGetGuestProperty(guest, 'has_room_booking', false) ? ' + Room' : ''}</td>
                ${!isDoorman ? `<td class="py-3 px-4 payment-column">${formatPaymentDisplay(guest)}</td>` : ''}
                <td class="py-3 px-4">
                    ${getStatusBadge(guest)}
                </td>
                ${isAdmin ? `
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
                ` : ''}
            </tr>
        `).join('');

        // Calculate totals
        const totalRegistrations = filteredGuests.length;
        const totalPax = filteredGuests.reduce((sum, guest) => {
            return sum + (guest.entry_type === 'couple' ? 2 : 1);
        }, 0);

        // Count verified guests (actual attendance)
        const verifiedGuests = filteredGuests.filter(guest => guest.status === 'verified').length;
        const verifiedPax = filteredGuests.filter(guest => guest.status === 'verified')
            .reduce((sum, guest) => sum + (guest.entry_type === 'couple' ? 2 : 1), 0);

        // Add total row with adjusted colspan based on role
        const totalColspan = isDoorman ? 2 : (isAdmin ? 3 : 3); // Adjust colspan based on visible columns
        tbody.innerHTML += `
            <tr class="border-t-2 border-pink-500 bg-purple-900 bg-opacity-30 font-bold">
                <td class="py-3 px-4" colspan="2">Total</td>
                <td class="py-3 px-4">${totalRegistrations} Registrations</td>
                <td class="py-3 px-4" colspan="${totalColspan}">${totalPax} PAX (Headcount)</td>
            </tr>
            <tr class="bg-green-900 bg-opacity-30 font-bold">
                <td class="py-3 px-4" colspan="2">Verified (Arrived)</td>
                <td class="py-3 px-4">${verifiedGuests} Guests</td>
                <td class="py-3 px-4" colspan="${totalColspan}">${verifiedPax} PAX (Headcount)</td>
            </tr>
        `;
        
        // Re-attach event listeners for WhatsApp sharing (only for admin)
        if (isAdmin) {
            document.querySelectorAll('.whatsapp-share').forEach(button => {
                button.addEventListener('click', function() {
                    const guestId = this.getAttribute('data-guest-id');
                    if (guestId) {
                        showWhatsAppShareModal(guestId);
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('Error loading guest list:', error);
    }
}

// Helper function to generate status badge with enhanced information
function getStatusBadge(guest) {
    // Check if guest has paid in full
    const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
    const isFullyPaid = parseFloat(guest.paid_amount) >= expectedAmount;
    
    // Determine status color and text
    let statusColor = '';
    let statusText = '';
    let verifiedIcon = '';
    
    if (guest.status === 'verified') {
        // Guest has been verified (arrived at event)
        verifiedIcon = '<i class="fas fa-check-circle mr-1"></i>';
        
        if (isFullyPaid) {
            // Fully paid and verified
            statusColor = 'bg-green-500';
            statusText = 'VERIFIED (PAID)';
        } else {
            // Partially paid but verified
            statusColor = 'bg-yellow-500';
            statusText = 'VERIFIED (PARTIAL)';
        }
    } else if (guest.status === 'paid' || isFullyPaid) {
        // Fully paid but not verified
        statusColor = 'bg-blue-500';
        statusText = 'PAID';
    } else if (guest.status === 'partially_paid') {
        // Partially paid
        statusColor = 'bg-yellow-500';
        statusText = 'PARTIAL';
    } else {
        // Pending
        statusColor = 'bg-red-500';
        statusText = 'PENDING';
    }
    
    return `<span class="px-2 py-1 rounded-full text-xs ${statusColor}">${verifiedIcon}${statusText}</span>`;
}

// Helper function to format payment display
function formatPaymentDisplay(guest) {
    const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
    const paidAmount = guest.paid_amount || 0;
    const roomBookingAmount = safeGetGuestProperty(guest, 'room_booking_amount', 0) || 0;
    
    // If there's a room booking, show both amounts separately
    if (roomBookingAmount > 0) {
        // For fully paid registration
        if (paidAmount >= expectedAmount) {
            return `Rs.${paidAmount} + Rs.${roomBookingAmount}`;
        }
        // For partially paid registration
        return `Rs.${paidAmount}/Rs.${expectedAmount} + Rs.${roomBookingAmount}`;
    }
    
    // No room booking, just show registration amount
    // For fully paid guests, only show the amount received
    if (paidAmount >= expectedAmount) {
        return `Rs.${paidAmount}`;
    }
    
    // For partially paid guests, show the format: paid/total
    return `Rs.${paidAmount}/Rs.${expectedAmount}`;
}

// Helper function to safely access guest properties with fallbacks for missing columns
function safeGetGuestProperty(guest, property, defaultValue) {
    // If the property exists on the guest object, return it
    if (guest && property in guest) {
        return guest[property];
    }
    // Otherwise return the default value
    return defaultValue;
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
                    
                    <div class="mt-6 flex space-x-4 sticky bottom-0 bg-[#2a0e3a] py-4">
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
                const updateData = {
                    username,
                    role
                };
                
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

// Edit guest function - CORRECTED VERSION
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
        modal.className = 'fixed inset-0 flex items-start justify-center z-50 bg-black bg-opacity-75 overflow-y-auto py-8';
        modal.innerHTML = `
            <div class="bg-[#1e1433] p-6 rounded-lg max-w-md w-full mx-4 my-8 shadow-xl">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-white">Edit Guest</h3>
                    <button class="text-gray-300 hover:text-white close-modal-btn">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <form id="editGuestForm" class="space-y-4">
                    <div class="grid grid-cols-4 gap-4 items-center">
                        <label for="editGuestName" class="text-white col-span-1">Guest Name</label>
                        <input type="text" id="editGuestName" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" 
                               value="${guest.guest_name || ''}" required>
                    </div>
                    
                    <div class="grid grid-cols-4 gap-4 items-center">
                        <label for="editClubName" class="text-white col-span-1">Club Name</label>
                        <input type="text" id="editClubName" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" 
                               value="${guest.club_name || ''}">
                    </div>
                    
                    <div class="grid grid-cols-4 gap-4 items-center">
                        <label for="editMobileNumber" class="text-white col-span-1">Mobile Number</label>
                        <input type="tel" id="editMobileNumber" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" 
                               value="${guest.mobile_number || ''}" required>
                    </div>
                    
                    <div class="grid grid-cols-4 gap-4 items-center">
                        <label for="editEntryType" class="text-white col-span-1">Entry Type</label>
                        <select id="editEntryType" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" required>
                            <option value="stag" ${guest.entry_type === 'stag' ? 'selected' : ''}>Stag</option>
                            <option value="couple" ${guest.entry_type === 'couple' ? 'selected' : ''}>Couple</option>
                        </select>
                    </div>
                    
                    <div class="grid grid-cols-4 gap-4 items-center">
                        <label for="editPaymentMode" class="text-white col-span-1">Payment Mode</label>
                        <select id="editPaymentMode" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" required>
                            <option value="full_payment" ${guest.payment_mode === 'full_payment' ? 'selected' : ''}>Full Payment</option>
                            <option value="partial_payment" ${guest.payment_mode === 'partial_payment' ? 'selected' : ''}>Partial Payment</option>
                        </select>
                    </div>
                    
                    <div id="editPartialPaymentContainer" class="grid grid-cols-4 gap-4 items-center" style="display: ${guest.payment_mode === 'partial_payment' ? 'grid' : 'none'}">
                        <label for="editPaidAmount" class="text-white col-span-1">Paid Amount</label>
                        <input type="number" id="editPaidAmount" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" 
                               value="${guest.paid_amount || 0}">
                    </div>
                    
                    <div class="grid grid-cols-4 gap-4 items-center">
                        <label for="editHasRoomBooking" class="text-white col-span-1">Room Booking</label>
                        <select id="editHasRoomBooking" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" required>
                            <option value="false" ${!guest.has_room_booking ? 'selected' : ''}>No</option>
                            <option value="true" ${guest.has_room_booking ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    
                    <div id="editRoomBookingContainer" class="grid grid-cols-4 gap-4 items-center" style="display: ${guest.has_room_booking ? 'grid' : 'none'}">
                        <label for="editRoomBookingAmount" class="text-white col-span-1">Room Booking Amount</label>
                        <input type="number" id="editRoomBookingAmount" class="form-control col-span-3 bg-white text-black border border-gray-300 rounded px-3 py-2" 
                               value="${guest.room_booking_amount || ''}">
                    </div>
                    
                    <div class="flex justify-end space-x-3 mt-6">
                        <button type="button" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 close-modal-btn">
                            Cancel
                        </button>
                        <button type="button" id="saveGuestBtn" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal handler
        const closeButtons = modal.querySelectorAll('.close-modal-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });
        
        // Show/hide partial payment field
        document.getElementById('editPaymentMode').addEventListener('change', function() {
            document.getElementById('editPartialPaymentContainer').style.display = 
                this.value === 'partial_payment' ? 'grid' : 'none';
        });
        
        // Show/hide room booking amount field
        document.getElementById('editHasRoomBooking').addEventListener('change', function() {
            document.getElementById('editRoomBookingContainer').style.display = 
                this.value === 'true' ? 'grid' : 'none';
        });
        
        // Save button handler with all fixes
        document.getElementById('saveGuestBtn').addEventListener('click', async () => {
            // Get form values
            const guestName = document.getElementById('editGuestName').value.trim();
            const clubName = document.getElementById('editClubName').value.trim();
            const mobileNumber = document.getElementById('editMobileNumber').value.trim();
            const entryType = document.getElementById('editEntryType').value;
            const paymentMode = document.getElementById('editPaymentMode').value;
            const hasRoomBooking = document.getElementById('editHasRoomBooking').value === 'true';
            const roomBookingAmountInput = document.getElementById('editRoomBookingAmount').value.trim();
            const roomBookingAmount = hasRoomBooking ? parseFloat(roomBookingAmountInput) || 0 : 0;
            
            // Validate inputs
            if (!guestName) {
                alert('Please enter guest name');
                return;
            }
            
            if (!mobileNumber || !/^\d{10}$/.test(mobileNumber)) {
                alert('Please enter a valid 10-digit mobile number');
                return;
            }
            
            // Calculate amounts
            const expectedAmount = entryType === 'stag' ? 2750 : 4750;
            let paidAmount;
            
            if (paymentMode === 'partial_payment') {
                const paidAmountInput = document.getElementById('editPaidAmount').value.trim();
                paidAmount = parseFloat(paidAmountInput) || 0;
                if (paidAmount < 0 || paidAmount >= expectedAmount) {
                    alert(`Partial payment must be between 0 and ${expectedAmount - 1}`);
                    return;
                }
            } else {
                paidAmount = expectedAmount;
            }
            
            if (hasRoomBooking && (isNaN(roomBookingAmount) || roomBookingAmount < 0)) {
                alert('Please enter a valid room booking amount');
                return;
            }
            
            try {
                // Determine status
                let finalStatus;
                if (paidAmount >= expectedAmount) {
                    finalStatus = 'paid';
                } else if (paidAmount > 0) {
                    finalStatus = 'partially_paid';
                } else {
                    finalStatus = 'pending';
                }
                
                // Prepare update data
                const updateData = {
                    guest_name: guestName,
                    club_name: clubName,
                    mobile_number: mobileNumber,
                    entry_type: entryType,
                    status: finalStatus,
                    payment_mode: paymentMode,
                    paid_amount: paidAmount,
                    has_room_booking: hasRoomBooking,
                    total_amount: expectedAmount,
                    room_booking_amount: hasRoomBooking ? roomBookingAmount : null
                };
                
                // Perform update
                const { error: updateError } = await supabase
                    .from('guests')
                    .update(updateData)
                    .eq('id', guestId);

                if (updateError) throw updateError;

                // Close edit modal
                document.body.removeChild(modal);

                // Refresh guest list
                await loadGuestList();
                // Refresh stats
                await loadStats();
                
                // Show success notification
                const successModal = document.createElement('div');
                successModal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
                successModal.innerHTML = `
                    <div class="bg-[#2a0e3a] p-6 rounded-lg max-w-md w-full">
                        <div class="text-center mb-4">
                            <i class="fas fa-check-circle text-green-400 text-4xl mb-2"></i>
                            <h3 class="text-xl font-bold">Guest Updated</h3>
                        </div>
                        <p class="mb-6 text-center">Changes saved successfully!</p>
                        <button onclick="this.closest('.fixed').remove()" class="kochin-button w-full">
                            OK
                        </button>
                    </div>
                `;
                document.body.appendChild(successModal);
                
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
async function initQRScanner() {
    console.log('Initializing QR scanner...');
    
    // First, ensure we completely stop and remove any existing scanner
    if (qrScanner) {
        try {
            console.log('Clearing existing scanner instance');
            qrScanner.clear();
            qrScanner = null;
        } catch (e) {
            console.error('Error clearing previous scanner instance:', e);
        }
    }
    
    // Additional thorough cleanup for any leftover elements
    try {
        // Stop all video streams
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => {
                    console.log('Stopping video track:', track.id);
                    track.stop();
                });
                video.srcObject = null;
            }
        });
        
        // Remove any existing scanner elements completely
        const qrReaderElement = document.getElementById('qr-reader');
        if (qrReaderElement) {
            qrReaderElement.remove();
        }
        
        // Remove any other scanner-related elements that might be left behind
        document.querySelectorAll('.html5-qrcode-element').forEach(el => el.remove());
    } catch (e) {
        console.error('Error during thorough cleanup:', e);
    }

    // Get the QR scanner container element
    const qrScannerContainer = document.getElementById('qrScanner');
    
    // If the container doesn't exist, return early
    if (!qrScannerContainer) {
        console.error('QR Scanner container not found');
        return;
    }
    
    // Clear any existing content
    qrScannerContainer.innerHTML = '<div id="qr-reader" style="width:100%"></div>';

    // Create new scanner with a slight delay to ensure DOM is ready
    setTimeout(() => {
        try {
            console.log('Creating new scanner instance');
            qrScanner = new Html5QrcodeScanner(
                "qr-reader", 
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true,
                    showZoomSliderIfSupported: true,
                    defaultZoomValueIfSupported: 2,
                    formatsToSupport: [ 
                        Html5QrcodeSupportedFormats.QR_CODE
                    ]
                },
                /* verbose= */ false // Disable verbose logging
            );
            
            // Render the scanner with our success and error handlers
            qrScanner.render(onScanSuccess, onScanError);
            
            console.log('QR scanner initialized successfully');
        } catch (error) {
            console.error('Scanner initialization failed:', error);
            qrScannerContainer.innerHTML = `
                <div class="error-message p-4 bg-red-800 rounded-lg text-center">
                    <p class="mb-4">Failed to initialize scanner: ${error.message}</p>
                    <button onclick="initQRScanner()" class="kochin-button">
                        Retry Scanner Initialization
                    </button>
                </div>
            `;
        }
    }, 300); // Delay to ensure DOM is ready
}

// Separate success handler with better error handling
async function onScanSuccess(decodedText) {
    try {
        console.log('QR Code detected:', decodedText);
        
        if (!decodedText?.trim()) {
            console.log('Empty QR code content - ignoring');
            return; // Just ignore empty scans instead of showing an error
        }

        // For debugging - log the exact QR code content
        console.log('QR Code content (length ' + decodedText.length + '):', JSON.stringify(decodedText));
        
        let guestData;
        try {
            guestData = JSON.parse(decodedText);
            console.log('Successfully parsed QR data:', guestData);
        } catch (parseError) {
            console.error('Failed to parse QR code JSON:', parseError);
            
            // Silently ignore common non-guest QR codes without showing errors
            if (decodedText.includes('http') || decodedText.includes('www')) {
                console.log('Ignoring URL QR code');
                return;
            }
            
            // Silently ignore malformed JSON without showing errors
            if (decodedText.includes('{') && decodedText.includes('}')) {
                console.log('Ignoring malformed JSON QR code');
                return;
            }
            
            // Silently ignore other invalid formats without showing errors
            console.log('Ignoring invalid QR code format');
            return;
        }
        
        // Validate the parsed data silently without showing errors
        if (!guestData || !guestData.id) {
            console.log('Invalid guest data in QR code - ignoring');
            return;
        }
        
        // Get the latest guest data from Supabase
        console.log('Fetching guest with ID:', guestData.id);
        
        const { data: guest, error } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestData.id)
            .single();
        
        if (error) {
            console.error('Supabase error:', error);
            return; // Silently ignore database errors
        }
        
        if (!guest) {
            console.log('Guest not found - ignoring');
            return; // Silently ignore missing guests
        }
        
        // Calculate expected amount and payment status
        const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
        const isFullyPaid = parseFloat(guest.paid_amount) >= expectedAmount;
        
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
                        <span class="text-gray-300">Entry Type</span>
                        <span class="font-bold">${guest.entry_type.toUpperCase()}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-300">Payment Status</span>
                        <span class="font-bold ${isFullyPaid ? 'text-green-400' : 'text-yellow-400'}">
                            ${isFullyPaid ? 'PAID IN FULL' : 'PARTIAL PAYMENT'}
                        </span>
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
        qrScanner.pause();
        
    } catch (error) {
        console.error('QR code processing error:', error);
        // Only show errors for critical issues, not for normal scanning operations
        if (error.message && (
            error.message.includes('permission') || 
            error.message.includes('camera') ||
            error.message.includes('hardware')
        )) {
            showErrorModal(error.message);
        } else {
            // Just log other errors without showing a modal
            console.log('Non-critical scanning error (ignored):', error.message);
        }
        
        // Resume scanning after a short delay
        setTimeout(() => {
            if (qrScanner) {
                qrScanner.resume();
            }
        }, 500);
    }
}

// Separate error handler
function onScanError(errorMessage) {
    console.log('Scanner error:', errorMessage);
    // Don't show any error modal for normal scanning errors
    // These errors are expected during normal scanning operation
}

// Helper function to show errors
function showErrorModal(message) {
    // Skip showing errors for common scanning messages that aren't actual errors
    if (message === 'Unknown error' || 
        message.includes('No QR code found') || 
        message.includes('scanning ongoing') ||
        message.toLowerCase().includes('qr code format') ||
        message.toLowerCase().includes('not found')) {
        console.log('Ignoring non-critical scanning message:', message);
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75';
    modal.innerHTML = `
        <div class="bg-[#2a0e3a] p-6 rounded-lg max-w-md w-full">
            <div class="text-center mb-4">
                <i class="fas fa-exclamation-triangle text-red-400 text-4xl mb-2"></i>
                <h3 class="text-xl font-bold">Scanning Error</h3>
            </div>
            <p class="mb-6 text-center">${message}</p>
            <button onclick="this.closest('.fixed').remove()" class="kochin-button w-full">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Add debugging information
function addDebugInfo() {
    const debugInfo = document.createElement('div');
    debugInfo.id = 'qrDebugInfo';
    debugInfo.className = 'text-xs text-gray-400 mt-4 p-2 bg-gray-800 rounded';
    debugInfo.innerHTML = `
        <h4 class="font-bold mb-1">Scanner Debug Info</h4>
        <div>Browser: ${navigator.userAgent}</div>
        <div>Supports camera: ${!!navigator.mediaDevices}</div>
        <div>Supports QR scanning: ${!!window.Html5QrcodeScanner}</div>
    `;
    document.getElementById('qrScanner').appendChild(debugInfo);
}

// Request camera permissions before initializing scanner
async function checkCameraPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Camera permission denied:', error);
        return false;
    }
}

// Verify guest entry
window.verifyGuest = async function(guestId) {
    try {
        if (!guestId) {
            console.error('Missing guest ID in verifyGuest function');
            return;
        }

        console.log('Verifying guest with ID:', guestId);
        
        // Get guest data
        const { data: guest, error: getError } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();
        
        if (getError) {
            console.error('Error fetching guest data:', getError);
            // Handle the error silently without showing an alert
            return;
        }
        
        if (!guest) {
            console.error('Guest not found with ID:', guestId);
            // Handle the error silently without showing an alert
            return;
        }
        
        console.log('Successfully fetched guest data:', guest);
        
        // Update guest status to verified regardless of user role
        // This ensures the status is always updated when a valid QR code is scanned
        const { error: updateError } = await supabase
            .from('guests')
            .update({ status: 'verified' })
            .eq('id', guestId);
        
        if (updateError) {
            console.error('Error updating guest status:', updateError);
            // Handle the error silently without showing an alert
            return;
        }
        
        console.log('Successfully updated guest status to verified');
        
        // Show success message without using alert
        const successModal = document.createElement('div');
        successModal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75';
        successModal.innerHTML = `
            <div class="bg-[#2a0e3a] p-6 rounded-lg max-w-md w-full">
                <div class="text-center mb-4">
                    <i class="fas fa-check-circle text-green-400 text-4xl mb-2"></i>
                    <h3 class="text-xl font-bold text-green-400">Success</h3>
                </div>
                <p class="mb-6 text-center">Guest entry verified successfully!</p>
                <button onclick="this.closest('.fixed').remove(); if(qrScanner) qrScanner.resume();" class="kochin-button w-full bg-green-600">
                    OK
                </button>
            </div>
        `;
        
        // Close any existing modals first
        const existingModals = document.querySelectorAll('.fixed');
        existingModals.forEach(modal => modal.remove());
        
        // Show the success modal
        document.body.appendChild(successModal);
        
        // Resume scanning after a delay
        setTimeout(() => {
            if (qrScanner) {
                qrScanner.resume();
            }
        }, 3000); // Give the user 3 seconds to see the success message
        
    } catch (error) {
        console.error('Error in verifyGuest function:', error);
        
        // Handle the error silently without showing an alert
        // Close any existing modals
        const modal = document.querySelector('.fixed');
        if (modal) {
            modal.remove();
        }
        
        // Resume scanning
        if (qrScanner) {
            qrScanner.resume();
        }
    }
};

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
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            showTab(tabId);
        });
    });
    
    // Individual navigation buttons (for backward compatibility)
    document.getElementById('newRegistrationBtn')?.addEventListener('click', () => showTab('registration'));
    document.getElementById('entryVerificationBtn')?.addEventListener('click', () => showTab('verification'));
    document.getElementById('guestListBtn')?.addEventListener('click', () => showTab('guests'));
    document.getElementById('statsBtn')?.addEventListener('click', () => showTab('stats'));
    document.getElementById('usersBtn')?.addEventListener('click', () => showTab('users'));

    // Guest search input - simplified implementation
    const searchInput = document.getElementById('guestSearchInput');
    if (searchInput) {
        // Clear any existing search input
        searchInput.value = '';
        
        // Set attributes to prevent password managers from interfering
        searchInput.setAttribute('autocomplete', 'off');
        searchInput.setAttribute('data-lpignore', 'true');
        searchInput.setAttribute('data-form-type', 'search');
        
        // Simple input handler without cloning or complex focus management
        searchInput.addEventListener('input', function() {
            const searchValue = this.value;
            
            // Use requestAnimationFrame to ensure UI updates before search
            requestAnimationFrame(() => {
                loadGuestList(searchValue);
            });
        });
    }
    
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

            // Add room booking fields if they exist in the form
            const roomBookingSelect = document.getElementById('roomBooking');
            if (roomBookingSelect) {
                formData.has_room_booking = roomBookingSelect.value === 'yes';
                
                if (formData.has_room_booking) {
                    const roomBookingAmountInput = document.getElementById('roomBookingAmount');
                    if (roomBookingAmountInput) {
                        formData.room_booking_amount = Number(roomBookingAmountInput.value) || 0;
                    }
                }
            }
            
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
            document.getElementById('roomBookingSection').classList.add('hidden');
            document.getElementById('roomBookingAmount').removeAttribute('required');
            
            // Reload lists
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

    // Room booking change handler
    document.getElementById('roomBooking')?.addEventListener('change', function() {
        const roomBookingSection = document.getElementById('roomBookingSection');
        const roomBookingAmountInput = document.getElementById('roomBookingAmount');
        
        if (this.value === 'yes') {
            roomBookingSection.classList.remove('hidden');
            roomBookingAmountInput.setAttribute('required', 'required');
        } else {
            roomBookingSection.classList.add('hidden');
            roomBookingAmountInput.removeAttribute('required');
            roomBookingAmountInput.value = '';
        }
    });

    // Entry type change handler
    document.getElementById('entryType')?.addEventListener('change', updateAmount);

    // PDF and CSV download buttons
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
                                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${guest.entry_type === 'stag' ? 'STAG' : 'COUPLE'}${safeGetGuestProperty(guest, 'has_room_booking', false) ? ' + ROOM' : ''}</p>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <p style="font-size: 14px; margin: 0; color: #f7d046;">Status</p>
                                    <p style="
                                        font-size: 24px; 
                                        font-weight: bold; 
                                        margin: 5px 0 0;
                                        color: ${guest.status === 'verified' ? '#4ade80' : 
                                        guest.status === 'paid' ? '#3b82f6' : 
                                        guest.status === 'partially_paid' ? '#f59e0b' : '#ef4444'};
                                    ">
                                        ${guest.status || 'pending'}
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
                const message = `KOCHIN HANGOVER - GUEST PASS

Name: ${guest.guest_name}
Club: ${guest.club_name || ''}
Mobile: ${guest.mobile_number}
Entry Type: ${guest.entry_type === 'stag' ? 'STAG' : 'COUPLE'}${safeGetGuestProperty(guest, 'has_room_booking', false) ? ' + ROOM' : ''}${formatWhatsAppPaymentInfo(guest)}

Please show this pass at the entrance.`;
                
                // Remove any existing modals first
                const existingModals = document.querySelectorAll('.fixed.inset-0.flex.items-center.justify-center.z-50');
                existingModals.forEach(modal => {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                });
                
                // Check if user is on mobile device
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                // Create appropriate modal based on device type
                const modal = document.createElement('div');
                modal.id = 'whatsappShareModal';
                modal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75';
                
                if (isMobile) {
                    // Mobile version
                    modal.innerHTML = `
                        <div class="kochin-container p-6 max-w-md mx-auto">
                            <h3 class="text-xl font-bold mb-4 kochin-header">Share Guest Pass</h3>
                            <p class="mb-4">The guest pass image has been downloaded to your device.</p>
                            <p class="mb-4">After clicking "Open WhatsApp", please:</p>
                            <ol class="list-decimal pl-6 mb-6">
                                <li class="mb-2">Send the text message first</li>
                                <li class="mb-2">Tap the attachment icon in WhatsApp</li>
                                <li class="mb-2">Select "Gallery" or "Documents"</li>
                                <li class="mb-2">Find and select the downloaded guest pass image</li>
                            </ol>
                            <div class="flex justify-between">
                                <button id="openWhatsAppBtn" class="kochin-button flex-1 bg-green-600">
                                    <i class="fab fa-whatsapp mr-2"></i> Open WhatsApp
                                </button>
                                <button id="closeShareModalBtn" class="kochin-button bg-gray-600 flex-1">
                                    Close
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    // Desktop version with copyable message
                    modal.innerHTML = `
                        <div class="kochin-container p-6 max-w-md mx-auto">
                            <h3 class="text-xl font-bold mb-4 kochin-header">Share Guest Pass</h3>
                            <p class="mb-4">The guest pass image has been downloaded to your device.</p>
                            <p class="mb-4">For WhatsApp Desktop:</p>
                            <ol class="list-decimal pl-6 mb-6">
                                <li class="mb-2">Click the button below to open WhatsApp</li>
                                <li class="mb-2">Copy the message by clicking "Select & Copy Message"</li>
                                <li class="mb-2">Paste the message into WhatsApp</li>
                                <li class="mb-2">Attach the downloaded guest pass image</li>
                            </ol>
                            
                            <div class="bg-gray-100 p-3 rounded mb-4 text-black overflow-auto" style="max-height: 120px;">
                                <pre id="whatsappMessage" class="whitespace-pre-wrap text-sm font-mono">${message}</pre>
                            </div>
                            
                            <div class="flex justify-between mb-3">
                                <button id="copyMessageBtn" class="kochin-button flex-1 bg-blue-600">
                                    <i class="fas fa-copy mr-2"></i> Select & Copy Message
                                </button>
                            </div>
                            
                            <div class="flex justify-between">
                                <button id="openWhatsAppBtn" class="kochin-button flex-1 bg-green-600">
                                    <i class="fab fa-whatsapp mr-2"></i> Open WhatsApp
                                </button>
                                <button id="closeShareModalBtn" class="kochin-button bg-gray-600 flex-1">
                                    Close
                                </button>
                            </div>
                        </div>
                    `;
                }
                
                document.body.appendChild(modal);
                
                // Flag to track if download has been triggered
                let downloadTriggered = false;
                
                // Function to trigger download only once
                const triggerDownload = () => {
                    if (!downloadTriggered) {
                        // Create a temporary link for download
                        const downloadLink = document.createElement('a');
                        downloadLink.href = guestPassImageUrl;
                        downloadLink.download = guestPassFileName;
                        
                        // Trigger download programmatically
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        
                        downloadTriggered = true;
                    }
                };
                
                // Do NOT download immediately - will download only when user chooses to share
                
                // Helper function for safely removing the modal
                const safeRemoveModal = () => {
                    try {
                        if (modal && modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                        }
                    } catch (err) {
                        console.error('Error removing modal:', err);
                    }
                };
                
                // For desktop: handle copy message functionality
                if (!isMobile && document.getElementById('copyMessageBtn')) {
                    document.getElementById('copyMessageBtn').onclick = function() {
                        const messageElement = document.getElementById('whatsappMessage');
                        if (messageElement) {
                            // Select and copy the message text
                            const range = document.createRange();
                            range.selectNodeContents(messageElement);
                            const selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(range);
                            document.execCommand('copy');
                            selection.removeAllRanges();
                            
                            // Show confirmation
                            this.innerHTML = '<i class="fas fa-check mr-2"></i> Copied!';
                            setTimeout(() => {
                                this.innerHTML = '<i class="fas fa-copy mr-2"></i> Select & Copy Message';
                            }, 1500);
                        }
                    };
                }
                
                // Only trigger download when user explicitly chooses to share
                document.getElementById('openWhatsAppBtn').onclick = function() {
                    triggerDownload();
                    
                    // Close modal
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                    
                    // Format the number for WhatsApp
                    const whatsappNumber = mobileNumber.replace('+', '');
                    
                    // Track sharing state to prevent duplicates
                    let isSharing = false;
                    
                    if (isMobile) {
                        const whatsappUrl = `whatsapp://send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;
                        // Direct app opening without browser fallback
                        window.location.href = whatsappUrl;
                    } else {
                        // Desktop handling - open WhatsApp Web directly
                        window.open(`https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`, '_blank');
                    }
                };
                
                // Close button just closes the modal
                document.getElementById('closeShareModalBtn').onclick = function() {
                    safeRemoveModal();
                    // No download here since it was already done when the modal opened
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
        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) {
            console.error('Error loading stats:', error);
            alert('Failed to load statistics');
            return;
        }
        
        // Calculate total stats
        const totalGuests = guests.length;
        
        // Count verified entries based on full payment
        const verifiedEntries = guests.filter(guest => {
            const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
            const isPaidInFull = parseFloat(guest.paid_amount) >= expectedAmount;
            return isPaidInFull; // Guest has paid in full
        }).length;
        
        const pendingEntries = totalGuests - verifiedEntries;
        const registrationRevenue = guests.reduce((sum, guest) => sum + (parseFloat(guest.paid_amount) || 0), 0);
        const roomBookingRevenue = guests.reduce((sum, guest) => sum + (safeGetGuestProperty(guest, 'has_room_booking', false) ? (parseFloat(safeGetGuestProperty(guest, 'room_booking_amount', 0)) || 0) : 0), 0);
        const totalRevenue = registrationRevenue + roomBookingRevenue;
        
        // Calculate total PAX (headcount)
        const totalPax = guests.reduce((sum, guest) => {
            return sum + (guest.entry_type === 'couple' ? 2 : 1);
        }, 0);

        // Update summary stats
        document.getElementById('totalRegistrations').textContent = totalGuests;
        document.getElementById('verifiedEntries').textContent = verifiedEntries;
        document.getElementById('pendingEntries').textContent = pendingEntries;
        document.getElementById('registrationRevenue').textContent = `Rs.${registrationRevenue}`;
        document.getElementById('roomBookingRevenue').textContent = `Rs.${roomBookingRevenue}`;
        document.getElementById('totalRevenue').textContent = `Rs.${totalRevenue}`;
        document.getElementById('totalPax').textContent = totalPax;
        
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
                    <td class="py-3 px-4">Rs.${stats.totalAmount}</td>
                    <td class="py-3 px-4">Rs.${stats.paidAmount}</td>
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
                                            <td class="py-2 px-2 text-sm">${guest.entry_type === 'stag' ? 'Stag' : 'Couple'}${safeGetGuestProperty(guest, 'has_room_booking', false) ? ' + Room' : ''}</td>
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
                                            <td class="py-2 px-2 text-sm">Rs.${guest.paid_amount} / Rs.${guest.total_amount}</td>
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
                button.addEventListener('click', function() {
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
        // Check user role first
        const { data: userRole, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.id)
            .single();
        
        if (roleError) throw roleError;
        if (userRole?.role === 'doorman') {
            alert('Access denied. You do not have permission to download guest lists.');
            return;
        }

        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (!guests || guests.length === 0) {
            alert('No guests found to generate PDF.');
            return;
        }

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Define colors
        const darkColor = 40;
        const primaryColor = [232, 50, 131];
        
        // Add title
        doc.setFillColor(darkColor, darkColor, darkColor);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('KOCHIN HANGOVER - Guest List', 105, 15, { align: 'center' });
        
        // Set up table
        const startY = 30;
        const headers = ['#', 'Guest Details', 'Entry Type', 'Payment', 'Status'];
        const colWidths = [15, 75, 35, 35, 30];
        
        // Add headers
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(10, startY - 5, 190, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        
        let xPos = 10;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 2, startY);
            xPos += colWidths[i];
        });
        
        // Draw table rows
        let yPos = startY + 10;
        doc.setTextColor(darkColor);
        doc.setFontSize(10);
        
        // Add alternating row colors
        guests.forEach((guest, index) => {
            const rowHeight = 15;
            
            // Add row background
            doc.setFillColor(index % 2 === 0 ? 245 : 235);
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
            doc.text(`${entryType}${safeGetGuestProperty(guest, 'has_room_booking', false) ? ' + Room' : ''}`, xPos + 2, yPos);
            xPos += colWidths[2];
            
            // Payment
            doc.text(`Rs.${guest.paid_amount || 0} / Rs.${guest.total_amount || 0}`, xPos + 2, yPos);
            xPos += colWidths[3];
            
            // Status
            doc.text(guest.status || 'pending', xPos + 2, yPos);
            
            yPos += rowHeight;
            
            // Add a new page if needed
            if (yPos > 280) {
                doc.addPage();
                
                // Add header to new page
                doc.setFillColor(darkColor, darkColor, darkColor);
                doc.rect(0, 0, 210, 20, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text('KOCHIN HANGOVER - Guest List (Continued)', 105, 15, { align: 'center' });
                
                // Reset for new page
                yPos = 30;
            }
        });
        
        // Add summary section with white background and dark text
        yPos += 10;
        doc.setFillColor(255, 255, 255);
        doc.rect(10, yPos - 5, 190, 40, 'F');
        
        // Calculate totals
        const totalGuests = guests.length;
        const totalPax = guests.reduce((sum, guest) => sum + (guest.entry_type === 'couple' ? 2 : 1), 0);
        const verifiedGuests = guests.filter(guest => guest.status === 'verified').length;
        const verifiedPax = guests.filter(guest => guest.status === 'verified')
            .reduce((sum, guest) => sum + (guest.entry_type === 'couple' ? 2 : 1), 0);
        
        // Add totals with clear formatting
        doc.setTextColor(darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`Total Registrations: ${totalGuests} (${totalPax} PAX)`, 15, yPos + 5);
        doc.text(`Verified Entries: ${verifiedGuests} (${verifiedPax} PAX)`, 15, yPos + 20);
        
        // Save the PDF
        doc.save('kochin-hangover-guest-list.pdf');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

async function downloadGuestsCSV() {
    try {
        // Check user role first
        const { data: userRole, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.id)
            .single();
        
        if (roleError) throw roleError;
        if (userRole?.role === 'doorman') {
            alert('Access denied. You do not have permission to download guest lists.');
            return;
        }

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
            guest.entry_type === 'stag' ? 'Stag' : 'Couple',
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
        // Check user role first
        const { data: userRole, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.id)
            .single();
        
        if (roleError) throw roleError;
        if (userRole?.role === 'doorman') {
            alert('Access denied. You do not have permission to download statistics.');
            return;
        }

        // Fetch all guests
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*');
        
        if (error) throw error;
        if (!guests || guests.length === 0) {
            alert('No data available to generate statistics PDF.');
            return;
        }

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Define colors
        const darkColor = 40;
        
        // Add title
        doc.setFillColor(darkColor, darkColor, darkColor);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('KOCHIN HANGOVER - Event Statistics', 105, 15, { align: 'center' });
        
        // Calculate statistics
        const totalGuests = guests.length;
        const verifiedEntries = guests.filter(guest => guest.status === 'verified').length;
        const pendingEntries = totalGuests - verifiedEntries;
        const registrationRevenue = guests.reduce((sum, guest) => sum + (parseFloat(guest.paid_amount) || 0), 0);
        const roomBookingRevenue = guests.reduce((sum, guest) => 
            sum + (safeGetGuestProperty(guest, 'has_room_booking', false) ? 
            (parseFloat(safeGetGuestProperty(guest, 'room_booking_amount', 0)) || 0) : 0), 0);
        const totalRevenue = registrationRevenue + roomBookingRevenue;
        const totalPax = guests.reduce((sum, guest) => sum + (guest.entry_type === 'couple' ? 2 : 1), 0);
        
        // Function to add a card with better visibility
        function addCard(title, value, x, y, width, height = 25) {
            // White background
            doc.setFillColor(255, 255, 255);
            doc.rect(x, y, width, height, 'F');
            
            // Dark text
            doc.setTextColor(darkColor);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(title, x + 5, y + 10);
            
            doc.setFontSize(12);
            doc.text(value, x + 5, y + 20);
        }
        
        // Add statistics cards with reduced height and better visibility
        const margin = 10;
        const cardWidth = 90;
        const cardHeight = 25;
        let startY = 30;
        
        // First row
        addCard('Total Registrations', totalGuests.toString(), margin, startY, cardWidth, cardHeight);
        addCard('Verified Entries', verifiedEntries.toString(), margin + cardWidth + 10, startY, cardWidth, cardHeight);
        
        // Second row
        startY += cardHeight + 5;
        addCard('Pending Entries', pendingEntries.toString(), margin, startY, cardWidth, cardHeight);
        addCard('Total Revenue', `Rs.${totalRevenue}`, margin + cardWidth + 10, startY, cardWidth, cardHeight);
        
        // Third row
        startY += cardHeight + 5;
        addCard('Registration Revenue', `Rs.${registrationRevenue}`, margin, startY, cardWidth, cardHeight);
        addCard('Room Booking Revenue', `Rs.${roomBookingRevenue}`, margin + cardWidth + 10, startY, cardWidth, cardHeight);
        
        // Fourth row - Full width card
        startY += cardHeight + 5;
        addCard('Total PAX (Headcount)', totalPax.toString(), margin, startY, cardWidth * 2 + 10, cardHeight);
        
        // Save the PDF
        doc.save('kochin-hangover-statistics.pdf');
        
    } catch (error) {
        console.error('Error generating statistics PDF:', error);
        alert('Failed to generate statistics PDF. Please try again.');
    }
}

async function downloadStatsCSV() {
    try {
        // Check user role first
        const { data: userRole, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.id)
            .single();
        
        if (roleError) throw roleError;
        if (userRole?.role === 'doorman') {
            alert('Access denied. You do not have permission to download statistics.');
            return;
        }

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
                    count: 0,
                    totalAmount: 0,
                    paidAmount: 0
                };
            }
            
            clubStats[clubName].count++;
            clubStats[clubName].totalAmount += guest.total_amount || 0;
            clubStats[clubName].paidAmount += guest.paid_amount || 0;
        });
        
        // Sort clubs by count (descending)
        const sortedClubs = Object.entries(clubStats)
            .sort((a, b) => b[1].count - a[1].count);
        
        // Convert to CSV
        const headers = ['Club Name', 'Count', 'Total Amount', 'Paid Amount'];
        const csvData = sortedClubs.map(([club, stats]) => [
            club,
            stats.count,
            stats.totalAmount,
            stats.paidAmount
        ]);
        
        // Add summary row
        csvData.push([
            'TOTAL',
            guests.length,
            guests.reduce((sum, guest) => sum + guest.total_amount, 0),
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

// Helper function to get expected amount for a given entry type
function getExpectedAmount(entryType) {
    return entryType === 'stag' ? 2750 : 4750;
}

// Helper function to get pending amount for a guest
function getPendingAmount(guest) {
    const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
    return expectedAmount - guest.paid_amount;
}

// Helper function to format WhatsApp payment info
function formatWhatsAppPaymentInfo(guest) {
    const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
    const paidAmount = guest.paid_amount || 0;
    const pendingAmount = expectedAmount - paidAmount;
    const hasRoomBooking = safeGetGuestProperty(guest, 'has_room_booking', false);
    const roomBookingAmount = safeGetGuestProperty(guest, 'room_booking_amount', 0) || 0;
    
    let message = `\nPayment Received : ₹${paidAmount}`;
    
    // Only show Payment Pending for guests who have not paid in full
    if (paidAmount < expectedAmount) {
        message += `\nPayment Pending : ₹${pendingAmount}`;
    }
    
    // Add room booking amount for guests who have room booking
    if (hasRoomBooking && roomBookingAmount > 0) {
        message += `\nPayment Received for Room Booking : ₹${roomBookingAmount}`;
    }
    
    return message;
}
