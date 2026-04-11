/**
 * Private bucket for deal attachments. Create it in Supabase → Storage (name must match).
 * Server uploads use the service role after org/deal checks in `src/actions/deals.ts`.
 */
export const DEAL_DOCUMENTS_BUCKET = "deal-documents";
