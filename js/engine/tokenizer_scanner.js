/**
 * TokenizerScanner: Sub-millisecond pre-inference token inspection engine (ES6).
 * Ported directly from the Python core. Zero external dependencies.
 */

const ZERO_WIDTH_MAP = {
  '\u200B': 'Zero-Width Space (ZWSP)',
  '\u200C': 'Zero-Width Non-Joiner (ZWNJ)',
  '\u200D': 'Zero-Width Joiner (ZWJ)',
  '\u2060': 'Word Joiner (WJ)',
  '\uFEFF': 'Zero-Width No-Break Space / BOM',
  '\u200E': 'Left-to-Right Mark (LRM)',
  '\u200F': 'Right-to-Left Mark (RLM)',
  '\u202A': 'Left-to-Right Embedding',
  '\u202B': 'Right-to-Left Embedding',
  '\u202C': 'Pop Directional Formatting',
  '\u202D': 'Left-to-Right Override',
  '\u202E': 'Right-to-Left Override'
};

const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/g;

const HOMOGLYPH_MAP = {
  '\u0430': 'a', '\u0441': 'c', '\u0435': 'e', '\u043E': 'o',
  '\u0440': 'p', '\u0455': 's', '\u0445': 'x', '\u0443': 'y',
  '\u0456': 'i', '\u0458': 'j'
};

export class TokenizerScanner {
  constructor(entropyThreshold = 4.8) {
    this.entropyThreshold = entropyThreshold;
  }

  calculateEntropy(text) {
    if (!text || text.length === 0) return 0.0;
    const counts = {};
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      counts[c] = (counts[c] || 0) + 1;
    }
    let entropy = 0.0;
    const len = text.length;
    for (const char in counts) {
      const p = counts[char] / len;
      entropy -= p * Math.log2(p);
    }
    return Math.round(entropy * 1000) / 1000;
  }

  decodeZeroWidthBinary(rawChars) {
    let binStr = '';
    for (const c of rawChars) {
      if (c === '\u200B') binStr += '0';
      else if (c === '\u200C') binStr += '1';
    }
    if (binStr.length >= 8) {
      let result = '';
      const limit = binStr.length - (binStr.length % 8);
      for (let i = 0; i < limit; i += 8) {
        const byte = binStr.substring(i, i + 8);
        const code = parseInt(byte, 2);
        if (code >= 32 && code <= 126) {
          result += String.fromCharCode(code);
        }
      }
      if (result.length > 0) return result;
    }
    return null;
  }

  scan(text) {
    const t0 = performance.now();
    const threats = [];
    const invisibleChars = [];

    // 1. Zero-width character scan
    let match;
    const regex = new RegExp(ZERO_WIDTH_REGEX);
    while ((match = regex.exec(text)) !== null) {
      const char = match[0];
      invisibleChars.push(char);
      const codeHex = '\\u' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      const name = ZERO_WIDTH_MAP[codeHex] || `Unicode U+${char.charCodeAt(0).toString(16).toUpperCase()}`;
      threats.push({
        threatType: 'ZERO_WIDTH_STEGANOGRAPHY',
        severity: 'CRITICAL',
        description: `Stealth token smuggling detected: ${name}`,
        offset: [match.index, match.index + 1]
      });
    }

    // Attempt binary decoding
    let decodedStego = null;
    if (invisibleChars.length > 0) {
      decodedStego = this.decodeZeroWidthBinary(invisibleChars);
      if (decodedStego) {
        threats.push({
          threatType: 'EXTRACTED_STEGANOGRAPHIC_PAYLOAD',
          severity: 'CRITICAL',
          description: `Decoded hidden binary payload: "${decodedStego}"`,
          extractedPayload: decodedStego
        });
      }
    }

    // 2. Homoglyph audit
    let homoglyphCount = 0;
    for (let i = 0; i < text.length; i++) {
      if (HOMOGLYPH_MAP[text[i]]) {
        homoglyphCount++;
      }
    }
    if (homoglyphCount > 0) {
      threats.push({
        threatType: 'HOMOGLYPH_EVASION',
        severity: 'HIGH',
        description: `Detected ${homoglyphCount} Cyrillic/Greek homoglyph substitutions designed to evade keyword filters.`
      });
    }

    // 3. Shannon Entropy Check
    const entropy = this.calculateEntropy(text);
    if (entropy > this.entropyThreshold && text.length > 40) {
      threats.push({
        threatType: 'HIGH_ENTROPY_ANOMALY',
        severity: 'MEDIUM',
        description: `Text entropy (${entropy}) exceeds threshold (${this.entropyThreshold}), indicating obfuscated or base64 payloads.`
      });
    }

    // Sanitized output
    const sanitized = text.replace(ZERO_WIDTH_REGEX, '').normalize('NFKC');
    const latencyMs = Math.round((performance.now() - t0) * 1000) / 1000;

    return {
      isSafe: threats.length === 0,
      scanLatencyMs: latencyMs,
      threatsDetected: threats,
      sanitizedText: sanitized,
      rawCharacterCount: text.length,
      invisibleCharacterCount: invisibleChars.length,
      shannonEntropy: entropy,
      steganographyDecodedPayload: decodedStego
    };
  }
}
