/**
 * ShadowPrompt Matrix & Chess Digital Rain Engine
 * Renders high-performance cybernetic digital rain with phosphorescent matrix glyphs
 * and luminescent white chess pieces tumbling through cyberspace.
 */

(function() {
  'use strict';

  class MatrixChessEngine {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.isRunning = true;
      this.isPaused = false;
      this.lastTime = 0;
      this.fpsInterval = 1000 / 35; // 35 FPS for retro aesthetic and minimal CPU

      // Character Sets
      this.matrixChars = '0123456789ABCDEF01λ§ΨΞ∑∆øｱｳｴｵｶｷｹｺｻｼｽｾﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾔﾕﾗﾘﾜ';
      this.chessPieces = ['♙', '♙', '♙', '♘', '♗', '♖', '♕', '♔']; // Weighted towards pawns

      // Grid Configuration
      this.fontSize = 14;
      this.columns = 0;
      this.drops = [];
      this.chessEntities = [];
      this.maxChessEntities = 22;

      // Mouse Interaction
      this.mouse = { x: -1000, y: -1000, radius: 90 };

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      });
      window.addEventListener('mouseleave', () => {
        this.mouse.x = -1000;
        this.mouse.y = -1000;
      });

      // Pause when tab is hidden
      document.addEventListener('visibilitychange', () => {
        this.isPaused = document.hidden;
      });

      // Spawn initial chess pieces
      for (let i = 0; i < this.maxChessEntities; i++) {
        this.spawnChessEntity(true);
      }

      requestAnimationFrame((t) => this.render(t));
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';

      this.ctx.scale(dpr, dpr);

      this.width = width;
      this.height = height;
      this.columns = Math.floor(width / this.fontSize);

      this.drops = [];
      for (let i = 0; i < this.columns; i++) {
        this.drops[i] = Math.floor(Math.random() * -50);
      }
    }

    spawnChessEntity(randomY = false) {
      const piece = this.chessPieces[Math.floor(Math.random() * this.chessPieces.length)];
      const size = 18 + Math.floor(Math.random() * 16);
      const x = Math.random() * (this.width || 1200);
      const y = randomY ? Math.random() * (this.height || 800) : -size - Math.random() * 100;
      const speed = 0.7 + Math.random() * 1.5;
      const opacity = 0.35 + Math.random() * 0.55;
      const rotation = Math.random() * Math.PI * 2;
      const rotSpeed = (Math.random() - 0.5) * 0.02;

      this.chessEntities.push({
        piece,
        size,
        x,
        y,
        speed,
        opacity,
        rotation,
        rotSpeed,
        life: 0
      });
    }

    render(currentTime) {
      if (!this.isRunning) return;

      requestAnimationFrame((t) => this.render(t));

      if (this.isPaused) return;

      const elapsed = currentTime - this.lastTime;
      if (elapsed < this.fpsInterval) return;
      this.lastTime = currentTime - (elapsed % this.fpsInterval);

      const ctx = this.ctx;

      // Trail fade
      ctx.fillStyle = 'rgba(8, 10, 15, 0.18)';
      ctx.fillRect(0, 0, this.width, this.height);

      // 1. Draw Green Matrix Digital Rain
      ctx.font = `${this.fontSize}px 'Geist Mono', monospace`;

      for (let i = 0; i < this.drops.length; i++) {
        const x = i * this.fontSize;
        const y = this.drops[i] * this.fontSize;

        if (y > -20 && y < this.height + 20) {
          const char = this.matrixChars[Math.floor(Math.random() * this.matrixChars.length)];

          const dx = x - this.mouse.x;
          const dy = y - this.mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const isNearMouse = dist < this.mouse.radius;

          if (isNearMouse) {
            ctx.fillStyle = '#67E8F9'; // Cyan hover glow
            ctx.fillText(char, x + (dx / dist) * 6, y + (dy / dist) * 6);
          } else {
            if (Math.random() > 0.94) {
              ctx.fillStyle = '#FFFFFF';
              ctx.shadowColor = '#00FF66';
              ctx.shadowBlur = 4;
            } else if (Math.random() > 0.45) {
              ctx.fillStyle = '#10B981';
              ctx.shadowBlur = 0;
            } else {
              ctx.fillStyle = '#047857';
              ctx.shadowBlur = 0;
            }
            ctx.fillText(char, x, y);
            ctx.shadowBlur = 0;
          }
        }

        if (y > this.height && Math.random() > 0.975) {
          this.drops[i] = 0;
        } else {
          this.drops[i]++;
        }
      }

      // 2. Draw Falling Luminescent White Chess Pieces
      for (let i = this.chessEntities.length - 1; i >= 0; i--) {
        const p = this.chessEntities[i];
        p.y += p.speed;
        p.rotation += p.rotSpeed;
        p.life++;

        // Repel from mouse
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.mouse.radius * 1.4 && dist > 0) {
          const force = (1 - dist / (this.mouse.radius * 1.4)) * 2.5;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        ctx.font = `${p.size}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Luminous White Chess Piece
        ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fillText(p.piece, 0, 0);

        ctx.restore();

        if (p.y > this.height + 40) {
          this.chessEntities.splice(i, 1);
          this.spawnChessEntity(false);
        }
      }
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      return this.isPaused;
    }
  }

  window.MatrixChessEngine = MatrixChessEngine;

  window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('matrix-chess-canvas')) {
      window.matrixEngine = new MatrixChessEngine('matrix-chess-canvas');
    }
  });
})();
