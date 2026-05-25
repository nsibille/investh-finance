"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="btn-icon-md"
        aria-label="Se déconnecter"
        title="Se déconnecter"
      >
        <LogOut size={16} aria-hidden />
      </button>
    </form>
  );
}
