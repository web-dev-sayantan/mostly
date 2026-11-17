import type { ReactNode } from "react";

export const AccountSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) => (
  <section
    aria-labelledby={`${id}-heading`}
    className="bg-card rounded-lg border"
  >
    <div className="border-b px-4 py-3">
      <h2 id={`${id}-heading`} className="text-base font-medium">
        {title}
      </h2>
    </div>
    <div className="grid gap-4 p-4">{children}</div>
  </section>
);
