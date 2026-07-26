// A small "report a correction" link, reachable from every verse, word, root and
// investigation page. It carries the page's path and a human reference into the
// report form as query params, so the reporter does not have to describe which
// page they mean. A plain link — it works without JavaScript.
export function ReportLink({ path, label }: { path: string; label?: string }) {
  const params = new URLSearchParams({ path });
  if (label) params.set('ref', label);
  return (
    <a
      href={`/report?${params.toString()}`}
      className="text-ink3 underline decoration-line underline-offset-2 hover:text-ink2"
    >
      Report a correction
    </a>
  );
}
