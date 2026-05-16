import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/app/brand-mark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/inbox");

  const { error } = await searchParams;
  const errorMessage =
    error === "deactivated"
      ? "Your account has been deactivated. Please contact the owner."
      : error === "pending_approval"
        ? "Your account is pending approval. The owner will activate it shortly."
        : error === "AccessDenied"
          ? "This Google account is not on the invite list."
          : error
            ? "Sign-in failed. Please try again."
            : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-emerald-50/30 to-white dark:from-zinc-950 dark:via-emerald-950/20 dark:to-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-7">
          <BrandMark size={80} withWordmark layout="stacked" />
        </div>

        <p className="text-center text-meta mb-5">
          Sign in with the Google account on your invite.
        </p>

        <Card className="shadow-sm border-zinc-200/80 dark:border-zinc-800/80">
          <CardContent className="pt-6 pb-6 px-6">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <Button
                type="submit"
                className="w-full h-11 font-medium"
                size="lg"
              >
                <GoogleGlyph />
                Continue with Google
              </Button>
            </form>

            {errorMessage ? (
              <p className="mt-4 text-sm text-destructive text-center">
                {errorMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Only invited team members can access. The owner manages the allowlist
          in <span className="text-foreground">Settings → Team</span>.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382c-.232 1.25-.937 2.31-1.997 3.018v2.51h3.232c1.892-1.742 2.983-4.305 2.983-7.351z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.617-2.422l-3.232-2.51c-.895.6-2.04.955-3.385.955-2.605 0-4.81-1.76-5.596-4.124H3.064v2.59A9.996 9.996 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.404 13.9a6.006 6.006 0 0 1 0-3.8V7.51H3.064a10.005 10.005 0 0 0 0 8.98l3.34-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.47 0 2.787.505 3.823 1.496l2.867-2.867C16.96 3.044 14.695 2 12 2A9.996 9.996 0 0 0 3.064 7.51l3.34 2.59C7.19 7.737 9.395 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}
