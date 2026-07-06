import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PersonDetailView } from "@/components/persons/PersonDetailView";
import {
  getPersonLedger,
  getCreditCandidates,
  buildPersonEvents,
} from "@/lib/persons/queries";

export const dynamic = "force-dynamic";

export default async function PersonneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, candidates] = await Promise.all([
    getPersonLedger(id),
    getCreditCandidates(),
  ]);

  if (!person) notFound();

  const events = buildPersonEvents(person);

  return (
    <>
      <Breadcrumb
        items={[{ label: "Personnes", href: "/personnes" }, { label: person.name }]}
      />
      <div style={{ marginTop: "var(--space-5)" }}>
        <PersonDetailView person={person} events={events} candidates={candidates} />
      </div>
    </>
  );
}
