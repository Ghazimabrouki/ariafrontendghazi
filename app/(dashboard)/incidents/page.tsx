"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { X, AlertTriangle, ArrowRight, Tag, User } from "lucide-react";
import { incidentsAPI, type Incident, type IncidentListResponse } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";

// Mock data for demonstration
const mockIncidents: Incident[] = Array.from({ length: 15 }, (_, i) => ({
  id: `incident-${i + 1}`,
  title: [
    "ET SCAN Potential SSH Scan - 172.104.13.54 on ghazi",
    "Data Exfiltration Attempt Detected",
    "Malware Infection on Production Server",
    "Unauthorized Access to Admin Panel",
    "SQL Injection Attack on Web Application",
    "DDoS Attack on API Gateway",
    "Privilege Escalation Attempt",
    "Suspicious Container Activity",
  ][i % 8],
  description: "Multiple correlated alerts indicate a potential security incident requiring investigation.",
  severity: (["critical", "high", "medium", "low"] as const)[i % 4],
  status: (["open", "closed"] as const)[i % 2],
  assigned_to: i % 3 === 0 ? "user-1" : null,
  assigned_username: i % 3 === 0 ? "admin" : null,
  tags: [
    ["source-suricata", "ssh", "brute-force"],
    ["wazuh", "file-integrity"],
    ["falco", "container-escape"],
    ["auth-failure"],
  ][i % 4],
  alert_count: Math.floor(Math.random() * 20) + 3,
  closed_at: i % 2 === 1 ? new Date(Date.now() - i * 1000000).toISOString() : null,
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
  updated_at: new Date(Date.now() - i * 1800000).toISOString(),
}));

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const severityOptions = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function IncidentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "all");
  const limit = 20;

  const { data, error, isLoading, mutate } = useSWR<IncidentListResponse>(
    ["incidents", offset, status, severity],
    () =>
      incidentsAPI
        .list({
          limit,
          offset,
          status: status !== "all" ? status : undefined,
          severity: severity !== "all" ? severity : undefined,
        })
        .catch(() => {
          let filtered = [...mockIncidents];
          if (status !== "all") {
            filtered = filtered.filter((i) => i.status === status);
          }
          if (severity !== "all") {
            filtered = filtered.filter((i) => i.severity === severity);
          }
          return {
            incidents: filtered.slice(offset, offset + limit),
            total: filtered.length,
            limit,
            offset,
          };
        }),
    { refreshInterval: 30000 }
  );

  const handleWSUpdate = useCallback((message: WSMessage) => {
    mutate();
  }, [mutate]);

  useWSSubscription("incident_created", handleWSUpdate);
  useWSSubscription("incident_updated", handleWSUpdate);

  const incidents = data?.incidents || [];
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
      cell: (incident: Incident) => <SeverityBadge severity={incident.severity} />,
      className: "w-28",
    },
    {
      key: "title",
      header: "Incident",
      cell: (incident: Incident) => (
        <div className="max-w-md">
          <p className="truncate font-medium">{incident.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {incident.tags?.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                <Tag className="mr-1 h-2 w-2" />
                {tag}
              </Badge>
            ))}
            {incident.tags && incident.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{incident.tags.length - 2}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (incident: Incident) => <StatusBadge status={incident.status} />,
      className: "w-28",
    },
    {
      key: "alerts",
      header: "Alerts",
      cell: (incident: Incident) => (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">{incident.alert_count}</span>
        </div>
      ),
      className: "w-20",
    },
    {
      key: "assignee",
      header: "Assignee",
      cell: (incident: Incident) => (
        incident.assigned_username ? (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{incident.assigned_username}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )
      ),
      className: "w-28",
    },
    {
      key: "created",
      header: "Created",
      cell: (incident: Incident) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
        </span>
      ),
      className: "w-32",
    },
    {
      key: "actions",
      header: "",
      cell: (incident: Incident) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/incidents/${incident.id}`);
          }}
        >
          View
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ),
      className: "w-24",
    },
  ];

  const clearFilters = () => {
    setStatus("all");
    setSeverity("all");
    setOffset(0);
  };

  const hasFilters = status !== "all" || severity !== "all";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Incidents"
        description="Security incidents requiring investigation"
        onRefresh={() => mutate()}
        isLoading={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
              <SelectTrigger className="w-36">
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
            <Select value={severity} onValueChange={(v) => { setSeverity(v); setOffset(0); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                {severityOptions.map((opt) => (
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

      <div className="flex-1 p-6">
        <DataTable
          columns={columns}
          data={incidents}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onRowClick={(incident) => router.push(`/incidents/${incident.id}`)}
          isLoading={isLoading}
          emptyMessage="No incidents found"
        />
      </div>
    </div>
  );
}
