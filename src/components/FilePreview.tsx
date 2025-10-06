import { FileText, FileSpreadsheet, FileJson, FileCode, Image, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface FilePreviewProps {
  file: {
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    storage_path: string;
  };
}

export function FilePreview({ file }: FilePreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const getIcon = () => {
    switch (file.file_type) {
      case 'csv':
      case 'excel':
        return <FileSpreadsheet size={16} className="text-green-600" />;
      case 'json':
        return <FileJson size={16} className="text-yellow-600" />;
      case 'python':
        return <FileCode size={16} className="text-blue-600" />;
      case 'image':
        return <Image size={16} className="text-purple-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
    }
  };
  
  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to download files');
        return;
      }
      
      // Get signed URL from backend
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-file?fileId=${file.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download file');
      }
      
      const { url } = await response.json();
      
      // Open signed URL in new tab
      window.open(url, '_blank');
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2">
        {getIcon()}
        <div>
          <div className="text-sm font-medium">{file.filename}</div>
          <div className="text-xs text-muted-foreground">
            {(file.file_size / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>
      
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="p-2 hover:bg-muted rounded disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`Download ${file.filename}`}
      >
        <Download size={16} className={isDownloading ? 'animate-pulse' : ''} />
      </button>
    </div>
  );
}
