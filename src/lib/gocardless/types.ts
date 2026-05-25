export interface GCInstitution {
  id: string;
  name: string;
  bic?: string;
  transaction_total_days?: string;
  countries?: string[];
  logo?: string;
}

export interface GCRequisition {
  id: string;
  status: string;
  link: string;
  reference: string;
  institution_id: string;
  accounts: string[];
}

export interface GCAmount {
  amount: string;
  currency: string;
}

export interface GCTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  bookingDateTime?: string;
  transactionAmount: GCAmount;
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
}

export interface GCTransactionsResponse {
  transactions: {
    booked: GCTransaction[];
    pending: GCTransaction[];
  };
}

export interface GCAccountDetails {
  account: {
    iban?: string;
    name?: string;
    currency?: string;
    ownerName?: string;
  };
}
