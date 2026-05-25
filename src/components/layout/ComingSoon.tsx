import { Hammer } from "lucide-react";

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="card-surface">
      <div className="empty-state">
        <Hammer className="empty-state__icon" aria-hidden />
        <p className="empty-state__title">{feature} — bientôt disponible</p>
        <p className="empty-state__description">
          Cette section sera implémentée dans une prochaine étape.
        </p>
      </div>
    </div>
  );
}
