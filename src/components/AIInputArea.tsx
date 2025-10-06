/**
 * AI Input Area Component
 * 
 * Provides the chat input interface with file upload capabilities,
 * model selection, and chat mode controls.
 */

import { useState, useRef } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/useFileUpload';
import { AIInputControls } from './AIInputControls';
import { type ChatMode } from './ChatModeControl';

// Constants
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'json', 'py', 'txt', 'png', 'jpg', 'jpeg', 'pdf'];

interface AIInputAreaProps {
  onSend: (message: string, fileIds: string[]) => void;
  disabled?: boolean;
  conversationId: string | null;
  selectedModel: string;
  onModelChange: (model: string) => void;
  chatMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

export function AIInputArea({ 
  onSend, 
  disabled, 
  conversationId,
  selectedModel,
  onModelChange,
  chatMode,
  onModeChange
}: AIInputAreaProps) {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMultipleFiles, isUploading, uploadProgress } = useFileUpload(conversationId);
  
  const charCount = input.length;
  const maxChars = 4000;
  
  /**
   * Handle file selection and validation
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      // Validate file type
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        alert(`File type .${ext} not supported`);
        continue;
      }
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }
      
      setAttachedFiles(prev => [...prev, file]);
    }
  };
  
  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (!conversationId) return;
    
    // Upload files först
    const fileIds = attachedFiles.length > 0 
      ? await uploadMultipleFiles(attachedFiles)
      : [];
    
    // Send message
    await onSend(input, fileIds);
    
    // Reset
    setInput('');
    setAttachedFiles([]);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="flex-shrink-0 bg-card" data-testid="chat-form">
      <div className="max-w-4xl mx-auto px-4 py-3 space-y-3">
        {/* Controls Row */}
        <AIInputControls
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          chatMode={chatMode}
          onModeChange={onModeChange}
          disabled={disabled || isUploading}
        />
        
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm"
              >
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                  className="hover:bg-muted-foreground/20 rounded-full p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Upload progress bar */}
        {isUploading && uploadProgress > 0 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Uploading files... {uploadProgress}%
            </p>
          </div>
        )}
        
        {/* Input field */}
        <div className="relative">
          <div className={`flex gap-3 items-end transition-all duration-200 ${isFocused ? 'scale-[1.01]' : ''}`}>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full hover:bg-muted hover:scale-110 transition-transform"
              data-testid="chat-attach-file"
              aria-label="Attach file"
            >
              <Paperclip size={20} aria-hidden="true" />
            </Button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".xlsx,.xls,.csv,.json,.py,.txt,.png,.jpg,.jpeg,.pdf"
              className="hidden"
            />
            
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Message AI..."
                disabled={disabled || isUploading}
                className={`resize-none flex-1 min-h-[56px] max-h-[200px] overflow-y-auto transition-all duration-200 pr-14 ${
                  isFocused ? 'ring-2 ring-primary/20' : ''
                }`}
                rows={2}
                data-testid="chat-textarea"
                aria-label="Chat message input"
                maxLength={maxChars}
              />
              {/* Character counter */}
              {charCount > maxChars * 0.9 && (
                <div className={`absolute bottom-2 right-2 text-xs px-2 py-1 rounded-full ${
                  charCount >= maxChars 
                    ? 'bg-destructive/10 text-destructive' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {charCount}/{maxChars}
                </div>
              )}
            </div>
            
            <Button
              onClick={handleSend}
              disabled={disabled || isUploading || (!input.trim() && attachedFiles.length === 0) || charCount > maxChars}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-110 transition-transform shadow-lg"
              data-testid="chat-send"
              aria-label={isUploading ? "Uploading files" : disabled ? "Sending..." : "Send message"}
              title={disabled ? "Skickar meddelande..." : "Skicka meddelande (Enter)"}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send size={18} aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Supported: Excel, CSV, JSON, Python, images, PDF (max 50MB)</span>
          <span className="hidden sm:inline">Enter = skicka • Shift+Enter = ny rad</span>
        </div>
      </div>
    </div>
  );
}
