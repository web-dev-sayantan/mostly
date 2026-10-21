import { formatLogicalDate, formatRolloverHour } from "@/lib/time";

export const TodayHeader = ({
  today,
  late,
  rolloverHour,
  progressCopy,
  progressPercent,
  showBar,
}: {
  today: string;
  late: boolean;
  rolloverHour: number;
  progressCopy: string | null;
  progressPercent: number;
  showBar: boolean;
}) => (
  <header>
    <h1 className="text-[28px] leading-tight font-medium">
      {formatLogicalDate(today)}
      {late ? (
        <span className="text-muted-foreground ml-1 text-base font-normal">
          · still open until {formatRolloverHour(rolloverHour)}
        </span>
      ) : null}
    </h1>

    {progressCopy ? (
      <div className="mt-3">
        <p className="text-base">{progressCopy}</p>
        {showBar ? (
          <div
            aria-hidden="true"
            className="bg-border mt-2 h-1 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : null}
      </div>
    ) : null}
  </header>
);
