import { createContext, useContext, ReactNode } from 'react';
import { useConversations } from '@/hooks/useConversations';

interface ConversationsContextType {
  conversations: Array<{
    id: string;
    title: string;
    model: string;
    created_at: string;
    updated_at: string;
  }>;
  activeId: string | null;
  isLoading: boolean;
  createNew: (model?: string) => Promise<string | null>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string) => void;
  updateModel: (id: string, model: string) => Promise<void>;
  handleNewChat: (model?: string) => Promise<void>;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const conversationsState = useConversations();
  
  return (
    <ConversationsContext.Provider value={conversationsState}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversationsContext() {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error('useConversationsContext must be used within ConversationsProvider');
  }
  return context;
}
