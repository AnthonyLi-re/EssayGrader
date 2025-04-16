import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This function handles multipart/form-data for PDF uploads
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Extract the JWT token
    const token = authHeader.split(" ")[1];
    
    // In a real implementation, you would verify the JWT token
    // For now, we'll extract the user ID from the JWT payload
    // This is a simplified example - in production, use a proper JWT library
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub || payload.id;
      
      if (!userId) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
      
      // Parse form data
      const formData = await request.formData();
      const title = formData.get("title") as string;
      const prompt = formData.get("prompt") as string;
      const content = formData.get("content") as string;
      const pdfFile = formData.get("pdfFile") as File | null;
      
      // Get AI feedback and scores if available
      const feedbackText = formData.get("feedback") as string;
      const contentScore = parseInt(formData.get("contentScore") as string || "0");
      const languageScore = parseInt(formData.get("languageScore") as string || "0");
      const organizationScore = parseInt(formData.get("organizationScore") as string || "0");
      const totalScore = parseInt(formData.get("totalScore") as string || "0");
      const hasAIFeedback = feedbackText && contentScore && languageScore && organizationScore && totalScore;
      
      if (!title || !prompt || (!content && !pdfFile)) {
        return NextResponse.json(
          { error: "All fields are required" },
          { status: 400 }
        );
      }
      
      // Process uploaded file if provided
      let imageUrl = null;
      let extractedContent = content;
      
      if (pdfFile) {
        // Store file information
        const fileName = pdfFile.name;
        const fileType = pdfFile.type;
        const fileSize = pdfFile.size;
        
        // In a production environment, you would:
        // 1. Upload the file to a storage service like AWS S3
        // 2. Set the imageUrl to the stored file URL
        
        // For this example, we'll just use the filename with timestamp
        imageUrl = `file-${Date.now()}-${fileName}`;
        
        // If no content was provided but a file was, we'll use the content from the textarea
        // The OCR processing is done client-side, so we should have the content already
        if (!content && pdfFile) {
          extractedContent = "The content has been extracted from your uploaded file.";
        }
      }
      
      // Create the essay in the database
      const essay = await prisma.essay.create({
        data: {
          title,
          prompt,
          content: extractedContent,
          imageUrl, // Store file reference
          authorId: userId,
        },
      });
      
      // If AI feedback is available, create a feedback record
      if (hasAIFeedback) {
        await prisma.feedback.create({
          data: {
            essayId: essay.id,
            contentScore,
            languageScore,
            organizationScore,
            totalScore,
            feedback: feedbackText,
          },
        });
      }
      
      return NextResponse.json(
        {
          id: essay.id,
          title: essay.title,
          message: hasAIFeedback 
            ? "Essay submitted with AI feedback" 
            : "Essay submitted successfully",
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
    console.error("Error creating essay:", error);
    return NextResponse.json(
      { error: "Failed to create essay" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log("GET /api/essays request received");
    
    // Get authentication header
    const authHeader = req.headers.get("authorization");
    console.log("Auth header:", authHeader ? `${authHeader.substring(0, 15)}...` : "none");
    
    // Parse userId from query params
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    console.log("User ID from query:", userId);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid auth header");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Extract JWT token
    const token = authHeader.split(" ")[1];
    
    if (!token) {
      console.log("No token in auth header");
      return NextResponse.json(
        { error: "Authentication token required" },
        { status: 401 }
      );
    }
    
    try {
      // Parse token payload
      const payload = JSON.parse(atob(token.split(".")[1]));
      const tokenUserId = payload.sub || payload.id;
      console.log("User ID from token:", tokenUserId);
      
      if (!tokenUserId) {
        console.log("No user ID in token payload");
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
      
      // If userId is provided, ensure it matches the token
      if (userId && userId !== tokenUserId) {
        console.log("User ID mismatch - Token:", tokenUserId, "Query:", userId);
        return NextResponse.json(
          { error: "Unauthorized: User ID mismatch" },
          { status: 403 }
        );
      }
      
      // Use the token user ID if query param is missing
      const effectiveUserId = userId || tokenUserId;
      console.log("Using effective user ID:", effectiveUserId);
      
      // Get user's essays from the database
      const essays = await prisma.essay.findMany({
        where: {
          authorId: effectiveUserId,
        },
        include: {
          feedback: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5, // limit to 5 recent essays
      });
      
      console.log(`Found ${essays.length} essays for user ${effectiveUserId}`);
      return NextResponse.json(essays);
    } catch (error) {
      console.error("Error parsing JWT token:", error);
      return NextResponse.json(
        { error: "Invalid authentication token format" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error fetching essays:", error);
    return NextResponse.json(
      { error: "Failed to fetch essays" },
      { status: 500 }
    );
  }
} 