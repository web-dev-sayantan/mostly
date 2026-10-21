import type { GoalDto } from "@mostly/api/routers/goals";
import type { Cadence, Weekday } from "@mostly/domain";
import { sameCadence } from "@mostly/domain";
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
  defaultStartDate,
  effectiveCadence,
  formatDayMonth,
  isArchived,
} from "@/lib/goals";
import { orpc } from "@/utils/orpc";

import { CadenceFields, cadenceFromValue } from "./cadence-fields";

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

const initialForm = (goal: GoalDto | null, today: string): FormState => {
  const cadence = goal ? effectiveCadence(goal, today) : null;

  return {
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? null,
    color: goal?.color ?? null,
    priority: goal?.priority ?? "medium",
    cadenceType: cadence?.type ?? "daily",
    weekdays: cadence?.type === "weekdays" ? cadence.weekdays : [1, 3, 5],
    weeklyTarget: cadence?.type === "weekly_target" ? cadence.target : 3,
    startDate: goal?.startDate ?? defaultStartDate(today),
  };
};

const selectedCadence = (form: FormState): Cadence =>
  cadenceFromValue({
    type: form.cadenceType,
    weekdays: form.weekdays,
    target: form.weeklyTarget,
  });

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
          "border-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full border text-sm focus-visible:ring-2 focus-visible:outline-none",
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
            "border-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full border text-xl focus-visible:ring-2 focus-visible:outline-none",
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
          "border-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full border text-sm focus-visible:ring-2 focus-visible:outline-none",
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
            "border-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full border-2 focus-visible:ring-2 focus-visible:outline-none",
            value === color.value && "border-foreground"
          )}
          style={{ backgroundColor: color.value }}
        >
          {value === color.value ? (
            <span className="bg-background text-foreground flex size-5 items-center justify-center rounded-full">
              <Check aria-hidden="true" className="size-3.5" />
            </span>
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
            "border-border focus-visible:ring-ring min-h-11 flex-1 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
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
  const archiveTrigger = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deleteCopy = `This deletes ${goal.name} and all ${
    goal.sessionCount
  } ${goal.sessionCount === 1 ? "session" : "sessions"}. Export your data first? This can't be undone.`;

  const cancel = (trigger: typeof archiveTrigger) => {
    onCancel();
    requestAnimationFrame(() => trigger.current?.focus());
  };

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
          <p id="archive-goal-copy" className="text-muted-foreground text-sm">
            {ARCHIVE_COPY}
          </p>
          {confirmation === "archive" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                autoFocus
                aria-describedby="archive-goal-copy"
                onClick={onArchive}
                disabled={archivePending}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Archive goal
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => cancel(archiveTrigger)}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              ref={archiveTrigger}
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
        <p id="delete-goal-copy" className="text-muted-foreground text-sm">
          {deleteCopy}
        </p>
        {confirmation === "delete" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              autoFocus
              aria-describedby="delete-goal-copy"
              onClick={onDelete}
              disabled={deletePending}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Delete goal
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => cancel(deleteTrigger)}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            ref={deleteTrigger}
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

const NameField = ({
  form,
  fieldId,
  archived,
  validationError,
  nameRef,
  updateForm,
}: {
  form: FormState;
  fieldId: string;
  archived: boolean;
  validationError: FormError;
  nameRef: React.RefObject<HTMLInputElement | null>;
  updateForm: (patch: Partial<FormState>) => void;
}) => (
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
        validationError?.field === "name" ? `${fieldId}-name-error` : undefined
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
);

const GoalFields = ({
  form,
  fieldId,
  archived,
  startLocked,
  today,
  validationError,
  nameRef,
  cadenceChanged,
  updateForm,
}: {
  form: FormState;
  fieldId: string;
  archived: boolean;
  startLocked: boolean;
  today: string;
  validationError: FormError;
  nameRef: React.RefObject<HTMLInputElement | null>;
  cadenceChanged: boolean;
  updateForm: (patch: Partial<FormState>) => void;
}) => (
  <>
    <NameField
      form={form}
      fieldId={fieldId}
      archived={archived}
      validationError={validationError}
      nameRef={nameRef}
      updateForm={updateForm}
    />

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
    <CadenceFields
      fieldId={fieldId}
      value={{
        type: form.cadenceType,
        weekdays: form.weekdays,
        target: form.weeklyTarget,
      }}
      disabled={archived}
      changed={cadenceChanged}
      error={
        validationError?.field === "cadence" ? validationError.message : null
      }
      onChange={(value) =>
        updateForm({
          cadenceType: value.type,
          weekdays: value.weekdays,
          weeklyTarget: value.target,
        })
      }
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
        aria-invalid={validationError?.field === "startDate"}
        aria-describedby={
          validationError?.field === "startDate"
            ? `${fieldId}-start-error`
            : undefined
        }
        className="h-11 text-base"
      />
      {validationError?.field === "startDate" ? (
        <p
          id={`${fieldId}-start-error`}
          role="alert"
          className="text-destructive text-sm"
        >
          {validationError.message}
        </p>
      ) : null}
      {startLocked && !archived ? (
        <p className="text-muted-foreground text-sm">
          Start date can&apos;t change after a goal has started.
        </p>
      ) : null}
    </div>
  </>
);

const cadenceChangedSince = (
  goal: GoalDto | null,
  today: string,
  next: Cadence
): boolean => {
  if (!goal) {
    return false;
  }
  const current = effectiveCadence(goal, today);
  return current !== null && !sameCadence(current, next);
};

// The form reads better as one labelled sequence than as more one-off wrappers.
export const GoalEditor = ({
  goal,
  today,
  onClose,
  onDone,
  onDeleted,
}: {
  goal: GoalDto | null;
  today: string;
  onClose: () => void;
  onDone: () => void;
  onDeleted?: () => void;
}) => {
  const [form, setForm] = useState<FormState>(() => initialForm(goal, today));
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [validationError, setValidationError] = useState<FormError>(null);
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.goals.list.key() });
  };

  const createGoal = useMutation(
    orpc.goals.create.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        onDone();
      },
    })
  );
  const updateGoal = useMutation(
    orpc.goals.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        onDone();
      },
    })
  );
  const archiveGoal = useMutation(
    orpc.goals.archive.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        onDone();
      },
    })
  );
  const deleteGoal = useMutation(
    orpc.goals.delete.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        if (onDeleted) {
          onDeleted();
          return;
        }
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
  const cadenceChanged = cadenceChangedSince(goal, today, cadence);

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
          className="focus-visible:ring-ring min-w-0 rounded-lg text-lg font-medium break-words focus-visible:ring-2 focus-visible:outline-none"
        >
          {goal?.name ?? "New goal"}
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
        <GoalFields
          form={form}
          fieldId={fieldId}
          archived={archived}
          startLocked={startLocked}
          today={today}
          validationError={validationError}
          nameRef={nameRef}
          cadenceChanged={cadenceChanged}
          updateForm={updateForm}
        />

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
