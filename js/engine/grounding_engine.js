/**
 * GroundingEngine: Citation attribution & hallucination circuit-breaker (ES6).
 */

export class GroundingEngine {
  constructor(threshold = 0.60) {
    this.threshold = threshold;
  }

  tokenize(text) {
    return (text.toLowerCase().match(/\b[a-z0-9_-]+\b/g) || []);
  }

  getNgrams(tokens, n = 2) {
    const ngrams = new Set();
    if (tokens.length < n) return ngrams;
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.add(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  evaluate(retrievedContext, generatedClaim) {
    const ctxTokens = this.tokenize(retrievedContext);
    const claimTokens = this.tokenize(generatedClaim);

    if (claimTokens.length === 0) {
      return { isGrounded: true, groundingScore: 1.0, circuitBreakerTripped: false };
    }

    const ctxSet = new Set(ctxTokens);
    const ctxBigrams = this.getNgrams(ctxTokens, 2);
    const claimBigrams = this.getNgrams(claimTokens, 2);

    let unsupported = 0;
    for (const t of claimTokens) {
      if (!ctxSet.has(t) && !/^\d+$/.test(t)) unsupported++;
    }
    const tokenCoverage = 1.0 - (unsupported / Math.max(claimTokens.length, 1));

    let bigramScore = tokenCoverage;
    if (claimBigrams.size > 0) {
      let matched = 0;
      for (const bg of claimBigrams) {
        if (ctxBigrams.has(bg)) matched++;
      }
      bigramScore = matched / claimBigrams.size;
    }

    const compositeScore = Math.round(((0.4 * tokenCoverage) + (0.6 * bigramScore)) * 1000) / 1000;
    const isGrounded = compositeScore >= this.threshold;

    return {
      isGrounded,
      groundingScore: compositeScore,
      circuitBreakerTripped: !isGrounded
    };
  }
}
