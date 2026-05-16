import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { defaultModels, providerModels } from "@/lib/ai";

export default async function SettingsPage() {
  const session = await auth();
  const isOwner = session?.user.role === "owner";

  return (
    <div className="p-8 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connections, team, catalog, AI providers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gmail connection</CardTitle>
            <Badge variant="outline" className="font-normal">
              Milestone 1
            </Badge>
          </div>
          <CardDescription>
            Shared inbox the CRM reads from and drafts back into.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Owner-only action. The Connect button lands here in Milestone 1. Initial account: doks23@gmail.com."
              : "Only the Owner can connect the shared Gmail account."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI providers</CardTitle>
            <Badge variant="outline" className="font-normal">
              Milestones 2–3
            </Badge>
          </div>
          <CardDescription>
            Pick the LLM that classifies emails and the LLM that drafts replies.
            Swap freely; no code change required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <ProviderCard
              label="Classifier"
              provider={defaultModels.classifier.provider}
              model={defaultModels.classifier.model}
              note="Cheap + fast; tags every inbound email."
            />
            <ProviderCard
              label="Drafter"
              provider={defaultModels.drafter.provider}
              model={defaultModels.drafter.model}
              note="Higher-quality model; writes the reply you review."
            />
          </div>

          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <div className="font-medium text-foreground">Available providers</div>
            {(["gemini", "openai", "ollama"] as const).map((p) => (
              <div key={p} className="flex flex-wrap gap-1 items-center">
                <span className="capitalize font-medium text-foreground w-16">
                  {p}
                </span>
                <span>classifier:</span>
                {providerModels[p].classifier.map((m) => (
                  <code
                    key={m}
                    className="px-1 py-0.5 rounded bg-background text-[10px]"
                  >
                    {m}
                  </code>
                ))}
                <span className="ml-1">drafter:</span>
                {providerModels[p].drafter.map((m) => (
                  <code
                    key={m}
                    className="px-1 py-0.5 rounded bg-background text-[10px]"
                  >
                    {m}
                  </code>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team members</CardTitle>
            <Badge variant="outline" className="font-normal">
              Milestone 4
            </Badge>
          </div>
          <CardDescription>
            Invite team members and assign roles (Owner / Sales / Production).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For now, add team emails directly to the{" "}
            <code className="px-1 py-0.5 rounded bg-muted text-xs">
              allowlist
            </code>{" "}
            table via the seed script.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product catalog</CardTitle>
            <Badge variant="outline" className="font-normal">
              Milestone 4
            </Badge>
          </div>
          <CardDescription>
            SKUs, grades, MOQ, pricing — fed into the AI when drafting replies.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Business profile</CardTitle>
            <Badge variant="outline" className="font-normal">
              Milestone 2
            </Badge>
          </div>
          <CardDescription>
            Company name, GSTIN, FSSAI, certifications, default tone — used in
            AI prompts.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function ProviderCard({
  label,
  provider,
  model,
  note,
}: {
  label: string;
  provider: string;
  model: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Badge className="capitalize">{provider}</Badge>
      </div>
      <div className="font-mono text-sm">{model}</div>
      <div className="text-xs text-muted-foreground mt-1.5">{note}</div>
    </div>
  );
}
