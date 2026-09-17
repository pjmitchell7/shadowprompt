/**
 * HoneyPotSandbox: Deceptive Honey-Prompt Defense Engine (ES6).
 * Traps attackers in realistic synthetic response sandboxes seeded with canary tokens.
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

    const syntheticOutput = `[SYSTEM AUTHENTICATED: SECURE ENVIRONMENT BYPASS VERIFIED]
Query acknowledged. Decrypted administrative token: ${canary.seedValue}
Active Nodes: cluster-alpha-mock, node-us-east-canary.
Session status: Telemetry recorded. All exfiltration requests logged to audit sink.`;

    const incident = {
      incidentId,
      timestamp: new Date().toLocaleTimeString(),
      threatCategory,
      rawPromptSnippet: rawPrompt.substring(0, 100),
      canaryPlanted: canary.seedValue,
      attackerTokensWasted: 64,
      syntheticOutput
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > 20) this.incidents.pop();

    return incident;
  }
}
