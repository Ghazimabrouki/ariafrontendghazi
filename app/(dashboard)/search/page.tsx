"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  AlertTriangle,
  FileWarning,
  Archive,
  X,
  Filter,
} from "lucide-react";
import { searchAPI, type SearchResult } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// Mock search results
const mockResults: SearchResult[] = [
  {
    type: "alert",
    id: "ALT-2024-0142",
    title: "SSH brute force attack detected",
    description: "Multiple failed SSH authentication attempts from 192.168.1.100",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    relevance: 0.95,
  },
  {
    type: "incident",
    id: "INC-2024-0047",
    title: "Coordinated SSH Attack Campaign",
    description: "Multiple correlated alerts indicating ongoing brute force attack",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    relevance: 0.92,
  },
  {
    type: "investigation",
    id: "INV-2024-0023",
    title: "SSH Attack Investigation",
    description: "AI-powered analysis of SSH brute force campaign with automated playbook",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    relevance: 0.88,
  },
  {
    type: "archive",
    id: "ARC-2024-0015",
    title: "Previous SSH Attack Remediation",
    description: "Successfully blocked attackers and implemented rate limiting",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    relevance: 0.75,
  },
  {
    type: "alert",
    id: "ALT-2024-0089",
    title: "Failed SSH login from unknown IP",
    description: "Authentication failure detected from external IP address",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    relevance: 0.72,
  },
];

const typeIcons: Record<string, React.ElementType> = {
  alert: AlertTriangle,
  incident: FileWarning,
  investigation: Search,
  archive: Archive,
};

const typeColors: Record<string, string> = {
  alert: "text-warning bg-warning/10 border-warning/30",
  incident: "text-destructive bg-destructive/10 border-destructive/30",
  investigation: "text-primary bg-primary/10 border-primary/30",
  archive: "text-muted-foreground bg-muted border-border",
};

const typeRoutes: Record<string, string> = {
  alert: "/alerts",
  incident: "/incidents",
  investigation: "/investigations",
  archive: "/archives",
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "alert",
    "incident",
    "investigation",
    "archive",
  ]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSWR(
    debouncedQuery ? ["search", debouncedQuery, selectedTypes] : null,
    () =>
      searchAPI
        .search(debouncedQuery, selectedTypes.length < 4 ? selectedTypes : undefined)
        .catch(() =>
          mockResults.filter(
            (r) =>
              selectedTypes.includes(r.type) &&
              (r.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
                r.description.toLowerCase().includes(debouncedQuery.toLowerCase()))
          )
        ),
    { revalidateOnFocus: false }
  );

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(`${typeRoutes[result.type]}/${result.id}`);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Search"
        description="Search across all alerts, incidents, investigations, and archives"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Search Input */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for alerts, incidents, investigations..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 pl-10 text-base"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter by type:</span>
          </div>
          {["alert", "incident", "investigation", "archive"].map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2"
            >
              <Checkbox
                checked={selectedTypes.includes(type)}
                onCheckedChange={() => toggleType(type)}
              />
              <span className="text-sm capitalize">{type}s</span>
            </label>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : debouncedQuery && results ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
              <span className="font-medium text-foreground">&quot;{debouncedQuery}&quot;</span>
            </p>

            {results.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-lg font-medium">No results found</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search terms or filters
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {results.map((result) => {
                  const Icon = typeIcons[result.type];
                  const colorClass = typeColors[result.type];

                  return (
                    <Card
                      key={`${result.type}-${result.id}`}
                      className="cursor-pointer transition-all hover:shadow-md"
                      onClick={() => handleResultClick(result)}
                    >
                      <CardContent className="flex items-start gap-4 py-4">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                            colorClass
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {result.type}
                            </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              {result.id}
                            </span>
                          </div>
                          <p className="font-medium">{result.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {result.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(result.timestamp), {
                              addSuffix: true,
                            })}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${result.relevance * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(result.relevance * 100)}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium">Start searching</p>
              <p className="text-sm text-muted-foreground">
                Enter a search term to find alerts, incidents, and more
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
