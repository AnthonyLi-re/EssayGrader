import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t bg-background py-6">
      <div className="container px-4 md:flex md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} EssayGrader. All rights reserved.
          </p>
        </div>
        <div className="mt-4 flex justify-center space-x-6 md:mt-0">
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
} 