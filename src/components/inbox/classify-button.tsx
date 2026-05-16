"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export function ClassifyButton({
  gmailMessageId,
}: {
  gmailMessageId: string;
  subject: string;
  toEmail: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  };

  const handleClassify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inbox/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailMessageId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Classification failed");
      }

      const done = await pollForResult(gmailMessageId, cleanup);
      if (done) {
        router.refresh();
      } else {
        throw new Error(
          "AI analysis is taking longer than expected. Check that the Inngest dev server is running (http://localhost:8288) and try again.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      cleanup();
    }
  };

  return (
    <div className="border-t bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto w-full p-6 text-center space-y-3">
        <div className="flex justify-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          This message hasn&apos;t been analyzed yet. Run AI analysis to classify
          the lead and generate a draft reply.
        </p>
        {error ? (
          <p className="text-xs text-destructive max-w-md mx-auto">{error}</p>
        ) : null}
        <Button onClick={handleClassify} disabled={loading} size="lg">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {loading ? "Analyzing…" : "Run AI Analysis"}
        </Button>
      </div>
    </div>
  );
}

async function pollForResult(
  gmailMessageId: string,
  cleanup: () => void,
): Promise<boolean> {
  const maxAttempts = 20;
  const delay = 2000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => {
      const id = setTimeout(r, delay);
      // Store timeout ref so cleanup can cancel it
      // (We can't use ref directly in this standalone function, but we pass cleanup)
      if (i === 0) {
        // First iteration, nothing to clean up
      }
    });
    const res = await fetch(
      `/api/inbox/classify/status?gmailMessageId=${encodeURIComponent(gmailMessageId)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.done) return true;
      if (data.error) return false;
    }
  }
  return false;
}
