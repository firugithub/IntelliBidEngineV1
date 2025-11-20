import OpenAI from "openai";
import { ConfigHelper } from "../core/configHelpers";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ContextArchitecture {
  systemName: string;
  stakeholders: Array<{ name: string; role: string }>;
  businessFunctions: Array<{ name: string; description: string }>;
  channels: Array<{ name: string; type: string }>;
  interfacingSystems: Array<{ name: string; purpose: string }>;
  dataAssets: Array<{ name: string; description: string }>;
  enterpriseCapabilities: Array<{ name: string; description: string }>;
}

/**
 * Extract context architecture components from business case using AI
 */
export async function extractContextArchitecture(businessCaseContent: string): Promise<ContextArchitecture> {
  const config = ConfigHelper.getAgentsOpenAIConfig();
  
  // Initialize OpenAI client (Azure or regular)
  let client: OpenAI;
  if (config.useAzure) {
    const cleanEndpoint = config.azureEndpoint!.replace(/\/$/, '');
    client = new OpenAI({
      baseURL: `${cleanEndpoint}/openai/deployments/${config.azureDeployment}`,
      apiKey: config.apiKey,
      defaultQuery: { "api-version": config.azureApiVersion },
      defaultHeaders: { "api-key": config.apiKey },
    });
  } else {
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  const systemPrompt = `You are an enterprise architect analyzing business cases to extract conceptual architecture components.

Extract the following components from the business case:
1. Stakeholders - key people/groups involved (e.g., executives, users, IT teams)
2. Business Functions - main business capabilities or processes supported
3. Channels - interaction methods (e.g., web portal, mobile app, API, email)
4. Interfacing Systems - external systems that will integrate (e.g., ERP, CRM, payment gateways)
5. Data Assets - key data entities managed (e.g., customer data, transactions, inventory)
6. Enterprise Capabilities - strategic capabilities enabled (e.g., real-time analytics, automation)

Return your response as a JSON object matching this structure:
{
  "systemName": "Name of the system/project",
  "stakeholders": [{"name": "Executive Leadership", "role": "Strategic oversight"}],
  "businessFunctions": [{"name": "Order Processing", "description": "Process customer orders"}],
  "channels": [{"name": "Web Portal", "type": "User interface"}],
  "interfacingSystems": [{"name": "SAP ERP", "purpose": "Financial integration"}],
  "dataAssets": [{"name": "Customer Data", "description": "Customer profiles and preferences"}],
  "enterpriseCapabilities": [{"name": "Real-time Analytics", "description": "Live business insights"}]
}`;

  const response = await client.chat.completions.create({
    model: config.useAzure ? config.azureDeployment : "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this business case:\n\n${businessCaseContent}` }
    ],
    temperature: 0.3,
    max_tokens: 2000
  });

  const content = response.choices[0]?.message?.content || "{}";
  
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to parse AI response:", content);
    // Return default structure
    return {
      systemName: "Enterprise System",
      stakeholders: [{ name: "Business Users", role: "System users" }],
      businessFunctions: [{ name: "Core Operations", description: "Main business processes" }],
      channels: [{ name: "Web Application", type: "User interface" }],
      interfacingSystems: [{ name: "Legacy System", purpose: "Data integration" }],
      dataAssets: [{ name: "Business Data", description: "Core business information" }],
      enterpriseCapabilities: [{ name: "Process Automation", description: "Automated workflows" }]
    };
  }
}

/**
 * Sanitize text for Mermaid diagram (remove emoji, escape quotes, limit length)
 */
function sanitizeMermaidText(text: string, maxLength: number = 40): string {
  return text
    // Remove emoji and non-ASCII characters
    .replace(/[^\x00-\x7F]/g, '')
    // Escape quotes
    .replace(/"/g, '\\"')
    // Trim and limit length
    .substring(0, maxLength)
    .trim();
}

/**
 * Generate Mermaid diagram text for context architecture
 */
export function generateContextDiagramMermaid(architecture: ContextArchitecture): string {
  const { systemName, stakeholders, businessFunctions, channels, interfacingSystems, dataAssets } = architecture;
  
  let mermaid = `graph TB\n`;
  mermaid += `    System["${sanitizeMermaidText(systemName, 60)}"]\n\n`;
  
  // Add stakeholders (top)
  if (stakeholders.length > 0) {
    mermaid += `    %% Stakeholders\n`;
    stakeholders.forEach((sh, idx) => {
      const id = `SH${idx}`;
      const name = sanitizeMermaidText(sh.name, 30);
      const role = sanitizeMermaidText(sh.role, 30);
      mermaid += `    ${id}["${name}<br/><small>${role}</small>"]\n`;
      mermaid += `    ${id} -.-> System\n`;
    });
    mermaid += `\n`;
  }
  
  // Add channels (left)
  if (channels.length > 0) {
    mermaid += `    %% Channels\n`;
    channels.forEach((ch, idx) => {
      const id = `CH${idx}`;
      const name = sanitizeMermaidText(ch.name, 30);
      const type = sanitizeMermaidText(ch.type, 30);
      mermaid += `    ${id}["${name}<br/><small>${type}</small>"]\n`;
      mermaid += `    ${id} --> System\n`;
    });
    mermaid += `\n`;
  }
  
  // Add interfacing systems (right)
  if (interfacingSystems.length > 0) {
    mermaid += `    %% Interfacing Systems\n`;
    interfacingSystems.forEach((sys, idx) => {
      const id = `IS${idx}`;
      const name = sanitizeMermaidText(sys.name, 30);
      const purpose = sanitizeMermaidText(sys.purpose, 30);
      mermaid += `    ${id}["${name}<br/><small>${purpose}</small>"]\n`;
      mermaid += `    System <--> ${id}\n`;
    });
    mermaid += `\n`;
  }
  
  // Add data assets (bottom)
  if (dataAssets.length > 0) {
    mermaid += `    %% Data Assets\n`;
    dataAssets.forEach((data, idx) => {
      const id = `DA${idx}`;
      const name = sanitizeMermaidText(data.name, 30);
      const desc = sanitizeMermaidText(data.description, 30);
      mermaid += `    ${id}["${name}<br/><small>${desc}</small>"]\n`;
      mermaid += `    System --> ${id}\n`;
    });
    mermaid += `\n`;
  }
  
  // Add business functions as notes
  if (businessFunctions.length > 0) {
    mermaid += `    %% Business Functions\n`;
    businessFunctions.slice(0, 3).forEach((func, idx) => {
      const id = `BF${idx}`;
      const name = sanitizeMermaidText(func.name, 30);
      mermaid += `    ${id}["${name}"]\n`;
      mermaid += `    System -.-> ${id}\n`;
    });
  }
  
  // Style
  mermaid += `\n    classDef systemBox fill:#4F46E5,stroke:#312E81,stroke-width:3px,color:#fff\n`;
  mermaid += `    class System systemBox\n`;
  
  return mermaid;
}

/**
 * Render Mermaid diagram to PNG using mermaid-cli
 */
export async function renderMermaidToPng(mermaidText: string, outputPath: string): Promise<string> {
  // Create temporary .mmd file
  const tempDir = path.join(process.cwd(), 'uploads', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempMmdPath = path.join(tempDir, `diagram_${Date.now()}.mmd`);
  const tempPngPath = outputPath;
  
  try {
    // Write mermaid text to file
    fs.writeFileSync(tempMmdPath, mermaidText, 'utf-8');
    
    // Ensure output directory exists
    const outputDir = path.dirname(tempPngPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Use mmdc command via npx
    const mmdcPath = path.join(process.cwd(), 'node_modules', '.bin', 'mmdc');
    
    const { stdout, stderr } = await execFileAsync(mmdcPath, [
      '-i', tempMmdPath,
      '-o', tempPngPath,
      '-t', 'default',
      '-b', '#ffffff',
      '-w', '1600',
      '-H', '1200'
    ]);
    
    // Log mermaid-cli output for debugging
    if (stdout) console.log('[Mermaid CLI stdout]:', stdout);
    if (stderr) console.log('[Mermaid CLI stderr]:', stderr);
    
    // Verify output file was created
    if (!fs.existsSync(tempPngPath)) {
      throw new Error('Mermaid CLI did not generate output file');
    }
    
    // Clean up temp file
    fs.unlinkSync(tempMmdPath);
    
    return tempPngPath;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempMmdPath)) {
      fs.unlinkSync(tempMmdPath);
    }
    
    // Provide detailed error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stderr = (error as any).stderr || '';
    throw new Error(
      `Failed to render Mermaid diagram: ${errorMessage}${stderr ? `\nMermaid CLI error: ${stderr}` : ''}`
    );
  }
}

/**
 * Generate context diagram PNG from business case
 */
export async function generateContextDiagram(businessCaseContent: string, outputPath: string): Promise<{
  pngPath: string;
  architecture: ContextArchitecture;
  mermaidText: string;
}> {
  console.log('[Context Diagram] Extracting architecture components from business case...');
  const architecture = await extractContextArchitecture(businessCaseContent);
  
  console.log('[Context Diagram] Generating Mermaid diagram...');
  const mermaidText = generateContextDiagramMermaid(architecture);
  
  console.log('[Context Diagram] Rendering diagram to PNG...');
  const pngPath = await renderMermaidToPng(mermaidText, outputPath);
  
  return { pngPath, architecture, mermaidText };
}
