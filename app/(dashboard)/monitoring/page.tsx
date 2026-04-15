"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import {
  Server,
  Database,
  Search,
  Brain,
  Workflow,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { monitoringAPI, type ServiceHealth } from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Mock data
const mockServices: ServiceHealth[] = [
  { name: "Elasticsearch", status: "healthy", latency_ms: 12, last_check: new Date().toISOString() },
  { name: "Wazuh Manager", status: "healthy", latency_ms: 8, last_check: new Date().toISOString() },
  { name: "Falco Runtime", status: "healthy", latency_ms: 5, last_check: new Date().toISOString() },
  { name: "Suricata IDS", status: "healthy", latency_ms: 15, last_check: new Date().toISOString() },
  { name: "AI Engine", status: "healthy", latency_ms: 45, last_check: new Date().toISOString() },
  { name: "Pipeline Worker", status: "degraded", latency_ms: 120, last_check: new Date().toISOString(), details: "High queue depth" },
  { name: "Alert Correlator", status: "healthy", latency_ms: 22, last_check: new Date().toISOString() },
  { name: "Playbook Engine", status: "healthy", latency_ms: 18, last_check: new Date().toISOString() },
];

const serviceIcons: Record<string, React.ElementType> = {
  Elasticsearch: Search,
  "Wazuh Manager": Shield,
  "Falco Runtime": Server,
  "Suricata IDS": Shield,
  "AI Engine": Brain,
  "Pipeline Worker": Workflow,
  "Alert Correlator": Database,
  "Playbook Engine": Workflow,
};

export default function MonitoringPage() {
  const { data: services, isLoading, mutate } = useSWR<ServiceHealth[]>(
    "service-health",
    () => monitoringAPI.getHealth().catch(() => mockServices),
    { refreshInterval: 15000 }
  );

  const handleWSUpdate = useCallback((message: WSMessage) => {
    mutate();
  }, [mutate]);

  useWSSubscription("service_health_update", handleWSUpdate);

  const serviceList = services || mockServices;
  const healthyCount = serviceList.filter((s) => s.status === "healthy").length;
  const degradedCount = serviceList.filter((s) => s.status === "degraded").length;
  const downCount = serviceList.filter((s) => s.status === "down").length;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Service Monitoring"
        description="Backend services health status"
        onRefresh={() => mutate()}
        isLoading={isLoading}
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={cn(healthyCount === serviceList.length && "border-success/50 bg-success/5")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Healthy Services</p>
                  <p className="text-3xl font-bold text-success">{healthyCount}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-success/30" />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(degradedCount > 0 && "border-warning/50 bg-warning/5")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Degraded</p>
                  <p className={cn("text-3xl font-bold", degradedCount > 0 ? "text-warning" : "text-foreground")}>
                    {degradedCount}
                  </p>
                </div>
                <Clock className={cn("h-10 w-10", degradedCount > 0 ? "text-warning/30" : "text-muted-foreground/30")} />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(downCount > 0 && "border-destructive/50 bg-destructive/5")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Down</p>
                  <p className={cn("text-3xl font-bold", downCount > 0 ? "text-destructive" : "text-foreground")}>
                    {downCount}
                  </p>
                </div>
                <AlertTriangle className={cn("h-10 w-10", downCount > 0 ? "text-destructive/30" : "text-muted-foreground/30")} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">All Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {serviceList.map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Service Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceList.map((service) => {
                const Icon = serviceIcons[service.name] || Server;

                return (
                  <div
                    key={service.name}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4",
                      service.status === "healthy" && "border-success/30",
                      service.status === "degraded" && "border-warning/30 bg-warning/5",
                      service.status === "down" && "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-lg",
                          service.status === "healthy" && "bg-success/10 text-success",
                          service.status === "degraded" && "bg-warning/10 text-warning",
                          service.status === "down" && "bg-destructive/10 text-destructive"
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.details && (
                          <p className="text-sm text-muted-foreground">{service.details}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Latency</p>
                        <p
                          className={cn(
                            "font-mono text-sm",
                            service.latency_ms > 100 && "text-warning",
                            service.latency_ms > 500 && "text-destructive"
                          )}
                        >
                          {service.latency_ms}ms
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Last Check</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(service.last_check), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <StatusBadge status={service.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const Icon = serviceIcons[service.name] || Server;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 transition-all hover:shadow-md",
        service.status === "healthy" && "border-success/30",
        service.status === "degraded" && "border-warning/30",
        service.status === "down" && "border-destructive/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            service.status === "healthy" && "bg-success/10 text-success",
            service.status === "degraded" && "bg-warning/10 text-warning",
            service.status === "down" && "bg-destructive/10 text-destructive"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="relative">
          <div
            className={cn(
              "h-3 w-3 rounded-full",
              service.status === "healthy" && "bg-success",
              service.status === "degraded" && "bg-warning",
              service.status === "down" && "bg-destructive"
            )}
          />
          {service.status === "healthy" && (
            <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-success opacity-50" />
          )}
        </div>
      </div>
      <div className="mt-4">
        <p className="font-medium">{service.name}</p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {service.latency_ms}ms
        </p>
      </div>
      {/* Status accent */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-1 w-full",
          service.status === "healthy" && "bg-success",
          service.status === "degraded" && "bg-warning",
          service.status === "down" && "bg-destructive"
        )}
      />
    </div>
  );
}
