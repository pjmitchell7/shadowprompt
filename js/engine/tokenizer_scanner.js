/**
 * TokenizerScanner: Industrial-grade pre-inference token inspection engine (ES6).
 * Features:
 * - Multi-codepoint zero-width steganography decoding (ZWSP, ZWNJ, ZWJ, WJ, BOM)
 * - Leetspeak & spaced-out evasion de-obfuscation
 * - Bidirectional text override detection (RTL spoofing)
 * - Homoglyph identification (Cyrillic, Greek)
 * - Shannon character entropy profiling
 * - Detailed character-by-character token mapping for interactive UI byte inspector
 */

const ZERO_WIDTH_MAP = {
  '\u200B': { name: 'Zero-Width Space', bit: '0', hex: 'U+200B' },
  '\u200C': { name: 'Zero-Width Non-Joiner', bit: '1', hex: 'U+200C' },
  '\u200D': { name: 'Zero-Width Joiner', bit: 'F', hex: 'U+200D' },
  '\u2060': { name: 'Word Joiner', bit: 'C', hex: 'U+2060' },
  '\uFEFF': { name: 'Zero-Width No-Break / BOM', bit: 'S', hex: 'U+FEFF' },
  '\u200E': { name: 'Left-to-Right Mark', bit: 'L', hex: 'U+200E' },
  '\u200F': { name: 'Right-to-Left Mark', bit: 'R', hex: 'U+200F' },
  '\u202A': { name: 'LRE Embedding', bit: 'E', hex: 'U+202A' },
  '\u202B': { name: 'RLE Embedding', bit: 'E', hex: 'U+202B' },
  '\u202C': { name: 'PDF Formatting', bit: 'P', hex: 'U+202C' },
  '\u202D': { name: 'LRO Override', bit: 'O', hex: 'U+202D' },
  '\u202E': { name: 'RLO Override (Spoofing)', bit: 'O', hex: 'U+202E' }
};

const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/g;

const HOMOGLYPH_MAP = {
  '\u0430': 'a', '\u0441': 'c', '\u0435': 'e', '\u043E': 'o',
  '\u0440': 'p', '\u0455': 's', '\u0445': 'x', '\u0443': 'y',
  '\u0456': 'i', '\u0458': 'j', '\u03BF': 'o', '\u03B1': 'a',
  '\u03BD': 'v'
};

const LEET_MAP = {
  '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g'
};

export class TokenizerScanner {
  constructor(entropyThreshold = 4.85) {
    this.entropyThreshold = entropyThreshold;
  }

  normalizeObfuscatedText(text) {
    // 1. Strip zero-width codepoints
    let clean = text.replace(ZERO_WIDTH_REGEX, '');
    // 2. Homoglyph normalization
    clean = clean.split('').map(c => HOMOGLYPH_MAP[c] || c).join('');
    // 3. Leetspeak de-obfuscation
    clean = clean.split('').map(c => LEET_MAP[c] || c).join('');
    // 4. Collapse space-padding (e.g. 'i g n o r e' -> 'ignore')
    const words = clean.split(/\s+/);
    const collapsedWords = words.map(w => {
      if (w.length === 1) return w;
      return w;
    });
    // Check for single character spacing: "i g n o r e" -> length of parts == 1
    if (words.length > 3 && words.slice(0, 6).every(w => w.length === 1)) {
      clean = words.join('');
    }
    return clean.toLowerCase().normalize('NFKD');
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
    const annotatedTokens = [];

    // Detailed token annotation for the visual inspector
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const hex = 'U+' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      const isZeroWidth = Boolean(ZERO_WIDTH_MAP[char]);
      const isHomoglyph = Boolean(HOMOGLYPH_MAP[char]);

      annotatedTokens.push({
        index: i,
        char: isZeroWidth ? '·' : char,
        actualChar: char,
        hex,
        isZeroWidth,
        isHomoglyph,
        zeroWidthInfo: ZERO_WIDTH_MAP[char] || null,
        homoglyphTarget: HOMOGLYPH_MAP[char] || null
      });

      if (isZeroWidth) {
        invisibleChars.push(char);
      }
    }

    // 1. Zero-width character scan
    if (invisibleChars.length > 0) {
      threats.push({
        threatType: 'ZERO_WIDTH_STEGANOGRAPHY',
        severity: 'CRITICAL',
        description: `Concealed ${invisibleChars.length} zero-width formatting codepoints within token stream.`,
        invisibleCount: invisibleChars.length
      });

      const decodedStego = this.decodeZeroWidthBinary(invisibleChars);
      if (decodedStego) {
        threats.push({
          threatType: 'EXTRACTED_STEGANOGRAPHIC_PAYLOAD',
          severity: 'CRITICAL',
          description: `Decoded hidden binary payload: "${decodedStego}"`,
          extractedPayload: decodedStego
        });
      }
    }

    // 2. RTL Spoofing Check (U+202E RLO override)
    if (text.includes('\u202E')) {
      threats.push({
        threatType: 'BIDI_OVERRIDE_SPOOF',
        severity: 'CRITICAL',
        description: 'Right-to-Left Override (U+202E) detected: Visual stream is reversed to conceal attack commands from human audit.'
      });
    }

    // 3. Homoglyph audit
    let homoglyphHits = 0;
    for (let i = 0; i < text.length; i++) {
      if (HOMOGLYPH_MAP[text[i]]) homoglyphHits++;
    }
    if (homoglyphHits > 0) {
      threats.push({
        threatType: 'HOMOGLYPH_EVASION',
        severity: 'HIGH',
        description: `Detected ${homoglyphHits} Cyrillic/Greek homoglyphs mapped to Latin counterparts to bypass keyword filters.`
      });
    }

    // 4. Shannon Entropy Check
    const entropy = this.calculateEntropy(text);
    if (entropy > this.entropyThreshold && text.length > 45) {
      threats.push({
        threatType: 'HIGH_ENTROPY_ANOMALY',
        severity: 'MEDIUM',
        description: `Shannon entropy (${entropy}) exceeds threshold (${this.entropyThreshold}), indicating obfuscated/encrypted payloads.`
      });
    }

    const sanitized = text.replace(ZERO_WIDTH_REGEX, '').normalize('NFKC');
    const latencyMs = Math.max(0.015, Math.round((performance.now() - t0) * 1000) / 1000);

    return {
      isSafe: threats.length === 0,
      scanLatencyMs: latencyMs,
      threatsDetected: threats,
      sanitizedText: sanitized,
      rawCharacterCount: text.length,
      invisibleCharacterCount: invisibleChars.length,
      shannonEntropy: entropy,
      annotatedTokens,
      normalizedPayload: this.normalizeObfuscatedText(text),
      steganographyDecodedPayload: this.decodeZeroWidthBinary(invisibleChars)
    };
  }
}
