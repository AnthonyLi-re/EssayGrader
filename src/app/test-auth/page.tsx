"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserSession, setUserSession, clearUserSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function TestAuth() {
  const [userSession, setUserSessionState] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<"valid" | "invalid" | "checking" | "none">("none");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Get user session on component mount
    const session = getUserSession();
    setUserSessionState(session);
    
    // Get token
    const savedToken = localStorage.getItem("authToken");
    setToken(savedToken);
    
    // Check token validity
    checkToken(savedToken);
  }, []);

  const checkToken = async (currentToken: string | null) => {
    if (!currentToken) {
      setTokenStatus("none");
      return;
    }
    
    setTokenStatus("checking");
    
    try {
      const response = await fetch("/api/debug-auth", {
        headers: {
          "Authorization": `Bearer ${currentToken}`
        }
      });
      
      if (response.ok) {
        setTokenStatus("valid");
        setErrorMessage(null);
      } else {
        setTokenStatus("invalid");
        const data = await response.json();
        setErrorMessage(data.error || "Authentication failed");
      }
    } catch (error) {
      setTokenStatus("invalid");
      setErrorMessage("Error checking token: " + (error as Error).message);
    }
  };
  
  const generateNewToken = () => {
    if (!userSession) {
      setErrorMessage("Cannot generate token without a user session");
      return;
    }
    
    // Re-apply user session to generate a new token
    setUserSession(userSession);
    
    // Get the new token
    const newToken = localStorage.getItem("authToken");
    setToken(newToken);
    
    // Check the new token
    checkToken(newToken);
  };
  
  const clearSession = () => {
    clearUserSession();
    setUserSessionState(null);
    setToken(null);
    setTokenStatus("none");
  };
  
  const goToSignIn = () => {
    router.push("/auth/signin");
  };
  
  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Authentication Test</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Session</CardTitle>
            <CardDescription>Your current user session information</CardDescription>
          </CardHeader>
          <CardContent>
            {userSession ? (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">User session found</span>
                </div>
                <div className="rounded bg-gray-100 p-4 overflow-auto max-h-60">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(userSession, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">No user session found</span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {userSession ? (
              <Button variant="destructive" onClick={clearSession}>
                Clear Session
              </Button>
            ) : (
              <Button onClick={goToSignIn}>
                Sign In
              </Button>
            )}
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Auth Token</CardTitle>
            <CardDescription>Your current authentication token</CardDescription>
          </CardHeader>
          <CardContent>
            {token ? (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  {tokenStatus === "valid" && (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Valid token</span>
                    </>
                  )}
                  {tokenStatus === "invalid" && (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Invalid token</span>
                    </>
                  )}
                  {tokenStatus === "checking" && (
                    <span className="font-medium">Checking token...</span>
                  )}
                </div>
                <div className="rounded bg-gray-100 p-4 overflow-auto max-h-60">
                  <code className="text-xs break-all">
                    {token}
                  </code>
                </div>
                
                {errorMessage && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">No token found</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={generateNewToken} disabled={!userSession}>
              Generate New Token
            </Button>
            <Button variant="outline" onClick={() => checkToken(token)}>
              Test Token
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="mt-8">
        <Button onClick={() => router.push("/essays")}>
          Go to Essays Page
        </Button>
      </div>
    </div>
  );
} 