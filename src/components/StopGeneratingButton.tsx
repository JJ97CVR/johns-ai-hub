import { Button } from '@/components/ui/button';
import { Square } from 'lucide-react';

interface StopGeneratingButtonProps {
  onStop: () => void;
}

export function StopGeneratingButton({ onStop }: StopGeneratingButtonProps) {
  return (
    <Button
      onClick={onStop}
      variant="outline"
      size="sm"
      className="gap-2 shadow-lg border-2 hover:scale-105 transition-transform"
      title="Tryck ESC för att stoppa"
    >
      <Square className="h-3 w-3 fill-current animate-pulse" />
      Stop generating
    </Button>
  );
}
