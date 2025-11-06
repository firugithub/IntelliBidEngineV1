import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Send, Bot, User, Database, Plug, FileText, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { marked } from "marked";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: Array<{ type: "rag" | "mcp"; name: string; content?: string }>;
  ragChunksUsed?: number;
  mcpConnectorsUsed?: number;
}

interface ChatbotStatus {
  ready: boolean;
  openAIConfigured: boolean;
  ragConfigured: boolean;
  mcpConnectorsAvailable: number;
  missingConfiguration: string[];
}

interface ChatbotResponse {
  answer: string;
  sources: Array<{ type: "rag" | "mcp"; name: string; content?: string }>;
  ragChunksUsed: number;
  mcpConnectorsUsed: number;
}

export default function KnowledgeBaseChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check chatbot status
  const { data: status } = useQuery<ChatbotStatus>({
    queryKey: ["/api/kb-chatbot/status"],
  });

  // Query mutation
  const queryMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest(
        "POST",
        "/api/kb-chatbot/query",
        {
          query,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
        }
      ) as ChatbotResponse;
      return response;
    },
    onSuccess: (data, query) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: query,
          timestamp: Date.now(),
        },
        {
          role: "assistant",
          content: data.answer,
          timestamp: Date.now(),
          sources: data.sources,
          ragChunksUsed: data.ragChunksUsed,
          mcpConnectorsUsed: data.mcpConnectorsUsed,
        },
      ]);
      setInputValue("");
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || queryMutation.isPending) return;
    queryMutation.mutate(inputValue.trim());
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Knowledge Base Chatbot</h1>
        <p className="text-muted-foreground">
          Test your RAG system, MCP connectors, and ask questions about RFT/RFI processes
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chatbot Status</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.ready ? (
                <Badge variant="default" className="text-sm">Ready</Badge>
              ) : (
                <Badge variant="destructive" className="text-sm">Not Configured</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.ready
                ? "RAG system configured"
                : "Configure Azure AI Search in Admin Config"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RAG Documents</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.ragConfigured ? "Active" : "Inactive"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Azure AI Search embeddings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MCP Connectors</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.mcpConnectorsAvailable || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active external data sources
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Chat with Your Knowledge Base</CardTitle>
          <CardDescription>
            Ask questions about your documents, RFT/RFI processes, compliance standards, or vendor evaluations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 pr-4 mb-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Bot className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">Start a conversation</p>
                <p className="text-sm max-w-md">
                  Try asking: "What RFT documents do we have?" or "Show me our compliance standards"
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`flex flex-col max-w-[80%] ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`rounded-lg px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div 
                            className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0"
                            dangerouslySetInnerHTML={{ __html: marked(msg.content) as string }}
                          />
                        )}
                      </div>

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Sources:
                          </div>
                          {msg.sources.map((source, i) => (
                            <Badge
                              key={i}
                              variant={source.type === "rag" ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {source.type === "rag" ? (
                                <Database className="h-3 w-3 mr-1" />
                              ) : (
                                <Plug className="h-3 w-3 mr-1" />
                              )}
                              {source.name}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Stats */}
                      {msg.ragChunksUsed !== undefined && msg.mcpConnectorsUsed !== undefined && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {msg.ragChunksUsed} docs • {msg.mcpConnectorsUsed} connectors
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {queryMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Searching knowledge base...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <Separator className="my-4" />

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              data-testid="input-chatbot-query"
              placeholder="Ask about your knowledge base, RFT/RFI processes, or compliance standards..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={queryMutation.isPending || !status?.ready}
              className="flex-1"
            />
            <Button
              data-testid="button-send-query"
              type="submit"
              disabled={!inputValue.trim() || queryMutation.isPending || !status?.ready}
              size="icon"
            >
              {queryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {!status?.ready && (
            <p className="text-xs text-muted-foreground mt-2">
              Configure Azure AI Search in Admin Config to enable the chatbot
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
