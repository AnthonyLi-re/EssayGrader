"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Plus, Search, ChevronRight, X, Trash } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { getUserSession } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Helper function to format dates
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Feedback {
  id: string;
  totalScore: number;
  contentScore: number;
  languageScore: number;
  organizationScore: number;
}

interface Essay {
  id: string;
  title: string;
  content: string;
  prompt: string;
  createdAt: Date;
  feedback: Feedback | null;
}

// Group interface to organize essays by questions
interface QuestionGroup {
  prompt: string;
  essays: Essay[];
}

// Debug info interface
interface DebugInfo {
  error?: string;
  userSession?: any;
  authDebug?: any;
  apiResponse?: {
    status: number;
    statusText: string;
  };
  apiError?: any;
  catchError?: string;
}

export default function EssayList() {
  const [essays, setEssays] = useState<Essay[]>([]);
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadEssays() {
      try {
        // Get user session
        const userSession = getUserSession();
        if (!userSession) {
          // Not authenticated, redirect to sign in
          console.log("No user session found, redirecting to sign in");
          setDebugInfo({ error: "No user session found" });
          router.push("/auth/signin");
          return;
        }

        console.log("User session found:", userSession);
        setDebugInfo(prev => ({ ...prev, userSession }));

        // Test authentication with debug endpoint
        const debugResponse = await fetch(`/api/debug-auth?userId=${userSession.id}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken")}`
          }
        });
        
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          console.log("Debug auth response:", debugData);
          setDebugInfo(prev => ({ ...prev, authDebug: debugData }));
        }

        // Include user ID in the request
        const response = await fetch(`/api/essays?userId=${userSession.id}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken")}`
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log("Authentication failed, redirecting to sign in");
            setDebugInfo(prev => ({ ...prev, apiResponse: { status: response.status, statusText: response.statusText } }));
            router.push("/auth/signin");
            return;
          }
          
          const errorData = await response.json().catch(() => ({ error: "Could not parse error response" }));
          console.error("API error response:", errorData);
          setDebugInfo(prev => ({ ...prev, apiError: errorData }));
          throw new Error(errorData.error || "Failed to load essays");
        }
        
        const data = await response.json();
        setEssays(data);
        
        // Group essays by question/prompt
        const groups: Record<string, Essay[]> = {};
        data.forEach((essay: Essay) => {
          const prompt = essay.prompt || "Uncategorized";
          if (!groups[prompt]) {
            groups[prompt] = [];
          }
          groups[prompt].push(essay);
        });
        
        // Convert to array for rendering
        const questionGroupsArray = Object.entries(groups).map(([prompt, essays]) => ({
          prompt,
          essays
        }));
        
        setQuestionGroups(questionGroupsArray);
      } catch (err: any) {
        console.error("Error loading essays:", err);
        setError(err.message || "An unexpected error occurred");
        setDebugInfo(prev => ({ ...prev, catchError: err.toString() }));
      } finally {
        setLoading(false);
      }
    }
    
    loadEssays();
  }, [router]);

  // Filter essays based on search term
  const filteredEssays = essays.filter(essay => 
    essay.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    essay.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    essay.prompt.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter question groups based on search term
  const filteredQuestionGroups = questionGroups.map(group => ({
    ...group,
    essays: group.essays.filter(essay => 
      essay.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      essay.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(group => group.essays.length > 0 || 
    group.prompt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to delete an essay
  const deleteEssay = async (essayId: string, event: React.MouseEvent) => {
    event.preventDefault(); // Prevent navigation to essay detail page
    event.stopPropagation(); // Prevent event bubbling
    
    if (!confirm("Are you sure you want to delete this essay? This action cannot be undone.")) {
      return;
    }
    
    setDeleting(essayId);
    
    try {
      const response = await fetch(`/api/essays/${essayId}`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Could not parse error response" }));
        throw new Error(errorData.error || "Failed to delete essay");
      }
      
      // Remove essay from state
      setEssays(prev => prev.filter(essay => essay.id !== essayId));
      
      // Also update question groups
      setQuestionGroups(prev => 
        prev.map(group => ({
          ...group,
          essays: group.essays.filter(essay => essay.id !== essayId)
        })).filter(group => group.essays.length > 0)
      );
      
      // Show success message
      alert("Essay deleted successfully");
    } catch (err: any) {
      console.error("Error deleting essay:", err);
      alert(err.message || "Failed to delete essay");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading essays...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        {debugInfo && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
              <CardDescription>This information can help diagnose the authentication issue</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto text-xs p-4 bg-gray-100 rounded">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push("/auth/signin")} className="mr-2">Go to Sign In</Button>
              <Button onClick={() => router.push("/test-auth")} className="mr-2" variant="outline">Test Authentication</Button>
              <Button onClick={() => window.location.reload()} variant="outline">Reload Page</Button>
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }
  
  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Essays</h1>
        <Button asChild>
          <Link href="/essays/new" className="flex items-center gap-1">
            <Plus className="h-4 w-4" />
            Submit New Essays
          </Link>
        </Button>
      </div>
      
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search essays by title, content, or question..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Essays</TabsTrigger>
          <TabsTrigger value="by-question">By Question</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          {filteredEssays.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEssays.map((essay: Essay) => (
                <Link href={`/essays/${essay.id}/results`} key={essay.id} className="block">
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="line-clamp-1">{essay.title}</CardTitle>
                      <CardDescription>
                        {formatDate(essay.createdAt)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <Badge variant="outline">{essay.prompt.substring(0, 30)}{essay.prompt.length > 30 ? '...' : ''}</Badge>
                      </div>
                      <p className="line-clamp-3 text-muted-foreground text-sm">
                        {essay.content.substring(0, 150)}...
                      </p>
                    </CardContent>
                    <CardFooter>
                      <div className="w-full flex items-center justify-between">
                        {essay.feedback ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Score: </span>
                            <span className="text-sm font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                              {essay.feedback.totalScore}/100
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No feedback yet</span>
                        )}
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              router.push(`/essays/${essay.id}/results`);
                            }}
                          >
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600"
                            disabled={deleting === essay.id}
                            onClick={(e) => deleteEssay(essay.id, e)}
                          >
                            {deleting === essay.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            ) : (
                              <Trash className="h-3 w-3 mr-2" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 pb-4 text-center">
                {searchTerm ? (
                  <>
                    <p className="text-muted-foreground mb-2">No essays match your search</p>
                    <Button variant="outline" onClick={() => setSearchTerm("")}>Clear Search</Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">You haven't submitted any essays yet</p>
                    <Button asChild>
                      <Link href="/essays/new">Submit Your First Essay</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="by-question">
          {filteredQuestionGroups.length > 0 ? (
            <div className="space-y-8">
              {filteredQuestionGroups.map((group, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{group.prompt.substring(0, 100)}{group.prompt.length > 100 ? '...' : ''}</CardTitle>
                    <CardDescription>{group.essays.length} essay(s)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="grid gap-4 md:grid-cols-2">
                        {group.essays.map((essay) => (
                          <div key={essay.id} className="relative">
                            <Link href={`/essays/${essay.id}/results`}>
                              <div className="flex items-start p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                <div className="flex-grow overflow-hidden">
                                  <h3 className="font-medium line-clamp-1">{essay.title}</h3>
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {essay.content.substring(0, 100)}...
                                  </p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-muted-foreground">{formatDate(essay.createdAt)}</span>
                                    {essay.feedback && (
                                      <Badge variant="secondary">Score: {essay.feedback.totalScore}/100</Badge>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground self-center ml-2 flex-shrink-0" />
                              </div>
                            </Link>
                            <div className="absolute top-2 right-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 bg-white/80 text-red-600 rounded-full"
                                disabled={deleting === essay.id}
                                onClick={(e) => deleteEssay(essay.id, e)}
                              >
                                {deleting === essay.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 pb-4 text-center">
                {searchTerm ? (
                  <>
                    <p className="text-muted-foreground mb-2">No questions match your search</p>
                    <Button variant="outline" onClick={() => setSearchTerm("")}>Clear Search</Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">You haven't submitted any essays yet</p>
                    <Button asChild>
                      <Link href="/essays/new">Submit Your First Essay</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 