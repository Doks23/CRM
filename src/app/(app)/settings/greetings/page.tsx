import { FestiveDatesEditor } from "@/components/settings/festive-dates-editor";
import { getBusinessProfile } from "@/lib/business-profile";

export const dynamic = "force-dynamic";

export default async function SettingsGreetingsPage() {
  const profile = await getBusinessProfile();
  return (
    <div className="space-y-4">
      <header>
        <h1>Festive greetings</h1>
        <p className="text-meta">
          On these dates the CRM auto-drafts a personalised greeting for every
          active lead. You review and send — same flow as a reply.
        </p>
      </header>
      <FestiveDatesEditor initial={profile?.festiveDates ?? []} />
    </div>
  );
}
