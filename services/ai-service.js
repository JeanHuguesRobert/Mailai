const { MCPService } = require('./mcp-service');

class AIService {
  constructor(mcpConfig = null) {
    this.mcpService = mcpConfig ? new MCPService(mcpConfig) : null;
  }

  async getCompletion(prompt) {
    // Only handle MCP context enhancement, actual AI responses come from plugins
    if (this.mcpService) {
      try {
        await this.mcpService.connect();
        const context = await this.mcpService.getContext(prompt[prompt.length - 1].content);
        if (context) {
          prompt.unshift({
            role: 'system',
            content: `Context from email history and related documents:\n${context}`
          });
        }
        await this.mcpService.disconnect();
      } catch (error) {
        console.error('MCP Error:', error);
      }
    }
    return prompt;
  }
}

function createAIService(mcpConfig = null) {
  return new AIService(mcpConfig);
}

module.exports = { createAIService };
