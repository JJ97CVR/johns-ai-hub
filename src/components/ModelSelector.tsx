import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import geminiLogo from '@/assets/gemini-logo.png';
import chatgptLogo from '@/assets/chatgpt-logo.png';
import claudeLogo from '@/assets/claude-logo.svg';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

// Model configuration - matches backend models-config.ts
const models = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    logo: geminiLogo,
    badge: 'Balanserad',
    description: 'Bäst för daglig användning',
    color: 'text-blue-600',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    logo: geminiLogo,
    badge: 'Kraftfull',
    description: 'Avancerad reasoning',
    color: 'text-purple-600',
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini Flash Lite',
    logo: geminiLogo,
    badge: 'Snabb',
    description: 'Snabbaste svaren',
    color: 'text-green-600',
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    logo: chatgptLogo,
    badge: 'Premium',
    description: 'Högsta kvalitet',
    color: 'text-amber-600',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    logo: chatgptLogo,
    badge: 'Effektiv',
    description: 'Bra prestanda',
    color: 'text-teal-600',
  },
  {
    id: 'anthropic/claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    logo: claudeLogo,
    badge: 'Intelligent',
    description: 'Stark på analys',
    color: 'text-orange-600',
  },
];

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const currentModel = models.find(m => m.id === value) || models[0];
  
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[200px] h-11 bg-background border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-[280px] z-50 bg-popover">
        {models.map(model => {
          const isSelected = model.id === value;
          return (
            <SelectItem key={model.id} value={model.id} className="cursor-pointer py-3">
              <div className="flex items-start gap-3 w-full">
                <img src={model.logo} alt={model.name} className="w-5 h-5 object-contain mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{model.name}</span>
                    <Badge variant="secondary" className={`text-xs ${model.color}`}>
                      {model.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{model.description}</p>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
