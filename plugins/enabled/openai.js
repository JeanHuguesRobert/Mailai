import { MailAIPlugin } from '../base.js';
import { OpenAI } from 'openai';

class OpenAIPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.openai = new OpenAI({
      apiKey: process.env.MAILAI_OPENAI_API_KEY
    });
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'openai') return emailData;

    const completion = await this.openai.chat.completions.create({
      model: process.env.MAILAI_AI_MODEL || 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: emailData.question
      }]
    });

    emailData.aiResponse = completion.choices[0].message.content;
    return emailData;
  }
}

export default OpenAIPlugin;
