/**
 * Chat Messages Service
 * Sprint 6: Architecture Refactoring
 * 
 * Handles all message CRUD operations and conversation management.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withRetry } from '../../shared/db-retry.ts';

export interface SaveMessageResult {
  message: any;
  error?: any;
}

/**
 * Save user message to database with retry logic
 */
export async function saveUserMessage(
  supabaseClient: SupabaseClient,
  conversationId: string,
  content: string
): Promise<SaveMessageResult> {
  const { data: userMessage, error: userError } = await withRetry(async () => {
    const result = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content,
      })
      .select()
      .single();
    
    if (result.error) throw result.error;
    return result;
  });
  
  return { message: userMessage, error: userError };
}

/**
 * Save assistant message placeholder (content will be updated during streaming)
 */
export async function saveAssistantMessage(
  supabaseClient: SupabaseClient,
  conversationId: string
): Promise<SaveMessageResult> {
  const { data: assistantMessage, error: assistantError } = await supabaseClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '', // Will be updated during streaming
    })
    .select()
    .single();
  
  return { message: assistantMessage, error: assistantError };
}

/**
 * Update assistant message with final content
 * BUG-2 FIX: Added error handling and retry logic
 */
export async function updateAssistantMessage(
  supabaseClient: SupabaseClient,
  messageId: string,
  content: string,
  citations?: any[],
  toolsUsed?: string[]
): Promise<{ success: boolean; error?: any }> {
  try {
    const { data, error, count } = await withRetry(async () => {
      const result = await supabaseClient
        .from('messages')
        .update({ 
          content,
          citations: citations && citations.length > 0 ? citations : null,
          tools_used: toolsUsed && toolsUsed.length > 0 ? toolsUsed : null,
        })
        .eq('id', messageId)
        .select();
      
      if (result.error) throw result.error;
      return result;
    });

    if (error || !count || count === 0) {
      console.error('❌ Failed to update assistant message:', {
        messageId,
        error: String(error || 'No rows affected'),
        count
      });
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error('❌ Exception updating assistant message:', err);
    return { success: false, error: err };
  }
}

/**
 * Get conversation history (Sprint 4: excludes soft-deleted)
 */
export async function getConversationHistory(
  supabaseClient: SupabaseClient,
  conversationId: string
): Promise<any[]> {
  const { data: rawHistory } = await supabaseClient
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null) // Exclude soft-deleted
    .order('created_at', { ascending: true });
  
  return rawHistory || [];
}

/**
 * Auto-update conversation title on first message
 */
export async function updateConversationTitle(
  supabaseClient: SupabaseClient,
  conversationId: string,
  message: string
): Promise<void> {
  try {
    const { data: userMessages } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('role', 'user');
    
    if (userMessages && userMessages.length === 1) {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      await supabaseClient
        .from('conversations')
        .update({ title })
        .eq('id', conversationId);
    }
  } catch (error) {
    console.error('Failed to update conversation title:', error);
  }
}

/**
 * Update conversation timestamp
 */
export async function updateConversationTimestamp(
  supabaseClient: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabaseClient
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

/**
 * Save code blocks from assistant response
 */
export async function saveCodeBlocks(
  supabaseClient: SupabaseClient,
  messageId: string,
  codeBlocks: Array<{ language: string; code: string }>
): Promise<void> {
  if (codeBlocks.length === 0) return;
  
  for (const block of codeBlocks) {
    await supabaseClient
      .from('code_executions')
      .insert({
        message_id: messageId,
        code: block.code,
        language: block.language,
      });
  }
}

/**
 * Link files to user message
 */
export async function linkFilesToMessage(
  supabaseClient: SupabaseClient,
  fileIds: string[],
  messageId: string
): Promise<void> {
  await supabaseClient
    .from('uploaded_files')
    .update({ message_id: messageId })
    .in('id', fileIds);
}

/**
 * Verify file ownership
 */
export async function verifyFileOwnership(
  userClient: SupabaseClient,
  fileIds: string[],
  conversationId: string
): Promise<{ valid: boolean; error?: string }> {
  const { data: ownedFiles, error: filesError } = await userClient
    .from('uploaded_files')
    .select('id, conversation_id')
    .in('id', fileIds);
  
  if (filesError) {
    return { valid: false, error: 'Failed to verify file access' };
  }
  
  const allOwned = ownedFiles?.every((f: any) => f.conversation_id === conversationId);
  if (!allOwned || ownedFiles?.length !== fileIds.length) {
    return { valid: false, error: 'Access denied: One or more files not accessible' };
  }
  
  return { valid: true };
}

/**
 * Soft delete conversation and related data (Sprint 4)
 */
export async function softDeleteConversation(
  supabaseClient: SupabaseClient,
  conversationId: string
): Promise<void> {
  // Use the database function for atomic soft delete
  const { error } = await supabaseClient.rpc('soft_delete_conversation', {
    conversation_uuid: conversationId
  });

  if (error) {
    console.error('Failed to soft delete conversation:', error);
    throw error;
  }
}

/**
 * Permanently delete soft-deleted conversation (Sprint 4)
 */
export async function permanentlyDeleteConversation(
  supabaseClient: SupabaseClient,
  conversationId: string
): Promise<void> {
  // Verify conversation is soft-deleted first
  const { data: conv, error: checkError } = await supabaseClient
    .from('conversations')
    .select('deleted_at')
    .eq('id', conversationId)
    .single();

  if (checkError || !conv || !conv.deleted_at) {
    throw new Error('Conversation must be soft-deleted first');
  }

  // Permanently delete
  const { error } = await supabaseClient
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('Failed to permanently delete conversation:', error);
    throw error;
  }
}
