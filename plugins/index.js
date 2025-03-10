const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor() {
    this.plugins = [];
  }

  loadPlugins(pluginDir = path.join(__dirname, 'enabled')) {
    if (!fs.existsSync(pluginDir)) return;
    
    fs.readdirSync(pluginDir)
      .filter(file => file.endsWith('.js'))
      .forEach(file => {
        const Plugin = require(path.join(pluginDir, file));
        const config = process.env[`MAILAI_PLUGIN_${file.replace('.js', '').toUpperCase()}`];
        this.plugins.push(new Plugin(config ? JSON.parse(config) : {}));
      });
  }

  async executeHook(hookName, ...args) {
    for (const plugin of this.plugins) {
      if (typeof plugin[hookName] === 'function') {
        args[0] = await plugin[hookName](...args);
      }
    }
    return args[0];
  }
}

module.exports = { PluginManager };
