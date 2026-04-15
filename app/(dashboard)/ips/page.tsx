"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import {
  Globe,
  Activity,
  Server,
  Filter,
  RefreshCw,
  Pause,
  Play,
  X,
  ChevronRight,
  AlertTriangle,
  Shield,
} from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
} from "react-simple-maps";
import {
  ipsAPI,
  type IPSMapDataResponse,
  type IPSLiveEventsResponse,
  type IPSStatisticsResponse,
  type IPSSummaryResponse,
  type IPSFiltersResponse,
} from "@/lib/api";
import { useWSSubscription, type WSMessage } from "@/lib/websocket";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mock data for demonstration
const mockMapData: IPSMapDataResponse = {
  attacks: Array.from({ length: 20 }, (_, i) => ({
    event_id: `event-${i}`,
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
    source: {
      ip: `${172 + (i % 50)}.${104 + (i % 100)}.${13 + i}.${54 + i}`,
      port: 443,
      country: ["CN", "RU", "US", "BR", "IN"][i % 5],
      country_name: ["China", "Russia", "United States", "Brazil", "India"][i % 5],
      city: ["Beijing", "Moscow", "New York", "Sao Paulo", "Mumbai"][i % 5],
      lat: [39.9042, 55.7558, 40.7128, -23.5505, 19.076][i % 5],
      lon: [116.4074, 37.6173, -74.006, -46.6333, 72.8777][i % 5],
      isp: "Unknown ISP",
    },
    destination: {
      ip: "10.175.1.137",
      port: 443,
      country: "TN",
      country_name: "Tunisia",
      city: "Tunis",
    },
    severity: ["critical", "high", "medium", "low"][i % 4],
    alert_name: [
      "ET SCAN Potential SSH Scan",
      "SQL Injection Attempt",
      "Brute Force Attack",
      "Port Scan Detected",
    ][i % 4],
    category: ["Attempted Information Leak", "Web Application Attack", "Brute Force", "Reconnaissance"][i % 4],
    protocol: ["TCP", "UDP", "ICMP"][i % 3],
  })),
  paths: Array.from({ length: 20 }, (_, i) => ({
    id: `path-${i}`,
    from: {
      lat: [39.9042, 55.7558, 40.7128, -23.5505, 19.076][i % 5],
      lon: [116.4074, 37.6173, -74.006, -46.6333, 72.8777][i % 5],
      city: ["Beijing", "Moscow", "New York", "Sao Paulo", "Mumbai"][i % 5],
      country: ["China", "Russia", "United States", "Brazil", "India"][i % 5],
    },
    to: { lat: 36.8065, lon: 10.1815, city: "Tunis", country: "Tunisia" },
    severity: ["critical", "high", "medium", "low"][i % 4],
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
  })),
  count: 20,
  timestamp: new Date().toISOString(),
};

const mockLiveEvents: IPSLiveEventsResponse = {
  events: mockMapData.attacks.map((a) => ({
    event_id: a.event_id,
    timestamp: a.timestamp,
    source_ip: a.source.ip,
    source_city: a.source.city,
    source_country: a.source.country_name,
    source_country_code: a.source.country,
    dest_ip: a.destination.ip,
    dest_city: a.destination.city || "Tunis",
    dest_country: a.destination.country_name,
    severity: a.severity,
    alert_name: a.alert_name,
    category: a.category,
    protocol: a.protocol,
  })),
  count: 20,
  timestamp: new Date().toISOString(),
};

const mockStatistics: IPSStatisticsResponse = {
  total_attacks: 1234,
  unique_sources: 456,
  unique_targets: 12,
  active_events: 89,
  by_severity: { critical: 15, high: 120, medium: 450, low: 649 },
  by_category: [
    { category: "Attempted Information Leak", count: 400 },
    { category: "Web Application Attack", count: 300 },
    { category: "Brute Force", count: 200 },
    { category: "Reconnaissance", count: 334 },
  ],
  by_protocol: [
    { protocol: "TCP", count: 900 },
    { protocol: "UDP", count: 250 },
    { protocol: "ICMP", count: 84 },
  ],
  top_countries: [
    { code: "CN", count: 500 },
    { code: "RU", count: 300 },
    { code: "US", count: 200 },
    { code: "BR", count: 134 },
    { code: "IN", count: 100 },
  ],
  top_isps: [
    { isp: "China Telecom", count: 400 },
    { isp: "Rostelecom", count: 200 },
  ],
  timestamp: new Date().toISOString(),
};

const mockSummary: IPSSummaryResponse = {
  total: 1234,
  active: 89,
  unique_sources: 456,
  critical: 15,
  high: 120,
  medium: 450,
  low: 649,
};

const severityColors: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#3B82F6",
};

const countryNames: Record<string, string> = {
  CN: "China",
  RU: "Russia",
  US: "United States",
  BR: "Brazil",
  IN: "India",
  DE: "Germany",
  FR: "France",
  GB: "United Kingdom",
  JP: "Japan",
  KR: "South Korea",
};

export default function IPSMapPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [protocolFilter, setProtocolFilter] = useState("all");

  const { data: mapData, mutate: mutateMapData, isLoading: mapLoading } = useSWR<IPSMapDataResponse>(
    ["ips-map-data", severityFilter],
    () =>
      ipsAPI
        .getMapData({
          limit: 50,
          severity: severityFilter !== "all" ? severityFilter : undefined,
        })
        .catch(() => mockMapData),
    { refreshInterval: autoRefresh ? refreshInterval * 1000 : 0 }
  );

  const { data: liveEvents, mutate: mutateLiveEvents } = useSWR<IPSLiveEventsResponse>(
    "ips-live-events",
    () => ipsAPI.getLiveEvents().catch(() => mockLiveEvents),
    { refreshInterval: autoRefresh ? refreshInterval * 1000 : 0 }
  );

  const { data: statistics, mutate: mutateStatistics } = useSWR<IPSStatisticsResponse>(
    "ips-statistics",
    () => ipsAPI.getStatistics().catch(() => mockStatistics),
    { refreshInterval: 30000 }
  );

  const { data: summary } = useSWR<IPSSummaryResponse>(
    "ips-summary",
    () => ipsAPI.getSummary().catch(() => mockSummary),
    { refreshInterval: 30000 }
  );

  const { data: filters } = useSWR<IPSFiltersResponse>(
    "ips-filters",
    () =>
      ipsAPI.getFilters().catch(() => ({
        severities: ["critical", "high", "medium", "low"],
        categories: ["Attempted Information Leak", "Web Application Attack", "Brute Force"],
        protocols: ["TCP", "UDP", "ICMP"],
        countries: ["CN", "RU", "US", "BR", "IN"],
      }))
  );

  const handleWSUpdate = useCallback(
    (message: WSMessage) => {
      mutateMapData();
      mutateLiveEvents();
      mutateStatistics();
    },
    [mutateMapData, mutateLiveEvents, mutateStatistics]
  );

  useWSSubscription("ips_event", handleWSUpdate);

  const paths = mapData?.paths || mockMapData.paths;
  const events = liveEvents?.events || mockLiveEvents.events;
  const stats = statistics || mockStatistics;
  const summaryData = summary || mockSummary;

  const filteredEvents = events.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (countryFilter !== "all" && e.source_country_code !== countryFilter) return false;
    if (protocolFilter !== "all" && e.protocol !== protocolFilter) return false;
    return true;
  });

  const handleRefresh = () => {
    mutateMapData();
    mutateLiveEvents();
    mutateStatistics();
  };

  const clearFilters = () => {
    setSeverityFilter("all");
    setCountryFilter("all");
    setProtocolFilter("all");
  };

  const hasFilters = severityFilter !== "all" || countryFilter !== "all" || protocolFilter !== "all";

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="IPS Attack Map"
        description="Real-time cyber attack visualization"
        onRefresh={handleRefresh}
        isLoading={mapLoading}
        actions={
          <div className="flex items-center gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {(filters?.countries || ["CN", "RU", "US", "BR", "IN"]).map((code) => (
                  <SelectItem key={code} value={code}>
                    {countryNames[code] || code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={protocolFilter} onValueChange={setProtocolFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Protocols</SelectItem>
                {(filters?.protocols || ["TCP", "UDP", "ICMP"]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
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
            <div className="h-6 w-px bg-border" />
            <Select
              value={refreshInterval.toString()}
              onValueChange={(v) => setRefreshInterval(parseInt(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="icon"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{summaryData.total.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">Total Attacks</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{summaryData.active}</span>
                <span className="text-xs text-muted-foreground">Active Events</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{summaryData.unique_sources}</span>
                <span className="text-xs text-muted-foreground">Unique Sources</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-destructive">{summaryData.critical}</span>
                <span className="text-xs text-muted-foreground">Critical</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/50">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-orange-500">{summaryData.high}</span>
                <span className="text-xs text-muted-foreground">High</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/50">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-yellow-500">{summaryData.medium}</span>
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-blue-500">{summaryData.low}</span>
                <span className="text-xs text-muted-foreground">Low</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map and Stats */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* World Map */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Globe className="h-4 w-4" />
                Attack Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-muted/20 rounded-lg overflow-hidden">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ scale: 120, center: [20, 30] }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="var(--muted)"
                          stroke="var(--border)"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: "none" },
                            hover: { fill: "var(--accent)", outline: "none" },
                            pressed: { outline: "none" },
                          }}
                        />
                      ))
                    }
                  </Geographies>
                  {/* Attack paths */}
                  {paths.slice(0, 15).map((path, i) => (
                    <Line
                      key={path.id}
                      from={[path.from.lon, path.from.lat]}
                      to={[path.to.lon, path.to.lat]}
                      stroke={severityColors[path.severity] || severityColors.medium}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      style={{
                        opacity: 0.6,
                      }}
                    />
                  ))}
                  {/* Source markers */}
                  {paths.slice(0, 15).map((path) => (
                    <Marker key={`src-${path.id}`} coordinates={[path.from.lon, path.from.lat]}>
                      <circle
                        r={4}
                        fill={severityColors[path.severity] || severityColors.medium}
                        opacity={0.8}
                      />
                    </Marker>
                  ))}
                  {/* Destination marker (Tunisia) */}
                  <Marker coordinates={[10.1815, 36.8065]}>
                    <circle r={6} fill="var(--primary)" stroke="white" strokeWidth={2} />
                  </Marker>
                </ComposableMap>
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4">
                {Object.entries(severityColors).map(([sev, color]) => (
                  <div key={sev} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs capitalize">{sev}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Activity className="h-4 w-4" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Top Countries */}
              <div>
                <p className="text-sm font-medium mb-2">Top Countries</p>
                <div className="space-y-2">
                  {stats.top_countries.slice(0, 5).map((c) => {
                    const percent = (c.count / stats.total_attacks) * 100;
                    return (
                      <div key={c.code} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{countryNames[c.code] || c.code}</span>
                          <span className="text-muted-foreground">{c.count}</span>
                        </div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By Category */}
              <div>
                <p className="text-sm font-medium mb-2">By Category</p>
                <div className="space-y-2">
                  {stats.by_category.slice(0, 4).map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[180px]">{c.category}</span>
                      <Badge variant="secondary">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Protocol */}
              <div>
                <p className="text-sm font-medium mb-2">By Protocol</p>
                <div className="flex gap-2">
                  {stats.by_protocol.map((p) => (
                    <Badge key={p.protocol} variant="outline">
                      {p.protocol}: {p.count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Events Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <AlertTriangle className="h-4 w-4" />
                Live Events
                {autoRefresh && (
                  <span className="relative flex h-2 w-2 ml-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                )}
              </CardTitle>
              <Badge variant="secondary">{filteredEvents.length} events</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {filteredEvents.map((event) => (
                  <div
                    key={event.event_id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: severityColors[event.severity] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.alert_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{event.source_ip}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{event.source_city}, {event.source_country}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {event.protocol}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {event.category.split(" ").slice(0, 2).join(" ")}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
