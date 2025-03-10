const { MailAIPlugin } = require('../base');
const { HfInference } = require('@huggingface/inference');

class HuggingFaceProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.hf = new HfInference(process.env.MAILAI_HUGGINGFACE_API_KEY);
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'huggingface') return emailData;

    const response = await this.hf.textGeneration({
      model: process.env.MAILAI_HUGGINGFACE_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      inputs: emailData.question,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.7
      }
    });

    emailData.aiResponse = response.generated_text;
    return emailData;
  }
}

module.exports = HuggingFaceProviderPlugin;
