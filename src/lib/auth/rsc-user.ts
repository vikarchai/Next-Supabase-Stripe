import { cache } from "react";

import { getViewer } from "@/lib/auth/viewer";

/** Thin wrapper; `getViewer()` is preferred when profile/org are needed too. */
export const getAuthUser = cache(async () => {
  const v = await getViewer();
  return v?.user ?? null;
});
