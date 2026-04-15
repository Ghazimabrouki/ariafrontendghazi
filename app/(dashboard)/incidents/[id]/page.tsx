"use client";

import { use } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Tag,
  User,
  Globe,
  Server,
} from "lucide-react";
import {
  incidentsAPI,
  type Incident,
  type IncidentDetailResponse,
  type Alert,
  type IncidentTimeline,
  type Investigation,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Mock data
const mockIncident: Incident = {
  id: "incident-1",
  title: "ET SCAN Potential SSH Scan - 172.104.13.54 on ghazi",
  description:
    "Multiple SSH authentication failures detected from various source IPs, indicating a coordinated brute force attack against the production servers. The attack pattern suggests automated tools being used from a botnet.",
  severity: "high",
  status: "open",
  assigned_to: "user-1",
  assigned_username: "admin",
  tags: ["source-suricata", "ssh", "brute-force", "mitre-T1110"],
  alert_count: 47,
  closed_at: null,
  created_at: new Date(Date.now() - 7200000).toISOString(),
  updated_at: new Date(Date.now() - 1800000).toISOString(),
};

const mockAlerts: Alert[] = Array.from({ length: 10 }, (_, i) => ({
  id: `alert-${i + 1}`,
  source: "suricata",
  source_id: `suricata-${i + 1000}`,
  title: `ET SCAN Potential SSH Scan from 172.104.13.${54 + i}`,
  description: `SSH authentication failure from IP 172.104.13.${54 + i}`,
  severity: "high" as const,
  status: "investigating" as const,
  source_ip: `172.104.13.${54 + i}`,
  dest_ip: "10.175.1.137",
  hostname: "ghazi",
  rule_name: "ET SCAN Potential SSH Scan",
  iocs: {
    ips: [`172.104.13.${54 + i}`, "10.175.1.137"],
    hashes: [],
    domains: [],
    urls: [],
  },
  tags: ["suricata", "mitre-T1595", "src-country-US"],
  created_at: new Date(Date.now() - i * 180000).toISOString(),
  updated_at: new Date(Date.now() - i * 180000).toISOString(),
}));

const mockTimeline: IncidentTimeline = {
  incident_id: "incident-1",
  total_events: 6,
  events: [
    {
      type: "created",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      description: "Incident created from alert",
    },
    {
      type: "alert_added",
      timestamp: new Date(Date.now() - 6800000).toISOString(),
      description: "First SSH brute force attempt detected",
    },
    {
      type: "alert_added",
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      description: "Attack rate increased - 47 alerts correlated",
    },
    {
      type: "investigation_started",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      investigation_id: "inv-001",
      description: "Investigation INV-001 initiated",
    },
    {
      type: "ai_completed",
      timestamp: new Date(Date.now() - 2700000).toISOString(),
      playbook_generated: true,
      description: "AI analysis completed - playbook generated",
    },
    {
      type: "status_changed",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      description: "Status updated to investigating",
    },
  ],
};

const mockInvestigations: Investigation[] = [
  {
    id: "inv-001",
    incident_id: "incident-1",
    incident_title: "ET SCAN Potential SSH Scan",
    status: "awaiting_approval",
    severity: "high",
    ai_summary: "Coordinated SSH brute force attack detected from multiple IPs",
    target_host: "ghazi",
    source_ips: ["172.104.13.54", "172.104.13.55"],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

function getEventConfig(type: string) {
  const configs: Record<string, { color: string; label: string }> = {
    created: { color: "bg-primary", label: "Created" },
    alert_added: { color: "bg-warning", label: "Alert Added" },
    investigation_started: { color: "bg-blue-500", label: "Investigation Started" },
    ai_completed: { color: "bg-emerald-500", label: "AI Completed" },
    approved: { color: "bg-emerald-500", label: "Approved" },
    declined: { color: "bg-destructive", label: "Declined" },
    remediation_completed: { color: "bg-emerald-500", label: "Remediation Complete" },
    status_changed: { color: "bg-muted-foreground", label: "Status Changed" },
    closed: { color: "bg-muted-foreground", label: "Closed" },
  };
  return configs[type] || { color: "bg-muted-foreground", label: type };
}

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: incidentData, isLoading: incidentLoading, mutate } = useSWR(
    ["incident", id],
    () => incidentsAPI.get(id).catch(() => ({ data: mockIncident, relationships: {} } as IncidentDetailResponse))
  );

  const { data: alertsData, isLoading: alertsLoading } = useSWR(
    ["incident-alerts", id],
    () => incidentsAPI.getAlerts(id).catch(() => ({ alerts: mockAlerts, total: mockAlerts.length }))
  );

  const { data: timelineData, isLoading: timelineLoading } = useSWR(
    ["incident-timeline", id],
    () => incidentsAPI.getTimeline(id).catch(() => mockTimeline)
  );

  const { data: investigationsData } = useSWR(
    ["incident-investigations", id],
    () => incidentsAPI.getInvestigations(id).catch(() => ({ investigations: mockInvestigations, total: mockInvestigations.length }))
  );

  if (incidentLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const incident = incidentData?.data || mockIncident;
  const alerts = alertsData?.alerts || mockAlerts;
  const timeline = timelineData || mockTimeline;
  const investigations = investigationsData?.investigations || mockInvestigations;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={incident.title}
        description={`Created ${formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}`}
        onRefresh={() => mutate()}
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Severity</p>
                  <SeverityBadge severity={incident.severity} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge status={incident.status} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Related Alerts</p>
                  <p className="text-2xl font-bold">{incident.alert_count}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Assignee</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {incident.assigned_username || "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">
                    {format(new Date(incident.created_at), "PPp")}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Investigations */}
        {investigations.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ExternalLink className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {investigations.length} Active Investigation{investigations.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {investigations[0].status === "awaiting_approval"
                        ? "Playbook ready for review"
                        : `Status: ${investigations[0].status}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant={investigations[0].status === "awaiting_approval" ? "default" : "outline"}
                  onClick={() => router.push(`/investigations/${investigations[0].id}`)}
                >
                  {investigations[0].status === "awaiting_approval" ? "Review" : "View"} Investigation
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {incident.tags && incident.tags.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {incident.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    <Tag className="mr-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Incident Timeline ({timeline.total_events} events)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="relative space-y-4 pl-6">
                    <div className="absolute left-2 top-2 h-[calc(100%-16px)] w-px bg-border" />
                    {timeline.events.map((event, index) => {
                      const config = getEventConfig(event.type);
                      return (
                        <div key={index} className="relative">
                          <div
                            className={cn(
                              "absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background",
                              config.color
                            )}
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {config.label}
                              </Badge>
                              {event.investigation_id && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs cursor-pointer"
                                  onClick={() => router.push(`/investigations/${event.investigation_id}`)}
                                >
                                  {event.investigation_id}
                                  <ExternalLink className="ml-1 h-2 w-2" />
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{event.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(event.timestamp), "PPpp")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Related Alerts ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between rounded-lg border border-border/50 bg-card/50 p-4 transition-colors hover:bg-accent/50 cursor-pointer"
                        onClick={() => router.push(`/alerts?id=${alert.id}`)}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <SeverityBadge severity={alert.severity} />
                          <div className="space-y-1 min-w-0">
                            <p className="font-medium truncate">{alert.title}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {alert.source}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                {alert.source_ip} → {alert.hostname}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground ml-4 shrink-0">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="description">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Incident Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {incident.description}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
