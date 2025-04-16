"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { get } from "@/lib/api";

// Simple interfaces
interface Feedback {
  id: string;
  essayId: string;
  contentScore: number;
  languageScore: number;
  organizationScore: number;
  totalScore: number;
  feedback: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Essay {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  prompt: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  feedback: Feedback | null;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [essays, setEssays] = useState<Essay[]>([]);
  const [loadingEssays, setLoadingEssays] = useState(true);
  
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push("/auth/signin");
      return;
    }
    
    // Redirect to teacher dashboard if user is a teacher
    if (!loading && user?.role === "TEACHER") {
      router.push("/dashboard/teacher");
      return;
    }
    
    // Only fetch essays if user is authenticated
    if (user?.id) {
      fetchEssays();
    }
  }, [user, loading, router]);
  
  const fetchEssays = async () => {
    try {
      setLoadingEssays(true);
      const data = await get(`essays?userId=${user?.id}`);
      setEssays(data);
    } catch (error) {
      console.error("Error fetching essays:", error);
    } finally {
      setLoadingEssays(false);
    }
  };

  // Show loading state
  if (loading || !user) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4 flex justify-center items-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalSubmissions = essays.length;
  const gradedEssays = essays.filter(e => e.feedback).length;
  const averageScore = totalSubmissions > 0 && gradedEssays > 0
    ? essays
        .filter(e => e.feedback)
        .reduce((sum, e) => sum + (e.feedback?.totalScore || 0), 0) / gradedEssays
    : 0;

  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Student Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {/* Stats Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Submissions</CardDescription>
            <CardTitle className="text-4xl">{totalSubmissions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All essays you have submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Graded Essays</CardDescription>
            <CardTitle className="text-4xl">{gradedEssays}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Essays that have received feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Score</CardDescription>
            <CardTitle className="text-4xl">{averageScore > 0 ? averageScore.toFixed(1) : 'N/A'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Average score on graded essays</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Name:</span>
                  <span>{user.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Email:</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Role:</span>
                  <span>{user.role}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild>
                <Link href="/profile">Edit Profile</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Essays</CardTitle>
              <CardDescription>Your most recent submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEssays ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : essays.length > 0 ? (
                <div className="space-y-4">
                  {essays.map((essay) => (
                    <div key={essay.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <Link href={`/essays/${essay.id}`} className="block">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium">{essay.title}</h3>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(essay.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {essay.content.substring(0, 150)}...
                        </p>
                        {essay.feedback ? (
                          <div className="flex gap-2 items-center mt-2">
                            <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              Score: {essay.feedback.totalScore}/100
                            </div>
                          </div>
                        ) : (
                           <div className="text-xs text-amber-600 dark:text-amber-500 mt-2 font-medium">
                             Pending Feedback
                           </div>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No essays submitted yet.</p>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <Button asChild variant="outline">
                <Link href="/essays">View All Essays</Link>
              </Button>
              <Button asChild>
                <Link href="/essays/new">Submit New Essay</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
} 