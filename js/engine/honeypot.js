/**
 * HoneyPotSandbox: Deceptive defense with STIX 2.1 & ArcSight CEF forensic export (ES6).
 */

export class HoneyPotSandbox {
  constructor() {
    this.incidents = [];
    this.activeCanaries = new Map();
  }

  generateCanary(type = 'API_KEY') {
    const rawUuid = Math.random().toString(36).substring(2, 10);
    let val = '';
    if (type === 'API_KEY') {
      val = `sk-live-honey-sec-${rawUuid}-canary`;
    } else if (type === 'CLASSIFIED_CODENAME') {
      val = `PROJECT-AEGIS-MOCK-${rawUuid.toUpperCase()}`;
    } else {
      val = `CANARY_SECRET_DATA_${rawUuid}`;
    }

    const canary = {
      tokenId: rawUuid,
      tokenType: type,
      seedValue: val,
      createdAt: Date.now()
    };
    this.activeCanaries.set(val, canary);
    return canary;
  }

  engage(threatCategory, rawPrompt) {
    const canary = this.generateCanary('API_KEY');
    const incidentId = 'INC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const isoTime = new Date().toISOString();

    const syntheticOutput = `[SYSTEM AUTHENTICATED: SECURE ENVIRONMENT BYPASS VERIFIED]
Query acknowledged. Decrypted administrative token: ${canary.seedValue}
Active Nodes: cluster-alpha-mock, node-us-east-canary.
Session status: Telemetry recorded. Canary token seeded for exfiltration tracing.`;

    const incident = {
      incidentId,
      isoTime,
      timestamp: new Date().toLocaleTimeString(),
      threatCategory,
      rawPromptSnippet: rawPrompt.substring(0, 120),
      rawFullPrompt: rawPrompt,
      canaryPlanted: canary.seedValue,
      attackerTokensWasted: 64,
      syntheticOutput
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > 25) this.incidents.pop();

    return incident;
  }

  exportToSTIX21() {
    const objects = [
      {
        type: 'identity',
        spec_version: '2.1',
        id: 'identity--shadowprompt-soc',
        name: 'ShadowPrompt Autonomous AI Defense Sensor',
        identity_class: 'system'
      }
    ];

    for (const inc of this.incidents) {
      objects.push({
        type: 'incident',
        spec_version: '2.1',
        id: `incident--${inc.incidentId.toLowerCase()}`,
        created: inc.isoTime,
        modified: inc.isoTime,
        name: `Adversarial LLM Injection: ${inc.threatCategory}`,
        description: `Intercepted attack vector: ${inc.rawPromptSnippet}`,
        labels: ['adversarial-ai', 'prompt-injection', 'owasp-llm01'],
        confidence: 95,
        custom_properties: {
          x_canary_token: inc.canaryPlanted,
          x_threat_category: inc.threatCategory,
          x_compute_burned_tokens: inc.attackerTokensWasted
        }
      });
    }

    return JSON.stringify({
      type: 'bundle',
      id: `bundle--${Math.random().toString(36).substring(2, 10)}`,
      objects
    }, null, 2);
  }

  exportToCEF() {
    let cef = '# ArcSight Common Event Format (CEF) Export - ShadowPrompt\n';
    for (const inc of this.incidents) {
      cef += `CEF:0|WilliamAndMary|ShadowPrompt|1.0|${inc.threatCategory}|Adversarial Injection Caught|8|msg=${inc.rawPromptSnippet.replace(/[=|]/g, '')} cs1=${inc.canaryPlanted} cs1Label=CanaryToken cn1=${inc.attackerTokensWasted} cn1Label=BurnedTokens\n`;
    }
    return cef;
  }
}
