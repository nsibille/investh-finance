import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequisition, getAccountDetails } from "@/lib/gocardless/client";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const reference = searchParams.get("ref");
  const target = (path: string) => NextResponse.redirect(`${origin}${path}`);

  if (searchParams.get("error") || !reference) {
    return target("/import?error=bank");
  }

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!connection) return target("/import?error=bank");

  try {
    const requisition = await getRequisition(connection.requisition_id);
    const accounts = requisition.accounts ?? [];

    if (accounts.length === 0) {
      await supabase
        .from("bank_connections")
        .update({ status: "error" })
        .eq("id", connection.id);
      return target("/import?error=bank_empty");
    }

    for (let i = 0; i < accounts.length; i++) {
      const gcAccountId = accounts[i];
      let iban: string | null = null;
      try {
        const details = await getAccountDetails(gcAccountId);
        iban = details.account?.iban ?? null;
      } catch {
        /* details optional */
      }

      if (i === 0) {
        await supabase
          .from("bank_connections")
          .update({ gc_account_id: gcAccountId, iban, status: "linked" })
          .eq("id", connection.id);
      } else {
        await supabase.from("bank_connections").insert({
          requisition_id: connection.requisition_id,
          reference: `${reference}-${i}`,
          institution_id: connection.institution_id,
          institution_name: connection.institution_name,
          gc_account_id: gcAccountId,
          iban,
          status: "linked",
        });
      }
    }

    return target("/import?linked=1");
  } catch {
    await supabase
      .from("bank_connections")
      .update({ status: "error" })
      .eq("id", connection.id);
    return target("/import?error=bank");
  }
}
