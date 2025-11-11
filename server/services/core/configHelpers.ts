import type { SystemConfig } from "@shared/schema";

/**
 * Configuration helper to retrieve values from database config first,
 * then fall back to environment variables if not found.
 */
export class ConfigHelper {
  /**
   * Get a configuration value with fallback to environment variable
   * @param configs Array of system config from database
   * @param key Database config key
   * @param envVar Environment variable name (optional, defaults to key)
   * @returns Configuration value or undefined
   */
  static getConfigValue(
    configs: SystemConfig[],
    key: string,
    envVar?: string
  ): string | undefined {
    const dbValue = configs.find((c) => c.key === key)?.value;
    if (dbValue) return dbValue;
    
    const envKey = envVar || key;
    return process.env[envKey];
  }

  /**
   * Get a required configuration value with fallback to environment variable
   * Throws an error if value is not found in either location
   */
  static getRequiredConfigValue(
    configs: SystemConfig[],
    key: string,
    envVar?: string,
    errorMessage?: string
  ): string {
    const value = this.getConfigValue(configs, key, envVar);
    if (!value) {
      const envKey = envVar || key;
      throw new Error(
        errorMessage ||
          `Configuration '${key}' not found in database or environment variable '${envKey}'. Please configure in Admin Config page or set environment variable.`
      );
    }
    return value;
  }

  /**
   * Get Azure OpenAI configuration with fallback to environment variables
   */
  static getAzureOpenAIConfig(configs: SystemConfig[]): {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion?: string;
  } {
    const endpoint = this.getRequiredConfigValue(
      configs,
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_ENDPOINT",
      "Azure OpenAI endpoint not configured. Please configure in Admin Config page or set AZURE_OPENAI_ENDPOINT environment variable."
    );

    const apiKey = this.getRequiredConfigValue(
      configs,
      "AZURE_OPENAI_KEY",
      "AZURE_OPENAI_KEY",
      "Azure OpenAI API key not configured. Please configure in Admin Config page or set AZURE_OPENAI_KEY environment variable."
    );

    const deployment = this.getRequiredConfigValue(
      configs,
      "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
      "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
      "Azure OpenAI embedding deployment not configured. Please configure in Admin Config page or set AZURE_OPENAI_EMBEDDING_DEPLOYMENT environment variable."
    );

    const apiVersion = this.getConfigValue(
      configs,
      "AZURE_OPENAI_API_VERSION",
      "AZURE_OPENAI_API_VERSION"
    ) || "2024-02-01";

    return { endpoint, apiKey, deployment, apiVersion };
  }

  /**
   * Get Azure AI Search configuration with fallback to environment variables
   */
  static getAzureSearchConfig(configs: SystemConfig[]): {
    endpoint: string;
    apiKey: string;
  } {
    const endpoint = this.getRequiredConfigValue(
      configs,
      "AZURE_SEARCH_ENDPOINT",
      "AZURE_SEARCH_ENDPOINT",
      "Azure AI Search endpoint not configured. Please configure in Admin Config page or set AZURE_SEARCH_ENDPOINT environment variable."
    );

    const apiKey = this.getRequiredConfigValue(
      configs,
      "AZURE_SEARCH_KEY",
      "AZURE_SEARCH_KEY",
      "Azure AI Search API key not configured. Please configure in Admin Config page or set AZURE_SEARCH_KEY environment variable."
    );

    return { endpoint, apiKey };
  }

  /**
   * Get Azure Blob Storage configuration with fallback to environment variables
   */
  static getAzureStorageConfig(configs: SystemConfig[]): {
    connectionString: string;
  } {
    const connectionString = this.getRequiredConfigValue(
      configs,
      "AZURE_STORAGE_CONNECTION_STRING",
      "AZURE_STORAGE_CONNECTION_STRING",
      "Azure Blob Storage connection string not configured. Please configure in Admin Config page or set AZURE_STORAGE_CONNECTION_STRING environment variable."
    );

    return { connectionString };
  }

  /**
   * Get Agents OpenAI configuration (Azure or regular OpenAI) with fallback
   */
  static getAgentsOpenAIConfig(configs: SystemConfig[]): {
    useAzure: boolean;
    azureEndpoint?: string;
    azureDeployment?: string;
    azureApiVersion?: string;
    apiKey: string;
    baseUrl?: string;
  } {
    // Try Azure OpenAI first (primary)
    const azureEndpoint = this.getConfigValue(configs, "AGENTS_OPENAI_ENDPOINT", "AZURE_OPENAI_ENDPOINT");
    const azureDeployment = this.getConfigValue(configs, "AGENTS_OPENAI_DEPLOYMENT", "AZURE_OPENAI_DEPLOYMENT");
    const azureApiKey = this.getConfigValue(configs, "AGENTS_OPENAI_API_KEY", "AZURE_OPENAI_KEY");
    const azureApiVersion = this.getConfigValue(configs, "AGENTS_OPENAI_API_VERSION") || "2024-08-01-preview";

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
    const openaiApiKey = this.getConfigValue(configs, "OPENAI_API_KEY") || 
                         process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
                         process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      throw new Error(
        "Neither Azure OpenAI nor regular OpenAI API key is configured. Please configure in Admin Config page or set environment variables."
      );
    }

    const baseUrl = this.getConfigValue(configs, "OPENAI_BASE_URL") ||
                    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    return {
      useAzure: false,
      apiKey: openaiApiKey,
      baseUrl,
    };
  }
}
