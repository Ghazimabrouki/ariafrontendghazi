"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/animated-counter";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "critical" | "warning" | "success";
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover-lift cursor-pointer",
        variant === "critical" && "border-destructive/30 hover:border-destructive/50",
        variant === "warning" && "border-warning/30 hover:border-warning/50",
        variant === "success" && "border-success/30 hover:border-success/50",
        variant === "default" && "hover:border-primary/30",
        className
      )}
      onClick={onClick}
    >
      {/* Background gradient effect */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          variant === "default" && "bg-gradient-to-br from-primary/5 to-transparent",
          variant === "critical" && "bg-gradient-to-br from-destructive/10 to-transparent",
          variant === "warning" && "bg-gradient-to-br from-warning/10 to-transparent",
          variant === "success" && "bg-gradient-to-br from-success/10 to-transparent"
        )}
      />
      
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-3">
              <AnimatedCounter
                value={value}
                className="text-3xl font-bold tracking-tight"
                duration={800}
              />
              {trend && (
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    trend.isPositive
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {trend.isPositive ? "+" : ""}
                  {trend.value}%
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
              variant === "default" && "bg-primary/10 text-primary",
              variant === "critical" && "bg-destructive/10 text-destructive",
              variant === "warning" && "bg-warning/10 text-warning",
              variant === "success" && "bg-success/10 text-success"
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
      
      {/* Bottom accent line */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-0.5 w-full transition-all duration-300",
          variant === "default" && "bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100",
          variant === "critical" && "bg-gradient-to-r from-transparent via-destructive to-transparent",
          variant === "warning" && "bg-gradient-to-r from-transparent via-warning to-transparent",
          variant === "success" && "bg-gradient-to-r from-transparent via-success to-transparent"
        )}
      />
    </Card>
  );
}

// Skeleton loader for stat card
export function StatCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-8 w-16" />
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="skeleton h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}
