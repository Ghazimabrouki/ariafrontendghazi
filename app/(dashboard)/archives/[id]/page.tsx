"use client";

import { use } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Archive,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  ChevronRight,
  ExternalLink,
  Server,
  Globe,
  Tag,
} from "lucide-react";
import {
  archivesAPI,
  type ArchiveDetailResponse,
  type Alert,
  type Investigation,
  type Incident,
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

// Mock data for when API is not available
const mockArchiveDetail: ArchiveDetailResponse = {
  id: "archive-1",
  investigation_id: "inv-001",
  incident_id: "inc-001",
  incident_title: "SSH Brute Force Attack - Multiple Failed Authentication Attempts",
  severity: "high",
  fix_status: "likely_fixed",
  fix_detail: "No new alerts observed after remediation. Attacker IPs blocked at firewall level. Fail2ban configured with aggressive settings.",
  full_context: {
    investigation: {
      id: "inv-001",
      incident_id: "inc-001",
      incident_title: "SSH Brute Force Attack",
      status: "archived",
      ai_summary: "Coordinated SSH brute force attack detected from multiple IP addresses across different geographic regions.",
      ai_narrative: "The attack began at 14:32 UTC with initial probing attempts from 117.50.130.90 (CN). Within 15 minutes, the attack escalated to include 47 unique source IPs, suggesting botnet involvement. The attack targeted root and admin accounts with a rate of 150+ attempts per minute.",
      ai_risk: "HIGH - Potential for credential compromise if any accounts had weak passwords. Lateral movement risk if successful authentication achieved.",
      playbook_yaml: "---\n- name: SSH Brute Force Response\n  hosts: ghazi\n  become: yes\n  tasks:\n    - name: Block attacking IPs\n      iptables:\n        chain: INPUT\n        source: '{{ item }}'\n        jump: DROP\n      loop:\n        - 117.50.130.90\n        - 103.45.67.89",
      playbook_valid: true,
      target_host: "ghazi",
      source_ips: ["117.50.130.90", "103.45.67.89", "45.33.32.156"],
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    incident: {
      id: "inc-001",
      title: "SSH Brute Force Attack - Multiple Failed Authentication Attempts",
      description: "Multiple SSH authentication failures detected from various source IPs targeting production servers.",
      severity: "high",
      status: "closed",
      assigned_to: "admin",
      assigned_username: "admin",
      tags: ["ssh", "brute-force", "automated-attack"],
      alert_count: 47,
      closed_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    alerts: Array.from({ length: 5 }, (_, i) => ({
      id: `alert-${i + 1}`,
      source: "wazuh",
      source_id: `wazuh-${i + 1000}`,
      title: `SSH authentication failure from 117.50.130.${90 + i}`,
      description: `Failed SSH login attempt for user root from IP 117.50.130.${90 + i}`,
      severity: "high" as const,
      status: "closed" as const,
      source_ip: `117.50.130.${90 + i}`,
      dest_ip: "10.175.1.137",
      hostname: "ghazi",
      rule_name: "sshd: authentication failure",
      iocs: {
        ips: [`117.50.130.${90 + i}`, "10.175.1.137"],
        hashes: [],
        domains: [],
        urls: [],
      },
      tags: ["wazuh", "ssh", "auth-failure"],
      created_at: new Date(Date.now() - 86400000 + i * 60000).toISOString(),
      updated_at: new Date(Date.now() - 86400000 + i * 60000).toISOString(),
    })),
  },
  archived_at: new Date(Date.now() - 3600000).toISOString(),
};

function FixStatusBadge({ status }: { status: string }) {
  const config = {
    likely_fixed: {
      icon: CheckCircle2,
      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      label: "Likely Fixed",
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

export default function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data, isLoading, mutate } = useSWR(
    ["archive", id],
    () => archivesAPI.get(id).catch(() => mockArchiveDetail)
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const archive = data || mockArchiveDetail;
  const investigation = archive.full_context?.investigation;
  const incident = archive.full_context?.incident;
  const alerts = archive.full_context?.alerts || [];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`Archive: ${archive.incident_title.substring(0, 50)}...`}
        description={`Archived ${formatDistanceToNow(new Date(archive.archived_at), { addSuffix: true })}`}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Severity</p>
                  <SeverityBadge severity={archive.severity} />
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Fix Status</p>
                  <FixStatusBadge status={archive.fix_status} />
                </div>
                <Shield className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Related Alerts</p>
                  <p className="text-2xl font-bold">{alerts.length}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Archived</p>
                  <p className="text-sm font-medium">
                    {format(new Date(archive.archived_at), "PPp")}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fix Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base font-medium">Verification Result</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{archive.fix_detail}</p>
          </CardContent>
        </Card>

        {/* Related Items Links */}
        <div className="grid gap-4 md:grid-cols-2">
          {incident && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Original Incident</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {incident.title}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/incidents/${archive.incident_id}`)}
                >
                  View
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
          {investigation && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Investigation</p>
                    <p className="text-sm text-muted-foreground">
                      {archive.investigation_id}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/investigations/${archive.investigation_id}`)}
                >
                  View
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs for detailed information */}
        <Tabs defaultValue="ai-analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="playbook">Playbook</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
            <TabsTrigger value="incident">Incident Details</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-analysis" className="space-y-4">
            {investigation && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-medium">AI Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {investigation.ai_summary || "No AI summary available"}
                    </p>
                  </CardContent>
                </Card>

                {/* Risk Assessment */}
                <Card className="border-destructive/30">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-base font-medium">Risk Assessment</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {investigation.ai_risk || "No risk assessment available"}
                    </p>
                  </CardContent>
                </Card>

                {/* Narrative */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base font-medium">Attack Narrative</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {investigation.ai_narrative || "No narrative available"}
                    </p>
                  </CardContent>
                </Card>

                {/* Source IPs */}
                {investigation.source_ips && investigation.source_ips.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-warning" />
                        <CardTitle className="text-base font-medium">Source IPs</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {investigation.source_ips.map((ip, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="font-mono cursor-pointer hover:bg-accent"
                            onClick={() => router.push(`/search?q=${ip}`)}
                          >
                            {ip}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Target Host */}
                {investigation.target_host && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-medium">Target Host</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="font-mono">
                        {investigation.target_host}
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="playbook">
            {investigation?.playbook_yaml ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Executed Playbook</CardTitle>
                    {investigation.playbook_valid ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Invalid
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
                      {investigation.playbook_yaml}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No playbook data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Related Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length > 0 ? (
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
                              <p className="text-sm text-muted-foreground truncate">
                                {alert.description}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {alert.source}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {alert.source_ip} → {alert.dest_ip}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {alert.tags?.slice(0, 3).map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    <Tag className="mr-1 h-2 w-2" />
                                    {tag}
                                  </Badge>
                                ))}
                                {alert.tags && alert.tags.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{alert.tags.length - 3}
                                  </Badge>
                                )}
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
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">No alerts available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incident">
            {incident && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium">{incident.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={incident.severity} />
                        <StatusBadge status={incident.status} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{incident.description}</p>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Alert Count</p>
                        <p className="text-lg font-semibold">{incident.alert_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Assigned To</p>
                        <p className="text-lg font-semibold">
                          {incident.assigned_username || "Unassigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">
                          {format(new Date(incident.created_at), "PPp")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Closed</p>
                        <p className="text-sm font-medium">
                          {incident.closed_at
                            ? format(new Date(incident.closed_at), "PPp")
                            : "Not closed"}
                        </p>
                      </div>
                    </div>

                    {incident.tags && incident.tags.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {incident.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">
                              <Tag className="mr-1 h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
