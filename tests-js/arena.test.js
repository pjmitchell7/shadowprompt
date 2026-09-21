import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena } from '../src/arena.js';

test('context restoration reapplies verdict and selection changed while unavailable', () => {
  const arena = Object.create(Arena.prototype);
  const stateMaterial = new THREE.MeshStandardMaterial({ color: 0x70baa0 });
  const targetPathMaterial = new THREE.LineDashedMaterial();
  const pathMaterials = Array.from({ length: 4 }, () => new THREE.LineDashedMaterial());
  const nodeBases = Object.fromEntries(['attacker', 'guardrail', 'target'].map(node => [node, new THREE.MeshStandardMaterial({ color: node === 'guardrail' ? 0x70baa0 : 0x2d3d49 })]));
  let removed = false;
  let rendered = false;
  let size = null;
  let status = null;
  Object.assign(arena, {
    available: false, disposed: false, selected: 'guardrail',
    event: { turn: 1, total: 4, verdict: 'no-match' },
    stateMaterial, targetPathMaterial, pathMaterials, nodeBases,
    branches: Array.from({ length: 4 }, () => ({ line: new THREE.Object3D(), marker: new THREE.Object3D(), label: new THREE.Object3D() })),
    motion: { matches: true },
    fallback: { remove() { removed = true; } },
    container: { clientWidth: 360, clientHeight: 400 },
    camera: new THREE.PerspectiveCamera(38, 2, 0.1, 70),
    renderer: { setSize(...args) { size = args; } },
    invalidate() { rendered = true; },
    onStatus(message) { status = message; },
  });
  try {
    arena.setEvent({ turn: 2, total: 3, verdict: 'quarantine' });
    arena.selectNode('attacker');
    assert.equal(stateMaterial.color.getHex(), 0x70baa0);
    assert.equal(targetPathMaterial.visible, true);
    assert.equal(nodeBases.guardrail.color.getHex(), 0x70baa0);
    assert.equal(rendered, false);

    arena.restoreContext();

    assert.equal(arena.available, true);
    assert.equal(stateMaterial.color.getHex(), 0xd0a96b);
    assert.equal(targetPathMaterial.visible, false);
    assert.equal(pathMaterials[1].opacity, 1);
    assert.equal(arena.branches[3].line.visible, false);
    assert.equal(arena.branches[3].marker.visible, false);
    assert.equal(arena.branches[3].label.visible, false);
    assert.equal(nodeBases.attacker.color.getHex(), 0x70baa0);
    assert.equal(nodeBases.guardrail.color.getHex(), 0x2d3d49);
    assert.deepEqual(size, [360, 400, false]);
    assert.equal(arena.camera.aspect, 0.9);
    assert.equal(removed, true);
    assert.equal(arena.fallback, null);
    assert.equal(status, 'WebGL restored');
    assert.equal(rendered, true);
  } finally {
    [stateMaterial, targetPathMaterial, ...pathMaterials, ...Object.values(nodeBases)].forEach(material => material.dispose());
  }
});

test('late context restoration cannot reactivate a disposed arena', () => {
  const arena = Object.create(Arena.prototype);
  Object.assign(arena, { disposed: true, available: false });
  assert.doesNotThrow(() => arena.restoreContext());
  assert.equal(arena.available, false);
});
