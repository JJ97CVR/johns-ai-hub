import { Bot, Search, Database, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { FilePreview } from './FilePreview';
import { CitationsList } from './CitationsList';
import { ArtifactRenderer, parseArtifacts } from './ArtifactRenderer';
import { MessageFeedback } from './MessageFeedback';
import geminiLogo from '@/assets/gemini-logo.png';
import chatgptLogo from '@/assets/chatgpt-logo.png';
import claudeLogo from '@/assets/claude-logo.svg';

interface Citation {
  title?: string;
  url: string;
  excerpt?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking_process?: string | null;
  created_at: string;
  uploaded_files?: any[];
  tools_used?: string[];
  citations?: Citation[];
  model?: string;
}

interface AIMessageBubbleProps {
  message: Message;
}

export function AIMessageBubble({ message }: AIMessageBubbleProps) {
  const isUser = message.role === 'user';
  
  // Parse artifacts from assistant messages
  const { text: messageText, artifacts } = !isUser && message.content 
    ? parseArtifacts(message.content)
    : { text: message.content, artifacts: [] };
  
  // Determine which logo to show based on model
  const getModelLogo = () => {
    if (!message.model) return null;
    
    if (message.model.startsWith('google/gemini')) {
      return <img src={geminiLogo} alt="Gemini" className="w-5 h-5 object-contain" />;
    }
    if (message.model.startsWith('openai/gpt')) {
      return <img src={chatgptLogo} alt="GPT" className="w-5 h-5 object-contain" />;
    }
    if (message.model.startsWith('anthropic/claude')) {
      return <img src={claudeLogo} alt="Claude" className="w-5 h-5 object-contain" />;
    }
    
    return <Bot size={18} className="text-white" />;
  };
  
  return (
    <div className="group animate-fade-in">
      <div 
        className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
        data-testid={isUser ? 'user-message' : 'assistant-message'}
      >
        {/* Avatar */}
        {!isUser && (
          <Avatar className="h-10 w-10 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
            <AvatarFallback className="bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center">
              {getModelLogo()}
            </AvatarFallback>
          </Avatar>
        )}
        
        {/* Content */}
        <div 
          className={`
            max-w-[90%] md:max-w-[80%] rounded-2xl px-5 py-3.5 transition-all duration-300
            ${isUser 
              ? 'bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-[1.02]' 
              : 'bg-card border shadow-md hover:shadow-xl hover:border-primary/30 hover:scale-[1.01]'}
          `}
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {/* Tools used indicator - hidden in production */}
          {import.meta.env.DEV && !isUser && message.tools_used && message.tools_used.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {message.tools_used.map((tool, i) => (
                <span 
                  key={i}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full flex items-center gap-1"
                >
                  {tool === 'web_search' && <Search size={10} />}
                  {tool === 'knowledge_base_search' && <Database size={10} />}
                  {tool === 'fetch_url' && <ExternalLink size={10} />}
                  {tool}
                </span>
              ))}
            </div>
          )}
          
          {/* Files */}
          {message.uploaded_files && message.uploaded_files.length > 0 && (
            <div className="mb-3 space-y-2">
              {message.uploaded_files.map(file => (
                <FilePreview key={file.id} file={file} />
              ))}
            </div>
          )}
          
          {/* Text content */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                code: ({ node, inline, className, children, ...props }: any) => {
                  if (inline) {
                    return <code className="bg-muted px-1 rounded">{children}</code>;
                  }
                  const language = className?.replace('language-', '') || 'text';
                  return <CodeBlock code={String(children)} language={language} />;
                }
              }}
            >
              {messageText}
            </ReactMarkdown>
          </div>
          
          {/* Artifacts */}
          {!isUser && artifacts.length > 0 && (
            <div className="space-y-2">
              {artifacts.map((artifact, i) => (
                <ArtifactRenderer key={i} {...artifact} />
              ))}
            </div>
          )}
          
          {/* Thinking process (hidden in production) */}
          {import.meta.env.DEV && message.thinking_process && (
            <details className="mt-3 p-3 bg-muted/50 rounded-lg border">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground mb-2">
                🧠 Thinking Process
              </summary>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
                {message.thinking_process}
              </pre>
            </details>
          )}
          
          {/* Timestamp */}
          <div className={`text-xs mt-2 ${isUser ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
            {new Date(message.created_at).toLocaleTimeString('sv-SE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        
        {isUser && (
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-secondary">
              <span className="text-secondary-foreground font-semibold">U</span>
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      
      {/* Feedback buttons for assistant messages - outside bubble */}
      {!isUser && (
        <div className="ml-14 mt-2">
          <MessageFeedback messageId={message.id} />
        </div>
      )}
      
      {/* Citations - displayed outside the bubble */}
      {!isUser && message.citations && message.citations.length > 0 && (
        <div className="ml-14 mt-2">
          <CitationsList citations={message.citations} />
        </div>
      )}
    </div>
  );
}
