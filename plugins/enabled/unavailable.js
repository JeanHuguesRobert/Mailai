import { MailAIPlugin } from '../base.js';

class UnavailablePlugin extends MailAIPlugin {
  constructor(config = {}) {
    super(config);
    this.defaultMessage = 'Thank you for your email. Unfortunately, we are currently unavailable and unable to respond at this time. We will get back to you as soon as possible.';
  }

  async beforeProcessEmail(emailData) {
    // Check if provider is set to unavailable (case insensitive)
    const currentProvider = emailData.persona?.ai?.toLowerCase();
    if (currentProvider !== 'unavailable') {
      return emailData;
    }
    // Get message and optional prompt from persona config
    const message = emailData.persona?.config?.message || this.defaultMessage;
    const prompt = emailData.persona?.config?.prompt;

    // Include prompt in response if present
    emailData.aiResponse = prompt 
      ? `[${prompt}]\n\n${message}`
      : message;

    return emailData;
  }

  async processMessage(emailData) {
    if (process.env.MAILAI_MODE === 'dry_run') {
      console.log(`Dry run: Would process message for unavailable provider`);
      return emailData;
    }
    emailData.aiResponse = this.defaultMessage;
    return emailData;
  }
}

export default UnavailablePlugin;
