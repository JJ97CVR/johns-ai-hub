import { Plus, MessageSquare, Trash2, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

interface ConversationSidebarProps {
  defaultModel?: string;
  isGlobalSidebarOpen?: boolean;
}

export function ConversationSidebar({ defaultModel = 'google/gemini-2.5-flash', isGlobalSidebarOpen = true }: ConversationSidebarProps) {
  const { conversations, handleNewChat, deleteConversation, selectConversation, activeId } = useConversationsContext();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Filter conversations by search query (debounced)
  const filteredConversations = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return conversations;
    const query = debouncedSearchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(query)
    );
  }, [conversations, debouncedSearchQuery]);
  
  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: { [key: string]: typeof conversations } = {
      'Idag': [],
      'Igår': [],
      'Senaste 7 dagarna': [],
      'Äldre': []
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    filteredConversations.forEach(conv => {
      const convDate = new Date(conv.created_at);
      const convDay = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());
      
      if (convDay.getTime() === today.getTime()) {
        groups['Idag'].push(conv);
      } else if (convDay.getTime() === yesterday.getTime()) {
        groups['Igår'].push(conv);
      } else if (convDate >= weekAgo) {
        groups['Senaste 7 dagarna'].push(conv);
      } else {
        groups['Äldre'].push(conv);
      }
    });
    
    return groups;
  }, [filteredConversations]);
  
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="pt-6 px-4 pb-4 border-b flex-shrink-0 space-y-3">
        <Button 
          onClick={() => handleNewChat(defaultModel)} 
          className="w-full gap-2 bg-primary hover:bg-primary/90 hover:scale-105 transition-transform shadow-sm"
        >
          <Plus size={18} />
          New Chat
        </Button>
        
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök konversationer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 overscroll-contain">
        <div className="p-2 space-y-4">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-4 animate-fade-in">
              <MessageSquare size={32} className="mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearchQuery ? 'Inga matchande konversationer' : 'Inga konversationer ännu'}
              </p>
            </div>
          ) : (
            Object.entries(groupedConversations).map(([groupName, convs]) => 
              convs.length > 0 && (
                <div key={groupName} className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground px-3 py-1">
                    {groupName}
                  </h3>
                  {convs.map((conv, idx) => (
                    <div 
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`
                        group/item flex items-center gap-2.5 p-3 rounded-lg cursor-pointer 
                        transition-all duration-200 animate-fade-in
                        ${activeId === conv.id 
                          ? 'bg-accent shadow-sm scale-[1.02]' 
                          : 'hover:bg-accent/50 hover:scale-[1.01]'}
                      `}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <MessageSquare size={16} className="shrink-0 text-primary mt-0.5" />
                      <span 
                        className="flex-1 text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                        title={conv.title === 'New Chat' 
                          ? new Date(conv.created_at).toLocaleString('sv-SE', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : conv.title
                        }
                      >
                        {conv.title === 'New Chat' 
                          ? new Date(conv.created_at).toLocaleString('sv-SE', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : conv.title
                        }
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="p-1.5 hover:bg-destructive/10 rounded-md transition-all hover:scale-110 shrink-0 opacity-0 group-hover/item:opacity-100"
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
