import { ExternalLink, FileText, Link2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Citation {
  title?: string;
  url: string;
  excerpt?: string;
}

interface CitationsListProps {
  citations: Citation[];
}

export function CitationsList({ citations }: CitationsListProps) {
  if (!citations || citations.length === 0) {
    return null;
  }

  // Sanitize citation data
  const sanitizeCitation = (citation: Citation) => ({
    title: citation.title ? DOMPurify.sanitize(citation.title, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    }) : undefined,
    url: citation.url,
    excerpt: citation.excerpt ? DOMPurify.sanitize(citation.excerpt, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
      ALLOWED_ATTR: []
    }) : undefined,
  });

  return (
    <Card className="mt-3 border-l-4 border-l-primary/30" data-testid="assistant-citations">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Källor ({citations.length})</h3>
        </div>
        
        <Separator className="mb-3" />
        
        <div className="space-y-2">
          {citations.map((citation, index) => {
            const sanitized = sanitizeCitation(citation);
            const hostname = new URL(sanitized.url).hostname.replace('www.', '');
            
            return (
              <a
                key={index}
                href={sanitized.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-all duration-200 group border border-transparent hover:border-primary/20"
              >
                <div className="mt-1 p-2 rounded-md bg-background shrink-0">
                  <FileText size={14} className="text-primary" />
                </div>
                
                <div className="min-w-0 flex-1">
                  {sanitized.title && (
                    <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                      {sanitized.title}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <ExternalLink size={10} />
                    <span className="truncate">{hostname}</span>
                  </div>
                  
                  {sanitized.excerpt && (
                    <div 
                      className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitized.excerpt }}
                    />
                  )}
                </div>
                
                <ExternalLink 
                  size={14} 
                  className="mt-1 text-muted-foreground group-hover:text-primary transition-colors shrink-0" 
                />
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
