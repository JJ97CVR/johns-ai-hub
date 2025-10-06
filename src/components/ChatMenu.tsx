import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Lock, Plus } from "lucide-react";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { supabase } from "@/integrations/supabase/client";

interface ChatMenuProps {
  onOpenChat: () => void;
  selectedModel?: string;
}

export default function ChatMenu({ onOpenChat, selectedModel = 'google/gemini-2.5-flash' }: ChatMenuProps) {
  const { conversations, handleNewChat, selectConversation } = useConversationsContext();
  const [isAuthed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const handleNew = async () => {
    if (!isAuthed) return;
    await handleNewChat(selectedModel);
    onOpenChat();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquarePlus className="w-4 h-4" /> Chat
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          LEX Chat {isAuthed ? null : <Lock className="w-4 h-4 text-muted-foreground" />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isAuthed ? (
          <>
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Du måste vara inloggad för att se dina chattar.
            </div>
            <DropdownMenuItem onClick={() => (window.location.href = "/auth")}>
              Logga in
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {conversations.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Inga konversationer än.</div>
            )}
            {conversations.slice(0, 8).map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => {
                  selectConversation(c.id);
                  onOpenChat();
                }}
                className="flex flex-col items-start"
              >
                <span className="font-medium truncate w-full">{c.title || "New Chat"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.updated_at).toLocaleString('sv-SE')}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNew} className="gap-2">
              <Plus className="w-4 h-4" /> Ny chatt
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
