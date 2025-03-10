const { MailAIPlugin } = require('../base');
const { CohereClient } = require('cohere-ai');

class CohereProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.cohere = new CohereClient({
      apiKey: process.env.MAILAI_COHERE_API_KEY
    });
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'cohere') return emailData;

    const response = await this.cohere.generate({
      model: 'command',
      prompt: emailData.question,
      max_tokens: 500
    });

    emailData.aiResponse = response.generations[0].text;
    return emailData;
  }
}

module.exports = CohereProviderPlugin;
