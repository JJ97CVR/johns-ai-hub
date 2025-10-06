import { Zap, Brain, Sparkles, Clock, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type ChatMode = 'fast' | 'auto' | 'extended';

interface ChatModeControlProps {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
}

const modeConfig = {
  fast: {
    label: 'Snabb',
    icon: Zap,
    description: 'Snabba svar (7s) - UTAN verktyg',
    detailedDescription: 'Direkt svar från AI utan externa sökningar. Auto-uppgraderar till Auto vid artikelnummer.',
    time: '~7s',
    useCases: ['Snabba frågor', 'Enkla uppgifter', 'Grundläggande info'],
    color: 'text-green-600 dark:text-green-400',
  },
  auto: {
    label: 'Auto',
    icon: Sparkles,
    description: 'Balanserad (12s) - Verktyg vid behov',
    detailedDescription: 'AI väljer automatiskt verktyg (sökning, kunskapsbas) baserat på frågan. Bäst för artikelnummer.',
    time: '~12s',
    useCases: ['Artikelnummer-frågor', 'Databas-sökningar', 'Placer­ings­frågor'],
    color: 'text-blue-600 dark:text-blue-400',
  },
  extended: {
    label: 'Fördjupad',
    icon: Brain,
    description: 'Djup analys (25s) - ALLTID verktyg',
    detailedDescription: 'Fullständig analys med webb-sökning, kunskapsbas och källhänvisningar. Använder alltid alla verktyg.',
    time: '~25s',
    useCases: ['Forskningsfrågor', 'Detaljerad analys', 'Flera källor behövs'],
    color: 'text-purple-600 dark:text-purple-400',
  },
};

export function ChatModeControl({ value, onChange }: ChatModeControlProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1" data-testid="chat-mode-control">
        {/* Hidden select for E2E tests - synced with visual buttons */}
        <select
          data-testid="chat-mode-select"
          aria-label="Chat mode"
          className="sr-only"
          value={value}
          onChange={(e) => onChange(e.target.value as ChatMode)}
        >
          <option value="fast">Snabb</option>
          <option value="auto">Auto</option>
          <option value="extended">Fördjupad</option>
        </select>
        {(Object.keys(modeConfig) as ChatMode[]).map((mode) => {
          const config = modeConfig[mode];
          const Icon = config.icon;
          const isActive = value === mode;
          
          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onChange(mode)}
                  className={`gap-2 ${!isActive && 'hover:bg-background/80'}`}
                  data-testid={`chat-mode-${mode}`}
                >
                  <Icon size={14} className={isActive ? '' : config.color} />
                  <span className="text-xs font-medium">{config.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Icon size={18} className={config.color} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.detailedDescription}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>Svarstid: {config.time}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Bäst för:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {config.useCases.map((useCase, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-primary" />
                          {useCase}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
