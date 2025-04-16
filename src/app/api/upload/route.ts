import { NextRequest, NextResponse } from "next/server";
// We're using our custom client module
import { processFileWithUrl } from "@/lib/mistral-client";

export async function POST(req: NextRequest) {
  try {
    // Check authentication using JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("Authentication header missing");
      return NextResponse.json(
        { error: "Authentication header missing" },
        { status: 401 }
      );
    }
    
    if (!authHeader.startsWith("Bearer ")) {
      console.error("Invalid authentication header format - must use Bearer token");
      return NextResponse.json(
        { error: "Invalid authentication format - must use Bearer token" },
        { status: 401 }
      );
    }
    
    // Extract the JWT token
    const token = authHeader.split(" ")[1];
    if (!token) {
      console.error("Empty Bearer token");
      return NextResponse.json(
        { error: "Empty Bearer token" },
        { status: 401 }
      );
    }
    
    // Verify the token (simplified version)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub || payload.id;
      
      if (!userId) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }

      // Get file from request
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      console.log(`Processing file: ${file.name} (${file.size / 1024}KB)`);
      
      try {
        // Process the file and get text directly
        const startTime = Date.now();
        const extractedText = await processFileWithUrl(file);
        const processingTime = Date.now() - startTime;
        
        console.log(`OCR processing completed in ${processingTime}ms. Text length: ${extractedText.length} characters`);
        
        // Return the extracted text directly to the client
        return NextResponse.json({ 
          success: true,
          text: extractedText,
          processingTime
        });
      } catch (err: any) {
        console.error("OCR processing error:", err);
        return NextResponse.json(
          { error: err.message || "Failed to process OCR" },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Error parsing token:", error);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
} 