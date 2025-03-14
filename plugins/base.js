class MailMessage {
  constructor() {
    this.id = null;
    this.flow = 'incoming';
    this.raw = null;
    this.header = null;
    this.body = null;
    this.parsed = null;
    this.persona = null;
    this.processor = null;
  }
}

class MailAIPlugin {
  constructor(persona) {
    this.id = persona.id + "_" + persona.ai.provider;
    this.persona = persona;
    this.mailai = mailai;
    this.config = config;
  }

  async handle(message) { }
  async onError(error, message ) {
    log("error", `Unhandled error in plugin ${this.id}: ${error.message}`);
  }
}

export { MailAIPlugin, MailMessage };
