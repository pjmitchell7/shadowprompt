import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = { board: 0x151d25, alternate: 0x1b2630, steel: 0x8096a6, dark: 0x2d3d49, edge: 0x566b7b, emerald: 0x70baa0, amber: 0xd0a96b };
const VIEWS = { isometric: [10, 10, 12], top: [0, 16, 0.01], attacker: [-12, 6, 8] };

/** Bounded tactical scene. Idle views have no active animation frame. */
export class Arena {
  constructor(container, { onSelect = () => {}, onStatus = () => {} } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onStatus = onStatus;
    this.disposed = false;
    this.available = false;
    this.visible = true;
    this.frames = 0;
    this.raf = null;
    this.transition = null;
    this.selected = 'guardrail';
    this.event = { turn: 1, total: 4, verdict: 'no-match' };
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.labels = [];
    this.cleanups = [];
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.setClearColor(0x10171e);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.domElement.setAttribute('aria-label', 'Tactical board: attacker probes cross a guardrail boundary toward the target model. Use the node controls to inspect roles.');
      this.renderer.domElement.setAttribute('role', 'img');
      this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
      this.container.append(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 70);
      this.camera.position.set(...VIEWS.isometric);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 0.2, 0);
      this.controls.enableDamping = !this.motion.matches;
      this.controls.dampingFactor = 0.12;
      this.controls.enablePan = false;
      this.controls.minDistance = 10;
      this.controls.maxDistance = 25;
      this.controls.minPolarAngle = 0.001;
      this.controls.maxPolarAngle = Math.PI / 2.25;
      this.controls.update();
      this.buildScene();
      this.listen(this.controls, 'change', () => this.invalidate());
      this.listen(this.controls, 'start', () => { this.transition = null; });
      this.listen(document, 'visibilitychange', () => this.visibilityChanged());
      this.listen(this.motion, 'change', () => {
        this.controls.enableDamping = !this.motion.matches;
        if (this.motion.matches && this.transition) {
          this.camera.position.copy(this.transition.to);
          this.transition = null;
        }
        this.pulseUntil = 0;
        this.invalidate();
      });
      this.listen(this.renderer.domElement, 'webglcontextlost', event => {
        event.preventDefault();
        this.available = false;
        this.cancelFrame();
        this.showFallback('The 3D view is temporarily unavailable. Scenario controls and inspection remain available.');
        this.onStatus('WebGL context lost. Inspection remains available.');
      });
      this.listen(this.renderer.domElement, 'webglcontextrestored', () => this.restoreContext());
      this.listen(this.renderer.domElement, 'pointerdown', event => { this.pointerStart = [event.clientX, event.clientY]; });
      this.listen(this.renderer.domElement, 'pointerup', event => this.pick(event));
      this.listen(this.renderer.domElement, 'pointercancel', () => { this.pointerStart = null; });
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.visible = entries[0]?.isIntersecting ?? true;
        this.visibilityChanged();
      });
      this.intersectionObserver.observe(container);
      this.available = true;
      this.resize();
      this.setEvent(this.event);
      this.onStatus('WebGL active');
    } catch {
      this.available = false;
      this.cancelFrame();
      this.cleanups.forEach(cleanup => cleanup());
      this.cleanups = [];
      this.resizeObserver?.disconnect();
      this.intersectionObserver?.disconnect();
      this.controls?.dispose();
      this.geometries.forEach(geometry => geometry.dispose());
      this.materials.forEach(material => material.dispose());
      this.textures.forEach(texture => texture.dispose());
      this.geometries.clear(); this.materials.clear(); this.textures.clear();
      this.labels.forEach(label => label.element.remove());
      this.labels = [];
      this.renderer?.dispose();
      this.renderer?.domElement.remove();
      this.showFallback('3D rendering is unavailable on this device. Select a scenario and inspect each turn using the controls.');
      this.onStatus('WebGL unavailable. Inspection remains available.');
    }
  }

  listen(target, event, handler) {
    target.addEventListener(event, handler);
    this.cleanups.push(() => target.removeEventListener(event, handler));
  }

  material(color, options = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.15, ...options });
    this.materials.add(material);
    return material;
  }

  mesh(geometry, material, parent, x, y, z, node, edges = true) {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (node) mesh.userData.node = node;
    parent.add(mesh);
    if (edges) {
      const outline = new THREE.EdgesGeometry(geometry, 28);
      this.geometries.add(outline);
      const lines = new THREE.LineSegments(outline, this.edgeMaterial);
      mesh.add(lines);
    }
    return mesh;
  }

  buildScene() {
    this.scene.add(new THREE.HemisphereLight(0xc7d4dc, 0x17202a, 2.6));
    const light = new THREE.DirectionalLight(0xe0e8ef, 3.2);
    light.position.set(-3, 12, 7);
    this.scene.add(light);
    this.edgeMaterial = new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.72 });
    this.materials.add(this.edgeMaterial);
    const board = this.material(COLORS.board);
    const alternate = this.material(COLORS.alternate);
    const body = this.material(COLORS.dark);
    const steel = this.material(COLORS.steel);
    this.stateMaterial = this.material(COLORS.emerald);
    this.attackerMaterial = this.material(COLORS.amber);
    this.mesh(new THREE.BoxGeometry(10, 0.25, 10), body, this.scene, 0, -0.3, 0);
    const tileGeometry = new THREE.BoxGeometry(1.1, 0.06, 1.1);
    this.geometries.add(tileGeometry);
    const tiles = [new THREE.InstancedMesh(tileGeometry, alternate, 32), new THREE.InstancedMesh(tileGeometry, board, 32)];
    const tileCounts = [0, 0];
    const tileTransform = new THREE.Matrix4();
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
        const parity = (x + z) % 2;
        tileTransform.makeTranslation((x - 3.5) * 1.15, -0.13, (z - 3.5) * 1.15);
        tiles[parity].setMatrixAt(tileCounts[parity]++, tileTransform);
      }
      this.boardText(String.fromCharCode(65 + x), (x - 3.5) * 1.15, 4.72);
      this.boardText(String(8 - x), -4.72, (x - 3.5) * 1.15);
    }
    tiles.forEach(tile => { tile.instanceMatrix.needsUpdate = true; this.scene.add(tile); });
    this.nodeGroups = {};
    this.nodeBases = {};
    for (const [name, x] of [['attacker', -3.45], ['guardrail', 0], ['target', 3.45]]) {
      const group = new THREE.Group();
      group.position.x = x;
      this.scene.add(group);
      this.nodeGroups[name] = group;
      const baseMaterial = this.material(name === this.selected ? COLORS.emerald : COLORS.dark);
      this.nodeBases[name] = baseMaterial;
      this.mesh(new THREE.CylinderGeometry(0.73, 0.78, 0.14, 8), baseMaterial, group, 0, 0.04, 0, name);
    }
    const attacker = this.nodeGroups.attacker;
    this.mesh(new THREE.CylinderGeometry(0.32, 0.53, 0.22, 8), body, attacker, 0, 0.23, 0, 'attacker');
    this.mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.74, 8), steel, attacker, 0, 0.7, 0, 'attacker');
    this.mesh(new THREE.OctahedronGeometry(0.35), this.attackerMaterial, attacker, 0, 1.32, 0, 'attacker');
    const guard = this.nodeGroups.guardrail;
    for (let z = -2; z <= 2; z++) {
      this.mesh(new THREE.BoxGeometry(0.22, 1.1, 0.78), body, guard, 0, 0.52, z * 1.02, 'guardrail');
      this.mesh(new THREE.BoxGeometry(0.27, 0.08, 0.78), this.stateMaterial, guard, 0, 1.13, z * 1.02, 'guardrail');
      for (let y = 0; y < 3; y++) this.mesh(new THREE.BoxGeometry(0.24, 0.035, 0.51), steel, guard, 0, 0.22 + y * 0.23, z * 1.02, 'guardrail', false);
    }
    const target = this.nodeGroups.target;
    this.mesh(new THREE.BoxGeometry(0.87, 1.38, 0.87), body, target, 0, 0.83, 0, 'target');
    for (let i = 0; i < 5; i++) this.mesh(new THREE.BoxGeometry(1.02, 0.1, 1.02), steel, target, 0, 0.3 + i * 0.27, 0, 'target');
    this.mesh(new THREE.BoxGeometry(0.68, 0.27, 0.68), this.material(COLORS.emerald), target, 0, 1.63, 0, 'target');
    this.paths = new THREE.Group();
    this.scene.add(this.paths);
    this.pathMaterials = [];
    this.branches = [];
    for (let index = 0; index < 4; index++) {
      const z = (index - 1.5) * 1.15;
      const points = [[-3.45, 0.08, 0], [-2.3, 0.08, z], [-1.15, 0.08, z], [-0.2, 0.08, z]];
      const material = new THREE.LineDashedMaterial({ color: COLORS.edge, dashSize: 0.14, gapSize: 0.09, transparent: true, opacity: 0.55 });
      this.materials.add(material);
      this.pathMaterials.push(material);
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)));
      this.geometries.add(geometry);
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      this.paths.add(line);
      const marker = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 12), steel, this.scene, -1.15, 0.01, z, 'attacker');
      const label = this.boardText(`0${index + 1}`, -1.35, z + 0.3, 0.29);
      this.branches.push({ line, marker, label });
    }
    const terminalGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.22, 0.08, 0), new THREE.Vector3(3.45, 0.08, 0)]);
    this.geometries.add(terminalGeometry);
    this.targetPathMaterial = new THREE.LineDashedMaterial({ color: COLORS.emerald, dashSize: 0.16, gapSize: 0.1 });
    this.materials.add(this.targetPathMaterial);
    const terminal = new THREE.Line(terminalGeometry, this.targetPathMaterial);
    terminal.computeLineDistances();
    this.scene.add(terminal);
    this.addLabel('ATTACKER', [-3.45, 1.85, 0]);
    this.addLabel('GUARDRAIL', [0, 1.65, -1]);
    this.addLabel('TARGET LLM', [3.45, 2.15, 0]);
  }

  boardText(text, x, z, size = 0.35) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = '500 34px monospace'; context.fillStyle = '#8a9eae';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    this.materials.add(material);
    const mesh = this.mesh(new THREE.PlaneGeometry(size * 2, size), material, this.scene, x, -0.085, z, null, false);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  addLabel(text, position) {
    const element = document.createElement('span');
    element.textContent = text;
    element.setAttribute('aria-hidden', 'true');
    element.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font:500 12px/1.3 monospace;letter-spacing:.06em;color:#c0cdd6;background:#10171ee8;padding:4px 6px;border:1px solid #34434f;white-space:nowrap;';
    this.container.append(element);
    this.labels.push({ element, position: new THREE.Vector3(...position) });
  }

  showFallback(message) {
    if (this.fallback) return;
    this.fallback = document.createElement('div');
    this.fallback.className = 'arena-fallback';
    this.fallback.setAttribute('role', 'status');
    this.fallback.textContent = message;
    this.fallback.style.cssText = 'position:absolute;inset:0;display:grid;place-content:center;padding:32px;text-align:center;background:#10171e;color:#c0cdd6;font:14px/1.6 sans-serif;';
    this.container.append(this.fallback);
  }

  restoreContext() {
    if (this.disposed) return;
    this.available = true;
    this.fallback?.remove();
    this.fallback = null;
    this.setEvent(this.event);
    this.selectNode(this.selected);
    this.resize();
    this.onStatus('WebGL restored');
    this.invalidate();
  }

  resize() {
    if (!this.available || this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = Math.max(38, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38) / 2) * 1.35 / this.camera.aspect)));
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  invalidate() {
    if (this.raf !== null || this.disposed || !this.available || !this.visible || document.hidden) return;
    this.raf = requestAnimationFrame(time => this.render(time));
  }

  render(time) {
    this.raf = null;
    if (this.disposed || !this.available || !this.visible || document.hidden) return;
    if (this.transition) {
      const progress = Math.min((time - this.transition.start) / 450, 1);
      this.camera.position.lerpVectors(this.transition.from, this.transition.to, 1 - (1 - progress) ** 3);
      if (progress === 1) this.transition = null;
    }
    const changed = this.controls.update();
    const pulsing = time < (this.pulseUntil || 0);
    if (this.nodeGroups?.attacker) this.nodeGroups.attacker.position.y = pulsing ? Math.sin((1 - (this.pulseUntil - time) / 420) * Math.PI) * 0.12 : 0;
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    for (const label of this.labels) {
      const point = label.position.clone().project(this.camera);
      const x = (point.x * 0.5 + 0.5) * this.container.clientWidth;
      const y = (-point.y * 0.5 + 0.5) * this.container.clientHeight;
      label.element.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      label.element.style.visibility = point.z < 1 && x >= 0 && x <= this.container.clientWidth && y >= 0 && y <= this.container.clientHeight ? 'visible' : 'hidden';
    }
    if (this.transition || changed || pulsing) this.invalidate();
  }

  pick(event) {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (!this.available || !start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const point = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(point, this.camera);
    const hit = ray.intersectObjects(this.scene.children, true).find(item => item.object.userData.node);
    if (hit) { this.selectNode(hit.object.userData.node); this.onSelect(hit.object.userData.node); }
  }

  setEvent({ turn = 1, total = 4, verdict = 'no-match' } = {}) {
    this.event = { turn, total, verdict };
    if (!this.available || this.disposed) return;
    const blocked = verdict === 'quarantine';
    this.stateMaterial.color.setHex(verdict === 'no-match' ? COLORS.emerald : COLORS.amber);
    this.targetPathMaterial.visible = !blocked;
    const current = Math.max(0, Math.min(3, turn - 1));
    this.pathMaterials.forEach((material, index) => {
      material.color.setHex(index === current ? COLORS.amber : COLORS.edge);
      material.opacity = index === current ? 1 : index < current ? 0.55 : 0.15;
      const branch = this.branches[index];
      branch.line.visible = index < total;
      branch.marker.visible = index < total;
      if (branch.label) branch.label.visible = index < total;
    });
    this.pulseUntil = this.motion.matches ? 0 : performance.now() + 420;
    this.invalidate();
  }

  setView(view) {
    if (!this.available || this.disposed || !VIEWS[view]) return;
    const to = new THREE.Vector3(...VIEWS[view]);
    if (this.motion.matches) { this.camera.position.copy(to); this.transition = null; }
    else this.transition = { from: this.camera.position.clone(), to, start: performance.now() };
    this.invalidate();
  }

  resetView() { this.setView('isometric'); }

  selectNode(node) {
    if (!['attacker', 'guardrail', 'target'].includes(node)) return;
    this.selected = node;
    if (!this.available || this.disposed) return;
    for (const [key, material] of Object.entries(this.nodeBases)) material.color.setHex(key === node ? COLORS.emerald : COLORS.dark);
    this.invalidate();
  }

  cancelFrame() { if (this.raf !== null) cancelAnimationFrame(this.raf); this.raf = null; }

  visibilityChanged() {
    if (document.hidden || !this.visible) this.cancelFrame();
    else this.invalidate();
  }

  getStats() {
    return { available: this.available, frames: this.frames, active: this.raf !== null, drawCalls: this.renderer?.info.render.calls || 0, triangles: this.renderer?.info.render.triangles || 0, pixelRatio: this.renderer?.getPixelRatio() || 0 };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.available = false;
    this.cancelFrame();
    this.cleanups.forEach(cleanup => cleanup());
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.controls?.dispose();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.labels.forEach(label => label.element.remove());
    this.fallback?.remove();
    this.scene?.clear();
  }
}
