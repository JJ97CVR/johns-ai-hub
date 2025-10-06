import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Database, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function KnowledgePanel() {
  const [stats, setStats] = useState({
    knowledgeItems: 0,
    learnedPatterns: 0,
    cachedResponses: 0,
    orgFacts: 0,
  });
  
  useEffect(() => {
    loadStats();
  }, []);
  
  const loadStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-knowledge-stats');
      
      if (error) throw error;
      
      if (data) {
        setStats({
          knowledgeItems: data.knowledgeItems || 0,
          learnedPatterns: data.learnedPatterns || 0,
          cachedResponses: data.cachedResponses || 0,
          orgFacts: data.orgFacts || 0,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };
  
  return (
    <div className="bg-card rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2 text-foreground">
        <Brain size={18} className="text-primary" />
        AI Knowledge
      </h3>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="p-2 bg-purple-500/10 rounded">
          <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
            <Database size={14} />
            <span className="font-medium">Knowledge</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.knowledgeItems}</div>
        </div>
        
        <div className="p-2 bg-blue-500/10 rounded">
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
            <TrendingUp size={14} />
            <span className="font-medium">Patterns</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.learnedPatterns}</div>
        </div>
        
        <div className="p-2 bg-green-500/10 rounded">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
            <Zap size={14} />
            <span className="font-medium">Cached</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.cachedResponses}</div>
        </div>
        
        <div className="p-2 bg-orange-500/10 rounded">
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 mb-1">
            <Database size={14} />
            <span className="font-medium">Facts</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.orgFacts}</div>
        </div>
      </div>
      
      <button
        onClick={loadStats}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Refresh stats
      </button>
    </div>
  );
}
