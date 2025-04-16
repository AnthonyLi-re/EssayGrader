import { prisma } from "./prisma";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

// Simple user session interface
export interface UserSession {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
}

// Function to find or create a user from Google profile data
export async function findOrCreateUser(googleData: {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<UserSession> {
  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { 
      email: googleData.email
    },
  });

  // If user exists, return it
  if (user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role as UserRole,
    };
  }

  // Create a new user if they don't exist
  const newUser = await prisma.user.create({
    data: {
      email: googleData.email,
      name: googleData.name || "",
      image: googleData.picture || "",
      // Default role for new users
      role: "STUDENT",
    },
  });

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    image: newUser.image,
    role: newUser.role as UserRole,
  };
}

// Helper functions for client-side auth
export function setUserSession(user: UserSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("userSession", JSON.stringify(user));
    
    // Generate and store a simple JWT token for API authentication
    const token = generateJWT(user);
    localStorage.setItem("authToken", token);
  }
}

// Server-side: Extract token from request headers and validate
export function serverGetUserSession(req: Request): UserSession | null {
  try {
    // Extract the token from the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("No valid authorization header found");
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.error("No token found in authorization header");
      return null;
    }

    // Simple JWT decoding
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error("Invalid token format");
        return null;
      }

      // Decode the payload (middle part)
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.error("Token expired");
        return null;
      }
      
      // Return the user session from the payload
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        image: null,
        role: payload.role as UserRole
      };
    } catch (error) {
      console.error("Error parsing token:", error);
      return null;
    }
  } catch (error) {
    console.error("Server auth error:", error);
    return null;
  }
}

// Original client-side getUserSession remains unchanged
export function getUserSession(): UserSession | null {
  if (typeof window !== "undefined") {
    const session = localStorage.getItem("userSession");
    if (session) {
      const user = JSON.parse(session);
      
      // Check if auth token exists, if not generate it
      const token = localStorage.getItem("authToken");
      if (!token) {
        console.log("Auth token missing, generating new token");
        const newToken = generateJWT(user);
        localStorage.setItem("authToken", newToken);
      }
      
      return user;
    }
  }
  return null;
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("authToken");
  }
  return null;
}

export function clearUserSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("userSession");
    localStorage.removeItem("authToken");
  }
}

// Simple JWT generation - in production, use a proper JWT library
function generateJWT(user: UserSession): string {
  // Create a simple header
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  // Create a payload with user data and expiration
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiration
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  // In production, you would use a proper signature with a secret key
  // This is a simplified example without actual verification
  const signature = btoa(`${encodedHeader}.${encodedPayload}`);
  
  // Return the JWT token
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Add a function to ensure auth is initialized
export function ensureAuth(): boolean {
  const user = getUserSession();
  const token = getAuthToken();
  
  if (user && token) {
    return true;
  }
  
  if (user && !token) {
    // If we have a user but no token, generate one
    const newToken = generateJWT(user);
    localStorage.setItem("authToken", newToken);
    return true;
  }
  
  return false;
} 