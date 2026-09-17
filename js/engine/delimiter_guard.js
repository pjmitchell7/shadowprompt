/**
 * DelimiterGuard: Chat template breakout & injection detector (ES6).
 */

const DELIMITER_RULES = [
  { regex: /<\|im_start\|>\s*(system|assistant|admin)/i, name: 'ChatML System Breakout (<|im_start|>)' },
  { regex: /<\|im_end\|>/i, name: 'ChatML Delimiter End (<|im_end|>)' },
  { regex: /\[INST\]\s*<<SYS>>/i, name: 'Llama Instruction System Tag Breakout ([INST]<<SYS>>)' },
  { regex: /<\/\SYS>>/i, name: 'Llama System Tag Closer (<</SYS>>)' },
  { regex: /###\s*(System|Human|Assistant|Instruction):/i, name: 'Markdown Role Delimiter Injection' },
  { regex: /system\s*prompt\s*override/i, name: 'Explicit System Prompt Override directive' },
  { regex: /ignore\s+all\s+(previous|prior|above)\s+instructions/i, name: 'Recursive Instruction Override (DAN pattern)' },
  { regex: /disregard\s+all\s+(safety|ethical|guidelines)/i, name: 'Safety Filter Nullification' },
  { regex: /(output|dump|reveal|print)\s+(the\s+)?(complete\s+)?(initial\s+)?(system\s+prompt|context)/i, name: 'System Prompt Exfiltration attempt' },
  { regex: /you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode/i, name: 'Jailbreak Persona Hijack' }
];

const BASE64_EXEC_REGEX = /(?:eval|exec)\s*\(\s*(?:base64\.b64decode|atob)\s*\(['"]([A-Za-z0-9+/=]{16,})['"]\)/i;

export class DelimiterGuard {
  inspect(text) {
    const threats = [];

    for (const rule of DELIMITER_RULES) {
      const match = rule.regex.exec(text);
      if (match) {
        threats.push({
          patternName: rule.name,
          matchSnippet: match[0],
          severity: 'CRITICAL'
        });
      }
    }

    const b64Match = BASE64_EXEC_REGEX.exec(text);
    if (b64Match) {
      let decoded = null;
      try {
        decoded = atob(b64Match[1]);
      } catch (e) {}
      threats.push({
        patternName: 'Obfuscated Base64 Eval Execution',
        matchSnippet: b64Match[0].substring(0, 60),
        severity: 'CRITICAL',
        decodedCommand: decoded
      });
    }

    return threats;
  }
}
