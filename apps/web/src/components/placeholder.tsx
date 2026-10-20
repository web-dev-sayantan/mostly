export function Placeholder({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="py-4">
      <h1 className="text-[28px] leading-tight font-medium">{title}</h1>
      <div className="bg-card text-muted-foreground mt-6 rounded-lg border p-6 text-sm">
        {detail}
      </div>
    </section>
  );
}
