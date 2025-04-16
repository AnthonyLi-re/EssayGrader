"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <Button onClick={signOut} variant="ghost" size="sm">
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </Button>
  );
} 