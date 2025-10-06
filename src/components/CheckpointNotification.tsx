/**
 * Checkpoint Notification Component
 * Shows when a checkpoint is available for resuming
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CheckpointNotificationProps {
  conversationId: string | null;
  onRestore?: () => void;
}

export function CheckpointNotification({ 
  conversationId,
  onRestore 
}: CheckpointNotificationProps) {
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [checkpointData, setCheckpointData] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationId) {
      setHasCheckpoint(false);
      return;
    }

    checkForCheckpoint();
  }, [conversationId]);

  const checkForCheckpoint = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('loop_checkpoints')
        .select('*')
        .eq('conversation_id', conversationId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setHasCheckpoint(true);
        setCheckpointData(data[0]);
      } else {
        setHasCheckpoint(false);
      }
    } catch (error) {
      console.error('Error checking for checkpoint:', error);
    }
  };

  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    if (!checkpointData) return;

    setIsRestoring(true);
    try {
      // Trigger restore callback
      onRestore?.();
      
      toast({
        title: 'Checkpoint återställd',
        description: 'Fortsätter från senaste checkpoint',
      });

      // Hide notification
      setIsVisible(false);
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte återställa checkpoint',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!hasCheckpoint || !isVisible) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-3 animate-slide-in-right">
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 shadow-lg">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Checkpoint tillgänglig
          </p>
          <p className="text-xs text-muted-foreground">
            Det finns ett sparat tillstånd från iteration {checkpointData?.iteration}. 
            Vill du fortsätta därifrån?
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleRestore}
            className="shrink-0"
            disabled={isRestoring}
          >
            {isRestoring ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                Laddar...
              </>
            ) : (
              'Fortsätt'
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsVisible(false)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
