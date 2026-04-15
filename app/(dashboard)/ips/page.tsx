"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
  Zap,
  Target,
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
  type IPSPath,
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
import { AnimatedCounter } from "@/components/animated-counter";

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
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

const severityGlowColors: Record<string, string> = {
  critical: "rgba(239, 68, 68, 0.6)",
  high: "rgba(249, 115, 22, 0.5)",
  medium: "rgba(234, 179, 8, 0.4)",
  low: "rgba(59, 130, 246, 0.4)",
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

// Animated attack line with traveling particle effect
function AnimatedAttackPath({ 
  path, 
}: { 
  path: IPSPath; 
  index?: number;
  isNew?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [particleProgress, setParticleProgress] = useState(0);
  const color = severityColors[path.severity] || severityColors.medium;
  const glowColor = severityGlowColors[path.severity] || severityGlowColors.medium;
  
  // Memoize animation duration so it doesn't change on re-renders
  const animationDuration = useMemo(() => 2000 + Math.random() * 1000, []);
  
  useEffect(() => {
    let animationFrame: number;
    let startTime: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      setParticleProgress(progress);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Fade out after completing
        setTimeout(() => setVisible(false), 300);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [animationDuration]);

  if (!visible) return null;

  // Calculate current particle position along the path
  const currentLon = path.from.lon + (path.to.lon - path.from.lon) * particleProgress;
  const currentLat = path.from.lat + (path.to.lat - path.from.lat) * particleProgress;
  
  // Trail effect - show line from source to current particle position
  const trailOpacity = particleProgress > 0.9 ? 1 - (particleProgress - 0.9) * 10 : 1;

  return (
    <g style={{ opacity: trailOpacity }}>
      {/* Fading trail line from source to current position */}
      {particleProgress > 0 && (
        <>
          {/* Glow effect trail */}
          <Line
            from={[path.from.lon, path.from.lat]}
            to={[currentLon, currentLat]}
            stroke={glowColor}
            strokeWidth={3}
            strokeLinecap="round"
            style={{ filter: "blur(2px)", opacity: 0.6 }}
          />
          {/* Main trail line */}
          <Line
            from={[path.from.lon, path.from.lat]}
            to={[currentLon, currentLat]}
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ opacity: 0.8 }}
          />
        </>
      )}
      
      {/* Traveling particle (glowing dot) */}
      {particleProgress > 0 && particleProgress < 1 && (
        <Marker coordinates={[currentLon, currentLat]}>
          <g>
            {/* Outer glow */}
            <circle
              r={6}
              fill={glowColor}
              style={{ filter: "blur(3px)" }}
            />
            {/* Inner bright dot */}
            <circle
              r={3}
              fill={color}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
            {/* Center white dot */}
            <circle
              r={1.5}
              fill="white"
            />
          </g>
        </Marker>
      )}
    </g>
  );
}

// Animated marker with pulse effect
function AnimatedMarker({ 
  coordinates, 
  severity, 
  isSource,
  isNew,
  city,
  country,
}: { 
  coordinates: [number, number]; 
  severity: string;
  isSource: boolean;
  isNew?: boolean;
  city?: string;
  country?: string;
}) {
  const color = severityColors[severity] || severityColors.medium;
  const glowColor = severityGlowColors[severity] || severityGlowColors.medium;
  
  return (
    <Marker coordinates={coordinates}>
      <g className={cn(isNew && "animate-scale-in")}>
        {/* Outer pulse ring for critical/high */}
        {(severity === "critical" || severity === "high") && (
          <circle
            r={isSource ? 12 : 18}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            className="animate-marker-pulse"
            style={{ transformOrigin: "center" }}
          />
        )}
        {/* Glow circle */}
        <circle
          r={isSource ? 6 : 10}
          fill={glowColor}
          style={{ filter: "blur(4px)" }}
        />
        {/* Main circle */}
        <circle
          r={isSource ? 4 : 8}
          fill={isSource ? color : "var(--primary)"}
          stroke={isSource ? "rgba(255,255,255,0.3)" : "white"}
          strokeWidth={isSource ? 1 : 2}
        />
        {/* Inner dot for destination */}
        {!isSource && (
          <circle
            r={3}
            fill="white"
            className="animate-pulse"
          />
        )}
      </g>
    </Marker>
  );
}

// Stats card with animated counter
function StatSummaryCard({ 
  value, 
  label, 
  color,
  icon: Icon,
}: { 
  value: number; 
  label: string; 
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover-lift",
      color && `border-${color}/30`
    )}>
      <div className={cn(
        "absolute inset-0 opacity-10",
        color && `bg-gradient-to-br from-${color} to-transparent`
      )} />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <AnimatedCounter
              value={value}
              className={cn("text-2xl font-bold", color && `text-${color}`)}
              duration={800}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          {Icon && (
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center",
              color ? `bg-${color}/10 text-${color}` : "bg-primary/10 text-primary"
            )}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Track active attack animations with unique keys for continuous spawning
interface ActiveAttack {
  id: string;
  path: IPSPath;
  spawnTime: number;
}

export default function IPSMapPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [activeAttacks, setActiveAttacks] = useState<ActiveAttack[]>([]);

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
      // Track new events for animation
      if (message.data?.event_id) {
        setNewEventIds(prev => new Set(prev).add(message.data.event_id));
        setTimeout(() => {
          setNewEventIds(prev => {
            const next = new Set(prev);
            next.delete(message.data.event_id);
            return next;
          });
        }, 2000);
      }
      mutateMapData();
      mutateLiveEvents();
      mutateStatistics();
    },
    [mutateMapData, mutateLiveEvents, mutateStatistics]
  );

  useWSSubscription("ips_event", handleWSUpdate);

  const paths = mapData?.paths || mockMapData.paths;
  
  // Continuously spawn attack animations when autoRefresh is on
  useEffect(() => {
    if (!autoRefresh) return;
    
    const spawnAttack = () => {
      const availablePaths = severityFilter === "all" 
        ? paths 
        : paths.filter(p => p.severity === severityFilter);
      
      if (availablePaths.length === 0) return;
      
      // Pick a random path to animate
      const randomPath = availablePaths[Math.floor(Math.random() * availablePaths.length)];
      const newAttack: ActiveAttack = {
        id: `attack-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        path: randomPath,
        spawnTime: Date.now(),
      };
      
      setActiveAttacks(prev => [...prev, newAttack]);
      
      // Remove attack after animation completes (4 seconds max)
      setTimeout(() => {
        setActiveAttacks(prev => prev.filter(a => a.id !== newAttack.id));
      }, 4000);
    };
    
    // Spawn initial attacks
    for (let i = 0; i < 3; i++) {
      setTimeout(() => spawnAttack(), i * 500);
    }
    
    // Continue spawning at intervals (every 0.8-1.5 seconds)
    const interval = setInterval(() => {
      spawnAttack();
    }, 800 + Math.random() * 700);
    
    return () => clearInterval(interval);
  }, [autoRefresh, paths, severityFilter]);
  const events = liveEvents?.events || mockLiveEvents.events;
  const stats = statistics || mockStatistics;
  const summaryData = summary || mockSummary;

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (countryFilter !== "all" && e.source_country_code !== countryFilter) return false;
    if (protocolFilter !== "all" && e.protocol !== protocolFilter) return false;
    return true;
  }), [events, severityFilter, countryFilter, protocolFilter]);

  const filteredPaths = useMemo(() => {
    let filtered = paths;
    if (severityFilter !== "all") {
      filtered = filtered.filter(p => p.severity === severityFilter);
    }
    return filtered.slice(0, 15);
  }, [paths, severityFilter]);

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

  // Unique source markers
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    return filteredPaths.filter(p => {
      const key = `${p.from.lat}-${p.from.lon}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredPaths]);

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
              className="relative"
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoRefresh && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </span>
              )}
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7 stagger-children">
          <StatSummaryCard 
            value={summaryData.total} 
            label="Total Attacks"
            icon={Globe}
          />
          <StatSummaryCard 
            value={summaryData.active} 
            label="Active Events"
            icon={Activity}
          />
          <StatSummaryCard 
            value={summaryData.unique_sources} 
            label="Unique Sources"
            icon={Target}
          />
          <Card className="border-destructive/30 relative overflow-hidden hover-lift transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent" />
            <CardContent className="pt-4 pb-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <AnimatedCounter
                    value={summaryData.critical}
                    className="text-2xl font-bold text-destructive"
                    duration={800}
                  />
                  <span className="text-xs text-muted-foreground">Critical</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/30 relative overflow-hidden hover-lift transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent" />
            <CardContent className="pt-4 pb-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <AnimatedCounter
                    value={summaryData.high}
                    className="text-2xl font-bold text-orange-500"
                    duration={800}
                  />
                  <span className="text-xs text-muted-foreground">High</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/30 relative overflow-hidden hover-lift transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent" />
            <CardContent className="pt-4 pb-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <AnimatedCounter
                    value={summaryData.medium}
                    className="text-2xl font-bold text-yellow-500"
                    duration={800}
                  />
                  <span className="text-xs text-muted-foreground">Medium</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30 relative overflow-hidden hover-lift transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
            <CardContent className="pt-4 pb-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <AnimatedCounter
                    value={summaryData.low}
                    className="text-2xl font-bold text-blue-500"
                    duration={800}
                  />
                  <span className="text-xs text-muted-foreground">Low</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Server className="h-4 w-4 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map and Stats */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* World Map */}
          <Card className="lg:col-span-2 relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Globe className="h-4 w-4" />
                Attack Map
                <div className="ml-auto flex items-center gap-2">
                  {autoRefresh && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                      </span>
                      Live
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[420px] bg-gradient-to-b from-muted/30 to-muted/10 rounded-lg overflow-hidden relative">
                {/* Subtle grid overlay */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-5"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, var(--border) 1px, transparent 1px),
                      linear-gradient(to bottom, var(--border) 1px, transparent 1px)
                    `,
                    backgroundSize: "40px 40px"
                  }}
                />
                
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ scale: 130, center: [20, 25] }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <defs>
                    {/* Glow filters for each severity */}
                    <filter id="glow-critical" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <filter id="glow-high" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
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
                  
                  {/* Active attack paths with traveling animation */}
                  {activeAttacks.map((attack) => (
                    <AnimatedAttackPath 
                      key={attack.id} 
                      path={attack.path} 
                    />
                  ))}
                  
                  {/* Source markers for active attacks */}
                  {activeAttacks.map((attack) => (
                    <AnimatedMarker
                      key={`src-${attack.id}`}
                      coordinates={[attack.path.from.lon, attack.path.from.lat]}
                      severity={attack.path.severity}
                      isSource={true}
                      isNew={true}
                      city={attack.path.from.city}
                      country={attack.path.from.country}
                    />
                  ))}
                  
                  {/* Destination marker (Tunisia - main target) */}
                  <AnimatedMarker
                    coordinates={[10.1815, 36.8065]}
                    severity="critical"
                    isSource={false}
                    city="Tunis"
                    country="Tunisia"
                  />
                </ComposableMap>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/50">
                {Object.entries(severityColors).map(([sev, color]) => (
                  <div key={sev} className="flex items-center gap-2 group cursor-pointer" onClick={() => setSeverityFilter(sev)}>
                    <div 
                      className={cn(
                        "w-3 h-3 rounded-full transition-transform group-hover:scale-125",
                        severityFilter === sev && "ring-2 ring-offset-2 ring-offset-background"
                      )} 
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} 
                    />
                    <span className={cn(
                      "text-xs capitalize transition-colors",
                      severityFilter === sev ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>{sev}</span>
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
            <CardContent className="space-y-5">
              {/* Top Countries */}
              <div>
                <p className="text-sm font-medium mb-3">Top Attack Sources</p>
                <div className="space-y-3">
                  {stats.top_countries.slice(0, 5).map((c, i) => {
                    const percent = (c.count / stats.total_attacks) * 100;
                    return (
                      <div key={c.code} className="space-y-1.5 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span>
                            {countryNames[c.code] || c.code}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">{c.count.toLocaleString()}</span>
                        </div>
                        <div className="relative">
                          <Progress value={percent} className="h-2" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By Category */}
              <div>
                <p className="text-sm font-medium mb-3">Attack Categories</p>
                <div className="space-y-2">
                  {stats.by_category.slice(0, 4).map((c, i) => (
                    <div 
                      key={c.category} 
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-slide-up"
                      style={{ animationDelay: `${(i + 5) * 50}ms` }}
                    >
                      <span className="truncate max-w-[160px] text-muted-foreground">{c.category}</span>
                      <Badge variant="secondary" className="font-mono">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Protocol */}
              <div>
                <p className="text-sm font-medium mb-3">Protocols</p>
                <div className="flex gap-2 flex-wrap">
                  {stats.by_protocol.map((p, i) => (
                    <Badge 
                      key={p.protocol} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-accent transition-colors animate-scale-in"
                      style={{ animationDelay: `${(i + 9) * 50}ms` }}
                      onClick={() => setProtocolFilter(p.protocol)}
                    >
                      {p.protocol}: <span className="font-mono ml-1">{p.count}</span>
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
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                )}
              </CardTitle>
              <Badge variant="secondary" className="font-mono">{filteredEvents.length} events</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              <div className="space-y-2">
                {filteredEvents.map((event, i) => (
                  <div
                    key={event.event_id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200",
                      newEventIds.has(event.event_id) && "animate-slide-in-right border-primary/50 bg-primary/5"
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="relative">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ 
                          backgroundColor: severityColors[event.severity],
                          boxShadow: `0 0 8px ${severityColors[event.severity]}60`
                        }}
                      />
                      {(event.severity === "critical" || event.severity === "high") && (
                        <div
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ backgroundColor: severityColors[event.severity], opacity: 0.4 }}
                        />
                      )}
                    </div>
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
                      <Badge variant="secondary" className="text-xs max-w-[100px] truncate">
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
