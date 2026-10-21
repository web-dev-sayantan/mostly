import type { Cadence, Weekday } from "@mostly/domain";
import { normalizeCadence } from "@mostly/domain";
import { Label } from "@mostly/ui/components/label";
import { cn } from "@mostly/ui/lib/utils";

import { WEEKDAYS } from "@/lib/goals";

type CadenceType = Cadence["type"];

export interface CadenceFormValue {
  type: CadenceType;
  weekdays: Weekday[];
  target: number;
}

export const cadenceFormValue = (
  cadence: Cadence | null
): CadenceFormValue => ({
  type: cadence?.type ?? "daily",
  weekdays: cadence?.type === "weekdays" ? cadence.weekdays : [1, 3, 5],
  target: cadence?.type === "weekly_target" ? cadence.target : 3,
});

export const cadenceFromValue = (value: CadenceFormValue): Cadence => {
  if (value.type === "weekdays") {
    return normalizeCadence({ type: "weekdays", weekdays: value.weekdays });
  }
  if (value.type === "weekly_target") {
    return { type: "weekly_target", target: value.target };
  }
  return { type: "daily" };
};

const helperCopy: Record<CadenceType, string> = {
  daily: "Expected every day.",
  weekdays: "Only these days count. Other days aren't expected.",
  weekly_target: "Any days count. The week is met when you reach N.",
};

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Specific days" },
  { value: "weekly_target", label: "N times per week" },
] as const;

export const CadenceFields = ({
  fieldId,
  value,
  disabled = false,
  changed = false,
  error,
  onChange,
}: {
  fieldId: string;
  value: CadenceFormValue;
  disabled?: boolean;
  changed?: boolean;
  error?: string | null;
  onChange: (value: CadenceFormValue) => void;
}) => {
  const toggleWeekday = (day: Weekday) =>
    onChange({
      ...value,
      weekdays: value.weekdays.includes(day)
        ? value.weekdays.filter((entry) => entry !== day)
        : [...value.weekdays, day].toSorted((a, b) => a - b),
    });

  return (
    <fieldset
      disabled={disabled}
      aria-describedby={error ? `${fieldId}-cadence-error` : undefined}
    >
      <legend className="text-sm font-medium">Cadence</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {CADENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value.type === option.value}
            onClick={() => onChange({ ...value, type: option.value })}
            className={cn(
              "border-border focus-visible:ring-ring/50 min-h-11 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
              value.type === option.value &&
                "bg-primary text-primary-foreground border-primary"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        {helperCopy[value.type]}
      </p>

      {value.type === "weekdays" ? (
        <fieldset className="mt-3 flex flex-wrap gap-2">
          <legend className="sr-only">Weekdays</legend>
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              aria-pressed={value.weekdays.includes(day.value)}
              aria-label={day.label}
              onClick={() => toggleWeekday(day.value)}
              className={cn(
                "border-border focus-visible:ring-ring/50 min-h-11 min-w-11 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                value.weekdays.includes(day.value) &&
                  "bg-accent text-accent-foreground border-foreground/20"
              )}
            >
              {day.short}
            </button>
          ))}
        </fieldset>
      ) : null}

      {value.type === "weekly_target" ? (
        <div className="mt-3 flex items-center gap-3">
          <Label htmlFor={`${fieldId}-target`}>Times per week</Label>
          <select
            id={`${fieldId}-target`}
            value={value.target}
            onChange={(event) =>
              onChange({ ...value, target: Number(event.target.value) })
            }
            className="border-input bg-background h-11 rounded-full border px-3 text-base"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <p
          id={`${fieldId}-cadence-error`}
          role="alert"
          className="text-destructive mt-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      {changed ? (
        <output className="bg-warm/10 text-foreground mt-3 block rounded-xl p-3 text-sm">
          Past history stays. Your current streak resets only if the cadence
          unit changes.
        </output>
      ) : null}
    </fieldset>
  );
};
