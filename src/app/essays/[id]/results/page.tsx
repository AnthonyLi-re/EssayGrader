"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, ArrowLeft, Loader2, RefreshCw, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getUserSession, ensureAuth } from "@/lib/auth";

// Interfaces for structured feedback
interface FeedbackItem {
  type: "Grammar" | "Spelling" | "Word Choice" | "Sentence Flow" | "Clarity" | "Style" | "Content Requirement" | "Relevance" | "Idea Development" | "Organization" | "Other";
  segment: string;
  suggestion: string;
  number: number;
}

interface EssayScores {
  content: number;
  language: number;
  organization: number;
  overall: number;
}

interface EssayWithHighlights {
  id: string;
  title: string;
  content: string;
  prompt: string;
  highlightedContent?: string;
  scores: EssayScores;
  feedbackItems: FeedbackItem[];
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to get highlight color based on feedback type
function getHighlightColor(type: FeedbackItem['type']): string {
  switch (type) {
    case "Grammar":
    case "Spelling":
    case "Word Choice":
    case "Style":
      return "bg-yellow-100 border-yellow-300 border"; // Yellow for language issues
    case "Sentence Flow":
    case "Organization":
    case "Clarity":
      return "bg-blue-100 border-blue-300 border"; // Light blue for organization/flow
    case "Content Requirement":
    case "Relevance":
    case "Idea Development":
      return "bg-pink-100 border-pink-300 border"; // Pink for content
    default:
      return "bg-gray-100 border-gray-300 border"; // Gray for other
  }
}

// Convert percentage score back to HKDSE scale (0-7)
function getHKDSEScore(percentageScore: number): number {
  return Math.round((percentageScore / 100) * 7);
}

// Get total HKDSE score (0-21)
function getHKDSETotalScore(scores: EssayScores): number {
  return getHKDSEScore(scores.content) + getHKDSEScore(scores.language) + getHKDSEScore(scores.organization);
}

// Helper function to get valid auth header
function getAuthHeader() {
  // Ensure the auth token is valid
  ensureAuth();
  return { "Authorization": `Bearer ${localStorage.getItem("authToken")}` };
}

export default function EssayResults({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const essayId = resolvedParams.id;
  
  const [essay, setEssay] = useState<EssayWithHighlights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingFeedback, setProcessingFeedback] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<number | null>(null);
  const highlightRefs = useRef<{[key: number]: HTMLSpanElement | null}>({});
  const cardRefs = useRef<{[key: number]: HTMLDivElement | null}>({});
  
  const router = useRouter();
  const { toast } = useToast();

  // Helper functions for refs
  const setHighlightRef = (id: number) => (el: HTMLSpanElement | null) => {
    highlightRefs.current[id] = el;
  };
  
  const setCardRef = (id: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[id] = el;
  };

  useEffect(() => {
    async function loadEssayWithFeedback() {
      try {
        // Get user session
        const userSession = getUserSession();
        if (!userSession) {
          router.push("/auth/signin");
          return;
        }

        // Ensure auth token is refreshed
        ensureAuth();

        // First, fetch the basic essay data
        const response = await fetch(`/api/essays/${essayId}`, {
          headers: getAuthHeader()
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Try to refresh auth and retry once
            ensureAuth();
            const retryResponse = await fetch(`/api/essays/${essayId}`, {
              headers: getAuthHeader()
            });
            
            if (!retryResponse.ok) {
              router.push("/auth/signin");
              return;
            }
            
            const essayData = await retryResponse.json();
            
            // Continue with the refreshed token
            await loadDetailedFeedback(essayData);
            return;
          }
          
          if (response.status === 404) {
            throw new Error("Essay not found");
          }
          
          const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
          throw new Error(errorData.error || "Failed to load essay");
        }
        
        const essayData = await response.json();
        await loadDetailedFeedback(essayData);
      } catch (err: any) {
        console.error("Error loading essay:", err);
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    async function loadDetailedFeedback(essayData: any) {
      try {
        // Then, fetch the detailed feedback with highlights
        const feedbackResponse = await fetch(`/api/essays/${essayId}/detailed-feedback`, {
          headers: getAuthHeader()
        });
        
        if (!feedbackResponse.ok) {
          // If detailed feedback is not available, generate it
          console.log("Detailed feedback not available, generating now...");
          setProcessingFeedback(true);
          
          // Call the regenerate feedback endpoint
          const regenerateResponse = await fetch(`/api/essays/${essayId}/regenerate-feedback`, {
            method: "POST",
            headers: getAuthHeader()
          });
          
          if (!regenerateResponse.ok) {
            // Try once more with refreshed auth
            if (regenerateResponse.status === 401) {
              ensureAuth();
              const retryRegenerateResponse = await fetch(`/api/essays/${essayId}/regenerate-feedback`, {
                method: "POST",
                headers: getAuthHeader()
              });
              
              if (!retryRegenerateResponse.ok) {
                try {
                  const errorData = await retryRegenerateResponse.json().catch(() => ({ error: "Failed to parse error response" }));
                  console.error("Failed to generate detailed feedback after retry:", errorData);
                  throw new Error(errorData.error || "Failed to generate detailed feedback for this essay");
                } catch (parseError) {
                  console.error("Error parsing retry error:", parseError);
                  throw new Error("Failed to parse response from feedback API");
                }
              }
              
              try {
                const feedbackData = await retryRegenerateResponse.json();
                setEssay({
                  ...essayData,
                  ...feedbackData
                });
                setProcessingFeedback(false);
                return;
              } catch (parseError) {
                console.error("Error parsing retry feedback data:", parseError);
                throw new Error("Failed to parse feedback data from API");
              }
            }
            
            // Try to get the error message from the response
            try {
              const errorData = await regenerateResponse.json().catch(() => ({ error: "Failed to parse error response" }));
              console.error("Failed to generate detailed feedback:", errorData);
              throw new Error(errorData.error || "Failed to generate detailed feedback for this essay");
            } catch (parseError) {
              console.error("Error parsing error response:", parseError);
              throw new Error("Failed to parse error response from API");
            }
          }
          
          try {
            // Use the regenerated feedback
            const feedbackData = await regenerateResponse.json();
            setEssay({
              ...essayData,
              ...feedbackData
            });
          } catch (parseError) {
            console.error("Error parsing regenerate response:", parseError);
            throw new Error("Failed to parse feedback data");
          } finally {
            setProcessingFeedback(false);
          }
        } else {
          // Use the existing detailed feedback
          const feedbackData = await feedbackResponse.json();
          setEssay({
            ...essayData,
            ...feedbackData
          });
        }
      } catch (err: any) {
        console.error("Error loading detailed feedback:", err);
        throw err;
      }
    }
    
    loadEssayWithFeedback();
  }, [essayId, router]);

  const regenerateFeedback = async () => {
    if (!essay) return;
    
    setProcessingFeedback(true);
    
    try {
      // Ensure auth token is refreshed
      ensureAuth();
      
      const response = await fetch(`/api/essays/${essay.id}/regenerate-feedback`, {
        method: "POST",
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        // Try once more with refreshed auth if needed
        if (response.status === 401) {
          ensureAuth();
          const retryResponse = await fetch(`/api/essays/${essay.id}/regenerate-feedback`, {
            method: "POST",
            headers: getAuthHeader()
          });
          
          if (!retryResponse.ok) {
            const data = await retryResponse.json().catch(() => ({ error: "Failed to parse error response" }));
            throw new Error(data.error || "Failed to regenerate feedback");
          }
          
          const feedbackData = await retryResponse.json();
          setEssay({
            ...essay,
            ...feedbackData
          });
          
          toast({
            title: "Feedback regenerated",
            description: "Your essay feedback has been updated.",
          });
          return;
        }
        
        const data = await response.json();
        throw new Error(data.error || "Failed to regenerate feedback");
      }
      
      // Clone the response before parsing to avoid consuming it twice
      const feedbackData = await response.clone().json();
      
      setEssay({
        ...essay,
        ...feedbackData
      });
      
      toast({
        title: "Feedback regenerated",
        description: "Your essay feedback has been updated.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to regenerate feedback");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to regenerate feedback",
      });
    } finally {
      setProcessingFeedback(false);
    }
  };

  const scrollToHighlight = (highlightId: number) => {
    if (highlightRefs.current[highlightId]) {
      highlightRefs.current[highlightId]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      setActiveHighlight(highlightId);
      
      // Remove active state after a delay
      setTimeout(() => {
        setActiveHighlight(null);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading essay results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href={`/essays/${essayId}`}>Back to Essay</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!essay) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Essay not found</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/essays">Back to Essays</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Convert scores to HKDSE scale (0-7)
  const hkdseContent = getHKDSEScore(essay.scores.content);
  const hkdseLanguage = getHKDSEScore(essay.scores.language);
  const hkdseOrganization = getHKDSEScore(essay.scores.organization);
  const hkdseTotal = getHKDSETotalScore(essay.scores);

  return (
    <div className="container py-10 max-w-7xl mx-auto px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">{essay.title}</h1>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/essays">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Essays
            </Link>
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
        </div>
      </div>
      
      {/* Score Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Essay Score Summary</CardTitle>
          <CardDescription>
            Based on HKDSE English Language Paper 2 (Writing) criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <div className="text-sm text-muted-foreground mb-1">Content</div>
              <div className="text-3xl font-bold">{hkdseContent}<span className="text-sm text-muted-foreground">/7</span></div>
              <Progress value={(hkdseContent/7)*100} className="h-1.5 mt-2" />
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-sm text-muted-foreground mb-1">Language</div>
              <div className="text-3xl font-bold">{hkdseLanguage}<span className="text-sm text-muted-foreground">/7</span></div>
              <Progress value={(hkdseLanguage/7)*100} className="h-1.5 mt-2" />
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-sm text-muted-foreground mb-1">Organization</div>
              <div className="text-3xl font-bold">{hkdseOrganization}<span className="text-sm text-muted-foreground">/7</span></div>
              <Progress value={(hkdseOrganization/7)*100} className="h-1.5 mt-2" />
            </div>
            <div className="p-4 border rounded-lg text-center bg-muted/30">
              <div className="text-sm text-muted-foreground mb-1">Total Score</div>
              <div className="text-3xl font-bold">{hkdseTotal}<span className="text-sm text-muted-foreground">/21</span></div>
              <Progress value={(hkdseTotal/21)*100} className="h-1.5 mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Main Content: Two-column layout with essay and comments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Essay with Feedback</CardTitle>
              <CardDescription>
                Highlighted sections indicate specific feedback points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <h2 className="text-xl font-semibold mb-4">{essay.prompt}</h2>
                
                {/* Essay content with highlights */}
                <div 
                  className="whitespace-pre-wrap p-4 border rounded-lg font-serif text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: essay.highlightedContent || 
                      // If no highlighted content is available, use regular content
                      essay.content.split('\n').map(line => 
                        `<p>${line || '&nbsp;'}</p>`
                      ).join('')
                  }}
                />

                {/* Add CSS for highlights - these classes are added to spans in the highlighted content */}
                <style jsx global>{`
                  .highlight-language {
                    background-color: #FEFCBF;
                    border: 1px solid #F6E05E;
                    border-radius: 0.25rem;
                    padding: 0 0.25rem;
                  }
                  .highlight-organization {
                    background-color: #BEE3F8;
                    border: 1px solid #90CDF4;
                    border-radius: 0.25rem;
                    padding: 0 0.25rem;
                  }
                  .highlight-content {
                    background-color: #FED7E2;
                    border: 1px solid #FBB6CE;
                    border-radius: 0.25rem;
                    padding: 0 0.25rem;
                  }
                `}</style>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex flex-col h-full">
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle>Feedback Comments</CardTitle>
              <CardDescription>
                Click on a comment to highlight the relevant text
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden p-4">
              <div className="space-y-3 pr-2 h-full overflow-y-auto max-h-[calc(100vh-350px)]">
                {essay.feedbackItems.map((item) => (
                  <div
                    key={item.number}
                    ref={setCardRef(item.number)}
                    className={`p-3 border rounded-md cursor-pointer transition-all mb-3 ${
                      getHighlightColor(item.type)
                    } ${
                      activeHighlight === item.number ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => scrollToHighlight(item.number)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm">
                        {item.type} ({item.number})
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {item.segment}
                      {item.segment.split(" ").length > 5 && "..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {item.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 