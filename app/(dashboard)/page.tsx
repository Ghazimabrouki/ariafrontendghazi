"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { AlertTriangle, FileWarning, Search, Clock, Activity, Shield } from "lucide-react";
import { 
  dashboardAPI, 
  investigationsAPI,
  alertsAPI,
  type DashboardSummary, 
  type QuickStats,
  type InvestigationStats,
  type AlertListResponse,
  type TrendData,
  type SeverityCount,
  type ActivityItem
} from "@/lib/api";
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

// Types for combined dashboard data
interface DashboardData {
  quickStats: QuickStats;
  summary: DashboardSummary;
  investigationStats: InvestigationStats;
  alertsTrend: TrendData[];
  severityBreakdown: SeverityCount[];
  recentActivity: ActivityItem[];
}

// Mock data for demonstration when API is unavailable
const mockQuickStats: QuickStats = {
  alerts: 12847,
  incidents: 47,
  investigations: 12,
  archives: 156,
};

const mockSummary: DashboardSummary = {
  alerts: {
    total: 12847,
    by_severity: { critical: 23, high: 156, medium: 892, low: 11776 },
    by_status: { new: 45, open: 234, investigating: 89, closed: 12479 },
    by_source: { wazuh: 8234, suricata: 3201, falco: 1412 },
    navigation: "/alerts",
  },
  incidents: {
    total: 47,
    by_severity: { critical: 8, high: 15, medium: 18, low: 6 },
    by_status: { open: 35, closed: 12 },
    navigation: "/incidents",
  },
  investigations: {
    total: 12,
    by_status: { pending: 2, running: 3, awaiting_approval: 5, approved: 1, completed: 1 },
    navigation: "/investigations",
  },
  archives: {
    total: 156,
    navigation: "/archives",
  },
  pipeline: {
    running: true,
  },
};

const mockInvestigationStats: InvestigationStats = {
  pending: 2,
  awaiting_approval: 5,
  approved: 1,
  running: 3,
  completed: 89,
  failed: 2,
  archived: 156,
  declined: 8,
  total: 266,
};

const mockAlertsTrend: TrendData[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
  count: Math.floor(Math.random() * 500) + 200,
}));

const mockSeverityBreakdown: SeverityCount[] = [
  { severity: "critical", count: 8 },
  { severity: "high", count: 15 },
  { severity: "medium", count: 32 },
  { severity: "low", count: 42 },
];

const mockRecentActivity: ActivityItem[] = [
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
];

// Fetch all dashboard data using correct API endpoints
async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const [quickStats, summary, investigationStats] = await Promise.all([
      dashboardAPI.getQuickStats().catch(() => mockQuickStats),
      dashboardAPI.getSummary().catch(() => mockSummary),
      investigationsAPI.getStats().catch(() => mockInvestigationStats),
    ]);

    // Convert summary data to chart-friendly formats
    const severityBreakdown: SeverityCount[] = Object.entries(
      summary.incidents?.by_severity || {}
    ).map(([severity, count]) => ({
      severity,
      count: count as number,
    }));

    return {
      quickStats,
      summary,
      investigationStats,
      alertsTrend: mockAlertsTrend, // Real endpoint would be alerts trend API
      severityBreakdown: severityBreakdown.length > 0 ? severityBreakdown : mockSeverityBreakdown,
      recentActivity: mockRecentActivity, // Would need a real activity endpoint
    };
  } catch {
    return {
      quickStats: mockQuickStats,
      summary: mockSummary,
      investigationStats: mockInvestigationStats,
      alertsTrend: mockAlertsTrend,
      severityBreakdown: mockSeverityBreakdown,
      recentActivity: mockRecentActivity,
    };
  }
}

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    "dashboard-data",
    fetchDashboardData,
    {
      refreshInterval: 30000,
      fallbackData: {
        quickStats: mockQuickStats,
        summary: mockSummary,
        investigationStats: mockInvestigationStats,
        alertsTrend: mockAlertsTrend,
        severityBreakdown: mockSeverityBreakdown,
        recentActivity: mockRecentActivity,
      },
    }
  );

  // Handle real-time updates
  const handleWSUpdate = useCallback((message: WSMessage) => {
    mutate();
  }, [mutate]);

  useWSSubscription("alert_created", handleWSUpdate);
  useWSSubscription("incident_created", handleWSUpdate);
  useWSSubscription("investigation_updated", handleWSUpdate);

  // Extract data with proper defaults
  const dashboardData = data || {
    quickStats: mockQuickStats,
    summary: mockSummary,
    investigationStats: mockInvestigationStats,
    alertsTrend: mockAlertsTrend,
    severityBreakdown: mockSeverityBreakdown,
    recentActivity: mockRecentActivity,
  };

  const { quickStats, summary, investigationStats, alertsTrend, severityBreakdown, recentActivity } = dashboardData;
  
  // Calculate critical alerts from summary
  const criticalAlerts = summary.alerts?.by_severity?.critical || 0;
  const openIncidents = summary.incidents?.by_status?.open || quickStats.incidents;
  const pendingApprovals = investigationStats.awaiting_approval || 0;

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 stagger-children">
          <StatCard
            title="Total Alerts"
            value={quickStats.alerts}
            subtitle="Last 24 hours"
            icon={AlertTriangle}
            trend={{ value: 12, isPositive: false }}
          />
          <StatCard
            title="Critical Alerts"
            value={criticalAlerts}
            subtitle="Requires immediate action"
            icon={Shield}
            variant="critical"
          />
          <StatCard
            title="Open Incidents"
            value={openIncidents}
            subtitle="Under investigation"
            icon={FileWarning}
            variant="warning"
          />
          <StatCard
            title="Active Investigations"
            value={quickStats.investigations}
            subtitle="AI analysis in progress"
            icon={Search}
          />
          <StatCard
            title="Pending Approvals"
            value={pendingApprovals}
            subtitle="Playbooks awaiting review"
            icon={Clock}
            variant={pendingApprovals > 0 ? "warning" : "success"}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <AlertsChart data={alertsTrend} />
          <SeverityChart data={severityBreakdown} />
        </div>

        {/* Activity and Actions Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ActivityFeed activities={recentActivity} />
          <QuickActions
            pendingApprovals={pendingApprovals}
            activeInvestigations={quickStats.investigations}
          />
        </div>
      </div>
    </div>
  );
}
