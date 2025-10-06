import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PromoteToKBButton } from '@/components/PromoteToKBButton';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Clock, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReviewCandidate {
  id: string;
  conversation_id: string;
  assistant_message_id: string | null;
  query: string;
  answer_preview: string | null;
  created_at: string;
  model_used: string;
  processing_time_ms: number;
}

export default function AdminReview() {
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: funcError } = await supabase.functions.invoke('get-review-candidates');

      if (funcError) throw funcError;

      if (data?.error) {
        throw new Error(data.error);
      }

      setCandidates(data?.candidates || []);
    } catch (err: any) {
      console.error('Load candidates error:', err);
      
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
        setError('Only admins can access this page');
      } else if (errorMsg.includes('authenticated') || errorMsg.includes('401')) {
        setError('You need to be logged in');
      } else {
        setError('Failed to load candidates');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Review Candidates</h1>
        <p className="text-muted-foreground">
          Responses without knowledge sources that could be promoted to the knowledge base
        </p>
      </div>

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No candidates found. All recent responses used knowledge sources!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">Query</CardTitle>
                    <p className="text-sm text-muted-foreground">{candidate.query}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {candidate.processing_time_ms}ms
                    </Badge>
                    <Badge variant="outline">{candidate.model_used}</Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {candidate.answer_preview && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm font-medium mb-2">Answer Preview</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {candidate.answer_preview}
                      {candidate.answer_preview.length >= 200 && '...'}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(candidate.created_at).toLocaleString('sv-SE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>

                  {candidate.assistant_message_id && (
                    <PromoteToKBButton
                      conversationId={candidate.conversation_id}
                      messageId={candidate.assistant_message_id}
                      defaultTitle={candidate.query.slice(0, 80)}
                      category="reviewed"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
