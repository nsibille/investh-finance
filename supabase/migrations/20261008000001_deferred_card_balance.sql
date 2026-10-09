-- ============================================================================
-- Solde des comptes à carte à débit différé
-- ============================================================================
-- Sur un compte carte à débit différé, chaque paiement carte est importé
-- individuellement ET le prélèvement mensuel « DEBIT DIFFERE » reprend leur
-- total : les additionner compte deux fois les dépenses. Sur ces comptes, le
-- solde garde les paiements carte (solde « disponible », encours déduit) et
-- ignore la ligne de consolidation — comme le graphe de trésorerie.
CREATE OR REPLACE VIEW public.account_balances
WITH (security_invoker = on) AS
WITH anchors AS (
  SELECT a_1.id AS account_id,
         a_1.initial_date AS anchor_date,
         a_1.initial_balance AS anchor_balance,
         '-infinity'::timestamptz AS ord
  FROM public.accounts a_1
  UNION ALL
  SELECT r.account_id, r.rebase_date, r.balance, r.created_at
  FROM public.account_rebases r
), latest_anchor AS (
  SELECT DISTINCT ON (anchors.account_id)
         anchors.account_id, anchors.anchor_date, anchors.anchor_balance
  FROM anchors
  ORDER BY anchors.account_id, anchors.anchor_date DESC, anchors.ord DESC
), counted AS (
  -- Transactions qui entrent dans le solde (hors débit différé sur carte différée).
  SELECT t.*
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  LEFT JOIN public.subcategories s ON s.id = t.subcategory_id
  LEFT JOIN public.categories c ON c.id = s.category_id
  WHERE NOT (
    a.is_deferred_card
    AND (
      c.name = 'Débit différé'
      OR upper(t.raw_label) LIKE '%DEBIT DIFFERE%'
      OR upper(t.raw_label) LIKE '%DEBIT DIFF %'
    )
  )
)
SELECT a.id AS account_id,
       a.name AS account_name,
       a.type,
       a.currency,
       a.initial_balance,
       COALESCE(sum(t.amount) FILTER (
         WHERE t.status = 'validated'::transaction_status
           AND t.operation_date > la.anchor_date
           AND t.operation_date <= CURRENT_DATE), 0::numeric) AS transactions_sum,
       la.anchor_balance + COALESCE(sum(t.amount) FILTER (
         WHERE t.status = 'validated'::transaction_status
           AND t.operation_date > la.anchor_date
           AND t.operation_date <= CURRENT_DATE), 0::numeric) AS current_balance,
       count(t.id) FILTER (WHERE t.status = 'pending'::transaction_status) AS pending_count
FROM public.accounts a
JOIN latest_anchor la ON la.account_id = a.id
LEFT JOIN counted t ON t.account_id = a.id
WHERE a.is_archived = false
GROUP BY a.id, la.anchor_balance, la.anchor_date;
