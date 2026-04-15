"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import {
  Workflow,
  Play,
  Pause,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { pipelineAPI, type PipelineStatus } from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Mock data
const mockPipelines: PipelineStatus[] = [
  {
    name: "Wazuh Ingestion",
    status: "running",
    processed_count: 45892,
    error_count: 12,
    last_processed: new Date(Date.now() - 5000).toISOString(),
  },
  {
    name: "Falco Events",
    status: "running",
    processed_count: 12456,
    error_count: 3,
    last_processed: new Date(Date.now() - 8000).toISOString(),
  },
  {
    name: "Suricata Alerts",
    status: "running",
    processed_count: 28934,
    error_count: 7,
    last_processed: new Date(Date.now() - 12000).toISOString(),
  },
  {
    name: "Filebeat Logs",
    status: "running",
    processed_count: 156789,
    error_count: 45,
    last_processed: new Date(Date.now() - 2000).toISOString(),
  },
  {
    name: "Alert Correlation",
    status: "running",
    processed_count: 8934,
    error_count: 2,
    last_processed: new Date(Date.now() - 15000).toISOString(),
  },
  {
    name: "AI Analysis Queue",
    status: "running",
    processed_count: 234,
    error_count: 1,
    last_processed: new Date(Date.now() - 60000).toISOString(),
  },
];

const mockStats = {
  total_processed: 253239,
  error_rate: 0.027,
  avg_processing_time: 45,
};

export default function PipelinePage() {
  const { data: pipelines, isLoading, mutate: mutatePipelines } = useSWR<PipelineStatus[]>(
    "pipeline-status",
    () => pipelineAPI.getStatus().catch(() => mockPipelines),
    { refreshInterval: 5000 }
  );

  const { data: stats, mutate: mutateStats } = useSWR(
    "pipeline-stats",
    () => pipelineAPI.getStats().catch(() => mockStats),
    { refreshInterval: 10000 }
  );

  const handleWSUpdate = useCallback((message: WSMessage) => {
    mutatePipelines();
    mutateStats();
  }, [mutatePipelines, mutateStats]);

  useWSSubscription("pipeline_update", handleWSUpdate);

  const pipelineList = pipelines || mockPipelines;
  const pipelineStats = stats || mockStats;

  const runningCount = pipelineList.filter((p) => p.status === "running").length;
  const totalErrors = pipelineList.reduce((acc, p) => acc + p.error_count, 0);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Data Pipeline"
        description="Alert ingestion and processing status"
        onRefresh={() => {
          mutatePipelines();
          mutateStats();
        }}
        isLoading={isLoading}
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Processed</p>
                  <p className="text-3xl font-bold">
                    {pipelineStats.total_processed.toLocaleString()}
                  </p>
                </div>
                <Workflow className="h-10 w-10 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Active Pipelines</p>
                  <p className="text-3xl font-bold text-success">{runningCount}</p>
                </div>
                <Play className="h-10 w-10 text-success/30" />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(pipelineStats.error_rate > 0.05 && "border-warning/50")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    pipelineStats.error_rate > 0.05 && "text-warning",
                    pipelineStats.error_rate > 0.1 && "text-destructive"
                  )}>
                    {(pipelineStats.error_rate * 100).toFixed(2)}%
                  </p>
                </div>
                <AlertTriangle className={cn(
                  "h-10 w-10",
                  pipelineStats.error_rate > 0.05 ? "text-warning/30" : "text-muted-foreground/30"
                )} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Avg Processing</p>
                  <p className="text-3xl font-bold">{pipelineStats.avg_processing_time}ms</p>
                </div>
                <ArrowRight className="h-10 w-10 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Flow Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pipeline Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 overflow-x-auto pb-4">
              {/* Data Sources */}
              <div className="flex min-w-fit flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Sources</p>
                <div className="space-y-2">
                  {["Wazuh", "Falco", "Suricata", "Filebeat"].map((source) => (
                    <div
                      key={source}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      <span className="text-sm font-medium">{source}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="h-6 w-6 shrink-0 text-muted-foreground" />

              {/* Processing */}
              <div className="flex min-w-fit flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Processing</p>
                <div className="rounded-lg border bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-primary" />
                    <span className="font-medium">Pipeline Workers</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Parsing, normalization, enrichment
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="h-6 w-6 shrink-0 text-muted-foreground" />

              {/* Correlation */}
              <div className="flex min-w-fit flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Correlation</p>
                <div className="rounded-lg border bg-warning/5 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-medium">Alert Correlator</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pattern matching, incident creation
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="h-6 w-6 shrink-0 text-muted-foreground" />

              {/* Output */}
              <div className="flex min-w-fit flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Output</p>
                <div className="space-y-2">
                  {["Alerts", "Incidents", "Investigations"].map((output) => (
                    <div
                      key={output}
                      className="flex items-center gap-2 rounded-lg border bg-success/5 px-3 py-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">{output}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pipelineList.map((pipeline) => {
                const errorRate = pipeline.processed_count > 0
                  ? (pipeline.error_count / pipeline.processed_count) * 100
                  : 0;
                const isHighError = errorRate > 1;

                return (
                  <div
                    key={pipeline.name}
                    className={cn(
                      "rounded-lg border p-4",
                      pipeline.status === "error" && "border-destructive/50 bg-destructive/5",
                      pipeline.status === "stopped" && "border-muted bg-muted/50",
                      isHighError && pipeline.status === "running" && "border-warning/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            pipeline.status === "running" && "bg-success/10 text-success",
                            pipeline.status === "stopped" && "bg-muted text-muted-foreground",
                            pipeline.status === "error" && "bg-destructive/10 text-destructive"
                          )}
                        >
                          {pipeline.status === "running" ? (
                            <Play className="h-5 w-5" />
                          ) : pipeline.status === "stopped" ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{pipeline.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Last processed{" "}
                            {formatDistanceToNow(new Date(pipeline.last_processed), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Processed</p>
                          <p className="font-mono text-sm font-medium">
                            {pipeline.processed_count.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Errors</p>
                          <p
                            className={cn(
                              "font-mono text-sm font-medium",
                              isHighError && "text-warning"
                            )}
                          >
                            {pipeline.error_count} ({errorRate.toFixed(2)}%)
                          </p>
                        </div>
                        <StatusBadge status={pipeline.status} />
                      </div>
                    </div>
                    {/* Progress bar showing relative throughput */}
                    <div className="mt-4">
                      <Progress
                        value={Math.min(
                          (pipeline.processed_count / pipelineStats.total_processed) * 100 * pipelineList.length,
                          100
                        )}
                        className="h-1.5"
                      />
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
