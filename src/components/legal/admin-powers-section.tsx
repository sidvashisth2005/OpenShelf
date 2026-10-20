import { ADMIN_POWERS } from "@/lib/legal";

/** The full administrator-powers disclosure, shared by the Terms and Privacy pages. */
export function AdminPowersSection({ id, heading }: { id: string; heading: string }) {
  return (
    <section id={id} className="my-10 scroll-mt-24 rounded-2xl border border-amber-500/30 bg-warn-bg p-6 sm:p-8">
      <h2 className="!mt-0">{heading}</h2>
      <p>
        This platform has a single administrator account (the &quot;Super Admin&quot;) with platform-wide powers. We
        tell you about them here, in plain language, so that you can decide whether to use the platform.
      </p>
      {ADMIN_POWERS.map((p) => (
        <div key={p.title}>
          <h3>{p.title}</h3>
          <p>{p.body}</p>
        </div>
      ))}
    </section>
  );
}
