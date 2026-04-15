"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  actions?: React.ReactNode;
  isLive?: boolean;
  badge?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  onRefresh,
  isLoading,
  actions,
  isLive,
  badge,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{title}</h1>
              {isLive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                  Live
                </div>
              )}
              {badge}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {actions}
          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              className="relative"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
