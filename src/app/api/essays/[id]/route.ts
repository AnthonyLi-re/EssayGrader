import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const essayId = params.id;
    
    console.log(`GET /api/essays/${essayId} request received`);
    
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
      
      // Fetch the essay with its feedback
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
      
      // Check if user is authorized to view this essay
      const isAuthor = essay.authorId === userId;
      const isTeacher = userRole === "TEACHER";
      
      console.log(`Essay author: ${essay.authorId}, requesting user: ${userId}, isAuthor: ${isAuthor}, isTeacher: ${isTeacher}`);
      
      if (!isAuthor && !isTeacher) {
        console.log("User not authorized to view this essay");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }
      
      console.log("Successfully fetched essay");
      return NextResponse.json(essay);
    } catch (error) {
      console.error("Error parsing token:", error);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error fetching essay:", error);
    return NextResponse.json(
      { error: "Failed to fetch essay" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const essayId = params.id;
    
    console.log(`DELETE /api/essays/${essayId} request received`);
    
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
      
      // Fetch the essay first to check ownership
      const essay = await prisma.essay.findUnique({
        where: { id: essayId },
      });
      
      if (!essay) {
        console.log(`Essay with ID ${essayId} not found`);
        return NextResponse.json(
          { error: "Essay not found" },
          { status: 404 }
        );
      }
      
      // Check if user is authorized to delete this essay
      const isAuthor = essay.authorId === userId;
      const isTeacher = userRole === "TEACHER";
      
      console.log(`Essay author: ${essay.authorId}, requesting user: ${userId}, isAuthor: ${isAuthor}, isTeacher: ${isTeacher}`);
      
      if (!isAuthor && !isTeacher) {
        console.log("User not authorized to delete this essay");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }
      
      // Delete the feedback first if it exists (due to foreign key constraint)
      await prisma.feedback.deleteMany({
        where: { essayId: essayId },
      });
      
      // Then delete the essay
      await prisma.essay.delete({
        where: { id: essayId },
      });
      
      console.log(`Successfully deleted essay ${essayId}`);
      return NextResponse.json({ 
        success: true, 
        message: "Essay deleted successfully" 
      });
    } catch (error) {
      console.error("Error parsing token or deleting essay:", error);
      return NextResponse.json(
        { error: "Failed to delete essay" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { error: "Failed to process delete request" },
      { status: 500 }
    );
  }
} 