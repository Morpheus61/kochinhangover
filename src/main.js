import { supabase } from './config/supabase'
import './styles.css'

// Initialize app state
let guests = []
let currentGuest = null
let currentUser = null

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await handleLogin(user)
    } else {
        showLoginScreen()
    }

    // Setup event listeners
    setupEventListeners()
})

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen')?.classList.remove('hidden')
    document.getElementById('mainApp')?.classList.add('hidden')
}

// Handle successful login
async function handleLogin(user) {
    currentUser = user
    document.getElementById('loginScreen')?.classList.add('hidden')
    document.getElementById('mainApp')?.classList.remove('hidden')
    
    // Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
    
    // Update UI based on user role
    if (profile?.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'))
        showTab('registration')
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'))
        showTab('beverage')
    }
    
    // Load guests
    await loadGuests()
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const email = document.getElementById('username').value
        const password = document.getElementById('password').value
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        
        if (error) {
            const errorDiv = document.getElementById('loginError')
            errorDiv.textContent = error.message
            errorDiv.classList.remove('hidden')
            setTimeout(() => errorDiv.classList.add('hidden'), 3000)
            return
        }
        
        await handleLogin(data.user)
    })
    
    // Other event listeners will be added here
}

// Load guests from Supabase
async function loadGuests() {
    const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error('Error loading guests:', error)
        return
    }
    
    guests = data
    populateGuestList()
}

// Show specific tab
function showTab(tabName) {
    // Hide all content
    document.querySelectorAll('[id$="Content"]').forEach(el => el.classList.add('hidden'))
    
    // Deactivate all tabs
    document.querySelectorAll('[id$="Tab"]').forEach(el => el.classList.remove('active'))
    
    // Show selected content and activate tab
    document.getElementById(`${tabName}Content`)?.classList.remove('hidden')
    document.getElementById(`${tabName}Tab`)?.classList.add('active')
    
    // Special actions for specific tabs
    if (tabName === 'guestList') {
        populateGuestList()
    }
}

// Populate guest list
function populateGuestList() {
    const tbody = document.getElementById('guestsTableBody')
    if (!tbody) return
    
    tbody.innerHTML = guests.length ? '' : '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-400">No guests registered yet</td></tr>'
    
    guests.forEach(guest => {
        const row = document.createElement('tr')
        row.className = 'guest-row'
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${guest.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${guest.club_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${guest.mobile_number}</td>
            <td class="px-6 py-4 whitespace-nowrap">${guest.entry_type}</td>
            <td class="px-6 py-4 whitespace-nowrap">₹${guest.balance.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button class="text-blue-500 hover:text-blue-700 mr-2" onclick="selectGuest('${guest.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `
        tbody.appendChild(row)
    })
}
