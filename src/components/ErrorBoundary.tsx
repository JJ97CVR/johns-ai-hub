import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  className?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('💥 React Error Boundary caught:', error, errorInfo);
    
    // TODO: Send to error tracking service
    // Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Något gick fel</h1>
            <p className="text-muted-foreground">
              {this.state.error?.message || 'Ett oväntat fel inträffade'}
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Ladda om sidan
            </Button>
          </div>
        </div>
      );
    }

    return this.props.className ? (
      <div className={this.props.className}>
        {this.props.children}
      </div>
    ) : this.props.children;
  }
}
