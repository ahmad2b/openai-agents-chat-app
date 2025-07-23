'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Chat session error:', error);
  }, [error]);

  const isNetworkError = error.message.includes('fetch') || error.message.includes('network');
  const isSessionError = error.message.includes('session') || error.message.includes('404');

  return (
    <div className="h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {isSessionError ? 'Session Not Found' : 'Something went wrong'}
          </h1>
          <p className="text-muted-foreground">
            {isNetworkError 
              ? 'Unable to connect to the chat service. Please check your connection and try again.'
              : isSessionError
              ? 'The chat session you\'re looking for doesn\'t exist or has expired.'
              : 'An unexpected error occurred while loading your chat session.'
            }
          </p>
        </div>

        {/* Error Details */}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Details</AlertTitle>
          <AlertDescription className="mt-2">
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {error.message}
            </code>
            {error.digest && (
              <div className="mt-2 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button 
            onClick={reset}
            className="w-full"
            variant="default"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => window.location.href = '/'}
          >
            <Home className="w-4 h-4 mr-2" />
            Start New Chat
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            If this problem persists, please check that the backend service is running on port 8000.
          </p>
        </div>
      </div>
    </div>
  );
} 