import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative group my-4">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition">
        <Button
          onClick={handleCopy}
          size="sm"
          variant="secondary"
          className="h-8"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span className="ml-1">{copied ? 'Copied!' : 'Copy'}</span>
        </Button>
      </div>
      
      <div className="bg-muted rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
          {language}
        </div>
        <pre className="p-4 overflow-x-auto text-sm">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
