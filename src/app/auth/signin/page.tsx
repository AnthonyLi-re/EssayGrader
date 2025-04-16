"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { setUserSession } from "@/lib/auth";

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function SignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      initGoogleButton();
    };

    return () => {
      // Clean up
      document.head.removeChild(script);
    };
  }, []);

  const initGoogleButton = () => {
    console.log("Initializing Google button with client ID:", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    if (window.google && document.getElementById('googleSignInButton')) {
      window.google.accounts.id.initialize({
        // Use the hardcoded client ID to test if it's an environment variable issue
        client_id: "481483390761-04muvc54huq9onaf8t4j9m0puu9aaqoj.apps.googleusercontent.com",
        callback: handleGoogleResponse,
        ux_mode: 'popup',
        auto_select: false,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInButton')!,
        { theme: 'outline', size: 'large', width: '100%', text: 'signin_with' }
      );
    }
  };

  const handleGoogleResponse = async (response: any) => {
    setLoading(true);
    setError("");

    try {
      // Send the token to our API to verify and get user data
      const result = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: response.credential }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || 'Failed to sign in with Google');
      }

      // Save user session
      setUserSession(data.user);

      // Show success message
      toast({
        title: "Sign in successful",
        description: "You are now signed in.",
      });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google");
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: "There was a problem signing in with Google.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className="container py-10 max-w-6xl mx-auto px-4 flex h-[calc(100vh-8rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome to Essay Grading Platform</CardTitle>
          <CardDescription>
            Sign in with Google to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            {/* Google Sign In Button Container */}
            <div id="googleSignInButton" className="w-full"></div>
            
            {/* Fallback button if rendering fails */}
            <Button 
              onClick={handleManualGoogleSignIn} 
              className="w-full" 
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-muted-foreground w-full">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
} 