"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BusinessProfileData {
  companyName: string | null;
  gstin: string | null;
  fssaiNumber: string | null;
  defaultTone: string | null;
  defaultCurrency: string | null;
  pitchOneLiner: string | null;
  brandVoice: string | null;
  inboxKeywords: string[] | null;
}

/**
 * Company identity + brand voice form.
 *
 * The brand-voice textarea is the highest-leverage field on this screen:
 * it's injected into every AI draft's system prompt, so writing real sample
 * phrases here meaningfully changes reply quality.
 */
export function BusinessProfileForm({
  initial,
}: {
  initial: BusinessProfileData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    companyName: initial?.companyName ?? "",
    gstin: initial?.gstin ?? "",
    fssaiNumber: initial?.fssaiNumber ?? "",
    defaultTone: initial?.defaultTone ?? "warm-professional",
    defaultCurrency: initial?.defaultCurrency ?? "INR",
    pitchOneLiner: initial?.pitchOneLiner ?? "",
    brandVoice: initial?.brandVoice ?? "",
    inboxKeywords: (initial?.inboxKeywords ?? ["makhana"]).join(", "),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const body = {
          ...form,
          inboxKeywords: form.inboxKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        };
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
      <Section title="Company">
        <Field
          label="Company name"
          value={form.companyName}
          onChange={(v) => setForm((f) => ({ ...f, companyName: v }))}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="GSTIN"
            value={form.gstin}
            onChange={(v) => setForm((f) => ({ ...f, gstin: v }))}
          />
          <Field
            label="FSSAI number"
            value={form.fssaiNumber}
            onChange={(v) => setForm((f) => ({ ...f, fssaiNumber: v }))}
          />
        </div>
        <Field
          label="Pitch one-liner"
          value={form.pitchOneLiner}
          onChange={(v) => setForm((f) => ({ ...f, pitchOneLiner: v }))}
          hint="Used in every AI draft. One sentence that says what you sell and to whom."
        />
      </Section>

      <Section title="Voice & tone">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Default tone"
            value={form.defaultTone}
            onChange={(v) => setForm((f) => ({ ...f, defaultTone: v }))}
          />
          <Field
            label="Default currency"
            value={form.defaultCurrency}
            onChange={(v) => setForm((f) => ({ ...f, defaultCurrency: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-eyebrow">Brand voice — how we actually write</label>
          <textarea
            value={form.brandVoice}
            onChange={(e) =>
              setForm((f) => ({ ...f, brandVoice: e.target.value }))
            }
            rows={7}
            placeholder={`Sample phrases the AI should copy. 5–10 sentences in your own voice. Mix English / Hindi / Hinglish exactly how you'd type them. Example:

"Namaste sir, thanks for reaching out about our 4-suta."
"Sample bhej dete hain, address share kar dijiye."
"Pricing FOB Delhi hai, GST extra. 50% advance pe dispatch karte hain."

The more specific, the better — this becomes the AI's voice.`}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] font-mono leading-relaxed shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-meta">
            Fed into every draft. Skip generic adjectives — write actual sentences
            you'd send. Mixing languages is encouraged.
          </p>
        </div>
      </Section>

      <Section title="Inbox filter">
        <Field
          label="Inbox keywords"
          value={form.inboxKeywords}
          onChange={(v) => setForm((f) => ({ ...f, inboxKeywords: v }))}
          hint="Comma-separated. Only emails matching these keywords enter the CRM."
          placeholder="makhana, white pops, fox nut"
        />
      </Section>

      <FormActions
        onSave={handleSave}
        isPending={isPending}
        error={error}
        saved={saved}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Layout primitives (shared with AI providers form)
// ────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-eyebrow">{title}</h3>
      <div className="space-y-3 rounded-lg border bg-card p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-eyebrow">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-[14px]"
      />
      {hint ? <p className="text-meta">{hint}</p> : null}
    </div>
  );
}

function FormActions({
  onSave,
  isPending,
  error,
  saved,
}: {
  onSave: () => void;
  isPending: boolean;
  error: string | null;
  saved: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button size="sm" onClick={onSave} disabled={isPending}>
        <Save className="h-3.5 w-3.5 mr-1" />
        {isPending ? "Saving…" : "Save changes"}
      </Button>
      {saved ? (
        <span className="text-meta text-primary">Saved</span>
      ) : error ? (
        <span className="text-meta text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
