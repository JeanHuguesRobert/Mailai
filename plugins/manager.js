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
        const config = process.env[`MAILAI_${file.replace('.js', '').toUpperCase()}`];
        if( !config )return;
        try {
          const Plugin = require(path.join(pluginDir, file));
          console.log(`Loading plugin: ${file}`); 
          if (typeof Plugin === 'function') {
            console.log(`Successfully loaded plugin: ${file}`);
            this.plugins.push(new Plugin(JSON.parse(config)));
          } else {
            console.error(`Failed to load plugin: ${file} is not a constructor`);
          }
        } catch (error) {
          console.error(`Error loading plugin ${file}: ${error.message}`);
        }
      });
  }

  async executeHook(hookName, ...args) {
    for (const plugin of this.plugins) {
      if (typeof plugin[hookName] === 'function') {
        console.log(`Executing hook: ${hookName} for plugin: ${plugin.constructor.name}`);
        args[0] = await plugin[hookName](...args);
      }
    }
    return args[0];
  }
}

module.exports = PluginManager;
