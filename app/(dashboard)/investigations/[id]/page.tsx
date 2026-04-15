"use client";

import { use, useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Brain,
  Clock,
  Target,
  Shield,
  Archive,
  ChevronRight,
  AlertTriangle,
  Server,
  Globe,
  CheckCircle2,
  XCircle,
  Play,
  Copy,
} from "lucide-react";
import {
  investigationsAPI,
  type Investigation,
  type InvestigationTimeline,
  type PlaybookYamlResponse,
} from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { PageHeader } from "@/components/page-header";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Mock data
const mockInvestigation: Investigation = {
  id: "investigation-1",
  incident_id: "inc-001",
  incident_title: "ET SCAN Potential SSH Scan - 172.104.13.54 on ghazi",
  incident_severity: "high",
  status: "awaiting_approval",
  severity: "high",
  source_ips: ["117.50.130.90", "103.45.67.89", "45.33.32.156"],
  ai_summary:
    "AI analysis detected a coordinated SSH brute force attack targeting production servers. The attack originated from multiple IP addresses across different geographic regions, suggesting a botnet-driven campaign.",
  ai_narrative:
    "The attack began at 14:32 UTC with initial probing attempts from 117.50.130.90 (CN). Within 15 minutes, the attack escalated to include 47 unique source IPs, suggesting botnet involvement. The attack targeted root and admin accounts with a rate of 150+ attempts per minute. Pattern analysis indicates similarity to known Mirai botnet signatures.",
  ai_risk:
    "HIGH SEVERITY - Coordinated brute force attack with potential for lateral movement if successful authentication is achieved. Immediate action required to block attacking IPs and harden SSH configuration.",
  playbook_yaml: `---
- name: SSH Brute Force Response Playbook
  hosts: ghazi
  become: yes
  vars:
    attacking_ips:
      - 117.50.130.90
      - 103.45.67.89
      - 45.33.32.156
  
  tasks:
    - name: Block attacking IPs with iptables
      iptables:
        chain: INPUT
        source: "{{ item }}"
        jump: DROP
      loop: "{{ attacking_ips }}"
      
    - name: Configure fail2ban for SSH
      template:
        src: fail2ban-ssh.conf.j2
        dest: /etc/fail2ban/jail.d/ssh.conf
      notify: restart fail2ban
      
    - name: Disable password authentication
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: '^PasswordAuthentication'
        line: 'PasswordAuthentication no'
      notify: restart sshd
      
    - name: Generate incident report
      template:
        src: incident-report.md.j2
        dest: "/var/log/security/incident-{{ ansible_date_time.iso8601 }}.md"
        
  handlers:
    - name: restart fail2ban
      service:
        name: fail2ban
        state: restarted
        
    - name: restart sshd
      service:
        name: sshd
        state: restarted`,
  playbook_valid: true,
  playbook_error: null,
  target_host: "ghazi",
  created_at: new Date(Date.now() - 5400000).toISOString(),
  updated_at: new Date(Date.now() - 1800000).toISOString(),
};

const mockTimeline: InvestigationTimeline = {
  investigation_id: "investigation-1",
  events: [
    {
      type: "created",
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      description: "Investigation created",
    },
    {
      type: "ai_started",
      timestamp: new Date(Date.now() - 5000000).toISOString(),
      description: "AI analysis started",
    },
    {
      type: "ai_completed",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      playbook_generated: true,
      description: "AI analysis completed - playbook generated",
    },
  ],
};

function getEventConfig(type: string) {
  const configs: Record<string, { color: string; label: string }> = {
    created: { color: "bg-primary", label: "Created" },
    ai_started: { color: "bg-blue-500", label: "AI Started" },
    ai_completed: { color: "bg-emerald-500", label: "AI Completed" },
    approved: { color: "bg-emerald-500", label: "Approved" },
    declined: { color: "bg-destructive", label: "Declined" },
    remediation_started: { color: "bg-blue-500", label: "Remediation Started" },
    remediation_completed: { color: "bg-emerald-500", label: "Remediation Complete" },
    archived: { color: "bg-muted-foreground", label: "Archived" },
  };
  return configs[type] || { color: "bg-muted-foreground", label: type };
}

export default function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isActioning, setIsActioning] = useState(false);

  const { data: investigation, isLoading, mutate } = useSWR(
    ["investigation", id],
    () => investigationsAPI.get(id).catch(() => mockInvestigation)
  );

  const { data: timeline } = useSWR(
    ["investigation-timeline", id],
    () => investigationsAPI.getTimeline(id).catch(() => mockTimeline)
  );

  const handleWSUpdate = useCallback(
    (message: WSMessage) => {
      mutate();
    },
    [mutate]
  );

  useWSSubscription("investigation_updated", handleWSUpdate);
  useWSSubscription("playbook_status_changed", handleWSUpdate);

  const handleApprove = async () => {
    setIsActioning(true);
    try {
      await investigationsAPI.approve(id, "admin");
      mutate();
    } catch (error) {
      console.error("Failed to approve investigation:", error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleDecline = async () => {
    setIsActioning(true);
    try {
      await investigationsAPI.decline(id, "admin", declineReason);
      mutate();
      setShowDeclineDialog(false);
      setDeclineReason("");
    } catch (error) {
      console.error("Failed to decline investigation:", error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleExecute = async () => {
    setIsActioning(true);
    try {
      await investigationsAPI.execute(id);
      mutate();
    } catch (error) {
      console.error("Failed to execute playbook:", error);
    } finally {
      setIsActioning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const data = investigation || mockInvestigation;
  const timelineEvents = timeline?.events || mockTimeline.events;

  const canApprove = data.status === "awaiting_approval";
  const canExecute = data.status === "approved";

  return (
    <div className="flex flex-col">
      <PageHeader
        title={data.incident_title}
        description={`Investigation for incident ${data.incident_id}`}
        onRefresh={() => mutate()}
        actions={
          <div className="flex items-center gap-2">
            {canApprove && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={isActioning}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline
                </Button>
                <Button onClick={handleApprove} disabled={isActioning}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Playbook
                </Button>
              </>
            )}
            {canExecute && (
              <Button onClick={handleExecute} disabled={isActioning}>
                <Play className="mr-2 h-4 w-4" />
                Execute Playbook
              </Button>
            )}
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Status Bar */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <StatusBadge status={data.status} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Severity</p>
                <SeverityBadge severity={data.severity || data.incident_severity || "medium"} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Target Host</p>
                  <Badge variant="secondary">
                    <Server className="mr-1 h-3 w-3" />
                    {data.target_host || "Unknown"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Incident</p>
                <Badge
                  variant="outline"
                  className="cursor-pointer font-mono"
                  onClick={() => router.push(`/incidents/${data.incident_id}`)}
                >
                  {data.incident_id}
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Source IPs */}
        {data.source_ips && data.source_ips.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-warning" />
                <CardTitle className="text-base font-medium">
                  Attacking IPs ({data.source_ips.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.source_ips.map((ip, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="font-mono cursor-pointer hover:bg-accent"
                    onClick={() => router.push(`/search?q=${ip}`)}
                  >
                    {ip}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(ip);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="playbook">Playbook</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-medium">AI Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {data.ai_summary || "AI analysis in progress..."}
                </p>
              </CardContent>
            </Card>

            {/* Risk Assessment */}
            {data.ai_risk && (
              <Card className="border-destructive/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-base font-medium">Risk Assessment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{data.ai_risk}</p>
                </CardContent>
              </Card>
            )}

            {/* Narrative */}
            {data.ai_narrative && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Attack Narrative</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {data.ai_narrative}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="playbook">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Ansible Playbook</CardTitle>
                  <div className="flex items-center gap-2">
                    {data.playbook_valid ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Valid YAML
                      </Badge>
                    ) : data.playbook_error ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Invalid
                      </Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(data.playbook_yaml || "")}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.playbook_yaml ? (
                  <ScrollArea className="h-[500px]">
                    <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
                      {data.playbook_yaml}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="py-12 text-center">
                    <Brain className="mx-auto h-12 w-12 text-muted-foreground/50 animate-pulse" />
                    <p className="mt-4 text-muted-foreground">
                      AI is generating the playbook...
                    </p>
                  </div>
                )}
                {data.playbook_error && (
                  <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm text-destructive">{data.playbook_error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Investigation Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="relative space-y-4 pl-6">
                    <div className="absolute left-2 top-2 h-[calc(100%-16px)] w-px bg-border" />
                    {timelineEvents.map((event, index) => {
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
                              {event.playbook_generated && (
                                <Badge variant="secondary" className="text-xs">
                                  Playbook Generated
                                </Badge>
                              )}
                              {event.decided_by && (
                                <Badge variant="secondary" className="text-xs">
                                  By: {event.decided_by}
                                </Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm">{event.description}</p>
                            )}
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
        </Tabs>
      </div>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Investigation</DialogTitle>
            <DialogDescription>
              Provide a reason for declining this investigation. The case will be queued for archive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Reason for declining (optional)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={isActioning}>
              <XCircle className="mr-2 h-4 w-4" />
              Decline Investigation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
