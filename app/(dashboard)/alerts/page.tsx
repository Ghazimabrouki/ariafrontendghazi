"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import {
  ExternalLink,
  Filter,
  X,
  Globe,
  Server,
  Tag,
  AlertTriangle,
  Shield,
  Copy,
  ChevronRight,
} from "lucide-react";
import {
  alertsAPI,
  incidentsAPI,
  type Alert,
  type AlertListResponse,
  type AlertDetailResponse,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Mock data for demonstration
const mockAlerts: Alert[] = Array.from({ length: 25 }, (_, i) => ({
  id: `alert-${i + 1}`,
  source: ["wazuh", "falco", "suricata", "filebeat"][i % 4],
  source_id: `src-${i + 1000}`,
  title: [
    "ET SCAN Potential SSH Scan",
    "Suspicious file modification in /etc/passwd",
    "Multiple failed authentication attempts",
    "Potential SQL injection attempt",
    "Unusual network traffic pattern detected",
    "Container escape attempt detected by Falco",
    "Malware signature detected by ClamAV",
    "Unauthorized API access attempt",
  ][i % 8],
  description: `Detailed description of the security event. This alert was triggered due to suspicious activity detected on the monitored system. Alert index: ${i + 1}`,
  severity: (["critical", "high", "medium", "low"] as const)[i % 4],
  status: (["new", "open", "investigating", "closed"] as const)[i % 4],
  source_ip: `${172 + (i % 3)}.${104 + (i % 10)}.${13 + (i % 20)}.${54 + i}`,
  dest_ip: "10.175.1.137",
  hostname: ["ghazi", "web-server-01", "db-server-02", "api-gateway"][i % 4],
  rule_name: [
    "ET SCAN Potential SSH Scan",
    "File integrity monitoring alert",
    "Authentication failure threshold exceeded",
    "SQL injection attempt detected",
  ][i % 4],
  iocs: {
    ips: [`${172 + (i % 3)}.${104 + (i % 10)}.${13 + (i % 20)}.${54 + i}`, "10.175.1.137"],
    hashes: i % 3 === 0 ? ["a1b2c3d4e5f6789012345678901234567890abcd"] : [],
    domains: i % 4 === 0 ? ["malicious-domain.com"] : [],
    urls: [],
  },
  tags: [
    ["suricata", "mitre-T1595", "src-country-US"],
    ["wazuh", "file-integrity", "critical-system"],
    ["falco", "container-escape", "kubernetes"],
    ["auth-failure", "brute-force", "ssh"],
  ][i % 4],
  created_at: new Date(Date.now() - i * 300000).toISOString(),
  updated_at: new Date(Date.now() - i * 300000).toISOString(),
}));

const mockAlertDetail: AlertDetailResponse = {
  data: mockAlerts[0],
  relationships: {
    incidents: {
      count: 2,
      items: [
        { id: "inc-1", title: "SSH Brute Force Attack Investigation" },
        { id: "inc-2", title: "Related Network Scan Activity" },
      ],
      view_all: "/api/v1/alerts/alert-1/incidents",
    },
    similar: {
      count: 5,
      items: [
        { id: "alert-2", source_ip: "172.104.13.55" },
        { id: "alert-3", source_ip: "172.104.13.56" },
      ],
      view_all: "/api/v1/alerts/alert-1/similar",
    },
  },
  actions: {
    view_timeline: "/api/v1/incidents/inc-1/timeline",
    search_ip: "/api/v1/search/ips/172.104.13.54",
  },
};

const sourceOptions = [
  { value: "all", label: "All Sources" },
  { value: "wazuh", label: "Wazuh" },
  { value: "falco", label: "Falco" },
  { value: "suricata", label: "Suricata" },
  { value: "filebeat", label: "Filebeat" },
];

const severityOptions = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "closed", label: "Closed" },
];

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [source, setSource] = useState(searchParams.get("source") || "all");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const limit = 20;

  const { data, error, isLoading, mutate } = useSWR<AlertListResponse>(
    ["alerts", offset, source, severity, status],
    () =>
      alertsAPI
        .list({
          limit,
          offset,
          source: source !== "all" ? source : undefined,
          severity: severity !== "all" ? severity : undefined,
          status: status !== "all" ? status : undefined,
        })
        .catch(() => ({
          alerts: mockAlerts.slice(offset, offset + limit),
          total: mockAlerts.length,
          limit,
          offset,
        }))
  );

  // Fetch full alert details when one is selected
  const { data: alertDetail, isLoading: detailLoading } = useSWR<AlertDetailResponse>(
    selectedAlertId ? ["alert-detail", selectedAlertId] : null,
    () =>
      alertsAPI.get(selectedAlertId!).catch(() => ({
        ...mockAlertDetail,
        data: mockAlerts.find((a) => a.id === selectedAlertId) || mockAlerts[0],
      }))
  );

  const handleWSUpdate = useCallback(
    (message: WSMessage) => {
      mutate();
    },
    [mutate]
  );

  useWSSubscription("alert_created", handleWSUpdate);

  const alerts = data?.alerts || [];
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
      cell: (alert: Alert) => <SeverityBadge severity={alert.severity} />,
      className: "w-28",
    },
    {
      key: "title",
      header: "Alert",
      cell: (alert: Alert) => (
        <div className="max-w-md">
          <p className="truncate font-medium">{alert.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground font-mono">
              {alert.source_ip}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{alert.hostname}</span>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (alert: Alert) => (
        <Badge variant="outline" className="capitalize">
          {alert.source}
        </Badge>
      ),
      className: "w-28",
    },
    {
      key: "status",
      header: "Status",
      cell: (alert: Alert) => <StatusBadge status={alert.status} />,
      className: "w-32",
    },
    {
      key: "timestamp",
      header: "Time",
      cell: (alert: Alert) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
        </span>
      ),
      className: "w-32",
    },
  ];

  const clearFilters = () => {
    setSource("all");
    setSeverity("all");
    setStatus("all");
    setOffset(0);
  };

  const hasFilters = source !== "all" || severity !== "all" || status !== "all";

  const selectedAlert = alertDetail?.data;
  const relationships = alertDetail?.relationships;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Alerts"
        description="Security alerts from all monitoring sources"
        onRefresh={() => mutate()}
        isLoading={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v);
                setOffset(0);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={severity}
              onValueChange={(v) => {
                setSeverity(v);
                setOffset(0);
              }}
            >
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
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setOffset(0);
              }}
            >
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
          data={alerts}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onRowClick={(alert) => setSelectedAlertId(alert.id)}
          isLoading={isLoading}
          emptyMessage="No alerts found"
        />
      </div>

      {/* Alert Detail Sheet */}
      <Sheet open={!!selectedAlertId} onOpenChange={() => setSelectedAlertId(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {detailLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : selectedAlert ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={selectedAlert.severity} />
                  <StatusBadge status={selectedAlert.status} />
                </div>
                <SheetTitle className="text-left">{selectedAlert.title}</SheetTitle>
                <SheetDescription className="text-left">
                  {format(new Date(selectedAlert.created_at), "PPpp")}
                </SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="iocs">IOCs</TabsTrigger>
                  <TabsTrigger value="related">Related</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  {/* Description */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedAlert.description}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Network Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">Network Information</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Source IP</span>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {selectedAlert.source_ip}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(selectedAlert.source_ip)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => router.push(`/search?q=${selectedAlert.source_ip}`)}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Destination IP</span>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {selectedAlert.dest_ip}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(selectedAlert.dest_ip)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Host Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">Host Information</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Hostname</span>
                        <Badge variant="secondary">{selectedAlert.hostname}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Source</span>
                        <Badge variant="outline" className="capitalize">
                          {selectedAlert.source}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Rule</span>
                        <span className="text-sm font-medium">{selectedAlert.rule_name}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tags */}
                  {selectedAlert.tags && selectedAlert.tags.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-sm font-medium">Tags</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedAlert.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="iocs" className="space-y-4 mt-4">
                  {/* IP Indicators */}
                  {selectedAlert.iocs?.ips && selectedAlert.iocs.ips.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">IP Addresses</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedAlert.iocs.ips.map((ip, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                {ip}
                              </code>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(ip)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/search?q=${ip}`)}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Hashes */}
                  {selectedAlert.iocs?.hashes && selectedAlert.iocs.hashes.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">File Hashes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedAlert.iocs.hashes.map((hash, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <code className="bg-muted px-2 py-1 rounded text-xs font-mono truncate max-w-[300px]">
                                {hash}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(hash)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Domains */}
                  {selectedAlert.iocs?.domains && selectedAlert.iocs.domains.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Domains</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedAlert.iocs.domains.map((domain, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                {domain}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(domain)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Empty state */}
                  {(!selectedAlert.iocs ||
                    (selectedAlert.iocs.ips.length === 0 &&
                      selectedAlert.iocs.hashes.length === 0 &&
                      selectedAlert.iocs.domains.length === 0 &&
                      selectedAlert.iocs.urls.length === 0)) && (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          No IOCs extracted from this alert
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="related" className="space-y-4 mt-4">
                  {/* Related Incidents */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Related Incidents</CardTitle>
                        <Badge variant="secondary">{relationships?.incidents?.count || 0}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {relationships?.incidents?.items &&
                      relationships.incidents.items.length > 0 ? (
                        <div className="space-y-2">
                          {relationships.incidents.items.map((incident) => (
                            <div
                              key={incident.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer"
                              onClick={() => router.push(`/incidents/${incident.id}`)}
                            >
                              <span className="text-sm truncate max-w-[350px]">
                                {incident.title}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No related incidents found
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Similar Alerts */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Similar Alerts</CardTitle>
                        <Badge variant="secondary">{relationships?.similar?.count || 0}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {relationships?.similar?.items &&
                      relationships.similar.items.length > 0 ? (
                        <div className="space-y-2">
                          {relationships.similar.items.map((alert) => (
                            <div
                              key={alert.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer"
                              onClick={() => setSelectedAlertId(alert.id)}
                            >
                              <code className="text-sm font-mono">{alert.source_ip}</code>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ))}
                          {relationships.similar.count > relationships.similar.items.length && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() =>
                                router.push(`/alerts?source_ip=${selectedAlert.source_ip}`)
                              }
                            >
                              View all {relationships.similar.count} similar alerts
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No similar alerts found</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
