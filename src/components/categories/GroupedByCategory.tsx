import type { ReactNode } from "react";
import { Dot, CountBadge } from "@/components/ui/Badge";
import type { TypeGroup } from "@/lib/categories/group";

/**
 * Rendu générique d'items regroupés par catégorie en respectant la hiérarchie
 * Type → Catégorie. `renderTable` reçoit les items d'une catégorie et retourne
 * la table correspondante (`table-transactions` ou variante).
 */
export function GroupedByCategory<T>({
  groups,
  renderTable,
}: {
  groups: TypeGroup<T>[];
  renderTable: (items: T[]) => ReactNode;
}) {
  return (
    <div className="category-groups">
      {groups.map((type) => (
        <section className="category-group" key={type.typeName}>
          <h2 className="category-group__type">{type.typeName}</h2>
          {type.categories.map((cat) => (
            <div className="category-group__cat" key={cat.categoryName || "—"}>
              {cat.categoryName && (
                <div className="category-group__cat-head">
                  <Dot color={cat.categoryColor ?? undefined} />
                  <span className="category-group__cat-name">{cat.categoryName}</span>
                  <CountBadge count={cat.items.length} />
                </div>
              )}
              {renderTable(cat.items)}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
