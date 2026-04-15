"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  AlertTriangle,
  Activity,
  Network,
  RefreshCw,
} from "lucide-react";
import {
  metricsAPI,
  type MetricsDashboardResponse,
  type MetricsHostDetailResponse,
  type MetricsHistoryResponse,
  type MetricHost,
} from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Mock data matching the API spec
const mockHost: MetricHost = {
  hostname: "ghazi",
  ip: "193.95.30.97",
  status: "warning",
  last_update: new Date().toISOString(),
  metrics: {
    cpu: { current: 45.2, user: 40.1, system: 5.1, iowait: 0.0 },
    memory: { current: 66.5, used_mb: 8192.0, available_mb: 4096.0 },
    disk: [{ device: "/", used_percent: 45.2, used_gb: 45.2, free_gb: 54.8 }],
    network: { in_mb: 1.25, out_mb: 0.85 },
    load: { "1m": 2.5, "5m": 2.2, "15m": 1.8, cpus: 4 },
    connections: { tcp_established: 145, tcp_listen: 23, udp: 5 },
  },
  processes: {
    top_cpu: [
      { name: "nginx", cpu: 45.2, mem_mb: 230, pid: 1234 },
      { name: "docker", cpu: 12.3, mem_mb: 512, pid: 2345 },
      { name: "python", cpu: 8.7, mem_mb: 256, pid: 3456 },
    ],
    top_memory: [
      { name: "java", cpu: 12.5, mem_mb: 4100, pid: 5678 },
      { name: "elasticsearch", cpu: 8.2, mem_mb: 3200, pid: 6789 },
      { name: "nginx", cpu: 45.2, mem_mb: 230, pid: 1234 },
    ],
  },
};

const mockDashboard: MetricsDashboardResponse = {
  hosts: [mockHost],
  timestamp: new Date().toISOString(),
};

const mockHistory: MetricsHistoryResponse = {
  hostname: "ghazi",
  period: {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  },
  data_points: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    cpu: Math.random() * 40 + 30,
    memory: Math.random() * 20 + 55,
    disk: Math.random() * 5 + 43,
    network_in: Math.random() * 2,
    network_out: Math.random() * 1.5,
    load_1: Math.random() * 2 + 1.5,
  })),
  statistics: {
    cpu: { avg: 42.1, min: 15.2, max: 89.5 },
    memory: { avg: 65.2, min: 45.1, max: 85.2 },
    disk: { avg: 44.8, min: 44.0, max: 45.2 },
  },
};

const statusColors = {
  normal: "text-green-500 bg-green-500/10 border-green-500/30",
  warning: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  critical: "text-red-500 bg-red-500/10 border-red-500/30",
};

export default function MetricsPage() {
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>("24");

  const { data: dashboard, isLoading, mutate: mutateDashboard } = useSWR<MetricsDashboardResponse>(
    "metrics-dashboard",
    () => metricsAPI.getDashboard().catch(() => mockDashboard),
    { refreshInterval: 30000 }
  );

  const { data: hostDetail, mutate: mutateHostDetail } = useSWR<MetricsHostDetailResponse>(
    selectedHost ? ["metrics-host", selectedHost] : null,
    () => metricsAPI.getHost(selectedHost!).catch(() => null),
    { refreshInterval: 30000 }
  );

  const { data: history, mutate: mutateHistory } = useSWR<MetricsHistoryResponse>(
    selectedHost ? ["metrics-history", selectedHost, timeRange] : null,
    () =>
      metricsAPI
        .getHostHistory(selectedHost!, { hours: parseInt(timeRange) })
        .catch(() => mockHistory),
    { refreshInterval: 60000 }
  );

  const handleWSUpdate = useCallback(
    (message: WSMessage) => {
      mutateDashboard();
      if (selectedHost) {
        mutateHostDetail();
        mutateHistory();
      }
    },
    [mutateDashboard, mutateHostDetail, mutateHistory, selectedHost]
  );

  useWSSubscription("metric_update", handleWSUpdate);

  const hosts = dashboard?.hosts || mockDashboard.hosts;
  const currentHost = selectedHost
    ? hosts.find((h) => h.hostname === selectedHost) || mockHost
    : hosts[0] || mockHost;

  const chartData =
    history?.data_points.map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      cpu: d.cpu,
      memory: d.memory,
      disk: d.disk,
      network_in: d.network_in,
      network_out: d.network_out,
      load: d.load_1,
    })) || mockHistory.data_points.map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      cpu: d.cpu,
      memory: d.memory,
      disk: d.disk,
      network_in: d.network_in,
      network_out: d.network_out,
      load: d.load_1,
    }));

  const handleRefresh = () => {
    mutateDashboard();
    if (selectedHost) {
      mutateHostDetail();
      mutateHistory();
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Hardware Resources"
        description="Real-time performance monitoring"
        onRefresh={handleRefresh}
        isLoading={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedHost || hosts[0]?.hostname || ""}
              onValueChange={(v) => setSelectedHost(v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select host" />
              </SelectTrigger>
              <SelectContent>
                {hosts.map((host) => (
                  <SelectItem key={host.hostname} value={host.hostname}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          host.status === "critical" && "bg-red-500",
                          host.status === "warning" && "bg-yellow-500",
                          host.status === "normal" && "bg-green-500"
                        )}
                      />
                      {host.hostname}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Host Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="CPU Usage"
            value={currentHost.metrics.cpu.current}
            subtitle={`User: ${currentHost.metrics.cpu.user.toFixed(1)}% | System: ${currentHost.metrics.cpu.system.toFixed(1)}%`}
            icon={Cpu}
            color="chart-1"
          />
          <MetricCard
            title="Memory Usage"
            value={currentHost.metrics.memory.current}
            subtitle={`${currentHost.metrics.memory.used_mb.toLocaleString()} MB used / ${(currentHost.metrics.memory.used_mb + currentHost.metrics.memory.available_mb).toLocaleString()} MB total`}
            icon={MemoryStick}
            color="chart-2"
          />
          <MetricCard
            title="Disk Usage"
            value={currentHost.metrics.disk[0]?.used_percent || 0}
            subtitle={`${currentHost.metrics.disk[0]?.used_gb.toFixed(1)} GB used / ${(currentHost.metrics.disk[0]?.used_gb + currentHost.metrics.disk[0]?.free_gb).toFixed(1)} GB total`}
            icon={HardDrive}
            color="chart-3"
          />
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Load Average</p>
                <Activity className="h-5 w-5 text-chart-4" />
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="text-2xl font-bold">{currentHost.metrics.load["1m"].toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground ml-1">1m</span>
                </div>
                <div>
                  <span className="text-lg">{currentHost.metrics.load["5m"].toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground ml-1">5m</span>
                </div>
                <div>
                  <span className="text-lg">{currentHost.metrics.load["15m"].toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground ml-1">15m</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{currentHost.metrics.load.cpus} CPUs</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Alert */}
        {currentHost.status !== "normal" && (
          <Card
            className={cn(
              "border",
              currentHost.status === "critical" && "border-destructive/50 bg-destructive/5",
              currentHost.status === "warning" && "border-yellow-500/50 bg-yellow-500/5"
            )}
          >
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle
                className={cn(
                  "h-5 w-5",
                  currentHost.status === "critical" && "text-destructive",
                  currentHost.status === "warning" && "text-yellow-500"
                )}
              />
              <div>
                <p
                  className={cn(
                    "font-medium",
                    currentHost.status === "critical" && "text-destructive",
                    currentHost.status === "warning" && "text-yellow-500"
                  )}
                >
                  {currentHost.status === "critical" ? "Critical Alert" : "Warning"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Host {currentHost.hostname} has elevated resource usage
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="processes">Processes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Cpu className="h-4 w-4 text-chart-1" />
                    CPU Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke="var(--color-muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            color: "var(--color-popover-foreground)",
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "CPU"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="cpu"
                          stroke="var(--color-chart-1)"
                          strokeWidth={2}
                          fill="url(#cpuGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <MemoryStick className="h-4 w-4 text-chart-2" />
                    Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke="var(--color-muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            color: "var(--color-popover-foreground)",
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Memory"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="memory"
                          stroke="var(--color-chart-2)"
                          strokeWidth={2}
                          fill="url(#memGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Statistics */}
            {history?.statistics && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Statistics ({timeRange}h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">CPU</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Average</span>
                        <span>{history.statistics.cpu.avg.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Min / Max</span>
                        <span>
                          {history.statistics.cpu.min.toFixed(1)}% / {history.statistics.cpu.max.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Memory</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Average</span>
                        <span>{history.statistics.memory.avg.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Min / Max</span>
                        <span>
                          {history.statistics.memory.min.toFixed(1)}% / {history.statistics.memory.max.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Disk</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Average</span>
                        <span>{history.statistics.disk.avg.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Min / Max</span>
                        <span>
                          {history.statistics.disk.min.toFixed(1)}% / {history.statistics.disk.max.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Network In</p>
                    <Network className="h-4 w-4 text-chart-1" />
                  </div>
                  <p className="text-2xl font-bold">{currentHost.metrics.network.in_mb.toFixed(2)} MB/s</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Network Out</p>
                    <Network className="h-4 w-4 text-chart-2" />
                  </div>
                  <p className="text-2xl font-bold">{currentHost.metrics.network.out_mb.toFixed(2)} MB/s</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">TCP Established</p>
                  </div>
                  <p className="text-2xl font-bold">{currentHost.metrics.connections.tcp_established}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">TCP Listen</p>
                  </div>
                  <p className="text-2xl font-bold">{currentHost.metrics.connections.tcp_listen}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Network className="h-4 w-4" />
                  Network Traffic
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="netInGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="netOutGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="time" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)} MB`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Area type="monotone" dataKey="network_in" name="In" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#netInGradient)" />
                      <Area type="monotone" dataKey="network_out" name="Out" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#netOutGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processes" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Top CPU Processes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentHost.processes.top_cpu.map((proc, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {proc.pid}
                          </Badge>
                          <span className="font-medium">{proc.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{proc.cpu.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">CPU</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{proc.mem_mb} MB</p>
                            <p className="text-xs text-muted-foreground">Memory</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Top Memory Processes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentHost.processes.top_memory.map((proc, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {proc.pid}
                          </Badge>
                          <span className="font-medium">{proc.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{proc.cpu.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">CPU</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{proc.mem_mb} MB</p>
                            <p className="text-xs text-muted-foreground">Memory</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* All Hosts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">All Hosts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hosts.map((host) => (
                <div
                  key={host.hostname}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50 cursor-pointer",
                    host.status === "critical" && "border-destructive/50 bg-destructive/5",
                    host.status === "warning" && "border-yellow-500/50 bg-yellow-500/5",
                    selectedHost === host.hostname && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedHost(host.hostname)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        host.status === "critical" && "bg-red-500",
                        host.status === "warning" && "bg-yellow-500",
                        host.status === "normal" && "bg-green-500"
                      )}
                    />
                    <div>
                      <p className="font-medium">{host.hostname}</p>
                      <p className="text-xs text-muted-foreground font-mono">{host.ip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">CPU</p>
                      <p className="font-mono text-sm">{host.metrics.cpu.current.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Memory</p>
                      <p className="font-mono text-sm">{host.metrics.memory.current.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Disk</p>
                      <p className="font-mono text-sm">
                        {host.metrics.disk[0]?.used_percent.toFixed(1)}%
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(statusColors[host.status])}
                    >
                      {host.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) {
  const isWarning = value > 70;
  const isCritical = value > 90;

  return (
    <Card
      className={cn(
        isCritical && "border-destructive/50",
        isWarning && !isCritical && "border-yellow-500/50"
      )}
    >
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{title}</p>
            <Icon className={cn("h-5 w-5", `text-${color}`)} />
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "text-3xl font-bold",
                isCritical && "text-destructive",
                isWarning && !isCritical && "text-yellow-500"
              )}
            >
              {value.toFixed(1)}%
            </p>
          </div>
          <Progress
            value={value}
            className={cn(
              "h-2",
              isCritical && "[&>div]:bg-destructive",
              isWarning && !isCritical && "[&>div]:bg-yellow-500"
            )}
          />
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}
