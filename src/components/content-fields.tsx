import { Globe, Link2, Lock } from "lucide-react";
import type { FieldErrors } from "@/lib/validation";
import { FieldError } from "./form-message";

const VISIBILITY = [
  { value: "public", label: "Public", hint: "Listed on Explore and your profile", Icon: Globe },
  { value: "unlisted", label: "Unlisted", hint: "Anyone with the link", Icon: Link2 },
  { value: "private", label: "Private", hint: "Only you (and the administrator)", Icon: Lock },
] as const;

/** Title / description / visibility / status inputs shared by upload and edit. */
export function ContentFields({
  defaults,
  errors = {},
  titleRef,
}: {
  defaults?: { title: string; description: string; visibility: string; status: string };
  errors?: FieldErrors;
  titleRef?: React.Ref<HTMLInputElement>;
}) {
  const visibility = defaults?.visibility ?? "public";
  return (
    <>
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input className="input" id="title" name="title" required maxLength={140} defaultValue={defaults?.title} placeholder="Give it a name" ref={titleRef} />
        <FieldError message={errors.title} />
      </div>
      <div>
        <label className="label" htmlFor="description">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          className="input min-h-28 resize-y"
          id="description"
          name="description"
          maxLength={5000}
          defaultValue={defaults?.description}
          placeholder="What is this about?"
        />
        <FieldError message={errors.description} />
      </div>
      <fieldset>
        <legend className="label">Visibility</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {VISIBILITY.map(({ value, label, hint, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft transition hover:border-accent/40 has-checked:border-accent has-checked:bg-accent-soft/40 has-checked:ring-4 has-checked:ring-(--ring)"
            >
              <input type="radio" name="visibility" value={value} defaultChecked={visibility === value} className="sr-only" />
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.visibility} />
      </fieldset>
      <div className="max-w-xs">
        <label className="label" htmlFor="status">Status</label>
        <select className="input" id="status" name="status" defaultValue={defaults?.status ?? "published"}>
          <option value="published">Published</option>
          <option value="draft">Draft (only you)</option>
        </select>
        <FieldError message={errors.status} />
      </div>
    </>
  );
}
