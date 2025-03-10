class MailAIPlugin {
  constructor(config = {}) {
    this.config = config;
  }

  async beforeProcessEmail(emailData) { return emailData; }
  async afterProcessEmail(emailData, response) { return response; }
  async beforeSendEmail(emailOptions) { return emailOptions; }
  async onError(error, context) { }
}

module.exports = { MailAIPlugin };
