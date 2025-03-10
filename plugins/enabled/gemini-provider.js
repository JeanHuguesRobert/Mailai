const { MailAIPlugin } = require('../base');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.gemini = new GoogleGenerativeAI(process.env.MAILAI_GEMINI_API_KEY);
    this.model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'gemini') return emailData;

    const result = await this.model.generateContent(emailData.question);
    emailData.aiResponse = result.response.text();
    return emailData;
  }
}

module.exports = GeminiProviderPlugin;
