import type {
  GCInstitution,
  GCRequisition,
  GCTransactionsResponse,
  GCAccountDetails,
} from "./types";

const BASE = "https://bankaccountdata.gocardless.com/api/v2";

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials() {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error(
      "GoCardless non configuré : définis GOCARDLESS_SECRET_ID et GOCARDLESS_SECRET_KEY.",
    );
  }
  return { secretId, secretKey };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const { secretId, secretKey } = credentials();
  const res = await fetch(`${BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GoCardless auth échouée (${res.status})`);
  }
  const data = (await res.json()) as { access: string; access_expires: number };
  cachedToken = {
    value: data.access,
    expiresAt: Date.now() + data.access_expires * 1000,
  };
  return data.access;
}

async function gcFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const token = await getAccessToken();
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GoCardless ${path} → ${res.status} ${text}`.trim());
  }
  return (await res.json()) as T;
}

export function isGoCardlessConfigured(): boolean {
  return Boolean(
    process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY,
  );
}

export async function listInstitutions(
  country = "fr",
): Promise<GCInstitution[]> {
  return gcFetch<GCInstitution[]>(
    `/institutions/?country=${encodeURIComponent(country)}`,
  );
}

export async function createRequisition(params: {
  institutionId: string;
  redirect: string;
  reference: string;
}): Promise<GCRequisition> {
  return gcFetch<GCRequisition>("/requisitions/", {
    method: "POST",
    json: {
      institution_id: params.institutionId,
      redirect: params.redirect,
      reference: params.reference,
      user_language: "FR",
    },
  });
}

export async function getRequisition(id: string): Promise<GCRequisition> {
  return gcFetch<GCRequisition>(`/requisitions/${id}/`);
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
): Promise<GCTransactionsResponse> {
  const qs = dateFrom ? `?date_from=${dateFrom}` : "";
  return gcFetch<GCTransactionsResponse>(
    `/accounts/${accountId}/transactions/${qs}`,
  );
}

export async function getAccountDetails(
  accountId: string,
): Promise<GCAccountDetails> {
  return gcFetch<GCAccountDetails>(`/accounts/${accountId}/details/`);
}
