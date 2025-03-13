import { MailAIPlugin } from '../base.js';

class MistralPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.apiKey = process.env.MAILAI_AI_API_KEY;
    this.apiUrl = 'https://api.mistral.ai/v1/chat/completions';
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'mistral') return emailData;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: process.env.MAILAI_AI_MODEL || 'mistral-tiny',
        messages: [{
          role: 'user',
          content: emailData.question
        }]
      })
    });
    const data = await response.json();
    emailData.aiResponse = data.choices[0].message.content;
    return emailData;
  }
}

export default MistralPlugin;
