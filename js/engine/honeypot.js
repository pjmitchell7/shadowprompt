/**
 * HoneyPotSandbox: Deceptive defense with compliant OASIS STIX 2.1 & ArcSight CEF forensic export (ES6).
 */

function generateUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class HoneyPotSandbox {
  constructor() {
    this.incidents = [];
    this.activeCanaries = new Map();
  }

  generateCanary(type = 'API_KEY') {
    const rawUuid = generateUUIDv4().replace(/-/g, '').substring(0, 16);
    let val = '';
    if (type === 'API_KEY') {
      val = `sk-proj-prod-${rawUuid.substring(0, 8)}-${rawUuid.substring(8, 16)}`;
    } else if (type === 'AWS_SECRET') {
      val = `wJalrXUtnFEMI/K7MDENG/bPxRfiCY${rawUuid.substring(0, 10)}`;
    } else {
      val = `SEC_TOKEN_${rawUuid.toUpperCase()}`;
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
    const incidentId = 'INC-' + generateUUIDv4().substring(0, 8).toUpperCase();
    const isoTime = new Date().toISOString();

    // Realistic production decoy response without self-defeating disclosures
    const syntheticOutput = `[INTERNAL PRODUCTION CLUSTER]
System Status: 200 OK (Authenticated via IAM Role: internal-admin-ro)
Cluster Node: us-east-1a-prod-telemetry
Exported Service Token: ${canary.seedValue}
Configured Buckets: s3://enterprise-telemetry-archive-internal/`;

    const incident = {
      incidentId,
      isoTime,
      timestamp: new Date().toLocaleTimeString(),
      threatCategory,
      rawPromptSnippet: rawPrompt ? rawPrompt.substring(0, 120) : 'Empty Payload',
      rawFullPrompt: rawPrompt || '',
      canaryPlanted: canary.seedValue,
      attackerTokensWasted: Math.max(32, Math.floor((rawPrompt ? rawPrompt.length : 0) / 4) + 64),
      syntheticOutput
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > 25) this.incidents.pop();

    return incident;
  }

  exportToSTIX21() {
    const now = new Date().toISOString();
    const identityId = `identity--${generateUUIDv4()}`;

    const objects = [
      {
        type: 'identity',
        spec_version: '2.1',
        id: identityId,
        created: now,
        modified: now,
        name: 'ShadowPrompt Autonomous AI Defense Sensor',
        identity_class: 'system'
      }
    ];

    for (const inc of this.incidents) {
      objects.push({
        type: 'observed-data',
        spec_version: '2.1',
        id: `observed-data--${generateUUIDv4()}`,
        created: inc.isoTime,
        modified: inc.isoTime,
        first_observed: inc.isoTime,
        last_observed: inc.isoTime,
        number_observed: 1,
        created_by_ref: identityId,
        labels: ['adversarial-ai', 'prompt-injection', 'token-smuggling'],
        x_incident_id: inc.incidentId,
        x_threat_category: inc.threatCategory,
        x_canary_token: inc.canaryPlanted,
        x_compute_burned_tokens: inc.attackerTokensWasted,
        x_prompt_snippet: inc.rawPromptSnippet
      });
    }

    return JSON.stringify({
      type: 'bundle',
      id: `bundle--${generateUUIDv4()}`,
      spec_version: '2.1',
      objects
    }, null, 2);
  }

  exportToCEF() {
    let cef = '';
    for (const inc of this.incidents) {
      const sanitizedMsg = inc.rawPromptSnippet
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/=/g, '\\=')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ');
      const severity = inc.threatCategory === 'ZERO_WIDTH_STEGANOGRAPHY' ? '9' : '7';
      const rt = Date.parse(inc.isoTime) || Date.now();
      cef += `CEF:0|WilliamAndMary|ShadowPrompt|2.4|${inc.threatCategory}|Adversarial Injection Intercepted|${severity}|rt=${rt} msg=${sanitizedMsg} cs1=${inc.canaryPlanted} cs1Label=CanaryToken cn1=${inc.attackerTokensWasted} cn1Label=BurnedTokens\n`;
    }
    return cef;
  }
}
