"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, FileWarning, Search, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const ACTIVITY_ICONS = {
  alert: AlertTriangle,
  incident: FileWarning,
  investigation: Search,
  archive: Archive,
};

const ACTIVITY_COLORS = {
  alert: "text-warning bg-warning/10",
  incident: "text-destructive bg-destructive/10",
  investigation: "text-primary bg-primary/10",
  archive: "text-success bg-success/10",
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[320px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const colorClass = ACTIVITY_COLORS[activity.type];

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-accent/50"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm leading-tight">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
