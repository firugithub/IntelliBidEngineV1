/**
 * Configuration helper to retrieve values from environment variables only.
 * Database configuration has been removed for security and simplicity.
 */
export class ConfigHelper {
  /**
   * Get a configuration value from environment variable
   * @param envVar Environment variable name
   * @returns Configuration value or undefined
   */
  static getConfigValue(envVar: string): string | undefined {
    return process.env[envVar];
  }

  /**
   * Get a required configuration value from environment variable
   * Throws an error if value is not found
   */
  static getRequiredConfigValue(
    envVar: string,
    errorMessage?: string
  ): string {
    const value = process.env[envVar];
    if (!value) {
      throw new Error(
        errorMessage ||
          `Configuration '${envVar}' not found in environment variables. Please set ${envVar} in Replit Secrets.`
      );
    }
    return value;
  }

  /**
   * Get Azure OpenAI configuration from environment variables
   */
  static getAzureOpenAIConfig(): {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion?: string;
  } {
    const endpoint = this.getRequiredConfigValue(
      "AZURE_OPENAI_ENDPOINT",
      "Azure OpenAI endpoint not configured. Please set AZURE_OPENAI_ENDPOINT in Replit Secrets."
    );

    const apiKey = this.getRequiredConfigValue(
      "AZURE_OPENAI_KEY",
      "Azure OpenAI API key not configured. Please set AZURE_OPENAI_KEY in Replit Secrets."
    );

    const deployment = this.getRequiredConfigValue(
      "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
      "Azure OpenAI embedding deployment not configured. Please set AZURE_OPENAI_EMBEDDING_DEPLOYMENT in Replit Secrets."
    );

    const apiVersion = this.getConfigValue("AZURE_OPENAI_API_VERSION") || "2024-02-01";

    return { endpoint, apiKey, deployment, apiVersion };
  }

  /**
   * Get Azure AI Search configuration from environment variables
   */
  static getAzureSearchConfig(): {
    endpoint: string;
    apiKey: string;
  } {
    const endpoint = this.getRequiredConfigValue(
      "AZURE_SEARCH_ENDPOINT",
      "Azure AI Search endpoint not configured. Please set AZURE_SEARCH_ENDPOINT in Replit Secrets."
    );

    const apiKey = this.getRequiredConfigValue(
      "AZURE_SEARCH_KEY",
      "Azure AI Search API key not configured. Please set AZURE_SEARCH_KEY in Replit Secrets."
    );

    return { endpoint, apiKey };
  }

  /**
   * Get Azure Blob Storage configuration from environment variables
   */
  static getAzureStorageConfig(): {
    connectionString: string;
  } {
    const connectionString = this.getRequiredConfigValue(
      "AZURE_STORAGE_CONNECTION_STRING",
      "Azure Blob Storage connection string not configured. Please set AZURE_STORAGE_CONNECTION_STRING in Replit Secrets."
    );

    return { connectionString };
  }

  /**
   * Get Agents OpenAI configuration (Azure or regular OpenAI) from environment variables
   */
  static getAgentsOpenAIConfig(): {
    useAzure: boolean;
    azureEndpoint?: string;
    azureDeployment?: string;
    azureApiVersion?: string;
    apiKey: string;
    baseUrl?: string;
  } {
    // Try Azure OpenAI first (primary)
    const azureEndpoint = this.getConfigValue("AZURE_OPENAI_ENDPOINT");
    const azureDeployment = this.getConfigValue("AZURE_OPENAI_DEPLOYMENT");
    const azureApiKey = this.getConfigValue("AZURE_OPENAI_KEY");
    const azureApiVersion = this.getConfigValue("AZURE_OPENAI_API_VERSION") || "2024-08-01-preview";

    // If Azure config is complete and endpoint contains 'azure', use Azure
    if (azureEndpoint && azureDeployment && azureApiKey && azureEndpoint.includes('azure')) {
      return {
        useAzure: true,
        azureEndpoint,
        azureDeployment,
        azureApiVersion,
        apiKey: azureApiKey,
      };
    }

    // Fall back to regular OpenAI
    const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || 
                         process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      throw new Error(
        "Neither Azure OpenAI nor regular OpenAI API key is configured. Please set environment variables in Replit Secrets."
      );
    }

    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    return {
      useAzure: false,
      apiKey: openaiApiKey,
      baseUrl,
    };
  }

  /**
   * Get Azure Document Intelligence (Form Recognizer) configuration from environment variables
   * Falls back to Azure OpenAI credentials if dedicated Document Intelligence credentials are not set
   */
  static getAzureDocumentIntelligenceConfig(): {
    endpoint: string;
    apiKey: string;
    apiVersion?: string;
  } {
    // Try dedicated Document Intelligence credentials first
    let endpoint = this.getConfigValue("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT");
    let apiKey = this.getConfigValue("AZURE_DOCUMENT_INTELLIGENCE_KEY");
    
    // Fall back to Azure Cognitive Services or Azure OpenAI credentials
    if (!endpoint || !apiKey) {
      endpoint = this.getConfigValue("AZURE_COGNITIVE_SERVICES_ENDPOINT") || 
                 this.getConfigValue("AZURE_OPENAI_ENDPOINT");
      apiKey = this.getConfigValue("AZURE_COGNITIVE_SERVICES_KEY") || 
               this.getConfigValue("AZURE_OPENAI_KEY");
    }

    if (!endpoint || !apiKey) {
      throw new Error(
        "Azure Document Intelligence not configured. Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY, " +
        "or use existing Azure Cognitive Services/OpenAI credentials in Replit Secrets."
      );
    }

    // Use latest stable API version for Document Intelligence
    const apiVersion = this.getConfigValue("AZURE_DOCUMENT_INTELLIGENCE_API_VERSION") || "2024-11-30";

    return { endpoint, apiKey, apiVersion };
  }
}
