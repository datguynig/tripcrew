import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

type Props = {
  label: string;
  name: string;
  helper?: string;
  error?: string;
  hideLabel?: boolean;
  required?: boolean;
  children: ReactNode;
};

type InjectedProps = {
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

export function Field({
  label,
  name,
  helper,
  error,
  hideLabel,
  required,
  children,
}: Props) {
  const id = useId();
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<InjectedProps>, {
        id,
        name,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required ?? (children.props as InjectedProps).required,
      })
    : children;

  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className={
          hideLabel
            ? "sr-only"
            : "font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3"
        }
      >
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      {control}
      {helper && !error && (
        <span id={helperId} className="text-[12px] text-fg-3">
          {helper}
        </span>
      )}
      {error && (
        <span
          id={errorId}
          className="text-err font-mono text-[11px] uppercase tracking-[0.1em]"
        >
          {error}
        </span>
      )}
    </div>
  );
}
