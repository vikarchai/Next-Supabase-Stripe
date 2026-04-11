import { Suspense } from "react";

import { AuthCallbackHandler } from "./auth-callback-handler";

export const dynamic = "force-dynamic";

/**
 * OAuth / email links land here. Tokens in the URL hash never reach the server,
 * so this page must be served (not a Route Handler redirect) for implicit flows.
 * Query `code` / `token_hash` are completed via server actions from the client.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <p className="text-sm text-zinc-600">Completing sign-in…</p>
        </div>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}
