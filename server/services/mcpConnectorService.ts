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
      // Use tools/call to invoke the specific Confluence search tool
      const searchQuery = context.proposalSummary || context.projectName || "";
      
      // Get Confluence cloudId from connector config
      const config = connector.config as any;
      const cloudId = config?.cloudId || "";
      
      console.log(`🔍 [MCP DEBUG] Connector config:`, connector.config);
      console.log(`🔍 [MCP DEBUG] Extracted cloudId: "${cloudId}"`);
      
      if (!cloudId) {
        const errorMsg = `Confluence Cloud ID is required. Please edit the connector and add your Confluence Cloud ID (found in your Confluence URL).`;
        console.warn(`⚠️ [MCP] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      const jsonRpcRequest = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "confluence_cloud_search_for_page_or_blog_post",
          arguments: {
            query: searchQuery,
            instructions: `Search Confluence for pages and blog posts related to: ${searchQuery}. Return the full content of relevant pages.`,
            cloudId: cloudId,
            limit: 10,
          },
        },
      };
      
      console.log(`🔍 [MCP DEBUG] Sending request:`, JSON.stringify(jsonRpcRequest, null, 2));

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

      // DEBUG: Log what Confluence/MCP is actually returning
      console.log(`🔍 [MCP DEBUG] Raw response from ${connector.name}:`, JSON.stringify(data, null, 2));

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
    if (!data) {
      console.warn(`⚠️ [MCP] No data returned from ${connectorName}`);
      return "";
    }

    let formatted = `\n**EXTERNAL INTELLIGENCE: ${connectorName}**\n`;

    if (typeof data === "string") {
      formatted += data;
    } else if (Array.isArray(data)) {
      formatted += data.map((item, idx) => `${idx + 1}. ${JSON.stringify(item, null, 2)}`).join("\n");
    } else if (typeof data === "object") {
      // Check for JSON-RPC result wrapper
      if (data.result) {
        console.log(`🔍 [MCP] Found JSON-RPC result wrapper, extracting...`);
        return this.formatGenericData(data.result, connectorName);
      }
      
      // MCP tools/call response: Check for content array (standard MCP response format)
      if (data.content && Array.isArray(data.content)) {
        console.log(`📝 [MCP] Found content array with ${data.content.length} item(s)`);
        formatted += data.content.map((item: any) => {
          if (item.type === "text" && item.text) {
            return item.text;
          } else if (item.type === "resource" && item.resource) {
            return JSON.stringify(item.resource, null, 2);
          } else {
            return JSON.stringify(item, null, 2);
          }
        }).join("\n\n");
      }
      // MCP Protocol: Check for tools array (tools/list response)
      else if (data.tools && Array.isArray(data.tools)) {
        console.log(`🔧 [MCP] Found ${data.tools.length} tools in MCP response`);
        formatted += data.tools.map((tool: any, idx: number) => {
          let toolContent = `\n### Tool ${idx + 1}: ${tool.name || 'Unnamed Tool'}\n`;
          if (tool.description) {
            toolContent += `Description: ${tool.description}\n`;
          }
          if (tool.inputSchema) {
            toolContent += `Input Schema: ${JSON.stringify(tool.inputSchema)}\n`;
          }
          // Check if tool has pages/content/results
          if (tool.pages && Array.isArray(tool.pages)) {
            toolContent += this.formatPages(tool.pages);
          } else if (tool.content) {
            toolContent += `Content: ${tool.content}\n`;
          } else if (tool.results) {
            toolContent += `Results: ${JSON.stringify(tool.results, null, 2)}\n`;
          }
          return toolContent;
        }).join("\n---\n");
      }
      // Confluence-specific: Check for pages/results array
      else if (data.pages && Array.isArray(data.pages)) {
        console.log(`📄 [MCP] Found ${data.pages.length} Confluence pages`);
        formatted += this.formatPages(data.pages);
      }
      else if (data.results && Array.isArray(data.results)) {
        console.log(`📄 [MCP] Found ${data.results.length} search results`);
        formatted += this.formatPages(data.results);
      }
      // Check for insights array
      else if (data.insights && Array.isArray(data.insights)) {
        console.log(`💡 [MCP] Found ${data.insights.length} insights`);
        formatted += data.insights.map((insight: string, idx: number) => `- ${insight}`).join("\n");
      }
      // Check for vendor performance
      else if (data.vendor_performance) {
        formatted += this.formatVendorPerformance(data.vendor_performance);
      }
      // Check for documentation field
      else if (data.documentation) {
        formatted += `Relevant documentation:\n${data.documentation}`;
      }
      // Check for text field (MCP simple text response)
      else if (data.text) {
        console.log(`📝 [MCP] Found text field`);
        formatted += data.text;
      }
      // Generic fallback
      else {
        console.log(`⚠️ [MCP] Using generic formatting for object with keys: ${Object.keys(data).join(', ')}`);
        const entries = Object.entries(data).slice(0, 10);
        formatted += entries.map(([key, value]) => `- ${key}: ${String(value).substring(0, 200)}`).join("\n");
      }
    }

    console.log(`📝 [MCP] Formatted data length: ${formatted.length} characters`);
    return formatted;
  }

  private formatPages(pages: any[]): string {
    return pages.map((page: any, idx: number) => {
      let pageContent = `\n### Page ${idx + 1}: ${page.title || 'Untitled'}\n`;
      if (page.body) {
        pageContent += `${page.body}\n`;
      } else if (page.content) {
        pageContent += `${page.content}\n`;
      } else if (page.excerpt) {
        pageContent += `${page.excerpt}\n`;
      } else if (page.text) {
        pageContent += `${page.text}\n`;
      } else {
        // Show whatever fields are available
        pageContent += JSON.stringify(page, null, 2);
      }
      return pageContent;
    }).join("\n---\n");
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
    context: EvaluationContext,
    options?: { bypassCache?: boolean }
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
      
      // Skip cache for testing
      if (!options?.bypassCache) {
        const cached = cacheService.get<ConnectorPayload>(cacheKey);
        if (cached) {
          console.log(`✅ Cache hit for connector: ${connector.name}`);
          return cached;
        }
      } else {
        console.log(`🔄 Bypassing cache for connector: ${connector.name}`);
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
