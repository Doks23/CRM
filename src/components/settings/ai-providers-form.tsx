"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AIProvidersData {
  classifierProvider: string | null;
  classifierModel: string | null;
  drafterProvider: string | null;
  drafterModel: string | null;
}

const PROVIDERS = ["gemini", "openai", "ollama"] as const;
const MODELS: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
  ollama: ["llama3.1:8b", "llama3.1:70b", "qwen2.5:7b", "qwen2.5:14b"],
};

const TASK_DESCRIPTIONS = {
  classifier:
    "Tags every inbound email by category, type, and language. Should be fast and cheap.",
  drafter:
    "Writes the reply the team reviews. Higher quality is worth a bigger model.",
};

/**
 * Picks the LLM that classifies emails vs. the LLM that writes drafts.
 * Swap freely — no code changes required.
 */
export function AIProvidersForm({
  initial,
}: {
  initial: AIProvidersData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    classifierProvider: initial?.classifierProvider ?? "gemini",
    classifierModel: initial?.classifierModel ?? "gemini-2.5-flash",
    drafterProvider: initial?.drafterProvider ?? "gemini",
    drafterModel: initial?.drafterModel ?? "gemini-2.5-flash",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Failed");
        }
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-5">
      <ProviderRow
        task="classifier"
        title="Classifier"
        provider={form.classifierProvider}
        model={form.classifierModel}
        onProviderChange={(p) =>
          setForm((f) => ({
            ...f,
            classifierProvider: p,
            classifierModel: MODELS[p]?.[0] ?? f.classifierModel,
          }))
        }
        onModelChange={(m) =>
          setForm((f) => ({ ...f, classifierModel: m }))
        }
      />
      <ProviderRow
        task="drafter"
        title="Drafter"
        provider={form.drafterProvider}
        model={form.drafterModel}
        onProviderChange={(p) =>
          setForm((f) => ({
            ...f,
            drafterProvider: p,
            drafterModel: MODELS[p]?.[0] ?? f.drafterModel,
          }))
        }
        onModelChange={(m) => setForm((f) => ({ ...f, drafterModel: m }))}
      />

      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {saved ? (
          <span className="text-meta text-primary">Saved</span>
        ) : error ? (
          <span className="text-meta text-destructive">{error}</span>
        ) : null}
      </div>
    </div>
  );
}

function ProviderRow({
  task,
  title,
  provider,
  model,
  onProviderChange,
  onModelChange,
}: {
  task: "classifier" | "drafter";
  title: string;
  provider: string;
  model: string;
  onProviderChange: (p: string) => void;
  onModelChange: (m: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <Badge variant="outline" className="text-[11px] py-0 h-4 capitalize">
          {provider}
        </Badge>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-meta">{TASK_DESCRIPTIONS[task]}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Select
            label="Provider"
            value={provider}
            options={PROVIDERS.map((p) => ({ value: p, label: p }))}
            onChange={onProviderChange}
            capitalize
          />
          <Select
            label="Model"
            value={model}
            options={(MODELS[provider] ?? []).map((m) => ({
              value: m,
              label: m,
            }))}
            onChange={onModelChange}
            mono
          />
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  capitalize,
  mono,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  capitalize?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-eyebrow">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-8 w-full rounded-md border border-input bg-background px-2 text-[14px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          capitalize && "capitalize",
          mono && "font-mono",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
