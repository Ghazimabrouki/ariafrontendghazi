"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowRight,
  Archive,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  Filter,
} from "lucide-react";
import {
  archivesAPI,
  type Archive as ArchiveType,
  type ArchiveListResponse,
  type ArchiveStats,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Mock data
const mockArchives: ArchiveType[] = Array.from({ length: 20 }, (_, i) => ({
  id: `archive-${i + 1}`,
  investigation_id: `inv-${i + 1}`,
  incident_id: `inc-${i + 1}`,
  incident_title: [
    "SSH brute force attack mitigated - Attacker IPs blocked",
    "False positive - Legitimate admin activity confirmed",
    "Malware removed from production server",
    "Data exfiltration attempt blocked at firewall",
    "SQL injection vulnerability patched",
    "Container escape attempt prevented by Falco",
  ][i % 6],
  severity: (["critical", "high", "medium", "low"] as const)[i % 4],
  fix_status: (["likely_fixed", "not_fixed", "unknown"] as const)[i % 3],
  fix_detail: [
    "Blocked 47 malicious IPs at firewall, enabled fail2ban with aggressive settings. No new alerts observed.",
    "Confirmed legitimate activity from authorized admin, updated whitelist. Verified with user.",
    "Removed malware, patched vulnerability, rotated credentials. System clean after 24hr monitoring.",
    "Updated DLP rules, blocked data transfer to unauthorized endpoints. Data integrity verified.",
    "Applied security patches, implemented input validation. Penetration test passed.",
    "Updated container security policies, added runtime protection. No escape attempts since.",
  ][i % 6],
  archived_at: new Date(Date.now() - i * 86400000).toISOString(),
}));

const mockStats: ArchiveStats = {
  total_archived: 34,
  fix_success_rate_pct: 80.0,
  by_fix_status: {
    likely_fixed: 20,
    not_fixed: 4,
    unknown: 10,
  },
  by_severity: {
    critical: 2,
    high: 10,
    medium: 15,
    low: 7,
  },
};

function FixStatusBadge({ status }: { status: string }) {
  const config = {
    likely_fixed: {
      icon: CheckCircle2,
      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      label: "Fixed",
    },
    not_fixed: {
      icon: XCircle,
      className: "bg-destructive/10 text-destructive border-destructive/20",
      label: "Not Fixed",
    },
    unknown: {
      icon: HelpCircle,
      className: "bg-muted text-muted-foreground border-border",
      label: "Unknown",
    },
  }[status] || {
    icon: HelpCircle,
    className: "bg-muted text-muted-foreground border-border",
    label: status,
  };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function ArchivesPage() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [fixStatusFilter, setFixStatusFilter] = useState<string>("all");
  const limit = 20;

  const { data, isLoading, mutate } = useSWR<ArchiveListResponse>(
    ["archives", offset, fixStatusFilter],
    () =>
      archivesAPI
        .list({
          limit,
          offset,
          fix_status: fixStatusFilter !== "all" ? fixStatusFilter : undefined,
        })
        .catch(() => ({
          archives: mockArchives.slice(offset, offset + limit),
          total: mockArchives.length,
        }))
  );

  const { data: stats } = useSWR<ArchiveStats>(
    "archives-stats",
    () => archivesAPI.getStats().catch(() => mockStats),
    { refreshInterval: 60000 }
  );

  const archives = data?.archives || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * limit);
  };

  const columns = [
    {
      key: "severity",
      header: "Severity",
      cell: (archive: ArchiveType) => (
        <SeverityBadge severity={archive.severity} />
      ),
      className: "w-28",
    },
    {
      key: "title",
      header: "Incident",
      cell: (archive: ArchiveType) => (
        <div className="max-w-md">
          <p className="truncate font-medium">{archive.incident_title}</p>
          <p className="truncate text-xs text-muted-foreground mt-1">
            {archive.fix_detail}
          </p>
        </div>
      ),
    },
    {
      key: "fix_status",
      header: "Fix Status",
      cell: (archive: ArchiveType) => (
        <FixStatusBadge status={archive.fix_status} />
      ),
      className: "w-32",
    },
    {
      key: "investigation",
      header: "Investigation",
      cell: (archive: ArchiveType) => (
        <Badge
          variant="outline"
          className="cursor-pointer font-mono text-xs"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/investigations/${archive.investigation_id}`);
          }}
        >
          {archive.investigation_id}
        </Badge>
      ),
      className: "w-32",
    },
    {
      key: "archived",
      header: "Archived",
      cell: (archive: ArchiveType) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(archive.archived_at), { addSuffix: true })}
        </span>
      ),
      className: "w-32",
    },
    {
      key: "actions",
      header: "",
      cell: (archive: ArchiveType) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/archives/${archive.id}`);
          }}
        >
          View
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ),
      className: "w-24",
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Archives"
        description="Completed investigations and remediation history"
        onRefresh={() => mutate()}
        isLoading={isLoading}
        actions={
          <Select value={fixStatusFilter} onValueChange={setFixStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="likely_fixed">Likely Fixed</SelectItem>
              <SelectItem value="not_fixed">Not Fixed</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Archived</p>
                  <p className="text-3xl font-bold">{stats?.total_archived || 0}</p>
                </div>
                <Archive className="h-10 w-10 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-bold">
                    {stats?.fix_success_rate_pct?.toFixed(0) || 0}%
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Likely Fixed</p>
                  <p className="text-3xl font-bold text-emerald-500">
                    {stats?.by_fix_status?.likely_fixed || 0}
                  </p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Not Fixed</p>
                  <p className="text-3xl font-bold text-destructive">
                    {stats?.by_fix_status?.not_fixed || 0}
                  </p>
                </div>
                <XCircle className="h-10 w-10 text-destructive/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          columns={columns}
          data={archives}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onRowClick={(archive) => router.push(`/archives/${archive.id}`)}
          isLoading={isLoading}
          emptyMessage="No archived investigations"
        />
      </div>
    </div>
  );
}
