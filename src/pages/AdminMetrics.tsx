import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  AlertCircle, 
  Activity, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MetricsData {
  overview: {
    totalQueries: number;
    avgProcessingTime: number;
    cacheHitRate: number;
    activeRateLimits: number;
    uniqueUsers: number;
  };
  errors: {
    counts: {
      error: number;
      fatal: number;
      warn: number;
    };
    recent: Array<{
      message: string;
      level: string;
      function_name: string;
      timestamp: string;
      metadata: any;
    }>;
  };
  models: Record<string, number>;
  tools: Record<string, number>;
  adminActivity: Array<{
    action: string;
    target_type: string;
    created_at: string;
  }>;
  timestamp: string;
}

export default function AdminMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: funcError } = await supabase.functions.invoke('get-metrics');

      if (funcError) throw funcError;

      if (data?.error) {
        throw new Error(data.error);
      }

      setMetrics(data?.metrics || null);
    } catch (err: any) {
      console.error('Load metrics error:', err);
      
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
        setError('Endast admins kan se denna sida');
      } else if (errorMsg.includes('authenticated') || errorMsg.includes('401')) {
        setError('Du måste vara inloggad');
      } else {
        setError('Kunde inte ladda metrics: ' + errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Ingen metrics data tillgänglig</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalErrors = metrics.errors.counts.error + metrics.errors.counts.fatal + metrics.errors.counts.warn;

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Metrics</h1>
          <p className="text-muted-foreground mt-1">
            Senast uppdaterad: {new Date(metrics.timestamp).toLocaleString('sv-SE')}
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Activity className="h-4 w-4" />
          Live Dashboard
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Queries (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.totalQueries}</div>
            <p className="text-xs text-muted-foreground mt-1">Totala förfrågningar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Avg Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.avgProcessingTime}ms</div>
            <p className="text-xs text-muted-foreground mt-1">Genomsnittlig tid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              Cache Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.cacheHitRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Cachade svar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Användare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Aktiva användare</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {totalErrors === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : totalErrors < 5 ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              Errors (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErrors}</div>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-red-500">{metrics.errors.counts.fatal} fatal</span>
              <span className="text-amber-500">{metrics.errors.counts.error} error</span>
              <span className="text-yellow-500">{metrics.errors.counts.warn} warn</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Model Usage (7d)</CardTitle>
            <CardDescription>Requests per AI model</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(metrics.models).length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen data tillgänglig</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(metrics.models)
                  .sort(([, a], [, b]) => b - a)
                  .map(([model, count]) => (
                    <div key={model} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{model}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ 
                              width: `${(count / metrics.overview.totalQueries) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tool Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Tool Usage (7d)</CardTitle>
            <CardDescription>Mest använda verktyg</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(metrics.tools).length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen data tillgänglig</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(metrics.tools)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([tool, count]) => (
                    <div key={tool} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{tool}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Errors */}
      {metrics.errors.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Senaste Errors (24h)</CardTitle>
            <CardDescription>De 10 senaste error logs</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tidpunkt</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Funktion</TableHead>
                  <TableHead>Meddelande</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.errors.recent.map((error, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(error.timestamp).toLocaleString('sv-SE')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={error.level === 'fatal' ? 'destructive' : 'secondary'}>
                        {error.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{error.function_name}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">{error.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Admin Activity */}
      {metrics.adminActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Senaste Admin Activity (30d)</CardTitle>
            <CardDescription>Administrativa åtgärder</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tidpunkt</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.adminActivity.map((activity, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(activity.created_at).toLocaleString('sv-SE')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{activity.target_type || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
