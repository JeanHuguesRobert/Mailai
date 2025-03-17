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
    this.state = 'unloaded';
  }

  async handle(message) {
    // Called when an incoming message is received
    // Should add/update an outgoing response to the message
  }

  async on_error(error, message ) {
    // To be called by sub classes to signal an error
    log("error", `Unhandled error in plugin ${this.id}: ${error.message}`);
  }

  async on_load() {
    // Called when the plugin is to be loaded
    // May set state to transient 'loading' while loading
    this.state = 'loaded';
  }

  async on_unload() {
    // Called when the plugin is to be unloaded
    // May set state to transient 'unloading' while unloading
    this.state = 'unloaded';
  }

  async on_config_change( new_config ) {
    // Called when the config changes
    this.on_unload();
    this.config = new_config;
    this.on_load();
  }

  async on_persona_change() {
    // Called when something changed about the persona
    this.on_unload();
    this.on_load();
  }
}

export { MailAIPlugin, MailMessage };
