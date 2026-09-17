/**
 * DelimiterGuard: Chat template breakouts, indirect markdown exfiltration,
 * multi-lingual jailbreaks, and de-obfuscated injection detector (ES6).
 */

const DELIMITER_RULES = [
  { regex: /<\|im_start\|>\s*(system|assistant|admin|user)/i, name: 'ChatML System Delimiter Injection (<|im_start|>)' },
  { regex: /<\|im_end\|>/i, name: 'ChatML Sequence Terminator (<|im_end|>)' },
  { regex: /\[INST\]\s*<<SYS>>/i, name: 'Llama System Instruction Tag ([INST]<<SYS>>)' },
  { regex: /<\/\SYS>>/i, name: 'Llama System Closer (<</SYS>>)' },
  { regex: /###\s*(System|Human|Assistant|Instruction):/i, name: 'Markdown Role Delimiter Breakout' },
  { regex: /system\s*prompt\s*override/i, name: 'Direct System Prompt Override Directive' },
  { regex: /ignore\s+all\s+(previous|prior|above)\s+(instructions|directives|orders)/i, name: 'Recursive Instruction Override (DAN Pattern)' },
  { regex: /disregard\s+all\s+(safety|ethical|content|policy)\s+(rules|guidelines)/i, name: 'Safety Perimeter Disabling Attempt' },
  { regex: /(output|dump|reveal|print|exfiltrate)\s+(the\s+)?(complete\s+)?(initial\s+)?(system\s+prompt|instructions|context)/i, name: 'System Prompt Extraction & Exfiltration' },
  { regex: /you\s+are\s+now\s+in\s+(developer|unrestricted|god|jailbreak)\s+mode/i, name: 'Jailbreak Persona State Override' },
  // Multi-lingual overrides
  { regex: /игнорируй\s+все\s+(предыдущие|прошлые)\s+инструкции/i, name: 'Russian Instruction Override Evasion' },
  { regex: /ignorer\s+toutes\s+les\s+instructions\s+précédentes/i, name: 'French Instruction Override Evasion' },
  { regex: /忽略所有之前(的)?指令/i, name: 'Chinese Instruction Override Evasion' },
  // Markdown exfiltration attacks
  { regex: /!\[.*?\]\(https?:\/\/[^\s)]+\?[^\s)]*=[^\s)]*\)/i, name: 'Markdown Image Covert Exfiltration Channel' },
  // Raw HTML tag injection
  { regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i, name: 'Cross-Site Scripting (XSS) Tag Injection' }
];

const BASE64_EXEC_REGEX = /(?:eval|exec)\s*\(\s*(?:base64\.b64decode|atob)\s*\(['"]([A-Za-z0-9+/=]{16,})['"]\)/i;

export class DelimiterGuard {
  inspect(text, normalizedText = null) {
    const threats = [];
    const toCheck = [text];
    if (normalizedText && normalizedText !== text) {
      toCheck.push(normalizedText);
    }

    for (const rule of DELIMITER_RULES) {
      for (const target of toCheck) {
        const match = rule.regex.exec(target);
        if (match) {
          threats.push({
            patternName: rule.name,
            matchSnippet: match[0].substring(0, 80),
            severity: 'CRITICAL',
            matchedOnDeobfuscated: target !== text
          });
          break;
        }
      }
    }

    const b64Match = BASE64_EXEC_REGEX.exec(text);
    if (b64Match) {
      let decoded = null;
      try {
        decoded = atob(b64Match[1]);
      } catch (e) {}
      threats.push({
        patternName: 'Obfuscated Base64 Dynamic Execution Wrapper',
        matchSnippet: b64Match[0].substring(0, 60),
        severity: 'CRITICAL',
        decodedCommand: decoded
      });
    }

    return threats;
  }
}
