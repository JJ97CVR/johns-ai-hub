import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    loadConversations();
  }, []);
  
  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      setConversations(data || []);
      
      if (data && data.length > 0 && !activeId) {
        setActiveId(data[0].id);
      }
    } catch (error) {
      console.error('Load conversations error:', error);
      toast({
        title: 'Error',
        description: 'Could not load conversations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const createNew = async (model: string = 'google/gemini-2.5-flash') => {
    try {
      console.log('🆕 Creating new conversation with model:', model);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('conversations')
        .insert({ 
          title: 'New Chat',
          model: model,
          user_id: user.user.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Create conversation error:', error);
        throw error;
      }
      
      console.log('✅ Created conversation:', data.id);
      
      // Uppdatera state atomiskt - INGEN race condition
      setActiveId(data.id);
      setConversations(prev => [data, ...prev]);
      
      return data.id;
    } catch (error) {
      console.error('Create conversation error:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte skapa konversation',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const deleteConversation = async (id: string) => {
    try {
      // Save for potential undo
      const deletedConv = conversations.find(c => c.id === id);
      
      // Use soft delete RPC function instead of hard delete
      const { error } = await supabase.rpc('soft_delete_conversation', {
        conversation_uuid: id
      });
      
      if (error) throw error;
      
      // Om vi tar bort den aktiva, välj nästa
      if (activeId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        if (remaining.length > 0) {
          // Välj nästa conversation (den som kommer efter i listan)
          setActiveId(remaining[0].id);
        } else {
          // Inga conversations kvar
          setActiveId(null);
        }
      }
      
      await loadConversations();
      
      toast({
        title: '🗑️ Raderad',
        description: 'Konversation raderad (återställs automatiskt efter 30 dagar)',
      });
    } catch (error) {
      console.error('Delete conversation error:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte radera konversation',
        variant: 'destructive',
      });
    }
  };
  
  const selectConversation = (id: string) => {
    console.log('🎯 Selecting conversation:', id);
    setActiveId(id);
  };
  
  const updateModel = async (id: string, model: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ model })
        .eq('id', id);
      
      if (error) throw error;
      
      await loadConversations();
    } catch (error) {
      console.error('Update model error:', error);
    }
  };
  
  const handleNewChat = async (model: string = 'google/gemini-2.5-flash') => {
    try {
      const id = await createNew(model);
      if (id) {
        selectConversation(id);
        toast({
          title: 'Ny chatt skapad',
          description: 'En ny konversation har startats',
        });
      }
    } catch (error) {
      console.error('Create conversation error:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte skapa ny konversation',
        variant: 'destructive',
      });
    }
  };
  
  return {
    conversations,
    activeId,
    isLoading,
    createNew,
    deleteConversation,
    selectConversation,
    updateModel,
    handleNewChat,
  };
}
