import { MailAIPlugin } from '../base.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiPlugin extends MailAIPlugin {
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

export default GeminiPlugin;
