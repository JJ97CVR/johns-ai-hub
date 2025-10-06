import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MessageFeedbackProps {
  messageId: string;
}

export function MessageFeedback({ messageId }: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load existing feedback on mount
  useEffect(() => {
    loadExistingFeedback();
  }, [messageId]);

  const loadExistingFeedback = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const { data, error } = await supabase
        .from('message_feedback')
        .select('helpful')
        .eq('message_id', messageId)
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFeedback(data.helpful);
      }
    } catch (error) {
      console.error('Failed to load feedback:', error);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to provide feedback",
          variant: "destructive",
        });
        return;
      }

      // Upsert feedback (insert or update)
      const { error } = await supabase
        .from('message_feedback')
        .upsert({
          message_id: messageId,
          user_id: session.session.user.id,
          helpful,
        }, {
          onConflict: 'message_id,user_id'
        });

      if (error) throw error;

      setFeedback(helpful);
      
      toast({
        title: helpful ? "Thanks for the feedback!" : "Feedback received",
        description: helpful 
          ? "Glad this was helpful!" 
          : "We'll use this to improve our responses",
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast({
        title: "Failed to submit feedback",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <Button
        size="sm"
        variant={feedback === true ? 'default' : 'ghost'}
        className="h-7 px-2 gap-1"
        onClick={() => handleFeedback(true)}
        disabled={isLoading}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant={feedback === false ? 'default' : 'ghost'}
        className="h-7 px-2 gap-1"
        onClick={() => handleFeedback(false)}
        disabled={isLoading}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}
