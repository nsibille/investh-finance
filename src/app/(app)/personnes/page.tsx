import { PageHeader } from "@/components/layout/PageHeader";
import { PersonsManager } from "@/components/persons/PersonsManager";
import { getPersonsLedger, getCreditCandidates } from "@/lib/persons/queries";

export const dynamic = "force-dynamic";

export default async function PersonnesPage() {
  const [persons, creditCandidates] = await Promise.all([
    getPersonsLedger(),
    getCreditCandidates(),
  ]);

  return (
    <>
      <PageHeader
        title="Personnes"
        subtitle="Partage des transactions (dettes, cadeaux), suivi des créances et des remboursements par personne."
      />
      <PersonsManager persons={persons} creditCandidates={creditCandidates} />
    </>
  );
}
