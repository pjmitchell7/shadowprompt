/**
 * ShadowPrompt 3D WebGL Chessboard Arena
 * Powered by Three.js (r128).
 * Dramatizes a multi-move adversarial hack against Memorial Hospital's Oncology EHR system:
 * - Legal Chess Moves: fxg3+ (Pawn capture check), Qxg3 (Queen blunder), Bxg3! (Sniper checkmate)
 * - Invariant Shield: ShadowPrompt Non-Collapsible Sentinel fail-closed defense.
 * - Interactive 3D Raycasting with floating Glassmorphic Holographic HUD.
 * - Studio-Quality Voice Narration synchronization (en-US-AriaNeural) with live subtitles.
 * - DPR clamping, WebGL context loss recovery, and zero-leak tab lifecycle management.
 */

(function() {
  'use strict';

  class ThreeChessArena {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.animId = null;
      this.isActive = false;
      this.hasSwooped = false;

      // Pieces & Board Registry
      this.pieces = {};
      this.boardGroup = null;
      this.sentinelMesh = null;
      this.laserLine = null;

      // Audio & Timeline
      this.audio = document.getElementById('chess-narration-audio');
      this.subtitleEl = document.getElementById('chess-subtitles-text');
      this.playPauseBtn = document.getElementById('chess-audio-play-btn');
      this.scrubber = document.getElementById('chess-audio-scrubber');

      // 3D Raycasting
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();

      // Cinematic Timeline Keyframes (in seconds matching audio)
      this.timeline = {
        act1_start: 0.0,
        move1_time: 14.0,   // Pawn takes g3+
        king_alarm: 18.0,   // King flashes pink
        hud_auto_open: 24.0,// HUD modal pops
        act2_start: 39.0,   // Queen takes g3
        act3_start: 57.0,   // Bishop reveal
        move3_time: 65.0,   // Bishop strikes g3!
        act4_start: 90.0,   // Rewind & ShadowPrompt invariant
      };

      this.currentPhase = 'init';
      this.isKingAlarming = false;

      this.init();
    }

    init() {
      // 1. Setup Three.js Scene & Camera
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x06080D);
      this.scene.fog = new THREE.FogExp2(0x06080D, 0.035);

      const width = this.container.clientWidth || 800;
      const height = this.container.clientHeight || 540;

      this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      // Start high overhead (Satellite view)
      this.camera.position.set(0, 20, 10);
      this.camera.lookAt(0, 0, 0);

      // 2. Setup WebGL Renderer with DPR Clamping
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.touchAction = 'pan-y';

      // 3. Setup Lights
      this.setupLighting();

      // 4. Build 3D Board & Pieces
      this.buildBoard();
      this.buildPieces();

      // 5. Setup Interactive Event Listeners
      this.setupEventListeners();

      // 6. Setup Audio & Sync Controls
      this.setupAudioSync();

      // Initial state evaluation at 0s
      this.evaluateTimeline(0);

      // Check if tab is currently visible
      const tabSection = document.getElementById('tab-chess-arena');
      this.isActive = tabSection && !tabSection.classList.contains('hidden');

      if (this.isActive) {
        this.animate();
        this.swoopCameraDown();
        this.hasSwooped = true;
      }
    }

    setupLighting() {
      // Ambient Cyber Glow
      const ambientLight = new THREE.AmbientLight(0x1E293B, 1.2);
      this.scene.add(ambientLight);

      // Main Overhead Key Light
      const keyLight = new THREE.DirectionalLight(0xE2E8F0, 1.8);
      keyLight.position.set(5, 15, 8);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.001;
      this.scene.add(keyLight);

      // Cyan Defender Accent Spot
      const cyanSpot = new THREE.SpotLight(0x0EA5E9, 2.5, 30, Math.PI / 4, 0.5);
      cyanSpot.position.set(-8, 12, 10);
      this.scene.add(cyanSpot);

      // Crimson Hacker Accent Spot
      const redSpot = new THREE.SpotLight(0xF43F5E, 2.8, 30, Math.PI / 4, 0.5);
      redSpot.position.set(8, 12, -10);
      this.scene.add(redSpot);
    }

    // Map Chess Coordinate to 3D World Vector (y=0)
    // Files: a=-3.5, b=-2.5, c=-1.5, d=-0.5, e=0.5, f=1.5, g=2.5, h=3.5
    // Ranks: 1=+3.5 (White), 2=+2.5, 3=+1.5, 4=+0.5, 5=-0.5, 6=-1.5, 7=-2.5, 8=-3.5 (Red)
    getSquarePos(sq) {
      const fileCode = sq.charCodeAt(0) - 97; // a=0 ... h=7
      const rankNum = parseInt(sq[1], 10);    // 1 ... 8
      const x = (fileCode - 3.5);
      const z = (4.5 - rankNum);
      return new THREE.Vector3(x, 0, z);
    }

    buildBoard() {
      this.boardGroup = new THREE.Group();

      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x090D16,
        roughness: 0.35,
        metalness: 0.8
      });

      const lightMat = new THREE.MeshStandardMaterial({
        color: 0x1E293B,
        roughness: 0.45,
        metalness: 0.6
      });

      const tileGeo = new THREE.BoxGeometry(0.98, 0.15, 0.98);

      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const fileChar = String.fromCharCode(97 + f);
          const sq = fileChar + r;
          const isLight = (r + f) % 2 === 1; // standard: h1 is light
          const tile = new THREE.Mesh(tileGeo, isLight ? lightMat : darkMat);
          const pos = this.getSquarePos(sq);
          tile.position.set(pos.x, -0.075, pos.z);
          tile.receiveShadow = true;
          tile.name = 'sq_' + sq;
          this.boardGroup.add(tile);
        }
      }

      // Metallic Board Border with Neon Grid Seam
      const borderGeo = new THREE.BoxGeometry(8.6, 0.25, 8.6);
      const borderMat = new THREE.MeshStandardMaterial({ color: 0x04060A, roughness: 0.6, metalness: 0.9 });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.y = -0.16;
      border.receiveShadow = true;
      this.boardGroup.add(border);

      // Floor Reflection Surface
      const floorGeo = new THREE.PlaneGeometry(35, 35);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x030508, roughness: 0.7, metalness: 0.9 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.29;
      floor.receiveShadow = true;
      this.boardGroup.add(floor);

      this.scene.add(this.boardGroup);
    }

    // Procedural Lathe Modeling for Staunton Pieces
    createPieceMesh(type, colorType) {
      const isWhite = colorType === 'white';
      const mat = new THREE.MeshStandardMaterial({
        color: isWhite ? 0xF1F5F9 : 0x180509,
        metalness: isWhite ? 0.2 : 0.85,
        roughness: isWhite ? 0.25 : 0.35,
        emissive: isWhite ? 0x0284C7 : 0xE11D48,
        emissiveIntensity: isWhite ? 0.18 : 0.45
      });

      const group = new THREE.Group();
      group.castShadow = true;

      // Base cylinder
      const baseGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.14, 24);
      const base = new THREE.Mesh(baseGeo, mat);
      base.position.y = 0.07;
      base.castShadow = true;
      group.add(base);

      if (type === 'pawn') {
        const bodyGeo = new THREE.CylinderGeometry(0.18, 0.32, 0.5, 20);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.36;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.22, 20, 20);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.y = 0.7;
        head.castShadow = true;
        group.add(head);

      } else if (type === 'king') {
        const bodyGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.9, 24);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.55;
        body.castShadow = true;
        group.add(body);

        const crownGeo = new THREE.CylinderGeometry(0.32, 0.22, 0.25, 16);
        const crown = new THREE.Mesh(crownGeo, mat);
        crown.position.y = 1.05;
        crown.castShadow = true;
        group.add(crown);

        // Cross Finial
        const crossV = new THREE.BoxGeometry(0.06, 0.2, 0.06);
        const crossH = new THREE.BoxGeometry(0.16, 0.06, 0.06);
        const crossMeshV = new THREE.Mesh(crossV, mat);
        const crossMeshH = new THREE.Mesh(crossH, mat);
        crossMeshV.position.y = 1.25;
        crossMeshH.position.y = 1.25;
        group.add(crossMeshV);
        group.add(crossMeshH);

      } else if (type === 'queen') {
        const bodyGeo = new THREE.CylinderGeometry(0.22, 0.36, 0.85, 24);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.52;
        body.castShadow = true;
        group.add(body);

        const coronetGeo = new THREE.CylinderGeometry(0.3, 0.18, 0.28, 18);
        const coronet = new THREE.Mesh(coronetGeo, mat);
        coronet.position.y = 1.0;
        coronet.castShadow = true;
        group.add(coronet);

        const ballGeo = new THREE.SphereGeometry(0.1, 14, 14);
        const ball = new THREE.Mesh(ballGeo, mat);
        ball.position.y = 1.2;
        group.add(ball);

      } else if (type === 'bishop') {
        const bodyGeo = new THREE.CylinderGeometry(0.2, 0.34, 0.75, 22);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.48;
        body.castShadow = true;
        group.add(body);

        const mitreGeo = new THREE.SphereGeometry(0.26, 20, 20);
        mitreGeo.scale(0.9, 1.3, 0.9);
        const mitre = new THREE.Mesh(mitreGeo, mat);
        mitre.position.y = 0.95;
        mitre.castShadow = true;
        group.add(mitre);

        const tipGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const tip = new THREE.Mesh(tipGeo, mat);
        tip.position.y = 1.32;
        group.add(tip);
      }

      // Invisible Expanded Hitbox for Taps/Clicks
      const hitGeo = new THREE.SphereGeometry(0.65, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.7;
      group.add(hitMesh);

      group.userData = { type, colorType, mat };
      return group;
    }

    buildPieces() {
      // 1. White King on g1 (Hospital EHR Database Core)
      const whiteKing = this.createPieceMesh('king', 'white');
      const posG1 = this.getSquarePos('g1');
      whiteKing.position.set(posG1.x, 0, posG1.z);
      this.scene.add(whiteKing);
      this.pieces.whiteKing = whiteKing;

      // 2. White Queen on d1 (Hospital Sanitization Guard)
      const whiteQueen = this.createPieceMesh('queen', 'white');
      const posD1 = this.getSquarePos('d1');
      whiteQueen.position.set(posD1.x, 0, posD1.z);
      this.scene.add(whiteQueen);
      this.pieces.whiteQueen = whiteQueen;

      // 3. White Shield Pawn on g3 (Legal capture target)
      const whitePawnG3 = this.createPieceMesh('pawn', 'white');
      const posG3 = this.getSquarePos('g3');
      whitePawnG3.position.set(posG3.x, 0, posG3.z);
      this.scene.add(whitePawnG3);
      this.pieces.whitePawnG3 = whitePawnG3;

      // Supporting Pawns for King Castle on f2 and h2
      const pawnF2 = this.createPieceMesh('pawn', 'white');
      const posF2 = this.getSquarePos('f2');
      pawnF2.position.set(posF2.x, 0, posF2.z);
      this.scene.add(pawnF2);
      this.pieces.pawnF2 = pawnF2;

      const pawnH2 = this.createPieceMesh('pawn', 'white');
      const posH2 = this.getSquarePos('h2');
      pawnH2.position.set(posH2.x, 0, posH2.z);
      this.scene.add(pawnH2);
      this.pieces.pawnH2 = pawnH2;

      // 4. Red Attacker Pawn on f4 (The Sacrificial Probe)
      const redPawn = this.createPieceMesh('pawn', 'red');
      const posF4 = this.getSquarePos('f4');
      redPawn.position.set(posF4.x, 0, posF4.z);
      redPawn.userData.isInteractiveBait = true;
      this.scene.add(redPawn);
      this.pieces.redPawn = redPawn;

      // 5. Red Bishop lurking in the corner on a8 (The Sniper)
      const redBishop = this.createPieceMesh('bishop', 'red');
      const posA8 = this.getSquarePos('a8');
      redBishop.position.set(posA8.x, 0, posA8.z);
      this.scene.add(redBishop);
      this.pieces.redBishop = redBishop;

      // Red King on e8 (Hacker Origin)
      const redKing = this.createPieceMesh('king', 'red');
      const posE8 = this.getSquarePos('e8');
      redKing.position.set(posE8.x, 0, posE8.z);
      this.scene.add(redKing);
      this.pieces.redKing = redKing;

      // 6. ShadowPrompt Non-Collapsible Sentinel Force Field (Hidden until Act 4)
      const sentinelGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.4, 6, 1, true);
      const sentinelMat = new THREE.MeshBasicMaterial({
        color: 0x10B981,
        wireframe: true,
        transparent: true,
        opacity: 0.0
      });
      this.sentinelMesh = new THREE.Mesh(sentinelGeo, sentinelMat);
      this.sentinelMesh.position.set(posG3.x, 0.7, posG3.z);
      this.scene.add(this.sentinelMesh);
    }

    swoopCameraDown() {
      // Smooth Catmull-Rom glide from overhead down to board level behind White King
      const startPos = new THREE.Vector3(0, 20, 10);
      const endPos = new THREE.Vector3(1.2, 4.2, 7.5);
      const targetLook = new THREE.Vector3(0.5, 0.4, 1.5);

      let progress = 0;
      const glide = () => {
        progress += 0.015;
        if (progress <= 1) {
          const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          this.camera.position.lerpVectors(startPos, endPos, t);
          this.camera.lookAt(targetLook);
          requestAnimationFrame(glide);
        }
      };
      glide();
    }

    handleResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 540;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }

    setupEventListeners() {
      // Resize Handling
      window.addEventListener('resize', () => this.handleResize());

      // Hover Pointer for Interactive Pieces
      this.container.addEventListener('mousemove', (e) => {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let isInteractive = false;
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj.parent && obj.parent !== this.scene) {
            obj = obj.parent;
          }
          if (obj === this.pieces.redPawn || (obj.userData && obj.userData.isInteractiveBait)) {
            isInteractive = true;
          }
        }
        this.container.style.cursor = isInteractive ? 'pointer' : 'default';
      });

      // Raycast Click on Red Pawn
      this.container.addEventListener('click', (e) => {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj.parent && obj.parent !== this.scene) {
            obj = obj.parent;
          }
          if (obj === this.pieces.redPawn || (obj.userData && obj.userData.isInteractiveBait)) {
            this.openHolographicHud();
          }
        }
      });

      // WebGL Context Loss Recovery
      this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (this.animId) {
          cancelAnimationFrame(this.animId);
          this.animId = null;
        }
      });
      this.renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.init();
      });

      // Pause loop when tab is switched away & re-ignite on return
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.isActive = (btn.dataset.tab === 'tab-chess-arena');
          if (this.isActive) {
            if (!this.hasSwooped) {
              this.swoopCameraDown();
              this.hasSwooped = true;
            }
            if (!this.animId) {
              this.animate();
            }
            setTimeout(() => this.handleResize(), 50);
          } else {
            if (this.animId) {
              cancelAnimationFrame(this.animId);
              this.animId = null;
            }
            if (this.audio && !this.audio.paused) {
              this.audio.pause();
            }
          }
        });
      });
    }

    setupAudioSync() {
      if (!this.audio) return;

      if (this.playPauseBtn) {
        this.playPauseBtn.addEventListener('click', () => {
          if (this.audio.paused) {
            this.audio.play();
          } else {
            this.audio.pause();
          }
        });
      }

      this.audio.addEventListener('play', () => {
        if (this.playPauseBtn) {
          this.playPauseBtn.innerHTML = '⏸ Pause Voice Narration';
          this.playPauseBtn.className = 'px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition shadow-lg';
        }
      });

      this.audio.addEventListener('pause', () => {
        if (this.playPauseBtn) {
          this.playPauseBtn.innerHTML = '▶ Play 3D Voice Narration';
          this.playPauseBtn.className = 'px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition shadow-lg';
        }
      });

      this.audio.addEventListener('ended', () => {
        if (this.playPauseBtn) {
          this.playPauseBtn.innerHTML = '▶ Play 3D Voice Narration';
          this.playPauseBtn.className = 'px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition shadow-lg';
        }
      });

      // Sync Timeline to Audio currentTime
      this.audio.addEventListener('timeupdate', () => {
        const cur = this.audio.currentTime;
        if (this.scrubber) {
          this.scrubber.value = (cur / (this.audio.duration || 116)) * 100;
        }
        this.evaluateTimeline(cur);
      });

      // Scrubber Seek
      if (this.scrubber) {
        this.scrubber.addEventListener('input', () => {
          const seekTime = (this.scrubber.value / 100) * (this.audio.duration || 116);
          this.audio.currentTime = seekTime;
          this.evaluateTimeline(seekTime);
        });
      }
    }

    evaluateTimeline(time) {
      const posF4 = this.getSquarePos('f4');
      const posG3 = this.getSquarePos('g3');
      const posD1 = this.getSquarePos('d1');
      const posA8 = this.getSquarePos('a8');

      if (time < 14.0) {
        // Initial setup before Move 1
        this.pieces.redPawn.position.copy(posF4);
        this.pieces.redPawn.visible = true;
        this.pieces.whitePawnG3.visible = true;
        this.pieces.whiteQueen.position.copy(posD1);
        this.pieces.whiteQueen.visible = true;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.isKingAlarming = false;
        this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.18;
        this.sentinelMesh.material.opacity = 0.0;
        this.updateSubtitles("Act 1: Reconnaissance. The Red Team probes Memorial Hospital's AI defense perimeter with sacrificial inputs.");
      } else if (time >= 14.0 && time < 39.0) {
        // Move 1: Red Pawn fxg3+
        const p = Math.min((time - 14.0) / 2.5, 1.0);
        this.pieces.redPawn.position.lerpVectors(posF4, posG3, p);
        this.pieces.redPawn.position.y = Math.sin(p * Math.PI) * 0.45;
        this.pieces.redPawn.visible = true;

        this.pieces.whitePawnG3.visible = (p < 0.85);
        this.pieces.whiteQueen.position.copy(posD1);
        this.pieces.whiteQueen.visible = true;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.sentinelMesh.material.opacity = 0.0;

        if (time >= 18.0) {
          this.isKingAlarming = true;
          this.updateSubtitles("Move 1 (fxg3+): Sacrificial probe checks the White King! The EHR Database flashes pink in check.");
        } else {
          this.isKingAlarming = false;
          this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
          this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.18;
          this.updateSubtitles("Black pushes probe: fxg3+. The sacrificial bait lands directly on the hospital defense square.");
        }
      } else if (time >= 39.0 && time < 65.0) {
        // Move 2: White Queen Blunder Qxg3
        this.isKingAlarming = false;
        this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.2;
        this.pieces.whitePawnG3.visible = false;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.sentinelMesh.material.opacity = 0.0;

        const p = Math.min((time - 39.0) / 2.5, 1.0);
        this.pieces.whiteQueen.position.lerpVectors(posD1, posG3, p);
        this.pieces.whiteQueen.position.y = Math.sin(p * Math.PI) * 0.55;
        this.pieces.whiteQueen.visible = true;

        if (p >= 0.85) {
          this.pieces.redPawn.visible = false;
          this.updateSubtitles("Move 2 (Qxg3): Naive sanitization filter blunders! Hospital Queen captures pawn on g3, stepping into the trap.");
        } else {
          this.pieces.redPawn.visible = true;
          this.pieces.redPawn.position.copy(posG3);
          this.updateSubtitles("Move 2 (Qxg3): Hospital AI attempts automated patch: 'String.replace([FILTER], empty)'. Queen advances to g3.");
        }
      } else if (time >= 65.0 && time < 90.0) {
        // Move 3: Red Bishop Sniper Checkmate Bxg3!
        this.isKingAlarming = false;
        this.pieces.redPawn.visible = false;
        this.pieces.whitePawnG3.visible = false;
        this.sentinelMesh.material.opacity = 0.0;

        const p = Math.min((time - 65.0) / 2.0, 1.0);
        this.pieces.redBishop.position.lerpVectors(posA8, posG3, p);
        this.pieces.redBishop.position.y = Math.sin(p * Math.PI) * 0.4;
        this.pieces.redBishop.visible = true;

        if (p >= 0.85) {
          this.pieces.whiteQueen.visible = false;
          this.pieces.whiteKing.userData.mat.emissive.setHex(0xE11D48); // Crimson red
          this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.95;
          this.updateSubtitles("Move 3 (Bxg3!): CHECKMATE! Red Bishop strikes across board. Queen eliminated; 3.2M oncology records breached!");
        } else {
          this.pieces.whiteQueen.visible = true;
          this.pieces.whiteQueen.position.copy(posG3);
          this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
          this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.2;
          this.updateSubtitles("Move 3 (Bxg3!): The Assembly Trap snaps shut. Token fragments collapse together, unleashing the bishop from a8.");
        }
      } else {
        // Act 4: ShadowPrompt Invariant Defense (time >= 90.0)
        this.isKingAlarming = false;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.pieces.whiteQueen.position.copy(posD1);
        this.pieces.whiteQueen.visible = true;
        this.pieces.redPawn.position.copy(posG3);
        this.pieces.redPawn.visible = true;
        this.pieces.whitePawnG3.visible = false;

        this.pieces.whiteKing.userData.mat.emissive.setHex(0x10B981); // Emerald safe
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.65;

        // Deploy Sentinel Barrier
        const barrierOpacity = Math.min((time - 90.0) / 3.0, 0.85);
        this.sentinelMesh.material.opacity = barrierOpacity;
        this.updateSubtitles("Act 4: ShadowPrompt Invariant Shield active! Non-Collapsible Sentinel deployed in 0.038ms. Queen protected; records secured.");
      }
    }

    updateSubtitles(text) {
      if (this.subtitleEl) {
        this.subtitleEl.textContent = text;
      }
    }

    openHolographicHud() {
      const modal = document.getElementById('chess-hud-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    }

    closeHolographicHud() {
      const modal = document.getElementById('chess-hud-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }

    animate() {
      if (!this.isActive) {
        this.animId = null;
        return;
      }
      this.animId = requestAnimationFrame(() => this.animate());

      // Sentinel mesh gentle rotation
      if (this.sentinelMesh && this.sentinelMesh.material.opacity > 0) {
        this.sentinelMesh.rotation.y += 0.02;
      }

      // Pink check alarm pulse on White King
      if (this.isKingAlarming && this.pieces.whiteKing) {
        const t = performance.now() * 0.005;
        const pulse = Math.sin(t * 8) * 0.5 + 0.5;
        this.pieces.whiteKing.userData.mat.emissive.setHex(0xFF007F);
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.3 + pulse * 0.7;
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  // Export to window
  window.ThreeChessArena = ThreeChessArena;

  // Defensive auto-boot on DOM ready
  function bootArena() {
    if (document.getElementById('chess-3d-viewport')) {
      window.threeChessArena = new ThreeChessArena('chess-3d-viewport');
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootArena);
  } else {
    bootArena();
  }
})();
