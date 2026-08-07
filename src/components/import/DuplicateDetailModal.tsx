"use client";

import { Modal } from "@/components/ui/Modal";
import { Amount } from "@/components/ui/Amount";
import { formatShortDate, formatMonthLabel } from "@/lib/format/date";
import type { DuplicateMatch } from "@/lib/import/dedup";

interface CandidateInfo {
  operation_date: string;
  amount: number;
  currency: string;
  label: string;
  raw_label: string;
}

/** Bloc « une opération » : date, montant, libellé affiché + libellé brut. */
function OperationCard({
  title,
  accent,
  date,
  amount,
  currency,
  label,
  rawLabel,
}: {
  title: string;
  accent: "candidate" | "existing";
  date: string;
  amount: number;
  currency: string;
  label: string;
  rawLabel?: string | null;
}) {
  return (
    <div className={`dup-detail__op dup-detail__op--${accent}`}>
      <span className="dup-detail__op-title">{title}</span>
      <div className="dup-detail__op-head">
        <span className="dup-detail__op-date">{formatShortDate(date)}</span>
        <Amount value={amount} currency={currency} size="md" />
      </div>
      <span className="dup-detail__op-label">{label}</span>
      {rawLabel && rawLabel !== label && (
        <span className="dup-detail__op-raw">{rawLabel}</span>
      )}
    </div>
  );
}

/**
 * Détail de la similitude qui a fait détecter une ligne d'import comme doublon :
 * l'opération importée face à celle déjà en base, et la raison du rapprochement
 * (empreinte exacte, même compte/date/montant + libellé, ou rapprochement au
 * mois pour une carte à débit différé).
 */
export function DuplicateDetailModal({
  open,
  onClose,
  candidate,
  match,
  forced,
}: {
  open: boolean;
  onClose: () => void;
  candidate: CandidateInfo | null;
  match: DuplicateMatch | null;
  /** La ligne a été ré-incluse manuellement (faux positif déflagué). */
  forced?: boolean;
}) {
  if (!candidate || !match) return null;

  const grain = match.monthly ? "au mois" : "au jour";
  const existing = match.existing;
  const datesDiffer =
    existing != null && existing.operation_date !== candidate.operation_date;

  let reason: string;
  if (match.kind === "hash") {
    reason =
      "Empreinte identique : même libellé, même date et même montant sur ce compte. C'est le ré-import de la même opération (même source).";
  } else if (match.kind === "content") {
    reason = match.monthly
      ? "Même compte, même mois et même montant, avec un libellé compatible. Comparaison au mois car ce compte est une carte à débit différé (la date peut varier au sein du mois)."
      : "Même compte, même date et même montant, avec un libellé compatible : la même opération, importée par une autre source (libellé/empreinte différents).";
  } else {
    reason = match.monthly
      ? "Même compte, même mois et même montant, mais des libellés sans terme distinctif commun — rapproché sur la seule signature compte · mois · montant (carte à débit différé)."
      : "Même compte, même date et même montant, mais des libellés sans terme distinctif commun — rapproché sur la seule signature compte · date · montant.";
  }

  return (
    <Modal open={open} onClose={onClose} title="Détail du doublon détecté">
      <div className="dup-detail">
        <p className="dup-detail__lede">
          Cette opération a été détectée comme déjà présente en base
          (comparaison <strong>{grain}</strong>).
          {forced
            ? " Vous l'avez ré-incluse : elle sera tout de même importée."
            : " Elle est décochée par défaut et ne sera pas ré-importée."}
        </p>

        <div className="dup-detail__grid">
          <OperationCard
            title="Ligne importée"
            accent="candidate"
            date={candidate.operation_date}
            amount={candidate.amount}
            currency={candidate.currency}
            label={candidate.label}
            rawLabel={candidate.raw_label}
          />
          {existing ? (
            <OperationCard
              title="Déjà en base"
              accent="existing"
              date={existing.operation_date}
              amount={existing.amount}
              currency={candidate.currency}
              label={existing.label}
            />
          ) : (
            <div className="dup-detail__op dup-detail__op--existing">
              <span className="dup-detail__op-title">Déjà en base</span>
              <span className="dup-detail__op-raw">
                Opération présente en base (hors de la fenêtre de comparaison
                affichée).
              </span>
            </div>
          )}
        </div>

        <div className="dup-detail__reason">
          <span className="dup-detail__reason-title">Pourquoi ce rapprochement</span>
          <p className="dup-detail__reason-text">{reason}</p>

          <ul className="dup-detail__facts">
            <li>
              <span className="dup-detail__fact-key">Montant</span>
              <span className="dup-detail__fact-val">identique</span>
            </li>
            <li>
              <span className="dup-detail__fact-key">
                {match.monthly ? "Mois" : "Date"}
              </span>
              <span className="dup-detail__fact-val">
                {match.monthly && existing
                  ? formatMonthLabel(existing.operation_date)
                  : "identique"}
                {datesDiffer && (
                  <em className="dup-detail__fact-note">
                    {" "}
                    (dates différentes : {formatShortDate(candidate.operation_date)} vs{" "}
                    {formatShortDate(existing!.operation_date)})
                  </em>
                )}
              </span>
            </li>
            <li>
              <span className="dup-detail__fact-key">Libellé</span>
              <span className="dup-detail__fact-val">
                {match.kind === "hash"
                  ? "identique"
                  : match.sharedTokens.length > 0
                    ? "termes communs"
                    : "aucun terme commun"}
              </span>
            </li>
          </ul>

          {match.sharedTokens.length > 0 && (
            <div className="dup-detail__tokens">
              {match.sharedTokens.map((t) => (
                <span key={t} className="dup-detail__token">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
