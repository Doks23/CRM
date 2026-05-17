import { redirect } from "next/navigation";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { getBusinessProfile } from "@/lib/business-profile";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/settings");

  const profile = await getBusinessProfile();
  return (
    <div className="space-y-4">
      <header>
        <h1>Company &amp; voice</h1>
        <p className="text-meta">
          Brand identity, FSSAI / GSTIN, and the voice file the AI uses on every
          draft.
        </p>
      </header>
      <BusinessProfileForm
        initial={{
          companyName: profile.companyName,
          gstin: profile.gstin,
          fssaiNumber: profile.fssaiNumber,
          defaultTone: profile.defaultTone,
          defaultCurrency: profile.defaultCurrency,
          pitchOneLiner: profile.pitchOneLiner,
          brandVoice: profile.brandVoice,
          inboxKeywords: profile.inboxKeywords ?? [],
          logoUrl: profile.logoUrl,
        }}
      />
    </div>
  );
}
