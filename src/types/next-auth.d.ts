import "next-auth";

declare module "next-auth" {
  type Role = "owner" | "sales" | "production";

  interface Session {
    user: {
      id: string;
      role: Role;
      active: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      avatarUrl?: string | null;
    };
  }

  interface User {
    role?: Role;
    active?: boolean;
  }
}
