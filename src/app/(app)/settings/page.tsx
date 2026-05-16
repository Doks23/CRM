import Link from "next/link";
import {
  Building2,
  Mail,
  Sparkles,
  Users,
  Package,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { getBusinessProfile } from "@/lib/business-profile";
import { getAiCostCapStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [session, profile, gmailAccount, capStatus] = await Promise.all([
    auth(),
    getBusinessProfile(),
    db.query.gmailAccount.findFirst(),
    getAiCostCapStatus(),
  ]);

  const isOwner = session?.user?.role === "owner";

  const sections = [
    {
      href: "/settings/profile",
      icon: Building2,
      title: "Company & voice",
      desc: "Brand identity, FSSAI / GSTIN, tone, and the pitch Saathi uses in every draft.",
      badge: profile.companyName ? profile.companyName : "Not configured",
      status: (profile.companyName ? "ok" : "warn") as "ok" | "warn",
    },
    {
      href: "/settings/gmail",
      icon: Mail,
      title: "Gmail connection",
      desc: "Shared inbox the CRM reads from and drafts back into.",
      badge: gmailAccount ? gmailAccount.email : "Not connected",
      status: (gmailAccount ? "ok" : "warn") as "ok" | "warn",
    },
    {
      href: "/settings/ai",
      icon: Sparkles,
      title: "AI providers",
      desc: "Choose the LLM that classifies emails and the LLM that writes drafts.",
      badge: profile.classifierProvider
        ? `${profile.classifierProvider} · ${profile.drafterProvider ?? ""}`
        : "Default providers",
      status: "ok" as const,
    },
    {
      href: "/settings/team",
      icon: Users,
      title: "Team & roles",
      desc: "Invite team members, set roles (Owner / Sales / Production), and manage access.",
      badge: "Manage",
      status: "ok" as const,
    },
    {
      href: "/settings/products",
      icon: Package,
      title: "Products & SKUs",
      desc: "Catalog fed to the AI when drafting replies — grades, MOQ, pricing.",
      badge: "Manage",
      status: "ok" as const,
    },
    {
      href: "/settings/greetings",
      icon: MessageSquare,
      title: "Greetings & signatures",
      desc: "Opening lines and closings per language. Saathi samples these when drafting.",
      badge: "Manage",
      status: "ok" as const,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="serif text-[26px] leading-tight -tracking-[0.015em]">
          Overview
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          Tune Saathi to your business. Click any section to edit.
        </p>
      </div>

      {/* Quick status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickStat
          label="Gmail"
          value={gmailAccount ? "Connected" : "Not connected"}
          tone={gmailAccount ? "pos" : "warn"}
        />
        <QuickStat
          label="AI daily cap"
          value={
            capStatus.unlimited
              ? "No cap set"
              : `₹${capStatus.spentInr.toFixed(0)} / ₹${capStatus.capInr.toFixed(0)}`
          }
          tone={
            !capStatus.unlimited && capStatus.spentInr >= capStatus.capInr
              ? "warn"
              : "pos"
          }
        />
        <QuickStat
          label="Your role"
          value={session?.user?.role ?? "—"}
          tone="pos"
        />
      </div>

      {/* Section cards */}
      <div className="space-y-2">
        {sections.map((s) => {
          if (!isOwner && ["gmail", "ai"].some((k) => s.href.includes(k))) {
            return null;
          }
          return <SectionCard key={s.href} {...s} />;
        })}
      </div>

      {!isOwner && (
        <p className="text-[12px] text-muted-foreground px-1">
          Gmail and AI settings are visible to Owners only.
        </p>
      )}
    </div>
  );
}

function QuickStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "pos" | "warn" | "default";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1">
        {label}
      </div>
      <div
        className={`text-[14px] font-semibold ${
          tone === "pos"
            ? "text-pos"
            : tone === "warn"
              ? "text-warn"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  href,
  icon: Icon,
  title,
  desc,
  badge,
  status,
}: {
  href: string;
  icon: typeof Building2;
  title: string;
  desc: string;
  badge: string;
  status: "ok" | "warn";
}) {
  return (
    <Link href={href} className="block group">
      <Card className="px-5 py-4 gap-0 hover:border-primary/30 transition-colors">
        <div className="flex items-center gap-4">
          <div className="size-9 rounded-lg bg-surface-2 grid place-items-center shrink-0">
            <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold">{title}</span>
              <Badge
                variant="outline"
                className="text-[11px] font-normal rounded"
              >
                {badge}
              </Badge>
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-[1.4]">
              {desc}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status === "ok" ? (
              <CheckCircle2 className="size-4 text-pos" />
            ) : (
              <AlertCircle className="size-4 text-warn" />
            )}
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
