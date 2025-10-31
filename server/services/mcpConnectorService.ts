import { storage } from "../storage";
import { cacheService } from "./cacheService";
import type { McpConnector } from "@shared/schema";

export type AgentRole = "delivery" | "product" | "architecture" | "engineering" | "procurement" | "security";

export interface ConnectorPayload {
  roleContext: Record<AgentRole, string>;
  rawData: any;
  metadata: {
    connectorName: string;
    timestamp: number;
    ttl: number;
  };
}

export interface ConnectorAdapter {
  fetchData(connector: McpConnector, context: EvaluationContext): Promise<ConnectorPayload>;
  supports(connectorType: string): boolean;
}

export interface EvaluationContext {
  projectName?: string;
  vendorName?: string;
  requirements?: string[];
  proposalSummary?: string;
}

export interface ConnectorError {
  connectorId: string;
  connectorName: string;
  error: string;
  category: "auth" | "timeout" | "rateLimit" | "parsing" | "network" | "unknown";
  timestamp: number;
}

class RESTAdapter implements ConnectorAdapter {
  supports(connectorType: string): boolean {
    return connectorType === "rest";
  }

  async fetchData(connector: McpConnector, context: EvaluationContext): Promise<ConnectorPayload> {
    const timeout = 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
      };

      if (connector.authType === "bearer" && connector.apiKey) {
        headers["Authorization"] = `Bearer ${connector.apiKey}`;
      } else if (connector.authType === "apikey" && connector.apiKey) {
        headers["X-API-Key"] = connector.apiKey;
      } else if (connector.authType === "basic" && connector.apiKey) {
        headers["Authorization"] = `Basic ${Buffer.from(connector.apiKey).toString("base64")}`;
      }

      // Build JSON-RPC 2.0 request for MCP
      const jsonRpcRequest = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/list",
        params: {
          vendor: context.vendorName || "",
          project: context.projectName || "",
          requirements: context.requirements || [],
          proposalSummary: context.proposalSummary || "",
        },
      };

      const response = await fetch(connector.serverUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(jsonRpcRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw { category: "auth", message: `Authentication failed: ${response.statusText}` };
        }
        if (response.status === 429) {
          throw { category: "rateLimit", message: "Rate limit exceeded" };
        }
        throw { category: "network", message: `HTTP ${response.status}: ${response.statusText}` };
      }

      // Parse response (could be JSON or Server-Sent Events format)
      const contentType = response.headers.get("content-type") || "";
      let data: any;

      if (contentType.includes("text/event-stream")) {
        // Parse SSE format: "event: message\ndata: {...}\n"
        const text = await response.text();
        const dataMatch = text.match(/data: ({.*})/);
        if (dataMatch && dataMatch[1]) {
          data = JSON.parse(dataMatch[1]);
        } else {
          throw { category: "parsing", message: "Failed to parse SSE response" };
        }
      } else {
        // Regular JSON response
        data = await response.json();
      }

      const roleContext = this.formatDataForRoles(data, connector, context);
      const ttl = 300;

      return {
        roleContext,
        rawData: data,
        metadata: {
          connectorName: connector.name,
          timestamp: Date.now(),
          ttl,
        },
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw { category: "timeout", message: "Request timeout exceeded" };
      }

      if (error.category) {
        throw error;
      }

      throw { category: "unknown", message: error.message || "Unknown error occurred" };
    }
  }

  private formatDataForRoles(
    data: any,
    connector: McpConnector,
    context: EvaluationContext
  ): Record<AgentRole, string> {
    const roleMapping = connector.roleMapping || [];
    const formattedData: Record<string, string> = {};

    const defaultFormat = this.formatGenericData(data, connector.name);

    for (const role of roleMapping) {
      formattedData[role] = defaultFormat;
    }

    return formattedData as Record<AgentRole, string>;
  }

  private formatGenericData(data: any, connectorName: string): string {
    if (!data) return "";

    let formatted = `\n**EXTERNAL INTELLIGENCE: ${connectorName}**\n`;

    if (typeof data === "string") {
      formatted += data;
    } else if (Array.isArray(data)) {
      formatted += data.map((item, idx) => `${idx + 1}. ${JSON.stringify(item, null, 2)}`).join("\n");
    } else if (typeof data === "object") {
      if (data.insights && Array.isArray(data.insights)) {
        formatted += data.insights.map((insight: string, idx: number) => `- ${insight}`).join("\n");
      } else if (data.vendor_performance) {
        formatted += this.formatVendorPerformance(data.vendor_performance);
      } else if (data.documentation) {
        formatted += `Relevant documentation:\n${data.documentation}`;
      } else {
        const entries = Object.entries(data).slice(0, 10);
        formatted += entries.map(([key, value]) => `- ${key}: ${String(value).substring(0, 200)}`).join("\n");
      }
    }

    return formatted;
  }

  private formatVendorPerformance(perf: any): string {
    let result = "Vendor Performance History:\n";
    if (perf.past_projects) result += `- Past Projects: ${perf.past_projects}\n`;
    if (perf.on_time_delivery) result += `- On-Time Delivery Rate: ${perf.on_time_delivery}\n`;
    if (perf.sla_adherence) result += `- SLA Adherence: ${perf.sla_adherence}\n`;
    if (perf.support_quality) result += `- Support Quality: ${perf.support_quality}\n`;
    return result;
  }
}

class MCPConnectorService {
  private adapters: Map<string, ConnectorAdapter>;

  constructor() {
    this.adapters = new Map();
    this.registerAdapter(new RESTAdapter());
  }

  registerAdapter(adapter: ConnectorAdapter): void {
    if (adapter.supports("rest")) this.adapters.set("rest", adapter);
    if (adapter.supports("graphql")) this.adapters.set("graphql", adapter);
    if (adapter.supports("websocket")) this.adapters.set("websocket", adapter);
  }

  async fetchConnectorData(
    connectorId: string,
    context: EvaluationContext
  ): Promise<ConnectorPayload | null> {
    try {
      const connector = await storage.getMcpConnector(connectorId);
      if (!connector) {
        console.warn(`MCP Connector not found: ${connectorId}`);
        return null;
      }

      if (connector.isActive !== "true") {
        console.log(`MCP Connector is inactive: ${connector.name}`);
        return null;
      }

      const cacheKey = this.getCacheKey(connectorId, context);
      const cached = cacheService.get<ConnectorPayload>(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for connector: ${connector.name}`);
        return cached;
      }

      const adapter = this.adapters.get(connector.connectorType);
      if (!adapter) {
        console.warn(`No adapter found for connector type: ${connector.connectorType}`);
        return null;
      }

      console.log(`🔌 Fetching data from MCP connector: ${connector.name}`);
      const payload = await adapter.fetchData(connector, context);

      cacheService.set(cacheKey, payload, payload.metadata.ttl);
      console.log(`✅ Data fetched and cached from: ${connector.name}`);

      return payload;
    } catch (error: any) {
      const connectorError: ConnectorError = {
        connectorId,
        connectorName: (await storage.getMcpConnector(connectorId))?.name || "Unknown",
        error: error.message || String(error),
        category: error.category || "unknown",
        timestamp: Date.now(),
      };

      console.error(`❌ MCP Connector error:`, connectorError);
      return null;
    }
  }

  async fetchAllConnectorDataForRole(
    role: AgentRole,
    context: EvaluationContext
  ): Promise<{ payload: string; diagnostics: ConnectorError[] }> {
    const connectors = await storage.getActiveMcpConnectors();
    
    const relevantConnectors = connectors.filter((c) => {
      const roleMapping = c.roleMapping || [];
      return roleMapping.includes(role);
    });

    if (relevantConnectors.length === 0) {
      return { payload: "", diagnostics: [] };
    }

    console.log(`🔍 Fetching data from ${relevantConnectors.length} MCP connectors for role: ${role}`);

    const results = await Promise.allSettled(
      relevantConnectors.map((c) => this.fetchConnectorData(c.id, context))
    );

    const diagnostics: ConnectorError[] = [];
    const payloads: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        const connectorPayload = result.value;
        const roleContext = connectorPayload.roleContext[role];
        if (roleContext) {
          payloads.push(roleContext);
        }
      } else if (result.status === "rejected") {
        diagnostics.push({
          connectorId: relevantConnectors[idx].id,
          connectorName: relevantConnectors[idx].name,
          error: result.reason?.message || "Unknown error",
          category: result.reason?.category || "unknown",
          timestamp: Date.now(),
        });
      }
    });

    const combinedPayload = payloads.length > 0 ? payloads.join("\n\n") : "";
    
    return { payload: combinedPayload, diagnostics };
  }

  private getCacheKey(connectorId: string, context: EvaluationContext): string {
    const contextStr = JSON.stringify({
      vendor: context.vendorName,
      project: context.projectName,
    });
    return `mcp:${connectorId}:${Buffer.from(contextStr).toString("base64")}`;
  }
}

export const mcpConnectorService = new MCPConnectorService();
