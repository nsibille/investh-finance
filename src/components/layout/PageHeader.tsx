import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="layout-page-header">
      <div>
        <h1 className="layout-page-header__title">{title}</h1>
        {subtitle && <p className="layout-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="layout-page-header__actions">{actions}</div>}
    </div>
  );
}
