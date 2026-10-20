import { AlertCircle, CheckCircle2 } from "lucide-react";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2.5 text-sm text-success">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}
