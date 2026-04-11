"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PdfFilePickerProps = {
  id?: string;
  name: string;
  className?: string;
  chooseFileLabel?: string;
  emptyLabel?: string;
  /** After a file is chosen, submit the parent form (one-click upload in tables). */
  submitOnSelect?: boolean;
  disabled?: boolean;
  /** Only the trigger button — no “No file chosen” line (use when the row shows the file name elsewhere). */
  compact?: boolean;
};

/** Hides the native file input so the OS “no file chosen” string (locale-specific) never shows. */
export function PdfFilePicker({
  id,
  name,
  className,
  chooseFileLabel = "Choose file",
  emptyLabel = "No file chosen",
  submitOnSelect = false,
  disabled = false,
  compact = false,
}: PdfFilePickerProps) {
  const autoId = useId();
  const inputId = id ?? `pdf-file-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState(emptyLabel);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        accept="application/pdf"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setFileLabel(f ? f.name : emptyLabel);
          if (f && submitOnSelect) {
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {chooseFileLabel}
      </Button>
      {!compact ? (
        <span className="min-w-0 max-w-[14rem] truncate text-sm text-zinc-600 dark:text-zinc-400">
          {fileLabel}
        </span>
      ) : null}
    </div>
  );
}
