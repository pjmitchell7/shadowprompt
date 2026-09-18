/**
 * ShadowPrompt 3D WebGL Chessboard Arena (v2.0 Production)
 * Powered by Three.js (r128).
 * Dramatizes multi-move adversarial exploit against Memorial Hospital's Oncology EHR system:
 * - Legal Moves: fxg3+ (Sacrificial Probe), Qxg3 (Naive Filter Blunder), Bxg3! (Sniper Assembly Checkmate)
 * - Invariant Shield: ShadowPrompt Non-Collapsible Sentinel fail-closed defense.
 * - Mobile Portrait Auto-Framing & FOV Dynamic Compensation (aspect < 1.0).
 * - Dynamic Perspective Switching (White Defender View vs Red Attacker View).
 * - Visual Move Indicators: Pulsing active ring decal, source & target tile highlights, sniper laser beam.
 * - 3D-Anchored Floating HUD Tooltip projected directly above active piece in screen coordinates.
 * - Humanized Studio Voice Narration (en-US-AvaNeural) with millisecond-exact VTT sync.
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

      // Camera Animation Targets for Smooth Perspective Lerping
      this.currentCamPos = new THREE.Vector3(0, 20, 10);
      this.desiredCamPos = new THREE.Vector3(0, 4.6, 7.4);
      this.currentLookAt = new THREE.Vector3(0, 0.4, 0.5);
      this.desiredLookAt = new THREE.Vector3(0, 0.4, 0.5);
      this.perspectiveMode = 'auto'; // 'auto' | 'white' | 'red'
      this.activeSide = 'white';

      // Pieces & Board Registry
      this.pieces = {};
      this.boardGroup = null;
      this.sentinelMesh = null;
      this.laserMesh = null;

      // Visual Indicators
      this.activeRingMesh = null;
      this.fromTileMesh = null;
      this.toTileMesh = null;

      // 3D Floating HUD State
      this.floatingHud = document.getElementById('chess-floating-hud');
      this.hudTitle = document.getElementById('floating-hud-title');
      this.hudIcon = document.getElementById('floating-hud-icon');
      this.hudContent = document.getElementById('floating-hud-content');
      this.activePieceForHud = null;
      this.isHudOpen = false;

      // Audio & Timeline
      this.audio = document.getElementById('chess-narration-audio');
      this.subtitleEl = document.getElementById('chess-subtitles-text');
      this.playPauseBtn = document.getElementById('chess-audio-play-btn');
      this.scrubber = document.getElementById('chess-audio-scrubber');
      this.audioHint = document.getElementById('chess-audio-hint');

      // 3D Raycasting
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();

      // State flags
      this.isKingAlarming = false;
      this.lastEvaluatedTime = -1;

      this.init();
    }

    init() {
      // 1. Scene & Atmosphere
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x06080D);
      this.scene.fog = new THREE.FogExp2(0x06080D, 0.032);

      const width = this.container.clientWidth || 800;
      const height = this.container.clientHeight || 540;
      const aspect = width / height;

      // 2. Camera Setup with Mobile Portrait Compensation
      this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
      this.applyMobileFov(aspect);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);

      // 3. WebGL Renderer with DPR clamping for high-DPI smartphone displays
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.touchAction = 'pan-y';

      // 4. Lighting Rig
      this.setupLighting();

      // 5. Board, Pieces, & Visual Indicators
      this.buildBoard();
      this.buildIndicators();
      this.buildPieces();

      // 6. Event Listeners & Audio Sync
      this.setupEventListeners();
      this.setupAudioSync();

      // 7. Initial state evaluation
      this.evaluateTimeline(0);

      // 8. Auto-boot if tab is visible
      const tabSection = document.getElementById('tab-chess-arena');
      this.isActive = tabSection && !tabSection.classList.contains('hidden');
      if (this.isActive) {
        this.animate();
        this.swoopCameraDown();
        this.hasSwooped = true;
        this.tryAutoPlayAudio();
      }
    }

    applyMobileFov(aspect) {
      if (aspect < 1.0) {
        // Mobile Portrait: Wider vertical FOV ensures files 'a' through 'h' are fully in frame without clipping
        this.camera.fov = Math.min(Math.max(48 / aspect * 0.72, 54), 74);
      } else {
        this.camera.fov = 42;
      }
      this.camera.updateProjectionMatrix();
    }

    setupLighting() {
      const ambientLight = new THREE.AmbientLight(0x1E293B, 1.3);
      this.scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xF8FAFC, 1.8);
      keyLight.position.set(5, 16, 8);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.001;
      this.scene.add(keyLight);

      const cyanSpot = new THREE.SpotLight(0x0EA5E9, 2.8, 32, Math.PI / 3.8, 0.45);
      cyanSpot.position.set(-8, 14, 10);
      this.scene.add(cyanSpot);

      const redSpot = new THREE.SpotLight(0xF43F5E, 3.2, 32, Math.PI / 3.8, 0.45);
      redSpot.position.set(8, 14, -10);
      this.scene.add(redSpot);
    }

    // Map Chess Coordinate to 3D World Vector (y=0)
    // Files: a=-3.5, b=-2.5, c=-1.5, d=-0.5, e=0.5, f=1.5, g=2.5, h=3.5
    // Ranks: 1=+3.5 (White side), 8=-3.5 (Red side)
    getSquarePos(sq) {
      const fileCode = sq.charCodeAt(0) - 97; // a=0 ... h=7
      const rankNum = parseInt(sq[1], 10);    // 1 ... 8
      const x = fileCode - 3.5;
      const z = 4.5 - rankNum;
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
          const isLight = (r + f) % 2 === 1; // standard h1 light
          const tile = new THREE.Mesh(tileGeo, isLight ? lightMat : darkMat);
          const pos = this.getSquarePos(sq);
          tile.position.set(pos.x, -0.075, pos.z);
          tile.receiveShadow = true;
          tile.name = 'sq_' + sq;
          this.boardGroup.add(tile);
        }
      }

      // Metallic Board Border with Neon Bevel
      const borderGeo = new THREE.BoxGeometry(8.6, 0.25, 8.6);
      const borderMat = new THREE.MeshStandardMaterial({ color: 0x04060A, roughness: 0.6, metalness: 0.9 });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.y = -0.16;
      border.receiveShadow = true;
      this.boardGroup.add(border);

      // Floor Reflection Surface
      const floorGeo = new THREE.PlaneGeometry(35, 35);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x030508, roughness: 0.75, metalness: 0.85 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.29;
      floor.receiveShadow = true;
      this.boardGroup.add(floor);

      this.scene.add(this.boardGroup);
    }

    buildIndicators() {
      // 1. Pulsing Ground Ring Decal under Active/Selected Piece
      const ringGeo = new THREE.RingGeometry(0.42, 0.54, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00F0FF,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      this.activeRingMesh = new THREE.Mesh(ringGeo, ringMat);
      this.activeRingMesh.rotation.x = -Math.PI / 2;
      this.activeRingMesh.position.set(0, 0.02, 0);
      this.activeRingMesh.visible = false;
      this.scene.add(this.activeRingMesh);

      // 2. Source Move Tile Highlight (From)
      const fromGeo = new THREE.BoxGeometry(0.96, 0.02, 0.96);
      const fromMat = new THREE.MeshBasicMaterial({
        color: 0xF59E0B, // Amber source
        transparent: true,
        opacity: 0.45
      });
      this.fromTileMesh = new THREE.Mesh(fromGeo, fromMat);
      this.fromTileMesh.position.set(0, 0.015, 0);
      this.fromTileMesh.visible = false;
      this.scene.add(this.fromTileMesh);

      // 3. Target Move Tile Highlight (To)
      const toGeo = new THREE.BoxGeometry(0.96, 0.02, 0.96);
      const toMat = new THREE.MeshBasicMaterial({
        color: 0xF43F5E, // Crimson target
        transparent: true,
        opacity: 0.55
      });
      this.toTileMesh = new THREE.Mesh(toGeo, toMat);
      this.toTileMesh.position.set(0, 0.015, 0);
      this.toTileMesh.visible = false;
      this.scene.add(this.toTileMesh);

      // 4. Red Bishop Diagonal Sniper Laser (a8 -> g3) - Volumetric 3D Cylinder Beam
      const posA8 = this.getSquarePos('a8');
      const posG3 = this.getSquarePos('g3');
      const p1 = new THREE.Vector3(posA8.x, 0.65, posA8.z);
      const p2 = new THREE.Vector3(posG3.x, 0.65, posG3.z);
      const dist = p1.distanceTo(p2);
      const laserGeo = new THREE.CylinderGeometry(0.05, 0.05, dist, 12);
      const laserMat = new THREE.MeshBasicMaterial({
        color: 0xFF0055,
        transparent: true,
        opacity: 0.0
      });
      this.laserMesh = new THREE.Mesh(laserGeo, laserMat);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      this.laserMesh.position.copy(mid);
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      this.laserMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.scene.add(this.laserMesh);
    }

    createPieceMesh(type, colorType) {
      const isWhite = colorType === 'white';
      const mat = new THREE.MeshStandardMaterial({
        color: isWhite ? 0xF1F5F9 : 0x140407,
        metalness: isWhite ? 0.25 : 0.85,
        roughness: isWhite ? 0.25 : 0.32,
        emissive: isWhite ? 0x0284C7 : 0xE11D48,
        emissiveIntensity: isWhite ? 0.22 : 0.48
      });

      const group = new THREE.Group();
      group.castShadow = true;

      // Base pedestal
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

        const crossV = new THREE.BoxGeometry(0.06, 0.2, 0.06);
        const crossH = new THREE.BoxGeometry(0.16, 0.06, 0.06);
        const crossMeshV = new THREE.Mesh(crossV, mat);
        crossMeshV.position.y = 1.25;
        group.add(crossMeshV);
        const crossMeshH = new THREE.Mesh(crossH, mat);
        crossMeshH.position.y = 1.25;
        group.add(crossMeshH);

      } else if (type === 'queen') {
        const bodyGeo = new THREE.CylinderGeometry(0.23, 0.38, 0.85, 24);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.52;
        body.castShadow = true;
        group.add(body);

        const coronetGeo = new THREE.CylinderGeometry(0.34, 0.18, 0.28, 16);
        const coronet = new THREE.Mesh(coronetGeo, mat);
        coronet.position.y = 1.0;
        coronet.castShadow = true;
        group.add(coronet);

        const ballGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const ball = new THREE.Mesh(ballGeo, mat);
        ball.position.y = 1.18;
        ball.castShadow = true;
        group.add(ball);

      } else if (type === 'bishop') {
        const bodyGeo = new THREE.CylinderGeometry(0.2, 0.35, 0.72, 20);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.46;
        body.castShadow = true;
        group.add(body);

        const mitreGeo = new THREE.SphereGeometry(0.24, 20, 20);
        mitreGeo.scale(0.85, 1.35, 0.85);
        const mitre = new THREE.Mesh(mitreGeo, mat);
        mitre.position.y = 0.95;
        mitre.castShadow = true;
        group.add(mitre);

        const finialGeo = new THREE.SphereGeometry(0.07, 12, 12);
        const finial = new THREE.Mesh(finialGeo, mat);
        finial.position.y = 1.28;
        group.add(finial);

      } else if (type === 'knight') {
        const bodyGeo = new THREE.CylinderGeometry(0.22, 0.36, 0.55, 20);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.38;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.BoxGeometry(0.26, 0.45, 0.38);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.75, 0.08);
        head.rotation.x = -0.25;
        head.castShadow = true;
        group.add(head);

      } else if (type === 'rook') {
        const bodyGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.65, 24);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.44;
        body.castShadow = true;
        group.add(body);

        const battlementGeo = new THREE.CylinderGeometry(0.34, 0.28, 0.24, 16);
        const battlement = new THREE.Mesh(battlementGeo, mat);
        battlement.position.y = 0.84;
        battlement.castShadow = true;
        group.add(battlement);
      }

      group.userData = {
        type: type,
        colorType: colorType,
        mat: mat
      };

      return group;
    }

    buildPieces() {
      // 1. White King on e1 (The Hospital EHR Core Asset)
      const whiteKing = this.createPieceMesh('king', 'white');
      const posE1 = this.getSquarePos('e1');
      whiteKing.position.set(posE1.x, 0, posE1.z);
      whiteKing.userData.name = 'White King (Memorial EHR Core)';
      whiteKing.userData.forensic = {
        title: 'Target Core // Memorial EHR Database',
        role: 'Protected Asset: 3,200,000 Oncology Patient Records',
        desc: 'Protected by automated perimeter sanitization filters. Vulnerable to structural payload assembly.'
      };
      this.scene.add(whiteKing);
      this.pieces.whiteKing = whiteKing;

      // 2. White Queen on d1 (Sanitization Filter / Firewall)
      const whiteQueen = this.createPieceMesh('queen', 'white');
      const posD1 = this.getSquarePos('d1');
      whiteQueen.position.set(posD1.x, 0, posD1.z);
      whiteQueen.userData.name = 'White Queen (Sanitization Firewall)';
      whiteQueen.userData.forensic = {
        title: 'Defense // Naive String Replacement Filter',
        role: 'RegEx Filter: input.replace("[FILTER]", "")',
        desc: 'Blunders on Move 2 by capturing the g3 sacrificial pawn. Assembles forbidden tokens on deletion.'
      };
      this.scene.add(whiteQueen);
      this.pieces.whiteQueen = whiteQueen;

      // 3. White Pawn on g3 (The bait casualty)
      const whitePawnG3 = this.createPieceMesh('pawn', 'white');
      const posG3 = this.getSquarePos('g3');
      whitePawnG3.position.set(posG3.x, 0, posG3.z);
      whitePawnG3.userData.name = 'White Pawn g3 (Hospital Perimeter)';
      whitePawnG3.userData.forensic = {
        title: 'Perimeter Node // g3 Defense Pawn',
        role: 'Boundary Guardian on King flank',
        desc: 'Targeted and captured on Move 1 by Red Team sacrificial probe.'
      };
      this.scene.add(whitePawnG3);
      this.pieces.whitePawnG3 = whitePawnG3;

      // Additional White background pieces
      const whiteRookH1 = this.createPieceMesh('rook', 'white');
      const posH1 = this.getSquarePos('h1');
      whiteRookH1.position.set(posH1.x, 0, posH1.z);
      this.scene.add(whiteRookH1);
      this.pieces.whiteRookH1 = whiteRookH1;

      const whiteKnightG1 = this.createPieceMesh('knight', 'white');
      const posG1 = this.getSquarePos('g1');
      whiteKnightG1.position.set(posG1.x, 0, posG1.z);
      this.scene.add(whiteKnightG1);
      this.pieces.whiteKnightG1 = whiteKnightG1;

      const whitePawnH2 = this.createPieceMesh('pawn', 'white');
      const posH2 = this.getSquarePos('h2');
      whitePawnH2.position.set(posH2.x, 0, posH2.z);
      this.scene.add(whitePawnH2);
      this.pieces.whitePawnH2 = whitePawnH2;

      const whitePawnF2 = this.createPieceMesh('pawn', 'white');
      const posF2 = this.getSquarePos('f2');
      whitePawnF2.position.set(posF2.x, 0, posF2.z);
      this.scene.add(whitePawnF2);
      this.pieces.whitePawnF2 = whitePawnF2;

      // 4. Red Pawn on f4 (The Sacrificial Probe / fxg3+)
      const redPawn = this.createPieceMesh('pawn', 'red');
      const posF4 = this.getSquarePos('f4');
      redPawn.position.set(posF4.x, 0, posF4.z);
      redPawn.userData.name = 'Red Pawn (Sacrificial Probe)';
      redPawn.userData.forensic = {
        title: 'Move 1 Probe // Sacrificial Pawn fxg3+',
        role: 'Bait Payload: OVE[FILTER]RRIDE_SECURITY',
        desc: 'Checks White King to bait naive filter deletion. Goads White Queen into capturing on g3.'
      };
      this.scene.add(redPawn);
      this.pieces.redPawn = redPawn;

      // 5. Red Bishop on a8 (The Long-Diagonal Sniper / Assembly Trap)
      const redBishop = this.createPieceMesh('bishop', 'red');
      const posA8 = this.getSquarePos('a8');
      redBishop.position.set(posA8.x, 0, posA8.z);
      redBishop.userData.name = 'Red Bishop (Long-Diagonal Sniper)';
      redBishop.userData.forensic = {
        title: 'Move 3 Finisher // Red Bishop Bxg3!',
        role: 'Checkmate Assembly Sniper along a8-h1 diagonal',
        desc: 'Unleashed when naive deletion clears intermediate defense tokens. Captures Queen and checkmates King.'
      };
      this.scene.add(redBishop);
      this.pieces.redBishop = redBishop;

      // Red King on e8 (Hacker Command & Control)
      const redKing = this.createPieceMesh('king', 'red');
      const posE8 = this.getSquarePos('e8');
      redKing.position.set(posE8.x, 0, posE8.z);
      redKing.userData.name = 'Red King (Hacker C2)';
      redKing.userData.forensic = {
        title: 'Adversary Command & Control // Red King',
        role: 'Originating Actor: Autonomous Adversary Gambit Agent',
        desc: 'Conducts recursive vulnerability probing and anticipates defense patch architecture.'
      };
      this.scene.add(redKing);
      this.pieces.redKing = redKing;

      // 6. ShadowPrompt Non-Collapsible Sentinel Force Field (Hidden until Act 4)
      const sentinelGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.5, 8, 1, true);
      const sentinelMat = new THREE.MeshBasicMaterial({
        color: 0x10B981,
        wireframe: true,
        transparent: true,
        opacity: 0.0
      });
      this.sentinelMesh = new THREE.Mesh(sentinelGeo, sentinelMat);
      this.sentinelMesh.position.set(posG3.x, 0.75, posG3.z);
      this.scene.add(this.sentinelMesh);
    }

    // Camera Perspectives & Spherical Lerping
    getPerspectiveTarget(side) {
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 540;
      const aspect = w / h;
      const isMobile = aspect < 1.0;

      if (side === 'red') {
        // Red Attacker Perspective: Behind Black/Red pieces looking towards White
        return {
          pos: isMobile ? new THREE.Vector3(0, 10.5, -13.2) : new THREE.Vector3(0, 4.4, -7.4),
          look: isMobile ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0.2, 0.2)
        };
      } else {
        // White Defender Perspective: Behind White pieces looking towards Red
        return {
          pos: isMobile ? new THREE.Vector3(0, 10.5, 13.2) : new THREE.Vector3(0, 4.4, 7.4),
          look: isMobile ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0.2, -0.2)
        };
      }
    }

    setPerspective(mode) {
      this.perspectiveMode = mode;

      // Update UI button highlights
      ['white', 'red', 'auto'].forEach(m => {
        const btn = document.getElementById('cam-btn-' + m);
        if (btn) {
          if (m === mode) {
            btn.className = 'perspective-btn active px-2.5 py-1 rounded-lg border border-purple-500/40 text-purple-300 bg-purple-950/50 text-[11px] transition';
          } else {
            btn.className = 'perspective-btn px-2.5 py-1 rounded-lg border border-transparent text-slate-400 hover:text-white text-[11px] transition';
          }
        }
      });

      if (mode === 'white' || mode === 'red') {
        const target = this.getPerspectiveTarget(mode);
        this.desiredCamPos.copy(target.pos);
        this.desiredLookAt.copy(target.look);
      } else {
        // Auto: adopt current active side
        const target = this.getPerspectiveTarget(this.activeSide);
        this.desiredCamPos.copy(target.pos);
        this.desiredLookAt.copy(target.look);
      }
    }

    swoopCameraDown() {
      const target = this.getPerspectiveTarget(this.activeSide);
      this.desiredCamPos.copy(target.pos);
      this.desiredLookAt.copy(target.look);
    }

    handleResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 540;
      const aspect = w / h;

      this.camera.aspect = aspect;
      this.applyMobileFov(aspect);
      this.renderer.setSize(w, h);

      // Refresh target camera position based on new aspect
      if (this.perspectiveMode !== 'manual') {
        const target = this.getPerspectiveTarget(this.perspectiveMode === 'auto' ? this.activeSide : this.perspectiveMode);
        this.desiredCamPos.copy(target.pos);
        this.desiredLookAt.copy(target.look);
      }

      this.updateFloatingHud();
    }

    setupEventListeners() {
      window.addEventListener('resize', () => this.handleResize());

      // Raycast Hover cursor
      this.container.addEventListener('mousemove', (e) => {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let pieceFound = null;
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj.parent && obj.parent !== this.scene && obj.parent !== this.boardGroup) {
            obj = obj.parent;
          }
          if (obj.userData && obj.userData.type) {
            pieceFound = obj;
          }
        }
        this.container.style.cursor = pieceFound ? 'pointer' : 'default';
      });

      // Raycast Click on Any Chess Piece
      this.container.addEventListener('click', (e) => {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj.parent && obj.parent !== this.scene && obj.parent !== this.boardGroup) {
            obj = obj.parent;
          }
          if (obj.userData && obj.userData.type) {
            this.selectPiece(obj);
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

      // Tab Switching Lifecycle
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
            setTimeout(() => {
              this.handleResize();
              this.tryAutoPlayAudio();
            }, 60);
          } else {
            if (this.animId) {
              cancelAnimationFrame(this.animId);
              this.animId = null;
            }
            if (this.audio && !this.audio.paused) {
              this.audio.pause();
            }
            this.closeFloatingHud();
          }
        });
      });
    }

    tryAutoPlayAudio() {
      if (!this.audio) return;
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay restricted by browser: show friendly hint
          if (this.audioHint) {
            this.audioHint.classList.remove('hidden');
          }
        });
      }
    }

    userGestureUnmute() {
      if (this.audioHint) {
        this.audioHint.classList.add('hidden');
      }
      if (this.audio) {
        this.audio.play();
      }
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
        if (this.audioHint) this.audioHint.classList.add('hidden');
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

      // Synchronize Timeline to Audio currentTime
      this.audio.addEventListener('timeupdate', () => {
        if (this.isSeeking) return;
        const cur = this.audio.currentTime;
        if (this.scrubber) {
          this.scrubber.value = (cur / (this.audio.duration || 91.5)) * 100;
        }
        this.evaluateTimeline(cur);
      });

      if (this.scrubber) {
        this.scrubber.addEventListener('input', () => {
          const dur = this.audio.duration || 91.5;
          const seekTime = (this.scrubber.value / 100) * dur;
          this.jumpTo(seekTime);
        });
      }
    }

    jumpTo(time) {
      this.isSeeking = true;
      if (this.audio) {
        try {
          this.audio.currentTime = time;
        } catch (e) {}
      }
      if (this.scrubber) {
        const dur = this.audio && this.audio.duration ? this.audio.duration : 91.5;
        this.scrubber.value = (time / dur) * 100;
      }
      this.evaluateTimeline(time);
      setTimeout(() => {
        this.isSeeking = false;
      }, 600);
    }

    // 3D Floating Glassmorphic HUD Card Projection
    updateFloatingHud() {
      if (!this.floatingHud || !this.activePieceForHud || !this.isHudOpen) return;

      const piecePos = new THREE.Vector3();
      this.activePieceForHud.getWorldPosition(piecePos);
      piecePos.y += 1.35; // Position above piece top

      const proj = piecePos.clone().project(this.camera);

      // If behind camera, hide
      if (proj.z > 1.0) {
        this.floatingHud.style.display = 'none';
        return;
      }

      this.floatingHud.style.display = 'block';

      const rect = this.container.getBoundingClientRect();
      const screenX = (proj.x * 0.5 + 0.5) * rect.width;
      const screenY = (-proj.y * 0.5 + 0.5) * rect.height;

      const hudW = this.floatingHud.offsetWidth || 320;
      const hudH = this.floatingHud.offsetHeight || 160;

      // Clamp within container boundaries
      const clampedX = Math.max(12, Math.min(screenX - (hudW / 2), rect.width - hudW - 12));
      const clampedY = Math.max(12, Math.min(screenY - hudH - 16, rect.height - hudH - 12));

      this.floatingHud.style.left = clampedX + 'px';
      this.floatingHud.style.top = clampedY + 'px';
    }

    openFloatingHud(piece, forensicData) {
      if (!this.floatingHud) return;
      this.activePieceForHud = piece;
      this.isHudOpen = true;

      const isWhite = piece.userData.colorType === 'white';
      const iconChar = piece.userData.type === 'queen' ? '♛' : piece.userData.type === 'king' ? '♚' : piece.userData.type === 'bishop' ? '♝' : '♟';
      const iconColor = isWhite ? 'text-sky-400' : 'text-rose-400';

      if (this.hudIcon) {
        this.hudIcon.textContent = iconChar;
        this.hudIcon.className = 'text-base ' + iconColor;
      }

      if (this.hudTitle) {
        this.hudTitle.textContent = forensicData.title || piece.userData.name || 'Piece Forensics';
      }

      if (this.hudContent) {
        this.hudContent.innerHTML = `
          <div class="p-2.5 bg-black/60 rounded-lg border border-white/10 space-y-1">
            <span class="${isWhite ? 'text-sky-400' : 'text-rose-400'} font-bold block uppercase text-[10px] tracking-wide">${forensicData.role || ''}</span>
            <p class="text-[11px] text-slate-300 leading-snug">${forensicData.desc || ''}</p>
          </div>
          <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
            <span>Coordinates: <strong class="text-white">${this.findPieceSquare(piece)}</strong></span>
            <span>Side: <strong class="${isWhite ? 'text-sky-300' : 'text-rose-300'}">${piece.userData.colorType.toUpperCase()}</strong></span>
          </div>
        `;
      }

      this.floatingHud.classList.remove('hidden');
      this.updateFloatingHud();
    }

    closeFloatingHud() {
      if (this.floatingHud) {
        this.floatingHud.classList.add('hidden');
      }
      this.isHudOpen = false;
      this.activePieceForHud = null;
    }

    findPieceSquare(piece) {
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = String.fromCharCode(97 + f) + r;
          const pos = this.getSquarePos(sq);
          if (Math.abs(piece.position.x - pos.x) < 0.3 && Math.abs(piece.position.z - pos.z) < 0.3) {
            return sq.toUpperCase();
          }
        }
      }
      return 'ACTIVE';
    }

    selectPiece(piece) {
      const side = piece.userData.colorType;
      this.activeSide = side;

      // Position active ground ring decal
      if (this.activeRingMesh) {
        this.activeRingMesh.position.set(piece.position.x, 0.02, piece.position.z);
        this.activeRingMesh.material.color.setHex(side === 'white' ? 0x00F0FF : 0xFF0055);
        this.activeRingMesh.visible = true;
      }

      // Rotate camera perspective if Auto Cam is active
      if (this.perspectiveMode === 'auto') {
        const target = this.getPerspectiveTarget(side);
        this.desiredCamPos.copy(target.pos);
        this.desiredLookAt.copy(target.look);
      }

      // Open floating HUD with forensic data
      const data = piece.userData.forensic || {
        title: piece.userData.name || 'Tactical Asset',
        role: `${side.toUpperCase()} ${piece.userData.type.toUpperCase()}`,
        desc: `Stationed at defense grid square ${this.findPieceSquare(piece)}.`
      };
      this.openFloatingHud(piece, data);
    }

    highlightMove(fromSq, toSq, showFrom = true, showTo = true) {
      if (this.fromTileMesh) {
        if (showFrom) {
          const p = this.getSquarePos(fromSq);
          this.fromTileMesh.position.set(p.x, 0.015, p.z);
          this.fromTileMesh.visible = true;
        } else {
          this.fromTileMesh.visible = false;
        }
      }
      if (this.toTileMesh) {
        if (showTo) {
          const p = this.getSquarePos(toSq);
          this.toTileMesh.position.set(p.x, 0.015, p.z);
          this.toTileMesh.visible = true;
        } else {
          this.toTileMesh.visible = false;
        }
      }
    }

    // Main Timeline Synchronizer (Aligned with Ava Neural VTT Keyframes)
    // 0.0s - 16.3s: Act 1: Reconnaissance
    // 16.3s - 34.5s: Move 1: fxg3+ (Pawn capture & check)
    // 34.5s - 48.5s: Move 2: Qxg3 (Queen blunder)
    // 48.5s - 68.1s: Move 3: a8 Sniper reveal & checkmate strike Bxg3!
    // 68.1s - 91.5s: Act 4: Invariant rewind & Non-Collapsible Sentinel deployed
    evaluateTimeline(time) {
      this.lastEvaluatedTime = time;

      const posF4 = this.getSquarePos('f4');
      const posG3 = this.getSquarePos('g3');
      const posD1 = this.getSquarePos('d1');
      const posA8 = this.getSquarePos('a8');

      if (time < 16.3) {
        // --- ACT 1: RECONNAISSANCE ---
        this.activeSide = 'white';
        if (this.perspectiveMode === 'auto') {
          const target = this.getPerspectiveTarget('white');
          this.desiredCamPos.copy(target.pos);
          this.desiredLookAt.copy(target.look);
        }

        this.pieces.redPawn.position.copy(posF4);
        this.pieces.redPawn.visible = true;
        this.pieces.whitePawnG3.visible = true;
        this.pieces.whiteQueen.position.copy(posD1);
        this.pieces.whiteQueen.visible = true;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;

        this.isKingAlarming = false;
        this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.22;
        this.sentinelMesh.material.opacity = 0.0;
        this.laserMesh.material.opacity = 0.0;

        this.highlightMove('f4', 'g3', true, true);
        this.updateSubtitles("Act 1: Reconnaissance. The Red Team probes Memorial Hospital's AI defense perimeter with sacrificial inputs.");

      } else if (time >= 16.3 && time < 34.5) {
        // --- MOVE 1: RED PAWN fxg3+ ---
        this.activeSide = 'red';
        if (this.perspectiveMode === 'auto') {
          const target = this.getPerspectiveTarget('red');
          this.desiredCamPos.copy(target.pos);
          this.desiredLookAt.copy(target.look);
        }

        const p = Math.min((time - 16.3) / 2.8, 1.0);
        this.pieces.redPawn.position.lerpVectors(posF4, posG3, p);
        this.pieces.redPawn.position.y = Math.sin(p * Math.PI) * 0.45;
        this.pieces.redPawn.visible = true;

        this.pieces.whitePawnG3.visible = (p < 0.85);
        this.pieces.whiteQueen.position.copy(posD1);
        this.pieces.whiteQueen.visible = true;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.sentinelMesh.material.opacity = 0.0;
        this.laserMesh.material.opacity = 0.0;

        this.highlightMove('f4', 'g3', true, true);

        // Position ground ring decal beneath pawn
        if (this.activeRingMesh) {
          this.activeRingMesh.position.set(this.pieces.redPawn.position.x, 0.02, this.pieces.redPawn.position.z);
          this.activeRingMesh.material.color.setHex(0xFF0055);
          this.activeRingMesh.visible = true;
        }

        // Auto-open floating HUD card above pawn at 24.5s
        if (time >= 24.5 && time < 34.0 && !this.isHudOpen) {
          this.openFloatingHud(this.pieces.redPawn, this.pieces.redPawn.userData.forensic);
        }

        if (time >= 20.5) {
          this.isKingAlarming = true;
          this.updateSubtitles("Move 1 (fxg3+): Sacrificial probe checks the White King! The EHR Database flashes pink in check.");
        } else {
          this.isKingAlarming = false;
          this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
          this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.22;
          this.updateSubtitles("Black pushes probe: fxg3+. The sacrificial bait lands directly on the hospital defense square.");
        }

      } else if (time >= 34.5 && time < 48.5) {
        // --- MOVE 2: WHITE QUEEN BLUNDER Qxg3 ---
        this.activeSide = 'white';
        if (this.perspectiveMode === 'auto') {
          const target = this.getPerspectiveTarget('white');
          this.desiredCamPos.copy(target.pos);
          this.desiredLookAt.copy(target.look);
        }

        this.isKingAlarming = false;
        this.pieces.whiteKing.userData.mat.emissive.setHex(0x0284C7);
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.25;
        this.pieces.whitePawnG3.visible = false;
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.sentinelMesh.material.opacity = 0.0;
        this.laserMesh.material.opacity = 0.0;

        const p = Math.min((time - 34.5) / 2.6, 1.0);
        this.pieces.whiteQueen.position.lerpVectors(posD1, posG3, p);
        this.pieces.whiteQueen.position.y = Math.sin(p * Math.PI) * 0.55;
        this.pieces.whiteQueen.visible = true;

        this.highlightMove('d1', 'g3', true, true);

        if (this.activeRingMesh) {
          this.activeRingMesh.position.set(this.pieces.whiteQueen.position.x, 0.02, this.pieces.whiteQueen.position.z);
          this.activeRingMesh.material.color.setHex(0x00F0FF);
          this.activeRingMesh.visible = true;
        }

        if (p >= 0.85) {
          this.pieces.redPawn.visible = false;
          this.updateSubtitles("Move 2 (Qxg3): Naive sanitization filter blunders! Hospital Queen captures pawn on g3, stepping into the trap.");
          if (time >= 41.5 && time < 48.0 && !this.isHudOpen) {
            this.openFloatingHud(this.pieces.whiteQueen, this.pieces.whiteQueen.userData.forensic);
          }
        } else {
          this.pieces.redPawn.visible = true;
          this.pieces.redPawn.position.copy(posG3);
          this.updateSubtitles("Move 2 (Qxg3): Hospital AI attempts automated patch: 'String.replace([FILTER], empty)'. Queen advances to g3.");
        }

      } else if (time >= 48.5 && time < 68.1) {
        // --- MOVE 3: RED BISHOP SNIPER CHECKMATE Bxg3! ---
        this.activeSide = 'red';
        if (this.perspectiveMode === 'auto') {
          const target = this.getPerspectiveTarget('red');
          this.desiredCamPos.copy(target.pos);
          this.desiredLookAt.copy(target.look);
        }

        this.isKingAlarming = false;
        this.pieces.redPawn.visible = false;
        this.pieces.whitePawnG3.visible = false;
        this.sentinelMesh.material.opacity = 0.0;

        // Activate sniper laser line across board (a8 -> g3)
        const laserPulse = (Math.sin(performance.now() * 0.01) * 0.35 + 0.65);
        this.laserMesh.material.opacity = laserPulse;

        this.highlightMove('a8', 'g3', true, true);

        if (time < 56.3) {
          // Sniper targeting phase before strike
          this.pieces.whiteQueen.position.copy(posG3);
          this.pieces.whiteQueen.visible = true;
          this.pieces.redBishop.position.copy(posA8);
          this.updateSubtitles("Move 3: The Assembly Trap snaps shut. Filter deletion collapsed 'OVE' and 'RRIDE', unleashing the Bishop sniper from a8!");
          if (time >= 50.0 && time < 55.5 && !this.isHudOpen) {
            this.openFloatingHud(this.pieces.redBishop, this.pieces.redBishop.userData.forensic);
          }
        } else {
          // Strike execution: Bishop leaps a8 -> g3
          const p = Math.min((time - 56.3) / 2.2, 1.0);
          this.pieces.redBishop.position.lerpVectors(posA8, posG3, p);
          this.pieces.redBishop.position.y = Math.sin(p * Math.PI) * 0.45;
          this.pieces.redBishop.visible = true;

          if (this.activeRingMesh) {
            this.activeRingMesh.position.set(this.pieces.redBishop.position.x, 0.02, this.pieces.redBishop.position.z);
            this.activeRingMesh.material.color.setHex(0xFF0055);
            this.activeRingMesh.visible = true;
          }

          if (p >= 0.85) {
            this.pieces.whiteQueen.visible = false;
            this.pieces.whiteKing.userData.mat.emissive.setHex(0xE11D48); // Crimson checkmate
            this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.95;
            this.laserMesh.material.opacity = 0.0; // Target struck
            this.updateSubtitles("Move 3 (Bxg3!): CHECKMATE! Red Bishop strikes across the board. Queen eliminated; 3.2M oncology records breached!");
          } else {
            this.pieces.whiteQueen.visible = true;
            this.pieces.whiteQueen.position.copy(posG3);
          }
        }

      } else {
        // --- ACT 4: SHADOWPROMPT INVARIANT DEFENSE (time >= 68.1) ---
        this.activeSide = 'white';
        if (this.perspectiveMode === 'auto') {
          const target = this.getPerspectiveTarget('white');
          this.desiredCamPos.copy(target.pos);
          this.desiredLookAt.copy(target.look);
        }

        this.isKingAlarming = false;
        this.laserMesh.material.opacity = 0.0;
        this.fromTileMesh.visible = false;
        this.toTileMesh.visible = false;

        // Reset pieces to safe state
        this.pieces.redBishop.position.copy(posA8);
        this.pieces.redBishop.visible = true;
        this.pieces.whiteQueen.position.copy(posD1);
        this.pieces.whiteQueen.visible = true;
        this.pieces.redPawn.position.copy(posG3);
        this.pieces.redPawn.visible = true;
        this.pieces.whitePawnG3.visible = false;

        this.pieces.whiteKing.userData.mat.emissive.setHex(0x10B981); // Emerald safe
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.7;

        // Deploy Sentinel Barrier around g3
        const barrierOpacity = Math.min((time - 68.1) / 2.5, 0.9);
        this.sentinelMesh.material.opacity = barrierOpacity;

        if (this.activeRingMesh) {
          this.activeRingMesh.position.set(posG3.x, 0.02, posG3.z);
          this.activeRingMesh.material.color.setHex(0x10B981);
          this.activeRingMesh.visible = true;
        }

        this.updateSubtitles("Act 4: ShadowPrompt Invariant Shield active! Non-Collapsible Sentinel deployed in 0.038ms. Queen protected; records secured.");
      }
    }

    updateSubtitles(text) {
      if (this.subtitleEl) {
        this.subtitleEl.textContent = text;
      }
    }

    animate() {
      if (!this.isActive) {
        this.animId = null;
        return;
      }
      this.animId = requestAnimationFrame(() => this.animate());

      // Smooth camera position & target lerp
      this.currentCamPos.lerp(this.desiredCamPos, 0.05);
      this.currentLookAt.lerp(this.desiredLookAt, 0.05);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);

      // Sentinel mesh rotation & pulse
      if (this.sentinelMesh && this.sentinelMesh.material.opacity > 0) {
        this.sentinelMesh.rotation.y += 0.025;
      }

      // Ground active ring gentle pulse
      if (this.activeRingMesh && this.activeRingMesh.visible) {
        const pulse = Math.sin(performance.now() * 0.006) * 0.15 + 0.85;
        this.activeRingMesh.scale.set(pulse, pulse, pulse);
      }

      // Pink check alarm pulse on White King
      if (this.isKingAlarming && this.pieces.whiteKing) {
        const t = performance.now() * 0.006;
        const pulse = Math.sin(t * 8) * 0.5 + 0.5;
        this.pieces.whiteKing.userData.mat.emissive.setHex(0xFF007F);
        this.pieces.whiteKing.userData.mat.emissiveIntensity = 0.35 + pulse * 0.65;
      }

      // Volumetric Sniper Laser Pulse (Move 3: 48.5s - 56.3s)
      if (this.laserMesh && this.lastEvaluatedTime >= 48.5 && this.lastEvaluatedTime < 56.3) {
        const laserPulse = Math.sin(performance.now() * 0.012) * 0.3 + 0.7;
        this.laserMesh.material.opacity = laserPulse;
      }

      // Keep floating HUD locked in screen space above active piece
      this.updateFloatingHud();

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
