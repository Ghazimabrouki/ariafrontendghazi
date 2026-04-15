"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, FileWarning, Search, Archive, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

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
  alert: "text-warning bg-warning/10 group-hover:bg-warning/20",
  incident: "text-destructive bg-destructive/10 group-hover:bg-destructive/20",
  investigation: "text-primary bg-primary/10 group-hover:bg-primary/20",
  archive: "text-success bg-success/10 group-hover:bg-success/20",
};

const ACTIVITY_LINKS = {
  alert: "/alerts",
  incident: "/incidents",
  investigation: "/investigations",
  archive: "/archives",
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[320px] pr-4">
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const colorClass = ACTIVITY_COLORS[activity.type];
              const linkHref = ACTIVITY_LINKS[activity.type];

              return (
                <Link
                  key={activity.id}
                  href={linkHref}
                  className={cn(
                    "group flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-3",
                    "transition-all duration-200 hover:bg-accent/50 hover:border-border hover:-translate-y-0.5",
                    "animate-slide-up"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm leading-tight line-clamp-2">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
