import { db } from "@/db";
import { TeamManager } from "@/components/settings/team-manager";
import { getBusinessProfile } from "@/lib/business-profile";

export const dynamic = "force-dynamic";

export default async function SettingsTeamPage() {
  const [profile, allUsers] = await Promise.all([
    getBusinessProfile(),
    db.query.users.findMany(),
  ]);
  return (
    <div className="space-y-4">
      <header>
        <h1>Team</h1>
        <p className="text-meta">
          Invite people by email and assign roles. Only invited addresses can
          sign in.
        </p>
      </header>
      <TeamManager
        initial={{
          users: allUsers,
          allowedEmails: profile?.allowedEmails ?? [],
        }}
      />
    </div>
  );
}
