type LoadingStateProps = {
  title?: string;
  description?: string;
  rows?: number;
  compact?: boolean;
};

export function InlineSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#8b91b3]">
      <span className="loading-spinner" />
      {label}
    </span>
  );
}

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-line" style={{ width: `${92 - index * 12}%` }} />
      ))}
    </div>
  );
}

export default function LoadingState({
  title = "Loading workspace",
  description = "Collecting the latest product signals.",
  rows = 4,
  compact = false,
}: LoadingStateProps) {
  return (
    <div className={`loading-panel ${compact ? "py-8" : "py-14"}`}>
      <div className="loading-mark">
        <span />
      </div>
      <div className="text-center">
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-1 text-xs font-medium text-[#8b91b3]">{description}</p>
      </div>
      <div className="w-full max-w-md">
        <SkeletonBlock rows={rows} />
      </div>
    </div>
  );
}
