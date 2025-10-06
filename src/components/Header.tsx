import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from 'next-themes';
import LexLogo from "./LexLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Sparkles, Brain, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ChatMenu from "@/components/ChatMenu";
import ChatSheet from "@/components/ChatSheet";

interface HeaderProps {
  currentModel?: string;
  onModelChange?: (model: string) => void;
}

const Header = ({ currentModel = 'openai/gpt-5', onModelChange }: HeaderProps) => {
  const [userEmail, setUserEmail] = useState<string>('');
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  // Don't show ChatSheet if already on /chat page
  const isOnChatPage = location.pathname === '/chat';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  /**
   * Get user initials from email for avatar display
   */
  const getInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <LexLogo className="h-16 w-auto" />
          
          {/* AI Model Selector */}
          {onModelChange && (
            <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs">
              <Select value={currentModel} onValueChange={onModelChange}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-50 border shadow-lg">
                  <SelectItem value="openai/gpt-5" className="bg-card">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-purple-500" />
                      <div>
                        <div className="font-medium">GPT-5</div>
                        <div className="text-xs text-muted-foreground">OpenAI's latest</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude-sonnet-4-20250514" className="bg-card">
                    <div className="flex items-center gap-2">
                      <Brain size={16} className="text-emerald-500" />
                      <div>
                        <div className="font-medium">Claude Sonnet 4</div>
                        <div className="text-xs text-muted-foreground">Anthropic's advanced</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="ml-auto flex items-center gap-3">
            {!isOnChatPage && (
              <ChatMenu onOpenChat={() => setChatSheetOpen(true)} selectedModel={currentModel} />
            )}
            
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9"
              title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition"
                  aria-label="User menu"
                >
                  <span className="hidden sm:inline text-sm font-medium text-foreground">{userEmail}</span>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(userEmail)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card z-50 border shadow-lg">
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      {!isOnChatPage && (
        <ChatSheet open={chatSheetOpen} onOpenChange={setChatSheetOpen} />
      )}
    </>
  );
};

export default Header;
