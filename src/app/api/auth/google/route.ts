import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Get the token from the request
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify the token with Google
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get user profile data from Google
    const googleData = await response.json();

    // Ensure email is present and verified
    if (!googleData.email || !googleData.email_verified) {
      return NextResponse.json(
        { error: "Google account email not verified" },
        { status: 401 }
      );
    }

    // Find or create user
    const user = await findOrCreateUser({
      id: googleData.sub,
      email: googleData.email,
      name: googleData.name,
      picture: googleData.picture,
    });

    // Return user data
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Google authentication error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
} 