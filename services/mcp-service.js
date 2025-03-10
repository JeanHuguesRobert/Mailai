const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class MCPService {
  constructor(config) {
    this.config = config;
    this.client = new Client(
      {
        name: 'mailai-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );
  }

  async connect() {
    try {
      const transport = new StdioClientTransport({
        command: this.config.command || 'mcp-server',
        args: [this.config.serverUrl],
        env: {
          MCP_CREDENTIALS: this.config.credentials
        }
      });

      await this.client.connect(transport);
    } catch (error) {
      throw new Error(`MCP Connection failed: ${error.message}`);
    }
  }

  async getContext(query) {
    try {
      // Use resources to get context
      const resources = await this.client.listResources();
      const relevantResource = resources.find(r => r.matches(query));
      
      if (relevantResource) {
        const result = await this.client.readResource(relevantResource.uri);
        return result.contents.map(c => c.text).join('\n');
      }

      // Fallback to tools if no relevant resource
      const toolResult = await this.client.callTool({
        name: 'search-context',
        arguments: { query }
      });

      return toolResult.content[0].text;
    } catch (error) {
      console.error('MCP Context Error:', error);
      return null;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}

module.exports = { MCPService };
