import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PromoteToKBButtonProps {
  conversationId: string;
  messageId: string;
  defaultTitle?: string;
  category?: string;
}

export function PromoteToKBButton({
  conversationId,
  messageId,
  defaultTitle,
  category = 'promoted',
}: PromoteToKBButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePromote = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('promote-to-kb', {
        body: {
          conversationId,
          messageId,
          title: defaultTitle,
          category,
        },
      });

      if (error) throw error;
      
      if (!data?.ok) {
        throw new Error(data?.error || 'Promote failed');
      }

      toast({
        title: 'Promoted to KB ✅',
        description: 'Answer has been added to the knowledge base',
      });
    } catch (err: any) {
      console.error('Promote error:', err);
      
      const errorMsg = err?.message || String(err);
      let description = 'Could not promote to knowledge base';
      
      if (errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
        description = 'Only admins can promote content to KB';
      } else if (errorMsg.includes('authenticated') || errorMsg.includes('401')) {
        description = 'You need to be logged in';
      }
      
      toast({
        title: 'Promote failed',
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handlePromote}
      disabled={loading}
      title="Promote this answer to knowledge base"
      className="gap-2"
    >
      <Upload className="h-3 w-3" />
      {loading ? 'Promoting...' : 'Promote to KB'}
    </Button>
  );
}
