import { Button } from '@/components/ui/button';
import { RotateCw, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MessageToolbarProps {
  onRegenerate?: () => void;
  onCopy?: () => void;
  content?: string;
  model?: string;
  mode?: string;
  citations?: Array<{ title: string; url: string }>;
}

export function MessageToolbar({ onRegenerate, onCopy, content, model, mode, citations }: MessageToolbarProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  
  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      // Reset after a delay to show feedback
      setTimeout(() => setIsRegenerating(false), 2000);
    }
  };
  
  const handleCopy = async () => {
    if (!content) return;
    
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast({
        title: '✅ Kopierat!',
        description: 'Meddelandet har kopierats till urklipp',
      });
      
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Kunde inte kopiera',
        description: 'Försök igen',
        variant: 'destructive',
      });
    }
  };
  return (
    <div className="mt-3 space-y-2">
      {/* Citations */}
      {citations && citations.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium">Sources:</div>
          {citations.map((citation, idx) => (
            <a
              key={idx}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:underline hover:text-primary"
            >
              [{idx + 1}] {citation.title}
            </a>
          ))}
        </div>
      )}

      {/* Model/Mode info */}
      {(model || mode) && (
        <div className="text-xs text-muted-foreground">
          {model && <span>Model: {model}</span>}
          {model && mode && <span className="mx-2">•</span>}
          {mode && <span>Mode: {mode}</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Copy button */}
        <Button
          onClick={handleCopy}
          variant="ghost"
          size="sm"
          className="gap-2 h-8"
          disabled={!content}
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              Kopierat!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Kopiera
            </>
          )}
        </Button>
        
        {/* Regenerate button */}
        {onRegenerate && (
          <Button
            onClick={handleRegenerate}
            variant="ghost"
            size="sm"
            className="gap-2 h-8"
            disabled={isRegenerating}
          >
            <RotateCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenererar...' : 'Regenerate'}
          </Button>
        )}
      </div>
    </div>
  );
}
