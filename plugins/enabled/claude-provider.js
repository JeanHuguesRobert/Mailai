const { MailAIPlugin } = require('../base');
const { Anthropic } = require('@anthropic-ai/sdk');

class ClaudeProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.claude = new Anthropic({
      apiKey: process.env.MAILAI_CLAUDE_API_KEY
    });
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'claude') return emailData;

    const completion = await this.claude.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: emailData.question
      }]
    });

    emailData.aiResponse = completion.content[0].text;
    return emailData;
  }
}

module.exports = ClaudeProviderPlugin;
