import { auth } from "@/auth";
import { UserMenuClient } from "./user-menu-client";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const { name, email, image, role } = session.user;
  return (
    <UserMenuClient
      name={name ?? null}
      email={email ?? null}
      image={image ?? null}
      role={role}
    />
  );
}
