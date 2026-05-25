import { SignOutButton } from "@/components/auth/SignOutButton";

interface HeaderProps {
  email: string;
  avatarUrl?: string | null;
}

function initialFromEmail(email: string) {
  return email.charAt(0).toUpperCase() || "?";
}

export function Header({ email, avatarUrl }: HeaderProps) {
  return (
    <header className="nav-header">
      <div className="nav-header__left">
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          {email}
        </span>
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
        <SignOutButton />
      </div>
    </header>
  );
}
