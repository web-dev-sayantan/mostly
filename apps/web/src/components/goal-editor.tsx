import type { GoalDto } from "@mostly/api/routers/goals";
import type { Cadence, Weekday } from "@mostly/domain";
import { normalizeCadence, sameCadence } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { Label } from "@mostly/ui/components/label";
import { cn } from "@mostly/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  EMOJI_CHOICES,
  GOAL_COLORS,
  PRIORITIES,
  PRIORITY_LABELS,
  WEEKDAYS,
  defaultStartDate,
  effectiveCadence,
  formatDayMonth,
  isArchived,
  localToday,
} from "@/lib/goals";
import { orpc } from "@/utils/orpc";

const ARCHIVE_COPY =
  "Ends this goal. It stays in Today for the rest of today, then leaves current stats. History is kept and read-only from the next day. Correct details before archiving. You can't unarchive; create a new goal to resume.";

type CadenceType = Cadence["type"];
type Confirmation = "archive" | "delete" | null;
type FormError = {
  field: "name" | "cadence" | "startDate";
  message: string;
} | null;

interface FormState {
  name: string;
  emoji: string | null;
  color: string | null;
  priority: (typeof PRIORITIES)[number];
  cadenceType: CadenceType;
  weekdays: Weekday[];
  weeklyTarget: number;
  startDate: string;
}

const initialForm = (goal: GoalDto | null): FormState => {
  const today = localToday();
  const cadence = goal ? effectiveCadence(goal, today) : null;

  return {
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? null,
    color: goal?.color ?? null,
    priority: goal?.priority ?? "medium",
    cadenceType: cadence?.type ?? "daily",
    weekdays: cadence?.type === "weekdays" ? cadence.weekdays : [1, 3, 5],
    weeklyTarget: cadence?.type === "weekly_target" ? cadence.target : 3,
    startDate: goal?.startDate ?? defaultStartDate(),
  };
};

const selectedCadence = (form: FormState): Cadence => {
  if (form.cadenceType === "weekdays") {
    return normalizeCadence({ type: "weekdays", weekdays: form.weekdays });
  }
  if (form.cadenceType === "weekly_target") {
    return { type: "weekly_target", target: form.weeklyTarget };
  }
  return { type: "daily" };
};

const validateForm = (form: FormState, today: string): FormError => {
  const name = form.name.trim();
  if (name.length === 0 || name.length > 40) {
    return { field: "name", message: "Name must be 1 to 40 characters." };
  }
  if (form.cadenceType === "weekdays" && form.weekdays.length === 0) {
    return { field: "cadence", message: "Choose at least one weekday." };
  }
  if (form.startDate < today) {
    return {
      field: "startDate",
      message: "Start date must be today or later.",
    };
  }
  return null;
};

const helperCopy: Record<CadenceType, string> = {
  daily: "Expected every day.",
  weekdays: "Only these days count. Other days are free.",
  weekly_target: "Any days count. The week is met when you reach N.",
};

const EmojiPicker = ({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (emoji: string | null) => void;
}) => (
  <fieldset disabled={disabled}>
    <legend className="text-sm font-medium">Emoji</legend>
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        aria-label="No emoji"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "border-border flex size-11 items-center justify-center rounded-full border text-sm",
          value === null && "bg-muted border-foreground/40"
        )}
      >
        <span
          aria-hidden="true"
          className="bg-muted-foreground/40 size-2 rounded-full"
        />
      </button>
      {EMOJI_CHOICES.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={emoji}
          aria-pressed={value === emoji}
          onClick={() => onChange(emoji)}
          className={cn(
            "border-border flex size-11 items-center justify-center rounded-full border text-xl",
            value === emoji && "bg-muted border-foreground/40"
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  </fieldset>
);

const ColorPicker = ({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (color: string | null) => void;
}) => (
  <fieldset disabled={disabled}>
    <legend className="text-sm font-medium">Color</legend>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label="No color"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "border-border flex size-11 items-center justify-center rounded-full border text-sm",
          value === null && "bg-muted border-foreground/40"
        )}
      >
        None
      </button>
      {GOAL_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          aria-label={color.label}
          aria-pressed={value === color.value}
          onClick={() => onChange(color.value)}
          className={cn(
            "border-border flex size-11 items-center justify-center rounded-full border-2",
            value === color.value && "border-foreground/60"
          )}
          style={{ backgroundColor: color.value }}
        >
          {value === color.value ? (
            <Check aria-hidden="true" className="size-4 text-white" />
          ) : null}
        </button>
      ))}
    </div>
  </fieldset>
);

const PriorityPicker = ({
  value,
  disabled,
  onChange,
}: {
  value: FormState["priority"];
  disabled: boolean;
  onChange: (priority: FormState["priority"]) => void;
}) => (
  <fieldset disabled={disabled}>
    <legend className="text-sm font-medium">Priority</legend>
    <div className="mt-2 flex gap-2">
      {PRIORITIES.map((priority) => (
        <button
          key={priority}
          type="button"
          aria-pressed={value === priority}
          onClick={() => onChange(priority)}
          className={cn(
            "border-border min-h-11 flex-1 rounded-full border px-3 text-sm",
            value === priority &&
              "bg-primary text-primary-foreground border-primary"
          )}
        >
          {PRIORITY_LABELS[priority]}
        </button>
      ))}
    </div>
  </fieldset>
);

const CadencePicker = ({
  fieldId,
  form,
  disabled,
  changed,
  error,
  onChange,
}: {
  fieldId: string;
  form: FormState;
  disabled: boolean;
  changed: boolean;
  error: string | null;
  onChange: (patch: Partial<FormState>) => void;
}) => {
  const toggleWeekday = (day: Weekday) =>
    onChange({
      weekdays: form.weekdays.includes(day)
        ? form.weekdays.filter((value) => value !== day)
        : [...form.weekdays, day].toSorted((a, b) => a - b),
    });

  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium">Cadence</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {(
          [
            { value: "daily", label: "Daily" },
            { value: "weekdays", label: "Specific days" },
            { value: "weekly_target", label: "N times per week" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={form.cadenceType === option.value}
            onClick={() => onChange({ cadenceType: option.value })}
            className={cn(
              "border-border min-h-11 rounded-full border px-3 text-sm",
              form.cadenceType === option.value &&
                "bg-primary text-primary-foreground border-primary"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        {helperCopy[form.cadenceType]}
      </p>

      {form.cadenceType === "weekdays" ? (
        <fieldset className="mt-3 flex flex-wrap gap-2">
          <legend className="sr-only">Weekdays</legend>
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              aria-pressed={form.weekdays.includes(day.value)}
              aria-label={day.label}
              onClick={() => toggleWeekday(day.value)}
              className={cn(
                "border-border min-h-11 min-w-11 rounded-full border px-3 text-sm",
                form.weekdays.includes(day.value) &&
                  "bg-accent text-accent-foreground border-foreground/20"
              )}
            >
              {day.short}
            </button>
          ))}
        </fieldset>
      ) : null}

      {form.cadenceType === "weekly_target" ? (
        <div className="mt-3 flex items-center gap-3">
          <Label htmlFor={`${fieldId}-target`}>Times per week</Label>
          <select
            id={`${fieldId}-target`}
            value={form.weeklyTarget}
            onChange={(event) =>
              onChange({ weeklyTarget: Number(event.target.value) })
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
        <p role="alert" className="text-destructive mt-2 text-sm">
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

const DangerZone = ({
  goal,
  today,
  confirmation,
  archivePending,
  deletePending,
  onConfirm,
  onCancel,
  onArchive,
  onDelete,
}: {
  goal: GoalDto;
  today: string;
  confirmation: Confirmation;
  archivePending: boolean;
  deletePending: boolean;
  onConfirm: (confirmation: Confirmation) => void;
  onCancel: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) => {
  const deleteCopy = `This deletes ${goal.name} and all ${
    goal.sessionCount
  } ${goal.sessionCount === 1 ? "session" : "sessions"}. Export your data first? This can't be undone.`;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-sm font-medium">End or remove</h3>

      {goal.archivedOn ? (
        <p className="text-muted-foreground mt-2 text-sm">
          {goal.archivedOn === today
            ? "Archives tomorrow"
            : `Archived ${formatDayMonth(goal.archivedOn)}`}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground text-sm">{ARCHIVE_COPY}</p>
          {confirmation === "archive" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={onArchive}
                disabled={archivePending}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Archive goal
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onConfirm("archive")}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Archive goal
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <p className="text-muted-foreground text-sm">{deleteCopy}</p>
        {confirmation === "delete" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={deletePending}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Delete goal
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm("delete")}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            Delete goal
          </Button>
        )}
      </div>
    </div>
  );
};

// The form reads better as one labelled sequence than as more one-off wrappers.
// eslint-disable-next-line complexity
export const GoalEditor = ({
  goal,
  onClose,
  onDone,
}: {
  goal: GoalDto | null;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [form, setForm] = useState<FormState>(() => initialForm(goal));
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [validationError, setValidationError] = useState<FormError>(null);
  const today = localToday();
  const archived = goal ? isArchived(goal, today) : false;
  const startLocked = Boolean(goal && goal.startDate <= today);
  const fieldId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (archived) {
      headingRef.current?.focus();
    } else {
      nameRef.current?.focus();
    }
  }, [archived]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orpc.goals.list.key() });
  };

  const createGoal = useMutation(
    orpc.goals.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        onDone();
      },
    })
  );
  const updateGoal = useMutation(
    orpc.goals.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        onDone();
      },
    })
  );
  const archiveGoal = useMutation(
    orpc.goals.archive.mutationOptions({
      onSuccess: () => {
        invalidate();
        onDone();
      },
    })
  );
  const deleteGoal = useMutation(
    orpc.goals.delete.mutationOptions({
      onSuccess: () => {
        invalidate();
        onDone();
      },
    })
  );

  const saving = createGoal.isPending || updateGoal.isPending;
  const mutationError =
    createGoal.error?.message ??
    updateGoal.error?.message ??
    archiveGoal.error?.message ??
    deleteGoal.error?.message ??
    null;
  const cadence = selectedCadence(form);
  const current = goal ? effectiveCadence(goal, today) : null;
  const cadenceChanged = Boolean(
    goal && current && !sameCadence(current, cadence)
  );

  const updateForm = (patch: Partial<FormState>) =>
    setForm((currentForm) => ({ ...currentForm, ...patch }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const error = validateForm(form, today);
    if (error) {
      setValidationError(error);
      return;
    }

    const fields = {
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      priority: form.priority,
      cadence,
    };

    if (goal) {
      updateGoal.mutate({
        id: goal.id,
        ...fields,
        ...(startLocked ? {} : { startDate: form.startDate }),
      });
    } else {
      createGoal.mutate({ ...fields, startDate: form.startDate });
    }
  };

  return (
    <section
      aria-labelledby={`${fieldId}-title`}
      className="bg-card mt-6 rounded-2xl border p-4 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2
          id={`${fieldId}-title`}
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-medium outline-none"
        >
          {goal ? goal.name : "New goal"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="min-h-11 rounded-full px-3 text-sm"
        >
          Close
        </Button>
      </div>

      {archived ? (
        <p className="text-muted-foreground mt-2 text-sm">
          This goal is archived. History is read-only.
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-5 space-y-6" noValidate>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-name`}>Name</Label>
          <Input
            id={`${fieldId}-name`}
            ref={nameRef}
            value={form.name}
            onChange={(event) => updateForm({ name: event.target.value })}
            maxLength={40}
            required
            disabled={archived}
            autoComplete="off"
            aria-invalid={validationError?.field === "name"}
            aria-describedby={
              validationError?.field === "name"
                ? `${fieldId}-name-error`
                : undefined
            }
            className="h-11 text-base"
          />
          {validationError?.field === "name" ? (
            <p
              id={`${fieldId}-name-error`}
              role="alert"
              className="text-destructive text-sm"
            >
              {validationError.message}
            </p>
          ) : null}
        </div>

        <EmojiPicker
          value={form.emoji}
          disabled={archived}
          onChange={(emoji) => updateForm({ emoji })}
        />
        <ColorPicker
          value={form.color}
          disabled={archived}
          onChange={(color) => updateForm({ color })}
        />
        <PriorityPicker
          value={form.priority}
          disabled={archived}
          onChange={(priority) => updateForm({ priority })}
        />
        <CadencePicker
          fieldId={fieldId}
          form={form}
          disabled={archived}
          changed={cadenceChanged}
          error={
            validationError?.field === "cadence"
              ? validationError.message
              : null
          }
          onChange={updateForm}
        />

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-start`}>Start date</Label>
          <Input
            id={`${fieldId}-start`}
            type="date"
            value={form.startDate}
            min={today}
            disabled={archived || startLocked}
            onChange={(event) => updateForm({ startDate: event.target.value })}
            className="h-11 text-base"
          />
          {validationError?.field === "startDate" ? (
            <p role="alert" className="text-destructive text-sm">
              {validationError.message}
            </p>
          ) : null}
          {startLocked && !archived ? (
            <p className="text-muted-foreground text-sm">
              Start date can&apos;t change after a goal has started.
            </p>
          ) : null}
        </div>

        {mutationError ? (
          <p role="alert" className="text-destructive text-sm">
            {mutationError}
          </p>
        ) : null}

        {archived ? null : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full px-5 text-sm"
            >
              {saving ? "Saving…" : "Save goal"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Cancel
            </Button>
          </div>
        )}
      </form>

      {goal ? (
        <DangerZone
          goal={goal}
          today={today}
          confirmation={confirmation}
          archivePending={archiveGoal.isPending}
          deletePending={deleteGoal.isPending}
          onConfirm={setConfirmation}
          onCancel={() => setConfirmation(null)}
          onArchive={() => archiveGoal.mutate({ id: goal.id })}
          onDelete={() =>
            deleteGoal.mutate({ id: goal.id, sessionCount: goal.sessionCount })
          }
        />
      ) : null}
    </section>
  );
};
