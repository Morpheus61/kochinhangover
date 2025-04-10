import { supabase } from '../config/supabase'

// Auth functions
export const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    return { data, error }
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
}

// Guest functions
export const createGuest = async (guestData) => {
    const { data, error } = await supabase
        .from('guests')
        .insert([guestData])
        .select()
    return { data, error }
}

export const updateGuest = async (id, updates) => {
    const { data, error } = await supabase
        .from('guests')
        .update(updates)
        .eq('id', id)
        .select()
    return { data, error }
}

export const getGuests = async () => {
    const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false })
    return { data, error }
}

// Transaction functions
export const createTransaction = async (transactionData) => {
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            ...transactionData,
            processed_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
    return { data, error }
}

export const getGuestTransactions = async (guestId) => {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            profiles:processed_by (username)
        `)
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
    return { data, error }
}

// Beverage transaction functions
export const createBeverageTransaction = async (transactionData) => {
    const { data, error } = await supabase
        .from('beverage_transactions')
        .insert([{
            ...transactionData,
            processed_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
    return { data, error }
}

export const getGuestBeverageTransactions = async (guestId) => {
    const { data, error } = await supabase
        .from('beverage_transactions')
        .select(`
            *,
            profiles:processed_by (username)
        `)
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
    return { data, error }
}

// Profile functions
export const updateProfile = async (userId, updates) => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
    return { data, error }
}

export const getProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    return { data, error }
}
