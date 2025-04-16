import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET handler for fetching essays (for teachers)
export async function GET(request: NextRequest) {
  try {
    // Check authentication using JWT token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
      
      if (!userId) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
      
      // Ensure user is a teacher
      if (userRole !== "TEACHER") {
        return NextResponse.json(
          { error: "Unauthorized: Only teachers can access this endpoint." },
          { status: 403 }
        );
      }
    
      // Add query parameter handling if needed (e.g., pagination, search)
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get("limit") || "50"); // Default limit
      const studentId = searchParams.get("studentId");
      const status = searchParams.get("status"); // e.g., 'graded', 'ungraded'
  
      let whereClause: any = {};
  
      if (studentId) {
        whereClause.authorId = studentId;
      }
      if (status === 'graded') {
        whereClause.feedback = { isNot: null };
      } else if (status === 'ungraded') {
        whereClause.feedback = null;
      }
  
      // Fetch essays based on criteria
      const essays = await prisma.essay.findMany({
        where: whereClause,
        include: {
          author: {
            select: { id: true, name: true, email: true }, // Include author info
          },
          feedback: {
            select: { id: true, totalScore: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });
  
      return NextResponse.json(essays);
    } catch (error) {
      console.error("Error parsing token:", error);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error("[API /teacher/essays GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch essays for teacher dashboard.", details: error.message },
      { status: 500 }
    );
  }
}

// Add other handlers (POST, PUT, DELETE) if needed later 