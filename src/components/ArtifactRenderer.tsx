import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Eye, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ArtifactProps {
  identifier: string;
  type: 'html' | 'react' | 'code' | 'svg';
  title?: string;
  content: string;
  language?: string;
}

export function ArtifactRenderer({ identifier, type, title, content, language = 'javascript' }: ArtifactProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  useEffect(() => {
    if (type === 'html' || type === 'svg') {
      const iframe = iframeRef.current;
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(content);
          doc.close();
        }
      }
    }
  }, [content, type]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success('Kopierat till urklipp!');
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([content], { type: type === 'svg' ? 'image/svg+xml' : 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <Card className="mt-4 overflow-hidden border-primary/20">
      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">{title || 'Artifact'}</span>
          <span className="text-xs text-muted-foreground">#{identifier}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          {(type === 'html' || type === 'svg') && (
            <Button variant="ghost" size="sm" onClick={handleOpenNewTab}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'code')}>
        <TabsList className="w-full rounded-none border-b bg-muted/30">
          <TabsTrigger value="preview" className="flex-1">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="code" className="flex-1">
            <Code className="h-4 w-4 mr-2" />
            Kod
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="m-0 p-4">
          {type === 'html' || type === 'svg' ? (
            <iframe
              ref={iframeRef}
              className="w-full h-[400px] border rounded-lg bg-white"
              sandbox="allow-scripts"
              title={title || 'Preview'}
            />
          ) : type === 'react' ? (
            <div className="w-full h-[400px] border rounded-lg bg-white p-4 overflow-auto">
              <div className="text-sm text-muted-foreground">
                React-rendering kräver react-live - implementeras senare
              </div>
            </div>
          ) : (
            <div className="w-full min-h-[400px] border rounded-lg bg-muted/30 p-4">
              <pre className="text-sm overflow-auto">
                <code>{content}</code>
              </pre>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="m-0 p-0">
          <div className="bg-muted/30 p-4 overflow-auto max-h-[400px]">
            <pre className="text-sm">
              <code className={`language-${language}`}>{content}</code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// Parse artifact tags from message content
export function parseArtifacts(content: string): { text: string; artifacts: ArtifactProps[] } {
  const artifactRegex = /<artifact\s+identifier="([^"]+)"\s+type="([^"]+)"(?:\s+title="([^"]+)")?(?:\s+language="([^"]+)")?>([\s\S]*?)<\/artifact>/g;
  
  const artifacts: ArtifactProps[] = [];
  let match;
  let lastIndex = 0;
  let textParts: string[] = [];

  while ((match = artifactRegex.exec(content)) !== null) {
    // Add text before artifact
    textParts.push(content.slice(lastIndex, match.index));
    
    artifacts.push({
      identifier: match[1],
      type: match[2] as ArtifactProps['type'],
      title: match[3] || undefined,
      language: match[4] || 'javascript',
      content: match[5].trim(),
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  textParts.push(content.slice(lastIndex));
  
  return {
    text: textParts.join('').trim(),
    artifacts,
  };
}
