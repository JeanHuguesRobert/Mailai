class MonitoringService {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      connections: new Map(),
      emailStats: this.initializeStats()
    };
  }

  initializeStats() {
    return {
      processed: 0,
      skipped: 0,
      answered: 0,
      errors: 0,
      responseTime: {
        avg: 0,
        min: Infinity,
        max: 0,
        total: 0,
        count: 0
      }
    };
  }

  start(port) {
    this.port = port;
    this.updateStats();
  }

  updateStats() {
    this.stats.uptime = Date.now() - this.stats.startTime;
  }

  recordMetric(type) {
    if (type in this.stats.emailStats) {
      this.stats.emailStats[type]++;
    }
  }

  recordResponseTime(time) {
    const rt = this.stats.emailStats.responseTime;
    rt.total += time;
    rt.count++;
    rt.avg = rt.total / rt.count;
    rt.min = Math.min(rt.min, time);
    rt.max = Math.max(rt.max, time);
  }

  getStats() {
    this.updateStats();
    return this.stats;
  }
}

module.exports = MonitoringService;