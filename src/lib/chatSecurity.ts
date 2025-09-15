import { supabase } from '@/integrations/supabase/client'

/**
 * Generates a cryptographically secure session ID for anonymous chat sessions
 */
export function generateSecureSessionId(): string {
  // Use crypto.randomUUID() if available, fallback to secure random string
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback: generate a secure 32-character random string
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Sets the session context for the current request to enable RLS validation
 */
export async function setSessionContext(sessionId: string): Promise<void> {
  try {
    // Call the security definer function to set session context
    const { error } = await supabase.rpc('set_session_context', {
      session_id_param: sessionId
    })
    
    if (error) {
      console.warn('Failed to set session context:', error.message)
    }
  } catch (error) {
    console.warn('Error setting session context:', error)
  }
}

/**
 * Safely retrieves a chat conversation with proper session validation
 */
export async function getChatConversation(sessionId: string, userId?: string) {
  // Set session context before making the query
  await setSessionContext(sessionId)
  
  try {
    const query = supabase
      .from('chat_conversations')
      .select('*')
      .eq('session_id', sessionId)
    
    // Add user filter if authenticated
    if (userId) {
      query.eq('user_id', userId)
    } else {
      query.is('user_id', null)
    }
    
    const { data, error } = await query.maybeSingle()
    
    if (error) {
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error fetching chat conversation:', error)
    return null
  }
}

/**
 * Safely creates or updates a chat conversation with proper session validation
 */
export async function upsertChatConversation(
  sessionId: string, 
  messages: any[], 
  userId?: string
) {
  // Set session context before making the query
  await setSessionContext(sessionId)
  
  try {
    const conversationData = {
      session_id: sessionId,
      user_id: userId || null,
      messages: JSON.stringify(messages),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('chat_conversations')
      .upsert(conversationData, {
        onConflict: 'session_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error upserting chat conversation:', error)
    throw error
  }
}

/**
 * Validates that a session ID meets security requirements
 */
export function validateSessionId(sessionId: string): boolean {
  // Must be at least 16 characters and not more than 100
  if (!sessionId || sessionId.length < 16 || sessionId.length > 100) {
    return false
  }
  
  // Should contain only valid characters (alphanumeric and hyphens)
  const validCharacters = /^[a-zA-Z0-9-]+$/
  if (!validCharacters.test(sessionId)) {
    return false
  }
  
  return true
}

/**
 * Gets or creates a session ID for the current browser session
 */
export function getOrCreateSessionId(): string {
  const storageKey = 'chat_session_id'
  
  try {
    // Try to get existing session ID from localStorage
    const existingSessionId = localStorage.getItem(storageKey)
    
    if (existingSessionId && validateSessionId(existingSessionId)) {
      return existingSessionId
    }
    
    // Generate new session ID if none exists or invalid
    const newSessionId = generateSecureSessionId()
    localStorage.setItem(storageKey, newSessionId)
    
    return newSessionId
  } catch (error) {
    // Fallback if localStorage is not available
    console.warn('localStorage not available, using temporary session ID')
    return generateSecureSessionId()
  }
}