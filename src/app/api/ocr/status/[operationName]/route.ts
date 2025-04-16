import { NextRequest, NextResponse } from "next/server";

// This is now a much simpler function that just returns the operation status
export async function GET(
  req: NextRequest,
  { params }: { params: { operationName: string } }
) {
  // This endpoint is no longer used for polling
  return NextResponse.json({
    status: "DEPRECATED",
    message: "OCR status polling is no longer needed. The OCR results are now returned directly from the upload endpoint.",
    operationName: params.operationName
  });
} 