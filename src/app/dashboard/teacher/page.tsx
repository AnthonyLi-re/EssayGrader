"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, FileText, Loader2, Search, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
}

interface Essay {
  id: string;
  title: string;
  content: string;
  prompt: string;
  createdAt: Date;
  authorId: string;
  feedback: Feedback | null;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

export default function TeacherDashboard() {
  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadEssays() {
      try {
        const response = await fetch("/api/teacher/essays");
        
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/auth/signin");
            return;
          }
          
          if (response.status === 403) {
            router.push("/dashboard");
            return;
          }
          
          throw new Error("Failed to load essays");
        }
        
        const data = await response.json();
        setEssays(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    loadEssays();
  }, [router]);

  // Filter essays based on search term
  const filteredEssays = essays.filter(essay => 
    essay.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    essay.author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    essay.author.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const gradedEssays = filteredEssays.filter(essay => essay.feedback !== null);
  const ungradedEssays = filteredEssays.filter(essay => essay.feedback === null);

  if (loading) {
    return (
      <div className="container py-10 max-w-6xl mx-auto px-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading teacher dashboard...</p>
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
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage and grade student essays</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search essays or students..."
              className="pl-8 w-full md:w-[250px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button asChild>
            <Link href="/dashboard">Student View</Link>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Essays</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{essays.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {gradedEssays.length} graded, {ungradedEssays.length} pending
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(essays.map(essay => essay.authorId)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active students submitting essays
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gradedEssays.length > 0 
                ? Math.round(gradedEssays.reduce((sum, essay) => sum + essay.feedback!.totalScore, 0) / gradedEssays.length) 
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average score across all graded essays
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Essays ({filteredEssays.length})</TabsTrigger>
          <TabsTrigger value="ungraded">Pending ({ungradedEssays.length})</TabsTrigger>
          <TabsTrigger value="graded">Graded ({gradedEssays.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {filteredEssays.length > 0 ? (
            <div className="rounded-md border">
              <div className="py-3 px-4 text-sm font-medium grid grid-cols-12 gap-2 border-b">
                <div className="col-span-5">Essay Title</div>
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Status</div>
              </div>
              <div className="divide-y">
                {filteredEssays.map(essay => (
                  <div key={essay.id} className="py-3 px-4 text-sm grid grid-cols-12 gap-2 hover:bg-muted/50">
                    <div className="col-span-5 font-medium">
                      <Link href={`/essays/${essay.id}`} className="hover:underline">
                        {essay.title}
                      </Link>
                    </div>
                    <div className="col-span-3 text-muted-foreground">
                      {essay.author.name}
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      {formatDate(essay.createdAt)}
                    </div>
                    <div className="col-span-2">
                      {essay.feedback ? (
                        <Badge variant="outline" className="bg-green-100">
                          Score: {essay.feedback.totalScore}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-100">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p>No essays found matching your search criteria.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="ungraded" className="space-y-4">
          {ungradedEssays.length > 0 ? (
            <div className="rounded-md border">
              <div className="py-3 px-4 text-sm font-medium grid grid-cols-12 gap-2 border-b">
                <div className="col-span-6">Essay Title</div>
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1"></div>
              </div>
              <div className="divide-y">
                {ungradedEssays.map(essay => (
                  <div key={essay.id} className="py-3 px-4 text-sm grid grid-cols-12 gap-2 hover:bg-muted/50">
                    <div className="col-span-6 font-medium">
                      <Link href={`/essays/${essay.id}`} className="hover:underline">
                        {essay.title}
                      </Link>
                    </div>
                    <div className="col-span-3 text-muted-foreground">
                      {essay.author.name}
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      {formatDate(essay.createdAt)}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/essays/${essay.id}`}>
                          Grade
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p>No pending essays found.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="graded" className="space-y-4">
          {gradedEssays.length > 0 ? (
            <div className="rounded-md border">
              <div className="py-3 px-4 text-sm font-medium grid grid-cols-12 gap-2 border-b">
                <div className="col-span-5">Essay Title</div>
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Score</div>
              </div>
              <div className="divide-y">
                {gradedEssays.map(essay => (
                  <div key={essay.id} className="py-3 px-4 text-sm grid grid-cols-12 gap-2 hover:bg-muted/50">
                    <div className="col-span-5 font-medium">
                      <Link href={`/essays/${essay.id}`} className="hover:underline">
                        {essay.title}
                      </Link>
                    </div>
                    <div className="col-span-3 text-muted-foreground">
                      {essay.author.name}
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      {formatDate(essay.createdAt)}
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className="bg-green-100">
                        {essay.feedback?.totalScore}/100
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p>No graded essays found.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 