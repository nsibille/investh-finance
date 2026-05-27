"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import {
  Input,
  SearchInput,
  CurrencyInput,
  DateInput,
} from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox, Radio, Toggle } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import {
  StatusBadge,
  ImportRowBadge,
  CategoryBadge,
  TagBadge,
  RecurringBadge,
  CountBadge,
} from "@/components/ui/Badge";
import { Amount } from "@/components/ui/Amount";
import { Card, InteractiveCard } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Avatar, AccountAvatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tooltip } from "@/components/ui/Tooltip";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { PieCategories } from "@/components/ui/charts/PieCategories";
import { BarMonthly } from "@/components/ui/charts/BarMonthly";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import type { SubcategoryOption } from "@/lib/categories/types";
import { useToast } from "@/hooks/useToast";

const DEMO_CATEGORY_OPTIONS: SubcategoryOption[] = [
  { id: "1", typeName: "Revenus", categoryName: "Salaire", subName: null, categoryColor: "#10B981", label: "Revenus / Salaire" },
  { id: "2", typeName: "Revenus", categoryName: "Loyers", subName: null, categoryColor: "#10B981", label: "Revenus / Loyers" },
  { id: "3", typeName: "Dépenses", categoryName: "Alimentation", subName: "Courses", categoryColor: "#EF4444", label: "Dépenses / Alimentation / Courses" },
  { id: "4", typeName: "Dépenses", categoryName: "Alimentation", subName: "Restaurants", categoryColor: "#EF4444", label: "Dépenses / Alimentation / Restaurants" },
  { id: "5", typeName: "Dépenses", categoryName: "Transport", subName: "Essence", categoryColor: "#F97316", label: "Dépenses / Transport / Essence" },
  { id: "6", typeName: "Dépenses", categoryName: "Transport", subName: "Péages", categoryColor: "#F97316", label: "Dépenses / Transport / Péages" },
  { id: "7", typeName: "Dépenses", categoryName: "Loisirs", subName: null, categoryColor: "#8B5CF6", label: "Dépenses / Loisirs" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--space-10)" }}>
      <h2
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: "var(--fw-semibold)",
          marginBottom: "var(--space-4)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-start" }}>
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  const [tab, setTab] = useState("a");
  const [modalOpen, setModalOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [demoCategory, setDemoCategory] = useState<string | null>("4");
  const toast = useToast();

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-12) var(--space-8)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--fw-bold)", marginBottom: "var(--space-8)" }}>
        Design system — Lyra
      </h1>

      <Section title="Boutons">
        <Button>Primaire</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Chargement</Button>
        <Button disabled>Désactivé</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button leftIcon={<Plus size={16} />}>Avec icône</Button>
        <IconButton label="Éditer"><Pencil size={16} /></IconButton>
        <IconButton label="Supprimer"><Trash2 size={16} /></IconButton>
      </Section>

      <Section title="Inputs & Forms">
        <div style={{ width: 240 }}><Input placeholder="Texte" /></div>
        <div style={{ width: 240 }}><Input invalid placeholder="En erreur" /></div>
        <div style={{ width: 240 }}><Input disabled placeholder="Désactivé" /></div>
        <div style={{ width: 240 }}><SearchInput /></div>
        <div style={{ width: 160 }}><CurrencyInput placeholder="0,00" /></div>
        <div style={{ width: 180 }}><DateInput /></div>
        <div style={{ width: 200 }}>
          <Select defaultValue="">
            <option value="" disabled>Choisir…</option>
            <option>Compte courant</option>
            <option>Livret A</option>
          </Select>
        </div>
        <div style={{ width: 240 }}><Textarea placeholder="Note libre" /></div>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Checkbox defaultChecked /> Checkbox
        </label>
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Radio name="r" defaultChecked /> Radio
        </label>
        <Toggle defaultChecked />
        <div style={{ width: 260 }}>
          <FormField label="Libellé" error="Ce champ est requis">
            <Input invalid defaultValue="" />
          </FormField>
        </div>
      </Section>

      <Section title="Sélecteur de catégorie — input-category-combobox">
        <div style={{ width: 280 }}>
          <FormField label="Catégorie (recherche + arborescence)">
            <CategorySelect
              value={demoCategory}
              options={DEMO_CATEGORY_OPTIONS}
              onChange={setDemoCategory}
            />
          </FormField>
        </div>
        <div style={{ width: 240 }}>
          <FormField label="Variante filtre">
            <CategorySelect
              value={null}
              options={DEMO_CATEGORY_OPTIONS}
              placeholder="Toutes catégories"
              onChange={() => {}}
            />
          </FormField>
        </div>
        <div style={{ width: 240 }}>
          <FormField label="Désactivé">
            <CategorySelect value="1" options={DEMO_CATEGORY_OPTIONS} onChange={() => {}} disabled />
          </FormField>
        </div>
      </Section>

      <Section title="Badges & Status">
        <StatusBadge status="pending" />
        <StatusBadge status="validated" />
        <StatusBadge status="ignored" />
        <ImportRowBadge kind="new" />
        <ImportRowBadge kind="duplicate" />
        <CategoryBadge name="Courses" color="#8B5CF6" />
        <TagBadge>Vacances 2026</TagBadge>
        <RecurringBadge />
        <RecurringBadge missing />
        <CountBadge count={7} />
      </Section>

      <Section title="Montants">
        <Amount value={1234.56} size="xl" />
        <Amount value={-89.9} size="lg" />
        <Amount value={4200} showSign />
        <Amount value={0} tone="neutral" />
      </Section>

      <Section title="KPI">
        <div style={{ width: 220 }}><KpiCard kind="revenus" label="Revenus" value="4 200,00 €" deltaPercent={5.2} /></div>
        <div style={{ width: 220 }}><KpiCard kind="depenses" label="Dépenses" value="2 980,12 €" deltaPercent={-3.1} /></div>
        <div style={{ width: 220 }}><KpiCard kind="solde" label="Solde" value="1 219,88 €" deltaPercent={0} /></div>
        <div style={{ width: 220 }}><KpiCard kind="epargne" label="Épargne" value="29 %" /></div>
      </Section>

      <Section title="Cards & Avatars">
        <div style={{ width: 260 }}>
          <Card>
            <strong>card-surface</strong>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Wrapper neutre.</p>
          </Card>
        </div>
        <div style={{ width: 260 }}>
          <InteractiveCard selected>card-interactive (selected)</InteractiveCard>
        </div>
        <Avatar email="nicolas@example.com" />
        <AccountAvatar type="checking" />
        <AccountAvatar type="savings" color="#10B981" />
        <AccountAvatar type="investment" color="#3B82F6" />
      </Section>

      <Section title="Navigation">
        <Tabs
          items={[
            { value: "a", label: "Tout" },
            { value: "b", label: "À valider" },
            { value: "c", label: "Validées" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Breadcrumb items={[{ label: "Comptes", href: "/accounts" }, { label: "Compte courant" }]} />
        <MonthPicker value={month} onChange={setMonth} />
      </Section>

      <Section title="Feedback">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
        <div style={{ width: 200 }}><SkeletonLine width="100%" /></div>
        <div style={{ width: 200 }}><ProgressBar value={64} /></div>
        <Tooltip label="Astuce utile"><Button variant="secondary">Survole-moi</Button></Tooltip>
        <Button variant="secondary" onClick={() => toast.success("Enregistré !")}>Toast succès</Button>
        <Button variant="secondary" onClick={() => toast.error("Une erreur est survenue")}>Toast erreur</Button>
      </Section>

      <Section title="Alerts">
        <div style={{ width: "100%" }}><Alert variant="info">Information neutre.</Alert></div>
        <div style={{ width: "100%" }}><Alert variant="warning">Récurrente manquante détectée.</Alert></div>
        <div style={{ width: "100%" }}><Alert variant="danger">Import invalide.</Alert></div>
        <div style={{ width: "100%" }}><Alert variant="success">Compte créé.</Alert></div>
      </Section>

      <Section title="Empty state & Modal">
        <div style={{ width: "100%" }}>
          <Card>
            <EmptyState
              title="Aucune transaction"
              description="Importe un relevé pour démarrer."
              action={<Button>Importer</Button>}
            />
          </Card>
        </div>
        <Button onClick={() => setModalOpen(true)}>Ouvrir une modale</Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Exemple de modale"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button onClick={() => setModalOpen(false)}>Confirmer</Button>
            </>
          }
        >
          Contenu de la modale.
        </Modal>
      </Section>

      <Section title="Import">
        <div style={{ width: "100%", maxWidth: 480 }}>
          <FileDropzone onFile={() => {}} accept=".csv,.xlsx" hint="CSV ou Excel, 10 Mo max" />
        </div>
      </Section>

      <Section title="Charts">
        <div style={{ width: 360 }}>
          <Card>
            <PieCategories
              data={[
                { name: "Courses", value: 420 },
                { name: "Loyer", value: 950 },
                { name: "Loisirs", value: 180 },
                { name: "Transport", value: 90 },
              ]}
            />
          </Card>
        </div>
        <div style={{ width: 520 }}>
          <Card>
            <BarMonthly
              data={[
                { month: "Jan", revenus: 4200, depenses: 3100 },
                { month: "Fév", revenus: 4200, depenses: 2800 },
                { month: "Mar", revenus: 4500, depenses: 3400 },
              ]}
            />
          </Card>
        </div>
      </Section>
    </main>
  );
}
