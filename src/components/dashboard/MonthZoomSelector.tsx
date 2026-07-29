"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Sélecteur de zoom du dashboard : « Année » (année glissante entière, défaut)
 * ou l'un des 12 derniers mois. Pilote le paramètre `zoom` de l'URL ; toute la
 * page s'adapte au mois choisi.
 */
export function MonthZoomSelector({
  months,
  labels,
  zoom,
}: {
  months: string[]; // 12 clés YYYY-MM (chronologique)
  labels: string[]; // libellés courts alignés
  zoom: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("zoom", next);
    else sp.delete("zoom");
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const year = (k: string) => k.slice(2, 4);

  return (
    <div className="month-zoom" role="group" aria-label="Zoom sur la période">
      <button
        type="button"
        className="month-zoom__chip"
        data-active={zoom === null || undefined}
        onClick={() => go(null)}
      >
        Année
      </button>
      {months.map((m, i) => (
        <button
          key={m}
          type="button"
          className="month-zoom__chip"
          data-active={zoom === m || undefined}
          onClick={() => go(zoom === m ? null : m)}
          title={m}
        >
          {labels[i]}
          <span className="month-zoom__year">{year(m)}</span>
        </button>
      ))}
    </div>
  );
}
