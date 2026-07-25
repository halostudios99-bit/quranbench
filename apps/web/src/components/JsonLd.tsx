// Machine-readable structure alongside every corpus page (extensibility §6). The
// JSON is server-rendered into the initial HTML so crawlers and AI systems read
// it without executing JavaScript. Values are serialised, not interpolated as
// HTML, so no field can break out of the script element.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
