"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function ThreadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-base font-semibold">Could not load thread</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <div className="flex items-center gap-2 justify-center">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Link href="/inbox">
            <Button variant="ghost">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to inbox
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
