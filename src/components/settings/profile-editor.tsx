"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";

interface ProfileData {
  companyName: string | null;
  gstin: string | null;
  fssaiNumber: string | null;
  defaultTone: string | null;
  defaultCurrency: string | null;
  pitchOneLiner: string | null;
  brandVoice: string | null;
  inboxKeywords: string[] | null;
  classifierProvider: string | null;
  classifierModel: string | null;
  drafterProvider: string | null;
  drafterModel: string | null;
}

export function ProfileEditor({ initial }: { initial: ProfileData | null }) {
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
    classifierProvider: initial?.classifierProvider ?? "gemini",
    classifierModel: initial?.classifierModel ?? "gemini-2.5-flash",
    drafterProvider: initial?.drafterProvider ?? "gemini",
    drafterModel: initial?.drafterModel ?? "gemini-2.5-flash",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setError(null); setSaved(false);
    startTransition(async () => {
      try {
        const body = {
          ...form,
          inboxKeywords: form.inboxKeywords.split(",").map(k => k.trim()).filter(Boolean),
        };
        const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        setSaved(true); router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  };

  const PROVIDERS = ["gemini", "openai", "ollama"] as const;
  const MODELS: Record<string, string[]> = {
    gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
    ollama: ["llama3.1:8b", "llama3.1:70b", "qwen2.5:7b", "qwen2.5:14b"],
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Company name</label>
          <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">GSTIN</label>
          <Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">FSSAI number</label>
          <Input value={form.fssaiNumber} onChange={e => setForm(f => ({ ...f, fssaiNumber: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Default tone</label>
          <Input value={form.defaultTone} onChange={e => setForm(f => ({ ...f, defaultTone: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Default currency</label>
          <Input value={form.defaultCurrency} onChange={e => setForm(f => ({ ...f, defaultCurrency: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Inbox keywords</label>
          <Input
            value={form.inboxKeywords}
            onChange={e => setForm(f => ({ ...f, inboxKeywords: e.target.value }))}
            placeholder="makhana, white pops, fox nut"
          />
          <p className="text-[11px] text-muted-foreground">
            Comma-separated. Only emails matching these keywords enter the CRM.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium">Pitch one-liner</label>
          <Input value={form.pitchOneLiner} onChange={e => setForm(f => ({ ...f, pitchOneLiner: e.target.value }))} />
        </div>
      </div>

      <div className="border-t pt-4 space-y-1.5">
        <label className="text-xs font-medium">Brand voice <span className="text-muted-foreground font-normal">— how we actually write</span></label>
        <textarea
          value={form.brandVoice}
          onChange={(e) => setForm((f) => ({ ...f, brandVoice: e.target.value }))}
          rows={7}
          placeholder={`Sample phrases the AI should copy. 5–10 sentences in your own voice. Mix English / Hindi / Hinglish exactly how you'd type them. Example:

"Namaste sir, thanks for reaching out about our 4-suta."
"Sample bhej dete hain, address share kar dijiye."
"Pricing FOB Delhi hai, GST extra. 50% advance pe dispatch karte hain."
"For export buyers we share COA + phytosanitary upfront."

The more specific, the better — this becomes the AI's voice.`}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono leading-relaxed shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="text-[12px] text-muted-foreground">
          Fed into every draft. Skip generic adjectives — write actual sentences you'd send. Mixing languages is encouraged.
        </p>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-3">AI providers</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium">Classifier</label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.classifierProvider} onChange={e => setForm(f => ({ ...f, classifierProvider: e.target.value, classifierModel: MODELS[e.target.value]?.[0] ?? f.classifierModel }))}>
              {PROVIDERS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono" value={form.classifierModel} onChange={e => setForm(f => ({ ...f, classifierModel: e.target.value }))}>
              {(MODELS[form.classifierProvider] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Drafter</label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.drafterProvider} onChange={e => setForm(f => ({ ...f, drafterProvider: e.target.value, drafterModel: MODELS[e.target.value]?.[0] ?? f.drafterModel }))}>
              {PROVIDERS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono" value={form.drafterModel} onChange={e => setForm(f => ({ ...f, drafterModel: e.target.value }))}>
              {(MODELS[form.drafterProvider] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </div>
  );
}
