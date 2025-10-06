/**
 * Persistence Queue - Async Database Operations
 * Phase 1: Non-blocking persistence for messages and metadata
 * 
 * Moves all database writes to background queue with retry logic
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logInfo, logError } from './logger-utils.ts';

interface PersistTask {
  type: 'user_message' | 'conversation_title' | 'file_link' | 'code_blocks' | 'conversation_timestamp';
  data: any;
  retries: number;
  createdAt: number;
}

class PersistenceQueue {
  private queue: PersistTask[] = [];
  private processing = false;
  private maxRetries = 3;
  private maxQueueSize = 1000;

  /**
   * Add task to queue and start processing if not already running
   */
  async add(task: Omit<PersistTask, 'retries' | 'createdAt'>): Promise<void> {
    // Prevent queue overflow
    if (this.queue.length >= this.maxQueueSize) {
      logError('persistence-queue', 'Queue overflow - dropping task', new Error('Queue full'), {
        queueSize: this.queue.length,
        taskType: task.type,
      });
      return;
    }

    this.queue.push({ 
      ...task, 
      retries: 0,
      createdAt: Date.now(),
    });
    
    logInfo('persistence-queue', 'Task queued', {
      type: task.type,
      queueSize: this.queue.length,
    });

    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }
  }

  /**
   * Process queue in background
   */
  private async process(): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      const age = Date.now() - task.createdAt;
      
      try {
        await this.executeTask(task);
        logInfo('persistence-queue', 'Task completed', {
          type: task.type,
          ageMs: age,
        });
      } catch (error) {
        logError('persistence-queue', 'Task execution error', error as Error, {
          type: task.type,
          retries: task.retries,
        });

        // Retry logic with exponential backoff
        if (task.retries < this.maxRetries) {
          task.retries++;
          this.queue.push(task);
          
          // Wait before retry (exponential backoff)
          const delay = 1000 * Math.pow(2, task.retries - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logError('persistence-queue', 'Task failed after max retries', error as Error, {
            type: task.type,
            data: task.data,
          });
        }
      }
    }
    
    this.processing = false;
  }

  /**
   * Execute individual task based on type
   */
  private async executeTask(task: PersistTask): Promise<void> {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (task.type) {
      case 'user_message':
        await supabase
          .from('messages')
          .insert({
            id: task.data.id,
            conversation_id: task.data.conversationId,
            role: 'user',
            content: task.data.message,
          });
        break;

      case 'conversation_title':
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('title')
          .eq('id', task.data.conversationId)
          .single();

        if (existingConv?.title === 'New Chat') {
          await supabase
            .from('conversations')
            .update({ title: task.data.title })
            .eq('id', task.data.conversationId);
        }
        break;

      case 'file_link':
        if (task.data.fileIds?.length > 0) {
          const updates = task.data.fileIds.map((fileId: string) => ({
            id: fileId,
            message_id: task.data.messageId,
          }));
          
          await supabase
            .from('uploaded_files')
            .upsert(updates);
        }
        break;

      case 'code_blocks':
        if (task.data.codeBlocks?.length > 0) {
          const records = task.data.codeBlocks.map((block: any) => ({
            message_id: task.data.messageId,
            code: block.code,
            language: block.language,
          }));
          
          await supabase
            .from('code_executions')
            .insert(records);
        }
        break;

      case 'conversation_timestamp':
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', task.data.conversationId);
        break;

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Get current queue statistics
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
    };
  }
}

// Export singleton instance
export const persistQueue = new PersistenceQueue();
