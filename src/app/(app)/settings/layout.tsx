import { PageHeader } from "@/components/app/page-header";
import { SettingsSubNav } from "@/components/settings/settings-sub-nav";

/**
 * Settings shell — Salesforce Setup pattern. Left sub-nav, right pane.
 *
 * Sub-pages are server components under settings/<section>/page.tsx. Each
 * one fetches just the data it needs (profile, products, users, etc.) so
 * loading is fast and scoped.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Settings"
        subtitle="Profile, team, catalog, AI, and integrations."
      />
      <div className="flex-1 min-h-0 overflow-hidden flex">
        <SettingsSubNav />
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
