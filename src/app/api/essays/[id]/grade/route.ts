import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const essayId = params.id;
    
    console.log(`POST /api/essays/${essayId}/grade request received`);
    
    // Check authentication using JWT token
    const authHeader = request.headers.get("authorization");
    console.log("Auth header:", authHeader ? `${authHeader.substring(0, 15)}...` : "none");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid auth header");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Extract the JWT token
    const token = authHeader.split(" ")[1];
    
    try {
      // Parse the token
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub || payload.id;
      const userRole = payload.role;
      
      console.log(`Token parsed, user ID: ${userId}, role: ${userRole}`);
      
      if (!userId) {
        console.log("No user ID found in token");
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
      
      // Fetch the essay to make sure it exists
      const essay = await prisma.essay.findUnique({
        where: { id: essayId },
        include: { feedback: true },
      });
      
      if (!essay) {
        console.log(`Essay with ID ${essayId} not found`);
        return NextResponse.json(
          { error: "Essay not found" },
          { status: 404 }
        );
      }
      
      // Only the essay author or teachers can request grading
      if (essay.authorId !== userId && userRole !== "TEACHER") {
        console.log("User not authorized to grade this essay");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }
      
      // Check if feedback already exists
      if (essay.feedback) {
        console.log("Essay already has feedback");
        return NextResponse.json(
          { error: "Essay already has feedback", feedbackId: essay.feedback.id },
          { status: 409 }
        );
      }
      
      // Here we would normally call our AI grading service
      // For now, we'll implement a mock grading system
      const contentScore = Math.floor(Math.random() * 30) + 60; // 60-90
      const languageScore = Math.floor(Math.random() * 30) + 60; // 60-90
      const organizationScore = Math.floor(Math.random() * 30) + 60; // 60-90
      const totalScore = Math.floor((contentScore + languageScore + organizationScore) / 3);
      
      // Generate mock feedback based on essay content length
      const contentLength = essay.content.length;
      let feedbackText = "";
      
      if (contentLength < 500) {
        feedbackText = `
          Your essay is too short (${contentLength} characters). 
          
          Strengths:
          - You have a clear opening statement
          
          Areas for improvement:
          - Develop your ideas further with examples and explanations
          - Aim for at least 800-1000 characters
          - Add more supporting evidence
          
          Overall, your essay needs significant expansion to meet the requirements.
        `.trim();
      } else if (contentLength < 1000) {
        feedbackText = `
          Your essay demonstrates basic understanding of the topic.
          
          Strengths:
          - Good attempt at addressing the prompt
          - Some relevant points included
          
          Areas for improvement:
          - Expand your conclusion to reinforce your main arguments
          - Work on sentence variety to improve flow
          - Consider adding more specific examples to strengthen your points
          
          Overall, this is a developing essay that would benefit from more depth.
        `.trim();
      } else {
        feedbackText = `
          Your essay demonstrates strong understanding of the topic.
          
          Strengths:
          - Clear thesis statement and excellent structure
          - Relevant supporting evidence throughout
          - Effective use of transitions between paragraphs
          
          Areas for improvement:
          - Consider incorporating more diverse vocabulary
          - Some minor grammatical issues can be addressed
          - The conclusion could more strongly tie back to your thesis
          
          Overall, this is a well-developed essay that effectively addresses the prompt.
        `.trim();
      }
      
      // Create feedback record in the database
      const feedback = await prisma.feedback.create({
        data: {
          essayId,
          contentScore,
          languageScore,
          organizationScore,
          totalScore,
          feedback: feedbackText,
        },
      });
      
      return NextResponse.json(
        {
          message: "Essay graded successfully",
          feedback: {
            id: feedback.id,
            contentScore,
            languageScore,
            organizationScore,
            totalScore,
            feedback: feedbackText,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error parsing token:", error);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error grading essay:", error);
    return NextResponse.json(
      { error: "Failed to grade essay" },
      { status: 500 }
    );
  }
} 