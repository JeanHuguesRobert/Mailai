import { MailAIPlugin, MailMessage } from '../base.js';

class UnavailablePlugin extends MailAIPlugin {
  constructor(config = {}) {
    super(config);
    this.defaultMessage = 'Thank you for your email. Unfortunately, we are currently unavailable and unable to respond at this time. We will get back to you as soon as possible.';
  }

  async handle(message) {
    const response = new MailMessage();
    message.response = response;
    response.persona = message.persona;
    response.incoming = message;
    response.flow = 'outgoing';
    response.parsed = { subject: 'Thank you for your email', text: this.defaultMessage };
  }
}

export default UnavailablePlugin;
