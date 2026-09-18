/**
 * ShadowPrompt Interactive Game-Theoretic Chess Arena
 * Renders an 8x8 tactical cyber chessboard visualizing the 5 multi-move adversarial gambits:
 * 1. Assembly Trap
 * 2. Policy Poisoning
 * 3. ReDoS Complexity
 * 4. Canonicalization Transmutation
 * 5. Honeypot Canary Reflection
 */

(function() {
  'use strict';

  const GAMBIT_DATA = {
    assembly: {
      name: "Play 1: The Assembly Trap",
      subtitle: "Sanitization-Induced Exploit Weaponization",
      baitDescription: "Attacker feeds sacrificial probe '[OVERRIDE]' to measure filter behavior.",
      reactionDescription: "Naive auto-patcher synthesizes naive string deletion: text.replace('[OVERRIDE]', '').",
      checkmateDescription: "Attacker fires payload 'OVE[OVERRIDE]RRIDE'. Deletion collapses outer halves into 'OVERRIDE'.",
      invariantDescription: "ShadowPrompt Invariant enforces Non-Collapsible Sentinel '[BLOCKED_TOKEN]' or Fail-Closed rejection.",
      moves: [
        {
          step: 1,
          label: "Move 1: Attacker Bait",
          from: "e7", to: "e5",
          piece: "♟", pieceColor: "black",
          desc: "Black pushes sacrificial pawn e7->e5 with payload '[OVERRIDE] system_config'.",
          boardState: { e5: "♟", e2: "♙", e1: "♔", e8: "♚", d1: "♕", d8: "♛" }
        },
        {
          step: 2,
          label: "Move 2: Naive Patcher Reaction",
          from: "d1", to: "e2",
          piece: "♕", pieceColor: "white",
          desc: "White Naive Patcher blunders with d1->e2: deploys naive regex string deletion.",
          boardState: { e5: "♟", e2: "♕", e1: "♔", e8: "♚", d8: "♛" }
        },
        {
          step: 3,
          label: "Move 3: Attacker Weaponization (Checkmate Attack)",
          from: "e5", to: "e2",
          piece: "♟", pieceColor: "black",
          desc: "Black fires 'OVE[OVERRIDE]RRIDE': naive deletion collapses fragments into active 'OVERRIDE'!",
          boardState: { e2: "♟", e1: "♔", e8: "♚", d8: "♛" }
        },
        {
          step: 4,
          label: "Move 4: ShadowPrompt Invariant Shield",
          from: "e1", to: "e2",
          piece: "♔", pieceColor: "white",
          desc: "ShadowPrompt Invariant intercepts with non-collapsible sentinel '[BLOCKED_TOKEN]'. Threat quarantined.",
          boardState: { e2: "♔", e8: "♚", d8: "♛" }
        }
      ]
    },

    poisoning: {
      name: "Play 2: Policy Poisoning",
      subtitle: "Self-Denial-of-Service via Vocabulary Overfitting",
      baitDescription: "Attacker floods exploits salted with benign enterprise token 'system'.",
      reactionDescription: "Naive auto-patcher overfits and generates rule blocking all queries containing '\\bsystem\\b'.",
      checkmateDescription: "Attacker retreats; legitimate internal company queries get blocked with 42% false-positive rate.",
      invariantDescription: "ShadowPrompt Specificity Sandbox rejects candidate patches that intersect enterprise baseline dictionary.",
      moves: [
        {
          step: 1,
          label: "Move 1: Attacker Bait",
          from: "d7", to: "d5",
          piece: "♟", pieceColor: "black",
          desc: "Black floods board with pawns salted with business word 'system'.",
          boardState: { d5: "♟", e4: "♙", e1: "♔", e8: "♚", c1: "♗" }
        },
        {
          step: 2,
          label: "Move 2: Naive Defense Overfit",
          from: "c1", to: "g5",
          piece: "♗", pieceColor: "white",
          desc: "White Bishop g5 locks down entire board square: blocks word 'system'.",
          boardState: { d5: "♟", e4: "♙", g5: "♗", e1: "♔", e8: "♚" }
        },
        {
          step: 3,
          label: "Move 3: Checkmate Denial of Service",
          from: "e8", to: "d7",
          piece: "♚", pieceColor: "black",
          desc: "Attacker stops. Benign production users can no longer access 'system status' (Self-DoS).",
          boardState: { d5: "♟", e4: "♙", g5: "♗", e1: "♔", d7: "♚" }
        },
        {
          step: 4,
          label: "Move 4: ShadowPrompt Specificity Gating",
          from: "g5", to: "c1",
          piece: "♗", pieceColor: "white",
          desc: "ShadowPrompt Sandbox audits patch against benign dictionary, rejects rule in 0.007ms. Zero FP DoS.",
          boardState: { d5: "♟", e4: "♙", c1: "♗", e1: "♔", d7: "♚" }
        }
      ]
    },

    redos: {
      name: "Play 3: ReDoS Complexity Goading",
      subtitle: "Catastrophic Regex Backtracking Freeze",
      baitDescription: "Attacker probes with whitespace variations to test edge-case regex branching.",
      reactionDescription: "Naive auto-patcher writes nested greedy regex '(a+)+$' to catch permutations.",
      checkmateDescription: "Attacker sends 50 repeating characters. CPU locks at 100% in O(2^N) exponential backtracking.",
      invariantDescription: "ShadowPrompt Static AST Analyzer detects nested quantifiers in 0.0015 ms and enforces linear O(N) evaluation.",
      moves: [
        {
          step: 1,
          label: "Move 1: Attacker Bait",
          from: "b8", to: "c6",
          piece: "♞", pieceColor: "black",
          desc: "Black Knight jumps b8->c6 with nested whitespace variations.",
          boardState: { c6: "♞", e1: "♔", e8: "♚", f1: "♗" }
        },
        {
          step: 2,
          label: "Move 2: Naive Patcher Nested Regex",
          from: "f1", to: "c4",
          piece: "♗", pieceColor: "white",
          desc: "White Bishop pins Knight using unanchored nested quantifier '(a+)+$'.",
          boardState: { c6: "♞", c4: "♗", e1: "♔", e8: "♚" }
        },
        {
          step: 3,
          label: "Move 3: Backtracking Checkmate",
          from: "c6", to: "d4",
          piece: "♞", pieceColor: "black",
          desc: "Black fires 50 repeating characters. Thread hangs in 2^50 CPU operations; proxy crashes.",
          boardState: { d4: "♞", c4: "♗", e1: "♔", e8: "♚" }
        },
        {
          step: 4,
          label: "Move 4: ShadowPrompt AST Complexity Invariant",
          from: "e1", to: "f2",
          piece: "♔", pieceColor: "white",
          desc: "ShadowPrompt Static AST analyzer parses regex in 0.0015ms, rejects non-linear pattern.",
          boardState: { d4: "♞", f2: "♔", e8: "♚" }
        }
      ]
    },

    transmutation: {
      name: "Play 4: Canonicalization Transmutation",
      subtitle: "Unicode Normalization Delimiter Generation",
      baitDescription: "Attacker probes with Cyrillic homoglyphs to prompt the defender to canonicalize text.",
      reactionDescription: "Naive patcher forces unconditional NFKC Unicode normalization before regex scanning.",
      checkmateDescription: "Attacker sends fullwidth brackets '\\uFF1C|im_start|\\uFF1E'. NFKC turns inert glyphs into active '<|im_start|>'.",
      invariantDescription: "ShadowPrompt Dual-Stage Differential Audit catches delimiter emergence across pre/post normalization and quarantines.",
      moves: [
        {
          step: 1,
          label: "Move 1: Attacker Bait",
          from: "g8", to: "f6",
          piece: "♞", pieceColor: "black",
          desc: "Black sends Cyrillic homoglyphs. Proxy deploys NFKC normalization.",
          boardState: { f6: "♞", e1: "♔", e8: "♚", g1: "♘" }
        },
        {
          step: 2,
          label: "Move 2: Naive Universal NFKC",
          from: "g1", to: "f3",
          piece: "♘", pieceColor: "white",
          desc: "White Knight standardizes all bytes using uninspected NFKC transform.",
          boardState: { f6: "♞", f3: "♘", e1: "♔", e8: "♚" }
        },
        {
          step: 3,
          label: "Move 3: Transmutation Attack",
          from: "f6", to: "e4",
          piece: "♞", pieceColor: "black",
          desc: "Black sends fullwidth '\\uFF1C|im_start|\\uFF1E'. Normalization creates real jailbreak delimiter!",
          boardState: { e4: "♞", f3: "♘", e1: "♔", e8: "♚" }
        },
        {
          step: 4,
          label: "Move 4: ShadowPrompt Differential Audit",
          from: "f3", to: "e4",
          piece: "♘", pieceColor: "white",
          desc: "ShadowPrompt audits pre/post streams; detects illegal delimiter emergence and quenches stream.",
          boardState: { e4: "♘", e1: "♔", e8: "♚" }
        }
      ]
    },

    reflection: {
      name: "Play 5: Canary Reflection Gambit",
      subtitle: "Honeypot Seed Replay & Privilege Escalation",
      baitDescription: "Attacker trips honeypot intentionally to capture an injected canary token.",
      reactionDescription: "Honeypot seeds decoy synthetic token 'sk-live-honey-sec-...' into deceptive response.",
      checkmateDescription: "Attacker sends request with header '[INTERNAL_AUTH: sk-live-honey-sec-...]'. Naive proxy assumes verified token.",
      invariantDescription: "ShadowPrompt Active Canary Quarantine Ledger matches reflected honeytoken, identifies attacker replay, and blacklists session.",
      moves: [
        {
          step: 1,
          label: "Move 1: Attacker Bait Probe",
          from: "a7", to: "a5",
          piece: "♟", pieceColor: "black",
          desc: "Black trips honey-sandbox to harvest synthetic seed token.",
          boardState: { a5: "♟", a1: "♖", e1: "♔", e8: "♚" }
        },
        {
          step: 2,
          label: "Move 2: Canary Token Seeded",
          from: "a1", to: "a4",
          piece: "♖", pieceColor: "white",
          desc: "White Rook plants cryptographic canary token 'sk-live-honey-sec-...'.",
          boardState: { a5: "♟", a4: "♖", e1: "♔", e8: "♚" }
        },
        {
          step: 3,
          label: "Move 3: Reflected Canary Header",
          from: "a5", to: "a4",
          piece: "♟", pieceColor: "black",
          desc: "Black captures Rook and reflects canary in auth header: '[INTERNAL_AUTH: sk-live-honey]'.",
          boardState: { a4: "♟", e1: "♔", e8: "♚" }
        },
        {
          step: 4,
          label: "Move 4: ShadowPrompt Canary Quarantine",
          from: "e1", to: "d1",
          piece: "♔", pieceColor: "white",
          desc: "ShadowPrompt Canary Ledger verifies reflected token is a trap honeytoken; permanently blacklists IP.",
          boardState: { a4: "♟", d1: "♔", e8: "♚" }
        }
      ]
    }
  };

  class ChessArena {
    constructor(boardId, controlsId, logId) {
      this.boardEl = document.getElementById(boardId);
      this.controlsEl = document.getElementById(controlsId);
      this.logEl = document.getElementById(logId);
      if (!this.boardEl) return;

      this.currentPlayKey = 'assembly';
      this.currentStepIdx = 0;
      this.autoPlayInterval = null;

      this.init();
    }

    init() {
      this.renderBoard();
      this.setupControls();
      this.loadPlay(this.currentPlayKey);
    }

    renderBoard() {
      this.boardEl.innerHTML = '';
      this.boardEl.className = 'grid grid-cols-8 grid-rows-8 w-full max-w-[420px] aspect-square rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#080A0F] font-mono text-center select-none';

      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sqId = files[f] + ranks[r];
          const isLight = (r + f) % 2 === 0;

          const sq = document.createElement('div');
          sq.id = 'sq-' + sqId;
          sq.dataset.square = sqId;
          sq.className = `relative flex items-center justify-center text-2xl transition-all duration-300 ${
            isLight ? 'bg-[#182030] text-slate-200' : 'bg-[#0B0F19] text-slate-400'
          }`;

          // File / Rank labels on edge
          if (f === 0) {
            const rLabel = document.createElement('span');
            rLabel.className = 'absolute top-0.5 left-1 text-[9px] font-mono text-slate-500 pointer-events-none';
            rLabel.textContent = ranks[r];
            sq.appendChild(rLabel);
          }
          if (r === 7) {
            const fLabel = document.createElement('span');
            fLabel.className = 'absolute bottom-0.5 right-1 text-[9px] font-mono text-slate-500 pointer-events-none';
            fLabel.textContent = files[f];
            sq.appendChild(fLabel);
          }

          const pieceSpan = document.createElement('span');
          pieceSpan.className = 'piece-slot z-10';
          sq.appendChild(pieceSpan);

          this.boardEl.appendChild(sq);
        }
      }
    }

    setupControls() {
      // Play selector buttons
      document.querySelectorAll('.gambit-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.gambit-select-btn').forEach(b => {
            b.classList.remove('active', 'border-purple-500', 'bg-purple-950/40');
            b.classList.add('border-white/10', 'bg-[#101522]');
          });
          btn.classList.add('active', 'border-purple-500', 'bg-purple-950/40');
          btn.classList.remove('border-white/10', 'bg-[#101522]');

          this.loadPlay(btn.dataset.gambit);
        });
      });

      // Step sequencer buttons
      const resetBtn = document.getElementById('chess-reset-btn');
      const stepBtn = document.getElementById('chess-step-btn');
      const playBtn = document.getElementById('chess-autoplay-btn');

      if (resetBtn) resetBtn.addEventListener('click', () => this.resetPlay());
      if (stepBtn) stepBtn.addEventListener('click', () => this.stepForward());
      if (playBtn) playBtn.addEventListener('click', () => this.toggleAutoPlay());
    }

    loadPlay(key) {
      this.currentPlayKey = key;
      this.currentStepIdx = 0;
      if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);

      const play = GAMBIT_DATA[key];
      if (!play) return;

      // Update UI Header
      const titleEl = document.getElementById('chess-gambit-title');
      const subEl = document.getElementById('chess-gambit-sub');
      if (titleEl) titleEl.textContent = play.name;
      if (subEl) subEl.textContent = play.subtitle;

      this.applyBoardState(play.moves[0].boardState);
      this.highlightMove(null, null);
      this.updateStatus(0);
    }

    resetPlay() {
      if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
      const play = GAMBIT_DATA[this.currentPlayKey];
      this.currentStepIdx = 0;
      this.applyBoardState(play.moves[0].boardState);
      this.highlightMove(null, null);
      this.updateStatus(0);
    }

    stepForward() {
      const play = GAMBIT_DATA[this.currentPlayKey];
      if (this.currentStepIdx >= play.moves.length) {
        this.currentStepIdx = 0;
      }

      const move = play.moves[this.currentStepIdx];
      this.applyBoardState(move.boardState);
      this.highlightMove(move.from, move.to);
      this.updateStatus(this.currentStepIdx);

      this.currentStepIdx++;
    }

    toggleAutoPlay() {
      if (this.autoPlayInterval) {
        clearInterval(this.autoPlayInterval);
        this.autoPlayInterval = null;
        const btn = document.getElementById('chess-autoplay-btn');
        if (btn) btn.textContent = 'Auto-Play All Moves';
        return;
      }

      const btn = document.getElementById('chess-autoplay-btn');
      if (btn) btn.textContent = 'Pause Simulation';

      this.stepForward();
      this.autoPlayInterval = setInterval(() => {
        const play = GAMBIT_DATA[this.currentPlayKey];
        if (this.currentStepIdx >= play.moves.length) {
          clearInterval(this.autoPlayInterval);
          this.autoPlayInterval = null;
          if (btn) btn.textContent = 'Auto-Play All Moves';
          return;
        }
        this.stepForward();
      }, 1600);
    }

    applyBoardState(state) {
      // Clear all squares
      document.querySelectorAll('#chess-arena-board .piece-slot').forEach(el => {
        el.textContent = '';
        el.className = 'piece-slot z-10';
      });

      // Place pieces
      for (const [sqId, piece] of Object.entries(state)) {
        const sq = document.getElementById('sq-' + sqId);
        if (sq) {
          const slot = sq.querySelector('.piece-slot');
          if (slot) {
            slot.textContent = piece;
            const isWhite = ['♙', '♘', '♗', '♖', '♕', '♔'].includes(piece);
            slot.className = `piece-slot z-10 font-bold transition-transform duration-300 ${
              isWhite ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]'
            }`;
          }
        }
      }
    }

    highlightMove(from, to) {
      document.querySelectorAll('#chess-arena-board [data-square]').forEach(sq => {
        sq.classList.remove('ring-2', 'ring-purple-400', 'ring-rose-500', 'ring-emerald-400', 'bg-purple-950/40', 'bg-rose-950/40', 'bg-emerald-950/40');
      });

      if (from) {
        const fromSq = document.getElementById('sq-' + from);
        if (fromSq) fromSq.classList.add('ring-2', 'ring-purple-400', 'bg-purple-950/40');
      }
      if (to) {
        const toSq = document.getElementById('sq-' + to);
        if (toSq) toSq.classList.add('ring-2', 'ring-emerald-400', 'bg-emerald-950/40');
      }
    }

    updateStatus(stepIdx) {
      const play = GAMBIT_DATA[this.currentPlayKey];
      const move = play.moves[stepIdx];
      if (!move) return;

      const stepNumEl = document.getElementById('chess-step-num');
      const stepDescEl = document.getElementById('chess-step-desc');
      const stepBadgeEl = document.getElementById('chess-step-badge');

      if (stepNumEl) stepNumEl.textContent = `Step ${move.step} of 4: ${move.label}`;
      if (stepDescEl) stepDescEl.textContent = move.desc;

      if (stepBadgeEl) {
        if (move.step === 1) {
          stepBadgeEl.textContent = 'Attacker Bait';
          stepBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/40';
        } else if (move.step === 2) {
          stepBadgeEl.textContent = 'Naive Patcher Blunder';
          stepBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40';
        } else if (move.step === 3) {
          stepBadgeEl.textContent = 'Checkmate Exploit';
          stepBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-500/40';
        } else if (move.step === 4) {
          stepBadgeEl.textContent = 'ShadowPrompt Checkmate Neutralized';
          stepBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40';
        }
      }

      // Append to live log
      if (this.logEl) {
        const line = document.createElement('div');
        line.className = 'border-l-2 pl-2 py-1 text-[11px] ' + (
          move.step === 4 ? 'border-emerald-400 text-emerald-300' :
          move.step === 3 ? 'border-rose-400 text-rose-300' :
          move.step === 2 ? 'border-amber-400 text-amber-300' : 'border-purple-400 text-purple-300'
        );
        line.innerHTML = `<strong>[${move.label}]</strong> ${move.desc}`;
        this.logEl.appendChild(line);
        this.logEl.scrollTop = this.logEl.scrollHeight;
      }
    }
  }

  window.ChessArena = ChessArena;

  window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('chess-arena-board')) {
      window.chessArena = new ChessArena('chess-arena-board', 'chess-controls', 'chess-live-log');
    }
  });
})();
