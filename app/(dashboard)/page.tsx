"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { AlertTriangle, FileWarning, Search, Clock, Activity, Shield } from "lucide-react";
import { dashboardAPI, type DashboardStats } from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { StatCard } from "@/components/dashboard/stat-card";
import { AlertsChart } from "@/components/dashboard/alerts-chart";
import { SeverityChart } from "@/components/dashboard/severity-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, RefreshCw } from "lucide-react";
import Link from "next/link";

// Mock data for demonstration when API is unavailable
const mockStats: DashboardStats = {
  total_alerts: 12847,
  critical_alerts: 23,
  open_incidents: 47,
  active_investigations: 12,
  pending_approvals: 5,
  alerts_trend: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    count: Math.floor(Math.random() * 500) + 200,
  })),
  incidents_by_severity: [
    { severity: "critical", count: 8 },
    { severity: "high", count: 15 },
    { severity: "medium", count: 32 },
    { severity: "low", count: 42 },
  ],
  recent_activity: [
    {
      id: "1",
      type: "alert",
      message: "High severity alert detected from Wazuh agent on web-server-01",
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: "2",
      type: "incident",
      message: "New incident INC-2024-0847 created with 5 correlated alerts",
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: "3",
      type: "investigation",
      message: "Investigation INV-2024-0312 completed - Playbook executed successfully",
      timestamp: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: "4",
      type: "archive",
      message: "Investigation INV-2024-0298 archived with resolution: False positive",
      timestamp: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: "5",
      type: "alert",
      message: "Suricata IDS detected potential SQL injection attempt",
      timestamp: new Date(Date.now() - 1200000).toISOString(),
    },
    {
      id: "6",
      type: "investigation",
      message: "AI analysis generated playbook for INV-2024-0315 - Awaiting approval",
      timestamp: new Date(Date.now() - 1500000).toISOString(),
    },
    {
      id: "7",
      type: "incident",
      message: "Incident INC-2024-0845 escalated to critical severity",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "8",
      type: "alert",
      message: "Falco detected suspicious container activity in prod-cluster",
      timestamp: new Date(Date.now() - 2100000).toISOString(),
    },
  ],
};

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: stats, error, isLoading, mutate } = useSWR<DashboardStats>(
    "dashboard-stats",
    () => dashboardAPI.getStats().catch(() => mockStats),
    {
      refreshInterval: 30000,
      fallbackData: mockStats,
    }
  );

  // Handle real-time updates
  const handleWSUpdate = useCallback((message: WSMessage) => {
    mutate();
  }, [mutate]);

  useWSSubscription("alert_created", handleWSUpdate);
  useWSSubscription("incident_created", handleWSUpdate);
  useWSSubscription("investigation_updated", handleWSUpdate);

  const data = stats || mockStats;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-semibold">Security Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Real-time security operations overview
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search alerts, incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery) {
                    window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
                  }
                }}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => mutate()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 space-y-6 p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <StatCard
            title="Total Alerts"
            value={data.total_alerts.toLocaleString()}
            subtitle="Last 24 hours"
            icon={AlertTriangle}
            trend={{ value: 12, isPositive: false }}
          />
          <StatCard
            title="Critical Alerts"
            value={data.critical_alerts}
            subtitle="Requires immediate action"
            icon={Shield}
            variant="critical"
          />
          <StatCard
            title="Open Incidents"
            value={data.open_incidents}
            subtitle="Under investigation"
            icon={FileWarning}
            variant="warning"
          />
          <StatCard
            title="Active Investigations"
            value={data.active_investigations}
            subtitle="AI analysis in progress"
            icon={Search}
          />
          <StatCard
            title="Pending Approvals"
            value={data.pending_approvals}
            subtitle="Playbooks awaiting review"
            icon={Clock}
            variant={data.pending_approvals > 0 ? "warning" : "success"}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <AlertsChart data={data.alerts_trend} />
          <SeverityChart data={data.incidents_by_severity} />
        </div>

        {/* Activity and Actions Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ActivityFeed activities={data.recent_activity} />
          <QuickActions
            pendingApprovals={data.pending_approvals}
            activeInvestigations={data.active_investigations}
          />
        </div>
      </div>
    </div>
  );
}
