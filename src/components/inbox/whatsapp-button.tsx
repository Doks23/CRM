"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Pencil, Save, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
  phone: string | null;
  contactName: string | null;
  companyName: string;
  language: "en" | "hi" | "hinglish" | null;
}

/**
 * "Continue on WhatsApp" button — most Indian B2B Makhana conversations
 * convert there, not on email. Opens https://wa.me/<phone>?text=<prefill>
 * in a new tab. Inline edit when no phone is set.
 *
 * Phone normalisation: strips non-digits and prepends 91 (India) when the
 * remaining digits don't include a country code. WhatsApp's wa.me URL
 * requires E.164 without the leading +.
 */
export function WhatsAppButton({
  leadId,
  phone,
  contactName,
  companyName,
  language,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = normaliseIndianPhone(phone);

  async function savePhone() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: draftPhone.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={draftPhone}
          onChange={(e) => setDraftPhone(e.target.value)}
          placeholder="+91 98xxxxxxxx"
          className="h-8 w-44 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") void savePhone();
            if (e.key === "Escape") {
              setEditing(false);
              setDraftPhone(phone ?? "");
            }
          }}
        />
        <Button size="sm" onClick={savePhone} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setDraftPhone(phone ?? "");
            setError(null);
          }}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        {error ? (
          <span className="text-[11px] text-destructive">{error}</span>
        ) : null}
      </div>
    );
  }

  if (!normalised) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setEditing(true)}
        title="Add phone number to enable WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
        Add WhatsApp number
      </Button>
    );
  }

  const prefill = buildPrefill({ contactName, companyName, language });
  const href = `https://wa.me/${normalised}?text=${encodeURIComponent(prefill)}`;

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ size: "sm" }),
          "no-underline bg-[#25D366] hover:bg-[#1eb358] text-white border-[#1eb358]",
        )}
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
        Continue on WhatsApp
      </a>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        title={phone ?? ""}
      >
        <Pencil className="h-3 w-3" />
        edit
      </button>
    </div>
  );
}

function normaliseIndianPhone(raw: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Strip a leading 0 (legacy STD code) before country code logic.
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  // If already E.164 (starts with country code) — sanity check length.
  if (digits.length >= 11 && digits.length <= 15) return digits;
  // Plain 10-digit Indian mobile → prepend 91.
  if (digits.length === 10) return "91" + digits;
  return null;
}

function buildPrefill({
  contactName,
  companyName,
  language,
}: {
  contactName: string | null;
  companyName: string;
  language: "en" | "hi" | "hinglish" | null;
}): string {
  const firstName = contactName?.split(/\s+/)[0];
  if (language === "hi") {
    return firstName
      ? `नमस्ते ${firstName} जी, मैं ${companyName} से बात कर रहा हूँ — आपकी पूछताछ के सिलसिले में।`
      : `नमस्ते, मैं ${companyName} से बात कर रहा हूँ — आपकी पूछताछ के सिलसिले में।`;
  }
  if (language === "hinglish") {
    return firstName
      ? `Hi ${firstName} ji, ${companyName} se baat kar raha hoon — aapki inquiry ke regarding.`
      : `Hi, ${companyName} se baat kar raha hoon — aapki inquiry ke regarding.`;
  }
  return firstName
    ? `Hi ${firstName}, this is ${companyName} — following up on your inquiry.`
    : `Hi, this is ${companyName} — following up on your inquiry.`;
}
