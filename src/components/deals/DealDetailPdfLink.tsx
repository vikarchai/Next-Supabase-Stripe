"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { getDealPdfSignedUrlAction } from "@/actions/deals";

export function DealDetailPdfLink({
  dealId,
  fileName,
}: {
  dealId: string;
  fileName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 disabled:opacity-60 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
      onClick={() => {
        startTransition(async () => {
          const r = await getDealPdfSignedUrlAction(dealId);
          if (r.ok) window.open(r.url, "_blank", "noopener,noreferrer");
          else toast.error(r.error);
        });
      }}
    >
      {fileName}
    </button>
  );
}
