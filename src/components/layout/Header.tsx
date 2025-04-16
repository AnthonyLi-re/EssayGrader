"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { SignOutButton } from "@/components/sign-out-button";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">EssayGrader</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Home
            </Link>
            {user && (
              <>
                <Link
                  href="/essays"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  My Essays
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Dashboard
                </Link>
              </>
            )}
            <Link
              href="/about"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              About
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm hidden md:inline-block">
                {user.name}
              </span>
              <SignOutButton />
              {user.role === "TEACHER" && (
                <Button variant="default" size="sm" asChild>
                  <Link href="/dashboard/teacher">Teacher Dashboard</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/signin">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 