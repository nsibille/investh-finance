import { SignOutButton } from "@/components/auth/SignOutButton";
import { SearchTrigger } from "@/components/search/SearchTrigger";

interface HeaderProps {
  email: string;
  avatarUrl?: string | null;
  /** Affiche le bouton de déconnexion. Masqué en mode libre accès. */
  showSignOut?: boolean;
}

function initialFromEmail(email: string) {
  return email.charAt(0).toUpperCase() || "?";
}

export function Header({ email, avatarUrl, showSignOut = true }: HeaderProps) {
  return (
    <header className="nav-header">
      <div className="nav-header__left">
        <SearchTrigger />
      </div>
      <div className="nav-header__right">
        <span className="avatar-md" title={email}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            initialFromEmail(email)
          )}
        </span>
        {showSignOut && <SignOutButton />}
      </div>
    </header>
  );
}
