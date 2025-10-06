import { useState, useEffect, useRef } from 'react';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { useAbortableSSE } from '@/hooks/useAbortableSSE';
import { supabase } from '@/integrations/supabase/client';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { AIInputArea } from '@/components/AIInputArea';
import { AIMessageBubble } from '@/components/AIMessageBubble';
import { StopGeneratingButton } from '@/components/StopGeneratingButton';
import { MessageToolbar } from '@/components/MessageToolbar';
import { ChatModeControl } from '@/components/ChatModeControl';
import { ModelSelector } from '@/components/ModelSelector';
import { CitationsList } from '@/components/CitationsList';
import { PromoteToKBButton } from '@/components/PromoteToKBButton';
import WelcomeSection from '@/components/WelcomeSection';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CheckpointNotification } from '@/components/CheckpointNotification';
import { PanelLeft, PanelLeftClose, Bot, ArrowDown, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestSpellingFix } from '@/lib/spellingSuggestions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import geminiLogo from '@/assets/gemini-logo.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  model?: string;
  mode?: string;
  citations?: Array<{ title: string; url: string }>;
  tools_used?: string[];
  isStreaming?: boolean;
}

interface ChatExactProps {
  embedded?: boolean;
}

export default function ChatExact({ embedded = false }: ChatExactProps) {
  const { toast } = useToast();
  const { conversations, activeId, createNew, updateModel } = useConversationsContext();
  const { startStream, stopStream, isStreaming } = useAbortableSSE();
  
  // Global Sidebar (huvudmeny) toggle state with localStorage persistence
  const [isGlobalSidebarOpen, setIsGlobalSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('globalSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'fast' | 'auto' | 'extended'>('auto');
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [spellingError, setSpellingError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lastStreamUpdate, setLastStreamUpdate] = useState<number>(Date.now());
  const [showTypingDots, setShowTypingDots] = useState(true);
  const [lastSendTime, setLastSendTime] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unreadCount, setUnreadCount] = useState(0);
  const [streamingDuration, setStreamingDuration] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  // Persist global sidebar state
  useEffect(() => {
    localStorage.setItem('globalSidebarOpen', JSON.stringify(isGlobalSidebarOpen));
  }, [isGlobalSidebarOpen]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const addedMessageIdsRef = useRef<Set<string>>(new Set());
  const shouldAutoScrollRef = useRef(true); // Track if user wants auto-scroll
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingDotsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingStartTimeRef = useRef<number>(0);
  const pendingAssistantRef = useRef<boolean>(false); // FIX #1: Track pending assistant message

  // FIX #6: Hide typing dots after 3s of inactivity (smoother UX)
  useEffect(() => {
    if (!streamingContent) {
      setShowTypingDots(true); // Reset when no streaming
      return;
    }
    
    // Show dots initially
    setShowTypingDots(true);
    
    // Clear existing timeout
    if (typingDotsTimeoutRef.current) {
      clearTimeout(typingDotsTimeoutRef.current);
    }
    
    // Set new timeout to hide dots after 3s of no updates (more forgiving)
    typingDotsTimeoutRef.current = setTimeout(() => {
      if (streamingContent && Date.now() - lastStreamUpdate > 2900) {
        // Content hasn't updated in 3s, hide dots
        console.log('⏰ Typing dots timeout - hiding after 3s inactivity');
        setShowTypingDots(false);
      }
    }, 3000);
    
    return () => {
      if (typingDotsTimeoutRef.current) {
        clearTimeout(typingDotsTimeoutRef.current);
      }
    };
  }, [streamingContent, lastStreamUpdate]);

  // UX: Track streaming duration and show timeout warning after 10s
  useEffect(() => {
    if (!isStreaming) {
      setStreamingDuration(0);
      setShowTimeoutWarning(false);
      streamingStartTimeRef.current = 0;
      return;
    }

    // Start timing
    streamingStartTimeRef.current = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - streamingStartTimeRef.current;
      setStreamingDuration(elapsed);
      
      // Show warning after 10s
      if (elapsed > 10000) {
        setShowTimeoutWarning(true);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      setStreamingDuration(0);
      setShowTimeoutWarning(false);
    };
  }, [isStreaming]);

  // Keyboard shortcuts + Online/Offline + Session timeout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to stop generating
      if (e.key === 'Escape' && isStreaming) {
        handleStop();
      }
    };
    
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: '🌐 Tillbaka online',
        description: 'Internetanslutningen är återställd',
      });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: '📡 Offline',
        description: 'Ingen internetanslutning',
        variant: 'destructive',
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isStreaming]);
  
  // Monitor auth session for timeouts
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        toast({
          title: '🔐 Session utgången',
          description: 'Du har loggats ut. Ladda om sidan för att logga in igen.',
          variant: 'destructive',
        });
      }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Smart auto-scroll - bara om användaren är nära botten
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    
    // Update auto-scroll preference based on user's scroll position
    shouldAutoScrollRef.current = isNearBottom;
    
    // Only auto-scroll if user is near bottom or if it's a new conversation
    if (isNearBottom || messages.length <= 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingContent]);
  
  // Handle manual scroll - detect if user scrolls up and show scroll button with unread count
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      shouldAutoScrollRef.current = isNearBottom;
      setShowScrollButton(!isNearBottom && messages.length > 0);
      
      // Reset unread count when user scrolls to bottom
      if (isNearBottom) {
        setUnreadCount(0);
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);
  
  // Track unread messages when scrolled up
  useEffect(() => {
    if (!shouldAutoScrollRef.current && messages.length > 0) {
      setUnreadCount(prev => prev + 1);
    }
  }, [messages.length]);

  // Sync selectedModel with active conversation
  useEffect(() => {
    if (!activeId) return;
    const conv = conversations.find(c => c.id === activeId);
    if (conv?.model) {
      setSelectedModel(conv.model);
    }
  }, [activeId, conversations]);

  // Load messages when conversation changes - CRITICAL FIX: Cleanup timeouts
  useEffect(() => {
    if (activeId) {
      console.log('🔄 Loading messages for conversation:', activeId);
      setMessages([]);
      setStreamingContent('');
      setStreamingMessageId(null);
      addedMessageIdsRef.current.clear();
      loadMessages(activeId);
    } else {
      setMessages([]);
      setStreamingMessageId(null);
      addedMessageIdsRef.current.clear();
    }
    
    // CRITICAL: Cleanup timeouts on conversation change
    return () => {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }
      if (typingDotsTimeoutRef.current) {
        clearTimeout(typingDotsTimeoutRef.current);
        typingDotsTimeoutRef.current = null;
      }
    };
  }, [activeId]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeId) return;
    
    // FIX: Clear tracking state on conversation switch to prevent stale duplicates
    addedMessageIdsRef.current.clear();
    
    console.log('🔔 Setting up realtime subscription for:', activeId);
    const channel = supabase
      .channel(`messages-${activeId}`)
      .on('postgres_changes', {
        event: '*', // PHASE 1D: Listen to INSERT + UPDATE (Lovable Pattern)
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeId}`
      }, (payload) => {
        const eventType = payload.eventType || (payload as any).event;
        console.log('📨 Realtime event:', eventType, payload.new);
        const msg = payload.new as any;
        
        // Handle UPDATE events: Streaming content updates
        if (eventType === 'UPDATE') {
          console.log('📝 Message updated via realtime');
          setMessages(prev => prev.map(m =>
            m.id === msg.id
              ? {
                  ...m,
                  content: msg.content,
                  citations: msg.citations,
                  tools_used: msg.tools_used,
                }
              : m
          ));
          return;
        }
        
        // Handle INSERT events: Initial message creation
        // CRITICAL FIX #1: Use pendingAssistantRef flag to catch streaming message early
        const isStreamingMessage = pendingAssistantRef.current && msg.role === 'assistant';
        
        if (isStreamingMessage) {
          console.log('✨ Streaming message arrived via realtime - replacing streaming content');
          
          // Clear flag immediately
          pendingAssistantRef.current = false;
          
          // Clear streaming timeout
          if (streamingTimeoutRef.current) {
            clearTimeout(streamingTimeoutRef.current);
            streamingTimeoutRef.current = null;
          }
          
          // Clear streaming state
          setStreamingContent('');
          streamingContentRef.current = '';
          setStreamingMessageId(null);
          
          // Remove temporary streaming message from array
          setMessages(prev => prev.filter(m => !m.isStreaming));
          
          // DON'T return early - let message be added below
        }
        
        // FIX #1 (CRITICAL): Check for duplicates BEFORE processing
        if (addedMessageIdsRef.current.has(msg.id)) {
          console.log('⏭️  Message already processed:', msg.id);
          return;
        }
        
        // FIX #1: Add to tracking set IMMEDIATELY to prevent race conditions
        addedMessageIdsRef.current.add(msg.id);
        console.log('✅ Registered message ID:', msg.id);
        
        setMessages(prev => {
          // FIX #4: Replace optimistic user message - find last temp-user message
          if (msg.role === 'user') {
            // Find the most recent temp-user message (not by content match)
            const optimisticIndex = prev.reduce((lastIndex, m, i) => 
              m.id.startsWith('temp-user-') && m.role === 'user' ? i : lastIndex, 
              -1
            );
            
            if (optimisticIndex !== -1) {
              console.log('🔄 Replacing optimistic user message with real one');
              const updated = [...prev];
              updated[optimisticIndex] = {
                id: msg.id,
                role: msg.role,
                content: msg.content,
                created_at: msg.created_at,
              };
              return updated;
            }
          }
          
          // Add new message
          console.log('✅ Adding realtime message:', msg.id);
          
          return [...prev, {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            created_at: msg.created_at,
          }];
        });
      })
      .subscribe();

    return () => {
      console.log('🔕 Cleaning up realtime subscription for:', activeId);
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  const loadMessages = async (conversationId: string) => {
    // Abort any previous load request
    if (loadAbortControllerRef.current) {
      console.log('🛑 Aborting previous message load');
      loadAbortControllerRef.current.abort();
    }
    
    // Guard mot concurrent loads
    if (isLoadingRef.current) {
      console.log('⏭️  Already loading messages, skipping');
      return;
    }
    
    const abortController = new AbortController();
    loadAbortControllerRef.current = abortController;
    
    isLoadingRef.current = true;
    setIsLoadingMessages(true);
    console.log('📨 Loading messages for:', conversationId);
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      // Check if this request was aborted
      if (abortController.signal.aborted) {
        console.log('⏭️  Load request was aborted');
        return;
      }

      if (error) throw error;

      console.log('✅ Loaded messages:', data?.length || 0);
      if (data) {
        // FIX #3 + #5: Deduplicate loaded messages and track IDs
        const seenIds = new Set<string>();
        const loadedMessages = data
          .filter(msg => {
            if (seenIds.has(msg.id)) {
              console.warn('⚠️ Duplicate message in DB:', msg.id);
              return false;
            }
            seenIds.add(msg.id);
            return true;
          })
          .map(msg => {
            // FIX #3: Register loaded message IDs to prevent realtime duplicates
            addedMessageIdsRef.current.add(msg.id);
            return {
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              created_at: msg.created_at,
            };
          });
        
        console.log(`📚 Loaded ${loadedMessages.length} messages, registered IDs`);
        setMessages(loadedMessages);
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        console.log('⏭️  Load aborted');
        return;
      }
      
      console.error('Error loading messages:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte ladda meddelanden',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
      isLoadingRef.current = false;
      if (loadAbortControllerRef.current === abortController) {
        loadAbortControllerRef.current = null;
      }
    }
  };

  const handleSend = async (message: string, fileIds: string[] = []) => {
    if (!message.trim() || isStreaming) return;
    
    // Rate limiting - 1s cooldown
    const now = Date.now();
    if (now - lastSendTime < 1000) {
      toast({
        title: '⏱️ Vänta lite',
        description: 'Du skickar meddelanden för snabbt. Vänta 1 sekund.',
        variant: 'destructive',
      });
      return;
    }
    setLastSendTime(now);
    
    // Input validation
    if (message.length > 10000) {
      toast({
        title: '📝 För långt meddelande',
        description: 'Meddelandet får inte vara längre än 10 000 tecken',
        variant: 'destructive',
      });
      return;
    }
    
    // Check for suspicious patterns (basic XSS prevention)
    const suspiciousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];
    if (suspiciousPatterns.some(pattern => pattern.test(message))) {
      toast({
        title: '⚠️ Ogiltigt innehåll',
        description: 'Meddelandet innehåller otillåtna tecken',
        variant: 'destructive',
      });
      return;
    }

    // Reset retry state when sending new message
    setIsRetrying(false);
    setLastUserMessage(message);

    // Ensure we have a conversation
    let conversationId = activeId;
    if (!conversationId) {
      console.log('🆕 No active conversation, creating new one');
      conversationId = await createNew(selectedModel);
      if (!conversationId) {
        toast({
          title: 'Fel',
          description: 'Kunde inte skapa konversation',
          variant: 'destructive',
        });
        return;
      }
    }

    console.log('📤 Sending message to conversation:', conversationId);

    // Add optimistic user message immediately for instant feedback
    const optimisticUserMsg: Message = {
      id: `temp-user-${crypto.randomUUID()}`, // FIX #3: Use UUID instead of Date.now()
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, optimisticUserMsg]);
    
    // Clear any existing streaming state
    setStreamingContent('');
    streamingContentRef.current = '';
    setSpellingError(null);
    
    // FIX #7: Add temporary streaming message to array
    const tempAssistantMsg: Message = {
      id: `temp-assistant-${crypto.randomUUID()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, tempAssistantMsg]);
    
    // FIX #1: Set pending flag EARLY so Realtime can catch it
    pendingAssistantRef.current = true;

    await startStream(conversationId, message, fileIds, selectedMode, {
      onProgress: (status) => {
        setProgressStatus(status);
      },
      onDelta: (delta) => {
        setProgressStatus(null); // Clear progress when content arrives
        streamingContentRef.current += delta;
        setStreamingContent(streamingContentRef.current);
        setLastStreamUpdate(Date.now());
        
        // FIX #2: Update temporary message in array (IMMUTABLE)
        setMessages(prev => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0) return prev;
          
          const lastMsg = prev[lastIndex];
          if (!lastMsg?.isStreaming) return prev;
          
          // Create new object - no mutation
          const updated = [...prev];
          updated[lastIndex] = {
            ...lastMsg,
            content: streamingContentRef.current
          };
          return updated;
        });
      },
      onDone: (metadata) => {
        setProgressStatus(null);
        
        // FIX #2: Check if we're still in the same conversation
        if (metadata?.conversationId && metadata.conversationId !== conversationId) {
          console.log('⚠️ Streaming finished for different conversation - ignoring');
          // Remove temporary message for wrong conversation
          setMessages(prev => prev.filter(m => !m.isStreaming));
          setStreamingContent('');
          streamingContentRef.current = '';
          return;
        }
        
        // Set streamingMessageId so realtime knows to replace streaming message
        if (metadata?.messageId) {
          console.log('💾 Streaming done, messageId:', metadata.messageId);
          pendingAssistantRef.current = false;  // FIX #5: Clear flag immediately
          setStreamingMessageId(metadata.messageId);
          
          // Safety timeout: clear streaming state after 5s if realtime never arrives
          if (streamingTimeoutRef.current) {
            clearTimeout(streamingTimeoutRef.current);
          }
          
          // FIX #3: Capture conversationId for timeout validation
          const timeoutConversationId = conversationId;
          
          streamingTimeoutRef.current = setTimeout(() => {
            // FIX #3: Validate we're still in the same conversation
            if (activeId !== timeoutConversationId) {
              console.log('⏰ Streaming timeout ignored - conversation changed');
              return;
            }
            
            console.log('⏰ Streaming timeout - clearing state (realtime message never arrived)');
            pendingAssistantRef.current = false; // FIX #1: Clear flag
            setStreamingContent('');
            streamingContentRef.current = '';
            setStreamingMessageId(null);
            // Remove temporary streaming message
            setMessages(prev => prev.filter(m => !m.isStreaming));
          }, 5000);
        } else {
          // No messageId from backend - clear immediately
          console.log('⚠️ No messageId in metadata - clearing streaming state');
          setStreamingContent('');
          streamingContentRef.current = '';
          setStreamingMessageId(null);
          // Remove temporary streaming message
          setMessages(prev => prev.filter(m => !m.isStreaming));
        }
      },
      onError: (error) => {
        console.error('🔴 [ChatError] Stream error:', error);
        console.error('🔴 [ChatError] Error type:', typeof error);
        console.error('🔴 [ChatError] Error details:', JSON.stringify(error, null, 2));
        
        const errorMsg = typeof error === 'string' ? error : String(error);
        
        // Check for spelling suggestions
        const suggestion = suggestSpellingFix(message);
        if (suggestion) {
          setSpellingError(suggestion);
        }
        
        // Determine more specific error message
        let title = 'Kunde inte generera svar';
        let description = errorMsg;
        let action = null;
        
        if (errorMsg.includes('rate') || errorMsg.includes('429')) {
          title = '⏱️ För många förfrågningar';
          description = 'Du har nått gränsen för hastighet. Försök igen om en stund eller byt till Fast-läge.';
        } else if (errorMsg.includes('402')) {
          title = '💳 Krediter saknas';
          description = 'Lägg till krediter i ditt Lovable-konto för att fortsätta.';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          title = '🌐 Nätverksfel';
          description = 'Kontrollera din internetanslutning och försök igen.';
          action = {
            label: isRetrying ? 'Försöker...' : '🔄 Försök igen',
            onClick: () => {
              if (!isRetrying) {
                setIsRetrying(true);
                handleSend(message);
              }
            }
          };
        } else if (errorMsg.includes('timeout')) {
          title = '⏱️ Timeout';
          description = 'Begäran tog för lång tid. Försök igen eller byt till Fast-läge.';
          action = {
            label: isRetrying ? 'Försöker...' : '🔄 Försök igen',
            onClick: () => {
              if (!isRetrying) {
                setIsRetrying(true);
                handleSend(message);
              }
            }
          };
        } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          title = '🔐 Autentiseringsfel';
          description = 'Ladda om sidan och logga in igen.';
        } else {
          title = '⚠️ Något gick fel';
          description = 'Ett tillfälligt fel uppstod. Försök igen eller ändra inställningar.';
          action = {
            label: isRetrying ? 'Försöker...' : '🔄 Försök igen',
            onClick: () => {
              if (!isRetrying) {
                setIsRetrying(true);
                handleSend(message);
              }
            }
          };
        }
        
        toast({
          title,
          description,
          variant: 'destructive',
          action: action ? (
            <button 
              onClick={action.onClick}
              disabled={isRetrying}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none"
            >
              {action.label}
            </button>
          ) : undefined,
        });
        
        // Clear streaming state on error
        pendingAssistantRef.current = false; // FIX #1: Clear flag on error
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreamingMessageId(null);
        setIsRetrying(false);
      },
    }, selectedModel);
  };

  const handleStop = () => {
    stopStream();
    
    // Streaming content will be saved by backend
    setStreamingContent('');
    streamingContentRef.current = '';
    setStreamingMessageId(null);
  };

  const handleRegenerate = async () => {
    if (!lastUserMessage || isStreaming) return;

    // Remove last assistant message from DB
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg) {
      await supabase
        .from('messages')
        .delete()
        .eq('id', lastAssistantMsg.id);
    }

    // Resend - realtime will update UI
    await handleSend(lastUserMessage);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const showWelcome = messages.length === 0 && !isStreaming && !isLoadingMessages;

  return (
    <>
      {!embedded && <Header />}
      <div
        className={embedded ? "h-full flex overflow-hidden" : "h-[100svh] flex overflow-hidden bg-background pt-[73px]"}
      >
        {/* KOLUMN 1 - Huvudmeny (sticky under header) */}
        {!embedded && (
          <aside
            className={`border-r transition-all duration-300 ease-in-out ${
              isGlobalSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 pointer-events-none"
            } overflow-hidden flex-shrink-0`}
          >
            <div className="sticky top-[73px] h-[calc(100svh-73px)] overflow-y-auto w-64">
              <Sidebar />
            </div>
          </aside>
        )}

        {/* KOLUMN 2 - Konversationslista (alltid synlig på desktop, dold på mobil) */}
        {!embedded && (
          <aside className="border-r w-80 flex-shrink-0 hidden md:block">
            <div className="sticky top-[73px] h-[calc(100svh-73px)] overflow-y-auto">
              <ConversationSidebar defaultModel={selectedModel} isGlobalSidebarOpen={isGlobalSidebarOpen} />
            </div>
          </aside>
        )}

        {/* KOLUMN 3 - Chattinnehåll (följer alltid vänsterkant perfekt) */}
        <section className="min-w-0 flex flex-col flex-1 min-h-0">
          {/* Compact header med pilknapp - linjerar alltid med vänsterkanten */}
          {!embedded && (
            <div className="flex-shrink-0 border-b px-4 md:px-6 py-4 flex items-center gap-3 bg-card/80 backdrop-blur-sm sticky top-[73px] z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsGlobalSidebarOpen(!isGlobalSidebarOpen)}
                      className="shrink-0 border-2 hover:scale-105 transition-transform"
                    >
                      {isGlobalSidebarOpen ? (
                        <PanelLeftClose className="h-5 w-5" />
                      ) : (
                        <PanelLeft className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{isGlobalSidebarOpen ? "Dölj huvudmeny" : "Visa huvudmenu"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <h1 className="text-lg font-semibold">LEX Chat</h1>
            </div>
          )}

        {/* Checkpoint notification */}
        {!embedded && activeId && (
          <CheckpointNotification 
            conversationId={activeId}
            onRestore={() => {
              // Reload messages to get checkpoint data
              if (activeId) loadMessages(activeId);
            }}
          />
        )}

        {/* Messages area with smooth scrollbar */}
        <ErrorBoundary className="flex-1 flex flex-col min-h-0">
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain scroll-smooth p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          >
            {showWelcome && <WelcomeSection />}
            
            {isLoadingMessages && (
              <div className="flex-1 flex items-center justify-center animate-fade-in">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {/* Animated model logo */}
                    <div className="h-16 w-16 animate-pulse">
                      <img src={geminiLogo} alt="Loading" className="w-full h-full object-contain opacity-80" />
                    </div>
                    {/* Rotating ring */}
                    <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Laddar meddelanden</p>
                    <div className="flex gap-1 justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1s_ease-in-out_infinite]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1s_ease-in-out_0.2s_infinite]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1s_ease-in-out_0.4s_infinite]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={msg.id} className="animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                <AIMessageBubble
                  message={msg}
                />
                {msg.role === 'assistant' && !msg.isStreaming && msg.citations && msg.citations.length > 0 && (
                  <CitationsList citations={msg.citations} />
                )}
                {msg.role === 'assistant' && !msg.isStreaming && (
                  <div className="flex items-center justify-start gap-2 mt-2">
                    <MessageToolbar
                      onRegenerate={msg.id === messages[messages.length - 1]?.id ? handleRegenerate : undefined}
                      content={msg.content}
                      model={msg.model}
                      mode={msg.mode}
                      citations={msg.citations}
                    />
                    {/* SECURITY FIX: Only show Promote to KB for real messages with valid UUIDs */}
                    {activeId && !msg.id.startsWith('temp-') && (
                      <PromoteToKBButton
                        conversationId={activeId}
                        messageId={msg.id}
                        defaultTitle={msg.content.slice(0, 60) + '...'}
                        category="chat-promoted"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Streaming content med typing indicator */}
            {streamingContent && (
              <div className="flex gap-4 justify-start animate-fade-in">
                {/* Enhanced animated avatar */}
                <div className="relative h-10 w-10 shrink-0">
                  <Avatar className="h-10 w-10 animate-pulse">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center">
                      <Bot size={18} className="text-white" />
                    </AvatarFallback>
                  </Avatar>
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary/30 animate-ping" />
                </div>
                <div className="max-w-[90%] md:max-w-[80%] rounded-2xl px-5 py-3.5 bg-card border border-primary/20 shadow-lg">
                  {/* UX: Timeout warning after 10s */}
                  {showTimeoutWarning && (
                    <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <Clock className="h-4 w-4 flex-shrink-0 animate-pulse" />
                        <div>
                          <p className="font-medium">Detta tar längre tid än vanligt...</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            Komplexa förfrågningar kan ta upp till 30 sekunder. Prova Fast-läge för snabbare svar.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {streamingContent}
                  </div>
                  {/* Progress bar for extended mode */}
                  {selectedMode === 'extended' && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Bearbetar...</span>
                        <span>{Math.min(100, Math.floor(streamingContent.length / 50))}%</span>
                      </div>
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.floor(streamingContent.length / 50))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Enhanced typing indicator - only show if active */}
                  {showTypingDots && (
                    <div className="flex gap-1.5 mt-3 items-center">
                      <span className="h-2 w-2 rounded-full bg-primary animate-[bounce_1s_ease-in-out_infinite]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-[bounce_1s_ease-in-out_0.15s_infinite]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-[bounce_1s_ease-in-out_0.3s_infinite]" />
                      <span className="text-xs text-muted-foreground ml-2">AI tänker...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Progress status när inget content ännu */}
            {!streamingContent && progressStatus && (
              <div className="flex gap-4 justify-start animate-fade-in">
                <div className="relative h-10 w-10 shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500">
                      <Bot size={18} className="text-white animate-pulse" />
                    </AvatarFallback>
                  </Avatar>
                  {/* Spinning ring for progress */}
                  <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
                <div className="rounded-2xl px-5 py-3.5 bg-muted/50 border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1s_ease-in-out_infinite]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1s_ease-in-out_0.2s_infinite]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1s_ease-in-out_0.4s_infinite]" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">{progressStatus}</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button with unread badge */}
          {showScrollButton && (
            <div className="absolute bottom-20 right-6 z-10 animate-fade-in">
              <div className="relative">
                <Button
                  onClick={scrollToBottom}
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg bg-primary hover:bg-primary/90 hover:scale-110 transition-transform"
                  aria-label="Scroll to bottom"
                >
                  <ArrowDown className="h-5 w-5" />
                </Button>
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
            </div>
          )}
        </ErrorBoundary>

        {/* Input Area - Fixed at bottom, outside scroll */}
        <div className="flex-shrink-0 border-t">
          {/* Spelling suggestion - above input */}
          {spellingError && (
            <div className="max-w-4xl mx-auto px-4 pt-2 text-sm">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-muted-foreground">Menade du:</span>
                <button
                  onClick={() => {
                    setSpellingError(null);
                    handleSend(spellingError);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  "{spellingError}"
                </button>
                <span className="text-muted-foreground">?</span>
              </div>
            </div>
          )}
          
          {/* Stop button (centered above input) */}
          {isStreaming && (
            <div className="flex justify-center py-2">
              <StopGeneratingButton onStop={handleStop} />
            </div>
          )}
          <AIInputArea
            onSend={handleSend}
            disabled={isStreaming}
            conversationId={activeId}
            selectedModel={selectedModel}
            onModelChange={async (model) => {
              setSelectedModel(model);
              if (activeId) {
                await updateModel(activeId, model);
              }
            }}
            chatMode={selectedMode}
            onModeChange={setSelectedMode}
          />
        </div>
        </section>
      </div>
    </>
  );
}
