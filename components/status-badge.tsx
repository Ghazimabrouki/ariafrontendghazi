"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string; dot?: string }> = {
  // Alert statuses
  new: {
    label: "New",
    className: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary animate-pulse",
  },
  // Incident statuses
  open: {
    label: "Open",
    className: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
  investigating: {
    label: "Investigating",
    className: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary animate-pulse",
  },
  resolved: {
    label: "Resolved",
    className: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  closed: {
    label: "Closed",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  // Investigation statuses
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  running: {
    label: "Running",
    className: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary animate-pulse",
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    className: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning animate-pulse",
  },
  completed: {
    label: "Completed",
    className: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  // Service statuses
  healthy: {
    label: "Healthy",
    className: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  degraded: {
    label: "Degraded",
    className: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
  down: {
    label: "Down",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  // Playbook statuses
  approved: {
    label: "Approved",
    className: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  declined: {
    label: "Declined",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  executed: {
    label: "Executed",
    className: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      )}
      {config.label}
    </span>
  );
}
