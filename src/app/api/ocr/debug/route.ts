import { NextRequest, NextResponse } from "next/server";

// This is a debug route to test the OCR functionality
export async function GET(request: NextRequest) {
  try {
    // Create a simple mock PDF file for testing
    const mockPdfFileName = "sample-essay.pdf";
    const mockPdfFileSize = 150000; // 150KB
    
    // Generate mock OCR text
    const mockText = `This is mock OCR text extracted from your uploaded file.

PDF Document Analysis:

Title: sample essay
Type: Academic Essay
Estimated Pages: 6

Introduction:
This essay presents a comprehensive analysis of the subject matter, taking into account various perspectives and evidence. The author has structured the argument in a logical manner, with clear thesis statements and supporting evidence.

Body:
The main points raised in this essay include several key arguments supported by evidence. The author cites relevant sources and provides context for each point. The language used is appropriate for academic writing, with proper terminology and formal structure.

Conclusion:
In conclusion, the essay effectively summarizes the main arguments and provides some insight into the broader implications of the topic. The author has demonstrated understanding of the subject and provided a coherent analysis.`;

    // Simulate a delay for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock OCR result
    return NextResponse.json({
      status: 200,
      text: mockText,
      fileType: "application/pdf",
      fileName: mockPdfFileName,
      fileSize: mockPdfFileSize,
      message: "This is a debug endpoint using mock OCR implementation",
      usedMock: true
    });
  } catch (error: any) {
    console.error("Debug: Error processing test OCR:", error.message);
    return NextResponse.json(
      { 
        error: `Debug error: ${error.message}`,
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 