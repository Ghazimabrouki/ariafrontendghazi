"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { X, ArrowRight, Clock, Server, Globe } from "lucide-react";
import {
  investigationsAPI,
  type Investigation,
  type InvestigationListResponse,
  type InvestigationStats,
} from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Mock data for demonstration
const mockInvestigations: Investigation[] = Array.from({ length: 12 }, (_, i) => ({
  id: `investigation-${i + 1}`,
  incident_id: `inc-${i + 1}`,
  incident_title: [
    "SSH Brute Force Attack - 117.50.130.90 (CN)",
    "Potential data exfiltration via DNS tunneling",
    "Malware signature detected in containerized workload",
    "Unauthorized API access pattern identified",
    "SQL injection attempt on web application",
    "Privilege escalation attempt in Kubernetes cluster",
  ][i % 6],
  status: (["pending", "running", "awaiting_approval", "approved", "completed", "failed", "archived", "declined"] as const)[i % 8],
  severity: (["critical", "high", "medium", "low"] as const)[i % 4],
  source_ips: [`117.50.130.${90 + i}`, `103.45.67.${80 + i}`],
  ai_summary: [
    "SSH brute force attack detected from multiple IPs targeting production servers",
    "Potential data exfiltration attempt via DNS tunneling",
    "Malware signature detected in containerized workload",
    "Unauthorized API access pattern identified",
    "SQL injection attempt on web application",
    "Privilege escalation attempt in Kubernetes cluster",
  ][i % 6],
  target_host: ["ghazi", "web-server-01", "db-server-02", "api-gateway"][i % 4],
  created_at: new Date(Date.now() - i * 5400000).toISOString(),
  updated_at: new Date(Date.now() - i * 2700000).toISOString(),
}));

const mockStats: InvestigationStats = {
  pending: 5,
  awaiting_approval: 52,
  approved: 7,
  running: 2,
  completed: 3,
  failed: 8,
  archived: 18,
  declined: 2,
  total: 97,
};

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
];

export default function InvestigationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const limit = 20;

  const { data, error, isLoading, mutate } = useSWR<InvestigationListResponse>(
    ["investigations", offset, status],
    () =>
      investigationsAPI
        .list({
          limit,
          offset,
          status: status !== "all" ? status : undefined,
        })
        .catch(() => {
          let filtered = [...mockInvestigations];
          if (status !== "all") {
            filtered = filtered.filter((i) => i.status === status);
          }
          return {
            investigations: filtered.slice(offset, offset + limit),
            total: filtered.length,
          };
        }),
    { refreshInterval: 15000 }
  );

  const { data: stats } = useSWR<InvestigationStats>(
    "investigations-stats",
    () => investigationsAPI.getStats().catch(() => mockStats),
    { refreshInterval: 30000 }
  );

  const handleWSUpdate = useCallback((message: WSMessage) => {
    mutate();
  }, [mutate]);

  useWSSubscription("investigation_created", handleWSUpdate);
  useWSSubscription("investigation_updated", handleWSUpdate);
  useWSSubscription("playbook_status_changed", handleWSUpdate);

  const investigations = data?.investigations || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * limit);
  };

  const pendingApprovals = stats?.awaiting_approval || 0;

  const columns = [
    {
      key: "severity",
      header: "Severity",
      cell: (inv: Investigation) => (
        inv.severity ? <SeverityBadge severity={inv.severity} /> : <span className="text-muted-foreground">-</span>
      ),
      className: "w-28",
    },
    {
      key: "status",
      header: "Status",
      cell: (inv: Investigation) => <StatusBadge status={inv.status} />,
      className: "w-40",
    },
    {
      key: "incident",
      header: "Incident",
      cell: (inv: Investigation) => (
        <div className="max-w-md">
          <p className="truncate font-medium">{inv.incident_title}</p>
          <div className="flex items-center gap-2 mt-1">
            {inv.target_host && (
              <Badge variant="secondary" className="text-xs">
                <Server className="mr-1 h-2 w-2" />
                {inv.target_host}
              </Badge>
            )}
            {inv.source_ips && inv.source_ips.length > 0 && (
              <span className="text-xs text-muted-foreground font-mono">
                {inv.source_ips[0]}
                {inv.source_ips.length > 1 && ` +${inv.source_ips.length - 1}`}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "incident_link",
      header: "Incident ID",
      cell: (inv: Investigation) => (
        <Badge
          variant="outline"
          className="cursor-pointer font-mono text-xs"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/incidents/${inv.incident_id}`);
          }}
        >
          {inv.incident_id}
        </Badge>
      ),
      className: "w-32",
    },
    {
      key: "updated",
      header: "Last Update",
      cell: (inv: Investigation) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(inv.updated_at), { addSuffix: true })}
        </span>
      ),
      className: "w-32",
    },
    {
      key: "actions",
      header: "",
      cell: (inv: Investigation) => (
        <Button
          variant={inv.status === "awaiting_approval" ? "default" : "ghost"}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/investigations/${inv.id}`);
          }}
        >
          {inv.status === "awaiting_approval" ? "Review" : "View"}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ),
      className: "w-28",
    },
  ];

  const clearFilters = () => {
    setStatus("all");
    setOffset(0);
  };

  const hasFilters = status !== "all";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Investigations"
        description="AI-powered security investigations with automated playbooks"
        onRefresh={() => mutate()}
        isLoading={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Pending Approvals Alert */}
        {pendingApprovals > 0 && status === "all" && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium">
                    {pendingApprovals} investigation{pendingApprovals > 1 ? "s" : ""} awaiting approval
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Review AI-generated playbooks before execution
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-warning text-warning hover:bg-warning/10"
                onClick={() => setStatus("awaiting_approval")}
              >
                Review Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          {[
            { key: "pending", label: "Pending", count: stats?.pending || 0 },
            { key: "running", label: "Running", count: stats?.running || 0 },
            { key: "awaiting_approval", label: "Awaiting", count: stats?.awaiting_approval || 0 },
            { key: "approved", label: "Approved", count: stats?.approved || 0 },
            { key: "completed", label: "Completed", count: stats?.completed || 0 },
            { key: "failed", label: "Failed", count: stats?.failed || 0 },
            { key: "declined", label: "Declined", count: stats?.declined || 0 },
            { key: "archived", label: "Archived", count: stats?.archived || 0 },
          ].map((item) => {
            const isActive = status === item.key;

            return (
              <Card
                key={item.key}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  isActive && "ring-2 ring-primary"
                )}
                onClick={() => setStatus(isActive ? "all" : item.key)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-bold">{item.count}</span>
                    <StatusBadge status={item.key} className="text-[10px]" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DataTable
          columns={columns}
          data={investigations}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onRowClick={(inv) => router.push(`/investigations/${inv.id}`)}
          isLoading={isLoading}
          emptyMessage="No investigations found"
        />
      </div>
    </div>
  );
}
