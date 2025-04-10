import { supabase } from './config/supabase'
import './styles.css'

// Initialize app state
let guests = []
let currentGuest = null
let currentUser = null

// Constants for entry prices
const ENTRY_PRICES = {
    stag: 2750,
    couple: 4750
}

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners()
    
    // Check if user is already logged in
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
        await handleLogin(session.user)
    } else {
        showLoginScreen()
    }
})

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const username = document.getElementById('username').value
        const password = document.getElementById('password').value
        
        try {
            // First get user data from the users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single()

            if (userError || !userData) {
                throw new Error('Invalid username or password')
            }

            // Check if password matches
            if (userData.password !== password) {
                throw new Error('Invalid username or password')
            }

            // Set the user role
            currentUser = {
                id: username,
                role: userData.role,
                username: username
            }

            // Update UI based on role
            document.getElementById('loginScreen')?.classList.add('hidden')
            document.getElementById('mainApp')?.classList.remove('hidden')

            // Show/hide admin features
            const isAdmin = userData.role === 'admin'
            document.querySelectorAll('.admin-only').forEach(el => {
                if (isAdmin) {
                    el.classList.remove('hidden')
                } else {
                    el.classList.add('hidden')
                }
            })

            // Show appropriate tab based on role
            showTab(isAdmin ? 'registration' : 'beverage')

            // Load initial data
            await loadGuests()
        } catch (error) {
            const errorDiv = document.getElementById('loginError')
            errorDiv.textContent = error.message || 'Failed to login'
            errorDiv.classList.remove('hidden')
            setTimeout(() => errorDiv.classList.add('hidden'), 3000)
        }
    })

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        supabase.auth.signOut()
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
            const entryType = formData.get('entryType')
            const paymentStatus = formData.get('paymentStatus')
            const totalAmount = ENTRY_PRICES[entryType]
            const amountPaid = paymentStatus === 'partial' ? 
                Number(formData.get('amountPaid')) : 
                (paymentStatus === 'paid' ? totalAmount : 0)

            const { data, error } = await supabase
                .from('guests')
                .insert([{
                    name: formData.get('name'),
                    phone: formData.get('phone'),
                    club_name: formData.get('clubName'),
                    club_number: formData.get('clubNumber'),
                    entry_type: entryType,
                    payment_status: paymentStatus,
                    amount_paid: amountPaid,
                    total_amount: totalAmount,
                    created_by: currentUser.username
                }])
            
            if (error) throw error
            
            // Reset form and reload guests
            e.target.reset()
            await loadGuests()
        } catch (error) {
            console.error('Error registering guest:', error)
            alert('Failed to register guest')
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
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen')?.classList.remove('hidden')
    document.getElementById('mainApp')?.classList.add('hidden')
    // Reset forms
    document.getElementById('loginForm')?.reset()
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
            <td class="py-3 px-4">${guest.name}</td>
            <td class="py-3 px-4">${guest.club_name}</td>
            <td class="py-3 px-4">${guest.phone}</td>
            <td class="py-3 px-4">${guest.entry_type}</td>
            <td class="py-3 px-4">
                <div class="flex flex-col">
                    <span>${guest.payment_status}</span>
                    ${guest.payment_status === 'partial' ? 
                        `<span class="text-xs text-gray-400">₹${guest.amount_paid} / ₹${guest.total_amount}</span>` 
                        : ''}
                </div>
            </td>
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

// Handle successful login
async function handleLogin(user) {
    try {
        // Get user profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
            
        if (error) throw error

        currentUser = { ...user, profile }
        
        // Update UI
        document.getElementById('loginScreen')?.classList.add('hidden')
        document.getElementById('mainApp')?.classList.remove('hidden')
        
        // Show/hide admin features
        const isAdmin = profile?.role === 'admin'
        document.querySelectorAll('.admin-only').forEach(el => {
            if (isAdmin) {
                el.classList.remove('hidden')
            } else {
                el.classList.add('hidden')
            }
        })
        
        // Show appropriate tab based on role
        showTab(isAdmin ? 'registration' : 'beverage')
        
        // Load initial data
        await loadGuests()
    } catch (error) {
        console.error('Error handling login:', error)
        showLoginScreen()
    }
}
