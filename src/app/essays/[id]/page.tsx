"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle, Loader2, Eye, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { getUserSession } from "@/lib/auth";

// Helper function to format dates
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Helper function to calculate letter grade
function calculateGrade(score: number) {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 45) return "D+";
  if (score >= 40) return "D";
  return "F";
}

interface Feedback {
  id: string;
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
  prompt: string;
  imageUrl?: string | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  feedback: Feedback | null;
}

export default function EssayDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const essayId = resolvedParams.id;
  const router = useRouter();
  
  // Immediately redirect to the detailed results page
  useEffect(() => {
    router.replace(`/essays/${essayId}/results`);
  }, [essayId, router]);
  
  // Show loading state while redirect happens
  return (
    <div className="container py-10 max-w-6xl mx-auto px-4 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg font-medium">Redirecting to detailed analysis...</p>
      </div>
    </div>
  );
} 