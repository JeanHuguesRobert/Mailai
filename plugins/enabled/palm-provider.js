const { MailAIPlugin } = require('../base');
const { TextServiceClient } = require('@google-ai/generativelanguage').v1beta2;
const { GoogleAuth } = require('google-auth-library');

class PaLMProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.client = new TextServiceClient({
      authClient: new GoogleAuth().fromAPIKey(process.env.MAILAI_PALM_API_KEY),
    });
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'palm') return emailData;

    const result = await this.client.generateText({
      model: 'text-bison-001',
      prompt: { text: emailData.question }
    });

    emailData.aiResponse = result[0].candidates[0].output;
    return emailData;
  }
}

module.exports = PaLMProviderPlugin;
