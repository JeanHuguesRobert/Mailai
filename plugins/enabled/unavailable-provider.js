const { MailAIPlugin } = require('../base');

class UnavailableProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'unavailable') return emailData;

    emailData.aiResponse = this.config.message 
    || `Thank you for your email. Unfortunately, we are currently unavailable and unable to respond at this time. We will get back to you as soon as possible.`;
    return emailData;
  }
}

module.exports = UnavailableProviderPlugin;
