"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { setBookingCustomUrl } from "@/lib/actions/bookingUrl";
import { useToast } from "@/hooks/useToast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingTitle: string;
  initialUrl: string | null;
};

export function BookingUrlDialog({
  open,
  onOpenChange,
  bookingId,
  bookingTitle,
  initialUrl,
}: Props) {
  const toast = useToast();
  const [value, setValue] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset the input when the dialog reopens for a different booking
  // (or with a new initialUrl after a save).
  useEffect(() => {
    if (open) {
      setValue(initialUrl ?? "");
      setError(null);
    }
  }, [open, initialUrl]);

  const submit = (next: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await setBookingCustomUrl(bookingId, next);
      if (result.success) {
        toast.success(next === null ? "Custom URL cleared." : "Custom URL saved.");
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  };

  const handleSave = () => {
    const trimmed = value.trim();
    submit(trimmed.length === 0 ? null : trimmed);
  };

  const handleClear = () => submit(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,calc(100vw-32px))] p-7">
        <DialogTitle>Edit booking URL</DialogTitle>
        <DialogDescription>
          Override the auto-resolved Maps and Website links for{" "}
          <span className="text-fg">{bookingTitle}</span>. Useful when the
          venue&apos;s real booking page lives elsewhere (OpenTable, the venue&apos;s
          own form, etc).
        </DialogDescription>

        <div className="flex flex-col gap-1.5 mb-6">
          <label
            htmlFor={`booking-url-${bookingId}`}
            className="label-sm-wide text-fg-3"
          >
            CUSTOM URL
          </label>
          <input
            id={`booking-url-${bookingId}`}
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://"
            disabled={pending}
            className="border border-line bg-bg text-fg
              px-[14px] py-[11px] rounded-md
              font-mono text-[13px]
              focus:outline-2 focus:outline-accent focus:outline-offset-1
              disabled:opacity-70"
            autoComplete="off"
          />
          {error && (
            <div className="text-err text-[12px] mt-1">{error}</div>
          )}
        </div>

        <div className="flex gap-2 justify-end items-center flex-wrap">
          {initialUrl && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
              disabled={pending}
            >
              Clear
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            tone="accent"
            size="sm"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
