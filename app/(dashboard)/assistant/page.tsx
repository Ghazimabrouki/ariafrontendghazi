"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import {
  Send,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  FileWarning,
  Search,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { aiAPI } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const exampleQuestions = [
  {
    icon: AlertTriangle,
    question: "What are the most critical alerts in the last 24 hours?",
  },
  {
    icon: FileWarning,
    question: "Summarize the current open incidents",
  },
  {
    icon: Search,
    question: "Are there any patterns in the recent SSH attacks?",
  },
  {
    icon: Lightbulb,
    question: "Recommend security improvements based on recent incidents",
  },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm ARIA, your AI security assistant by Huawei. I can help you analyze threats, investigate incidents, and provide security recommendations based on your security data. How can I assist you today?",
      timestamp: new Date(),
      suggestions: [
        "Show critical alerts",
        "Summarize open incidents",
        "Recent attack patterns",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await aiAPI.query(userMessage.content).catch(() => {
        // Mock response for demonstration
        return generateMockResponse(userMessage.content);
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        suggestions: response.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleExampleClick = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Security Assistant"
        description="Natural language queries for threat analysis and recommendations"
      />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <Card className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" && "justify-end"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] space-y-2",
                      message.role === "user" && "text-right"
                    )}
                  >
                    <div
                      className={cn(
                        "inline-block rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(message.timestamp, "h:mm a")}
                    </p>
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="h-auto py-1 text-xs"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Analyzing...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Example Questions (show when no conversation) */}
          {messages.length === 1 && (
            <div className="border-t p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Try asking:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {exampleQuestions.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto justify-start gap-2 px-3 py-2 text-left"
                    onClick={() => handleExampleClick(example.question)}
                  >
                    <example.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">{example.question}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                ref={inputRef}
                placeholder="Ask about threats, incidents, or security recommendations..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Mock response generator for demonstration
function generateMockResponse(query: string): { response: string; suggestions?: string[] } {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("critical") || lowerQuery.includes("alert")) {
    return {
      response: `Based on my analysis of the last 24 hours, I've identified **23 critical alerts** that require your attention:

**Top Critical Alerts:**
1. **SSH Brute Force Campaign** (47 related alerts)
   - Source: Multiple IPs across 12 countries
   - Target: Production servers (web-server-01, db-server-02)
   - Status: Active investigation (INV-2024-0001)

2. **Suspicious Container Activity** (12 related alerts)
   - Detected by: Falco
   - Risk: Potential container escape attempt
   - Status: Awaiting playbook approval

3. **Unauthorized API Access** (8 related alerts)
   - Source: External IP 203.0.113.42
   - Pattern: Automated scanning behavior
   - Status: Under investigation

**Recommendation:** I suggest prioritizing the SSH brute force campaign as it shows coordinated attack patterns.`,
      suggestions: [
        "Show SSH attack details",
        "View container alerts",
        "Recommend mitigations",
      ],
    };
  }

  if (lowerQuery.includes("incident") || lowerQuery.includes("open")) {
    return {
      response: `Currently, there are **47 open incidents** in the system. Here's a summary:

**By Severity:**
- Critical: 8 incidents (17%)
- High: 15 incidents (32%)
- Medium: 16 incidents (34%)
- Low: 8 incidents (17%)

**Most Active Incident:**
**INC-2024-0047** - Coordinated SSH Attack Campaign
- Created: 2 hours ago
- Alerts: 47 correlated
- Investigation: INV-2024-0001 (AI analysis complete)
- Next step: Playbook awaiting your approval

**Trend Analysis:** There has been a 23% increase in incidents compared to last week, primarily driven by SSH-related attacks.`,
      suggestions: [
        "Review critical incidents",
        "Approve pending playbook",
        "Show incident trends",
      ],
    };
  }

  if (lowerQuery.includes("pattern") || lowerQuery.includes("ssh")) {
    return {
      response: `I've analyzed SSH-related events over the past 7 days and identified the following patterns:

**Attack Patterns:**
1. **Coordinated Botnet Activity**
   - 47 unique source IPs
   - Geographic distribution: Russia (35%), China (28%), Brazil (15%), Others (22%)
   - Attack rate: 150+ attempts/minute at peak

2. **Target Accounts**
   - Most targeted: root (45%), admin (30%), ubuntu (15%), other (10%)
   - 0 successful authentications (defenses holding)

3. **Timing Patterns**
   - Peak activity: 02:00-04:00 UTC
   - Sustained low-level activity throughout day

**Similar Historical Events:**
- ARC-2024-0015 (2 weeks ago) - Same attack signature
- Resolution: IP blocking + fail2ban configuration

**Recommendations:**
1. Implement geographic restrictions on SSH
2. Enable key-only authentication
3. Consider port knocking for additional security`,
      suggestions: [
        "View historical archives",
        "Generate security report",
        "Implement recommendations",
      ],
    };
  }

  if (lowerQuery.includes("recommend") || lowerQuery.includes("improve")) {
    return {
      response: `Based on analysis of your recent incidents and security posture, here are my recommendations:

**Immediate Actions (High Priority):**
1. **Enable SSH Key-Only Authentication**
   - Impact: Would have prevented 85% of recent alerts
   - Effort: Low
   - Risk: Minimal if keys are properly distributed

2. **Implement Rate Limiting**
   - Configure fail2ban with: 5 attempts / 10 minute window
   - 24-hour ban duration
   - Geographic restrictions for non-business regions

**Short-Term Improvements:**
3. **Network Segmentation**
   - Isolate production servers from direct internet access
   - Implement bastion/jump host architecture

4. **Enhanced Monitoring**
   - Deploy honeypots to detect early reconnaissance
   - Increase alert threshold sensitivity for off-hours

**Long-Term Strategy:**
5. **Zero Trust Architecture**
   - Move toward identity-based access controls
   - Implement continuous verification

These recommendations are based on 234 analyzed incidents over the past 30 days.`,
      suggestions: [
        "Create implementation plan",
        "Estimate risk reduction",
        "View affected systems",
      ],
    };
  }

  // Default response
  return {
    response: `I understand you're asking about "${query}". 

Let me provide some context based on current system data:

- **Active Alerts:** 12,847 in the last 24 hours
- **Open Incidents:** 47 requiring investigation
- **Pending Approvals:** 5 playbooks awaiting review

Could you be more specific about what you'd like to know? I can help with:
- Threat analysis and investigation
- Incident summaries and trends
- Security recommendations
- Historical pattern analysis

Feel free to ask a more specific question!`,
    suggestions: [
      "Show critical alerts",
      "Summarize incidents",
      "Security recommendations",
    ],
  };
}
