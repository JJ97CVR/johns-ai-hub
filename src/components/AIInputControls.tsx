import { ModelSelector } from './ModelSelector';
import { ChatModeControl, type ChatMode } from './ChatModeControl';

interface AIInputControlsProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  chatMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export function AIInputControls({
  selectedModel,
  onModelChange,
  chatMode,
  onModeChange,
  disabled
}: AIInputControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <ModelSelector 
        value={selectedModel}
        onChange={onModelChange}
        disabled={disabled}
      />
      <div className="h-6 w-px bg-border" />
      <ChatModeControl
        value={chatMode}
        onChange={onModeChange}
      />
    </div>
  );
}
