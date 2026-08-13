import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { X, Maximize2, Minimize2 } from "lucide-react";
import BiKpiCard from "./BiKpiCard";

const YARD_POS = new THREE.Vector3(25, 0, 0);
/** Local offsets of yard entry gates (west side, facing Farm / Centers). */
const GATE_VEHICLES_LOCAL = new THREE.Vector3(-18, 0, -14);
const CENTER_VEHICLES_LOCAL = new THREE.Vector3(-18, 0, 14);

const NODES_META = {
  farm: { id: "farm", label: "Farm", pos: new THREE.Vector3(-55, 0, -35) },
  center: { id: "center", label: "Collection Centers", pos: new THREE.Vector3(-25, 0, 32) },
  yard: { id: "yard", label: "Yard", pos: YARD_POS.clone() },
  gateVehicles: {
    id: "gateVehicles",
    label: "Gate Vehicles",
    pos: YARD_POS.clone().add(GATE_VEHICLES_LOCAL),
  },
  centerVehiclesGate: {
    id: "centerVehiclesGate",
    label: "Center Vehicles",
    pos: YARD_POS.clone().add(CENTER_VEHICLES_LOCAL),
  },
  mill: { id: "mill", label: "Mill Premise", pos: new THREE.Vector3(105, 0, 0) },
};

/** Entry gate booth + boom barrier for Yard. */
function createYardEntryGate(label, accent = 0xf59e0b) {
  const g = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.25, roughness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.4 });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 8), concrete);
  pad.position.y = 0.1;
  pad.receiveShadow = true;
  g.add(pad);

  // Twin pillars
  [-2.2, 2.2].forEach((z) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.2, 0.55), concrete);
    pillar.position.set(-0.5, 2.2, z);
    pillar.castShadow = true;
    g.add(pillar);
  });

  // Cross beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 5.2), accentMat);
  beam.position.set(-0.5, 4.2, 0);
  beam.castShadow = true;
  g.add(beam);

  // Boom arm
  const boom = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 0.18), accentMat);
  boom.position.set(2.2, 2.4, 0);
  boom.castShadow = true;
  g.add(boom);
  const boomTip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), metal);
  boomTip.position.set(4.9, 2.4, 0);
  g.add(boomTip);

  // Guard cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.2), concrete);
  cabin.position.set(-2.4, 1.3, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.25, transparent: true, opacity: 0.8 })
  );
  win.position.set(-1.25, 1.5, 0);
  win.rotation.y = Math.PI / 2;
  g.add(win);

  // Sign board (canvas sprite-like mesh via colored plate + we'll add 3D label via createLabel at scene level)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 3.6), accentMat);
  sign.position.set(-0.5, 5.1, 0);
  g.add(sign);

  return g;
}

function createTruck() {
  const truckGroup = new THREE.Group();

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.15, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.5 })
  );
  chassis.position.set(-0.1, 0.4, 0);
  chassis.castShadow = true;
  truckGroup.add(chassis);

  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.0), bumperMat);
  bumper.position.set(1.15, 0.4, 0);
  bumper.castShadow = true;
  truckGroup.add(bumper);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.86),
    new THREE.MeshStandardMaterial({ color: 0xcc0000, metalness: 0.2, roughness: 0.4 })
  );
  cabin.position.set(0.8, 0.9, 0);
  cabin.castShadow = true;
  truckGroup.add(cabin);

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.45), glassMat);
  windshield.position.set(1.16, 1.05, 0);
  windshield.rotation.y = Math.PI / 2;
  truckGroup.add(windshield);

  const sideWinL = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), glassMat);
  sideWinL.position.set(0.8, 1.05, 0.44);
  truckGroup.add(sideWinL);
  const sideWinR = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), glassMat);
  sideWinR.position.set(0.8, 1.05, -0.44);
  sideWinR.rotation.y = Math.PI;
  truckGroup.add(sideWinR);

  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), bumperMat);
  grille.position.set(1.16, 0.65, 0);
  grille.rotation.y = Math.PI / 2;
  truckGroup.add(grille);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), bumperMat);
  exhaust.position.set(0.4, 1.2, 0.45);
  exhaust.castShadow = true;
  truckGroup.add(exhaust);

  const bedMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.9), bedMat);
  bed.position.set(-0.55, 0.5, 0);
  bed.castShadow = true;
  truckGroup.add(bed);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.9), bedMat);
  guard.position.set(0.25, 0.9, 0);
  truckGroup.add(guard);

  const loadGroup = new THREE.Group();
  loadGroup.position.set(-0.55, 0.6, 0);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.7, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x4d7c0f })
  );
  core.position.y = 0.35;
  loadGroup.add(core);

  const stalkGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 5);
  const stalkMat1 = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
  const stalkMat2 = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.8 });
  for (let i = 0; i < 50; i++) {
    const stalk = new THREE.Mesh(stalkGeo, Math.random() > 0.5 ? stalkMat1 : stalkMat2);
    stalk.rotation.z = Math.PI / 2;
    const face = Math.floor(Math.random() * 3);
    if (face === 0) stalk.position.set((Math.random() - 0.5) * 0.1, 0.7 + Math.random() * 0.1, (Math.random() - 0.5) * 0.8);
    else if (face === 1) stalk.position.set((Math.random() - 0.5) * 0.1, Math.random() * 0.7, 0.4 + Math.random() * 0.05);
    else stalk.position.set((Math.random() - 0.5) * 0.1, Math.random() * 0.7, -0.4 - Math.random() * 0.05);
    stalk.rotation.y = (Math.random() - 0.5) * 0.05;
    stalk.rotation.x = (Math.random() - 0.5) * 0.05;
    loadGroup.add(stalk);
  }

  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const rope1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.95), ropeMat);
  rope1.position.set(-0.4, 0.4, 0);
  loadGroup.add(rope1);
  const rope2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.95), ropeMat);
  rope2.position.set(0.4, 0.4, 0);
  loadGroup.add(rope2);
  truckGroup.add(loadGroup);

  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.15, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.17, 12);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.4 });
  [
    [0.7, 0.28, 0.45], [0.7, 0.28, -0.45],
    [-0.4, 0.28, 0.45], [-0.4, 0.28, -0.45],
    [-1.1, 0.28, 0.45], [-1.1, 0.28, -0.45],
  ].forEach((pos) => {
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(...pos);
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(...pos);
    truckGroup.add(tire);
    truckGroup.add(hub);
  });

  truckGroup.rotation.y = -Math.PI / 2;
  const truckContainer = new THREE.Group();
  truckContainer.add(truckGroup);
  truckContainer.scale.set(0.5, 0.5, 0.5);
  return truckContainer;
}

function createFarm(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  // Raised soil pad
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.95, metalness: 0 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), baseMat);
  base.position.y = 0.5;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  // Grass border
  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(15.2, 0.15, 15.2),
    new THREE.MeshStandardMaterial({ color: 0x3f7d2c, roughness: 1 })
  );
  grass.position.y = 0.08;
  grass.receiveShadow = true;
  group.add(grass);

  const stalkMatA = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.65 });
  const stalkMatB = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.8, side: THREE.DoubleSide });

  for (let i = -5.5; i <= 5.5; i += 1.6) {
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 })
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(i, 1.05, 0);
    ridge.castShadow = true;
    group.add(ridge);

    for (let j = -5.5; j <= 5.5; j += 1.15) {
      const height = 2.2 + Math.random() * 1.4;
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, height, 6),
        Math.random() > 0.5 ? stalkMatA : stalkMatB
      );
      stalk.position.set(i + (Math.random() * 0.25 - 0.12), 1 + height / 2, j + (Math.random() * 0.2 - 0.1));
      stalk.rotation.z = (Math.random() - 0.5) * 0.15;
      stalk.castShadow = true;
      group.add(stalk);

      // Leaf tuft
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 5), leafMat);
      leaf.position.set(stalk.position.x, 1 + height + 0.1, stalk.position.z);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      group.add(leaf);
    }
  }

  // Small farm shed for scale/realism
  const shed = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.8, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xd6b98c, roughness: 0.85 })
  );
  shed.position.set(5.2, 1.9, -5);
  shed.castShadow = true;
  group.add(shed);
  const shedRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.0, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 })
  );
  shedRoof.position.set(5.2, 3.2, -5);
  shedRoof.rotation.y = Math.PI / 4;
  shedRoof.castShadow = true;
  group.add(shedRoof);

  // Accent ring so pad reads clearly from distance
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.4, 7.7, 48),
    new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.02;
  group.add(ring);

  return { group, base, id: "farm" };
}

function createCenter(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  const baseMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.75, metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(12, 0.55, 14), baseMat);
  base.position.y = 0.275;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.45, 4.5), baseMat);
  ramp.rotation.x = Math.PI / 14;
  ramp.position.set(0, 0.28, 8);
  ramp.castShadow = true;
  group.add(ramp);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.35, roughness: 0.45 });
  [[-4.5, 4.5], [4.5, 4.5], [-4.5, -4.5], [4.5, -4.5]].forEach((p) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.2, 10), pillarMat);
    pillar.position.set(p[0], 2.35, p[1]);
    pillar.castShadow = true;
    group.add(pillar);
  });

  // Blue metal canopy with slight overhang
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(12.5, 0.25, 12.5),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.35, roughness: 0.4 })
  );
  roof.position.y = 4.5;
  roof.castShadow = true;
  group.add(roof);
  const roofEdge = new THREE.Mesh(
    new THREE.BoxGeometry(12.7, 0.35, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.4, roughness: 0.35 })
  );
  roofEdge.position.set(0, 4.35, 6.25);
  group.add(roofEdge);

  // Cane heap under shed
  const heap = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.9 })
  );
  heap.position.set(-3.2, 0.55, -2);
  heap.scale.set(1.4, 0.7, 1.1);
  heap.castShadow = true;
  group.add(heap);

  // Office cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.4, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 })
  );
  cabin.position.set(3.5, 1.75, -4.5);
  cabin.castShadow = true;
  group.add(cabin);
  const cabinWin = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 })
  );
  cabinWin.position.set(3.5, 1.9, -3.15);
  group.add(cabinWin);

  const truck = createTruck();
  truck.position.set(0, 0.55, 1);
  group.add(truck);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.2, 7.5, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.58;
  group.add(ring);

  return { group, base, id: "center" };
}

function createYard(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(36, 0.28, 42),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, metalness: 0.05 })
  );
  base.position.y = 0.22;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(36.6, 0.38, 42.6),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 })
  );
  curb.position.y = 0.06;
  group.add(curb);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const slotZs = [-14, -9, -4, 1, 6, 11];
  slotZs.forEach((z, idx) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.2), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(2, 0.38, z + 1.8);
    group.add(line);

    const truck = createTruck();
    truck.rotation.y = Math.PI / 2;
    truck.position.set((idx % 2 === 0 ? 0 : 4), 0.38, z);
    group.add(truck);
  });

  const office = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.8, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 })
  );
  office.position.set(12, 1.65, -16);
  office.castShadow = true;
  group.add(office);

  [[-14, 16], [14, 16], [-14, -17], [14, -17]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 })
    );
    pole.position.set(x, 3.6, z);
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.7 })
    );
    lamp.position.set(x, 7.1, z);
    group.add(lamp);
  });

  const gateVeh = createYardEntryGate("Gate Vehicles", 0xf59e0b);
  gateVeh.position.copy(GATE_VEHICLES_LOCAL);
  gateVeh.rotation.y = Math.PI / 2;
  group.add(gateVeh);

  const centerVeh = createYardEntryGate("Center Vehicles", 0x3b82f6);
  centerVeh.position.copy(CENTER_VEHICLES_LOCAL);
  centerVeh.rotation.y = Math.PI / 2;
  group.add(centerVeh);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(20, 20.5, 64),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);

  return {
    group,
    base,
    id: "yard",
    gates: [
      { id: "gateVehicles", local: GATE_VEHICLES_LOCAL.clone() },
      { id: "centerVehiclesGate", local: CENTER_VEHICLES_LOCAL.clone() },
    ],
  };
}

function createMill(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  // Lighter concrete compound so mill is visible
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.5, 30),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8, metalness: 0.08 })
  );
  base.position.y = 0.25;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75, metalness: 0.15 });
  const wallH = 4.2;
  const wallT = 0.45;
  const halfX = 20.8;
  const halfZ = 14.8;

  const backW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 30), wallMat);
  backW.position.set(halfX, wallH / 2, 0);
  backW.castShadow = true;
  group.add(backW);

  const sideW1 = new THREE.Mesh(new THREE.BoxGeometry(42, wallH, wallT), wallMat);
  sideW1.position.set(0, wallH / 2, halfZ);
  sideW1.castShadow = true;
  group.add(sideW1);
  const sideW2 = new THREE.Mesh(new THREE.BoxGeometry(42, wallH, wallT), wallMat);
  sideW2.position.set(0, wallH / 2, -halfZ);
  sideW2.castShadow = true;
  group.add(sideW2);

  const frontW1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 11), wallMat);
  frontW1.position.set(-halfX, wallH / 2, 9.5);
  frontW1.castShadow = true;
  group.add(frontW1);
  const frontW2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 11), wallMat);
  frontW2.position.set(-halfX, wallH / 2, -9.5);
  frontW2.castShadow = true;
  group.add(frontW2);

  // Gate posts
  [-4.5, 4.5].forEach((z) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 5, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    );
    post.position.set(-halfX, 2.5, z);
    post.castShadow = true;
    group.add(post);
  });

  // Integrated weighbridge
  const wbGroup = new THREE.Group();
  wbGroup.position.set(-14, 0.5, 0);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.25, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.55, roughness: 0.35 })
  );
  deck.position.set(0, 0.12, 0);
  deck.castShadow = true;
  wbGroup.add(deck);
  const booth = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 3.1, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 })
  );
  booth.position.set(0, 1.55, -3.8);
  booth.castShadow = true;
  wbGroup.add(booth);
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 1.1, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.2, transparent: true, opacity: 0.65 })
  );
  win.position.set(0, 1.9, -3.8);
  wbGroup.add(win);
  group.add(wbGroup);

  const carrier = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.1, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.45 })
  );
  carrier.rotation.z = Math.PI / 6;
  carrier.position.set(-1, 2.6, 0);
  carrier.castShadow = true;
  group.add(carrier);

  const conveyorCanes = [];
  const caneBundleGeo = new THREE.BoxGeometry(0.85, 0.65, 1.25);
  const caneBundleMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const bundle = new THREE.Mesh(caneBundleGeo, caneBundleMat);
    bundle.position.set(-3.2 + i * 2, 0.65, 0);
    bundle.castShadow = true;
    carrier.add(bundle);
    conveyorCanes.push(bundle);
  }

  const dongaGroup = new THREE.Group();
  dongaGroup.position.set(-6, 0.5, 4.5);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.45, roughness: 0.4 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 9.5, 10), craneMat);
  mast.position.y = 4.75;
  mast.castShadow = true;
  dongaGroup.add(mast);

  const boomGroup = new THREE.Group();
  boomGroup.position.set(0, 9, 0);
  dongaGroup.add(boomGroup);

  const boom = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.65, 0.65), craneMat);
  boom.position.set(-3.6, 0, 0);
  boom.castShadow = true;
  boomGroup.add(boom);

  const cableGroup = new THREE.Group();
  cableGroup.position.set(-6.8, 0, 0);
  boomGroup.add(cableGroup);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 5),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.4 })
  );
  cable.position.set(0, -2.5, 0);
  cableGroup.add(cable);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
  const clawBase = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.4, 10), metalMat);
  clawBase.position.y = -5;
  cableGroup.add(clawBase);

  const teethPivots = [];
  const toothGeo = new THREE.CylinderGeometry(0.09, 0.02, 1.25);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 0.42, -0.2, Math.sin(angle) * 0.42);
    pivot.rotation.y = -angle;
    const tooth = new THREE.Mesh(toothGeo, metalMat);
    tooth.position.set(0, -0.5, 0);
    tooth.rotation.x = 0.2;
    pivot.add(tooth);
    clawBase.add(pivot);
    teethPivots.push(pivot);
  }

  const grabbedCane = new THREE.Mesh(caneBundleGeo, caneBundleMat);
  grabbedCane.position.y = -0.8;
  grabbedCane.visible = false;
  clawBase.add(grabbedCane);
  group.add(dongaGroup);

  const plant = new THREE.Mesh(
    new THREE.BoxGeometry(13, 6.5, 11),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55, metalness: 0.05 })
  );
  plant.position.set(5, 3.75, 0);
  plant.castShadow = true;
  group.add(plant);

  // Window strips on plant
  for (let wy = 0; wy < 3; wy++) {
    const wstrip = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.7, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0369a1, emissiveIntensity: 0.35, transparent: true, opacity: 0.8 })
    );
    wstrip.position.set(5, 2.2 + wy * 1.5, 5.55);
    group.add(wstrip);
  }

  for (let i = -4.5; i <= 4.5; i += 3) {
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 13, 3),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.25, roughness: 0.45 })
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.x = Math.PI / 2;
    roof.position.set(5 + i, 7.5, 0);
    roof.castShadow = true;
    group.add(roof);
  }

  const boiler = new THREE.Mesh(
    new THREE.BoxGeometry(7, 8.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.7 })
  );
  boiler.position.set(14, 4.6, -4);
  boiler.castShadow = true;
  group.add(boiler);

  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 0.7, 16, 18),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
  );
  chimney.position.set(14, 12.5, -4);
  chimney.castShadow = true;
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
  const stripe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2, 18), stripeMat);
  stripe1.position.y = 4;
  chimney.add(stripe1);
  const stripe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2, 18), stripeMat);
  stripe2.position.y = -2;
  chimney.add(stripe2);
  group.add(chimney);

  for (let i = 0; i < 3; i++) {
    const tankGroup = new THREE.Group();
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, 6.2, 18),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.75, roughness: 0.2 })
    );
    cylinder.position.y = 3.6;
    cylinder.castShadow = true;
    tankGroup.add(cylinder);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.25 })
    );
    dome.position.y = 6.7;
    tankGroup.add(dome);
    tankGroup.position.set(13.5, 0.5, 3.5 + i * 3.6);
    group.add(tankGroup);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(18, 18.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.52;
  group.add(ring);

  return {
    group, base, id: "mill",
    boomGroup, cableGroup, teethPivots, grabbedCane, conveyorCanes,
  };
}

const LABEL_THEME = {
  farm: { accent: "#16a34a", soft: "#bbf7d0", pin: "#22c55e" },
  center: { accent: "#0284c7", soft: "#bae6fd", pin: "#0ea5e9" },
  yard: { accent: "#e11d48", soft: "#fecdd3", pin: "#f43f5e" },
  mill: { accent: "#7c3aed", soft: "#ddd6fe", pin: "#8b5cf6" },
  gateVehicles: { accent: "#d97706", soft: "#fde68a", pin: "#f59e0b", compact: true },
  centerVehiclesGate: { accent: "#2563eb", soft: "#bfdbfe", pin: "#3b82f6", compact: true },
};

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draw a map location pin (teardrop + inner circle). */
function drawLocationPin(ctx, cx, cy, size, fill, stroke) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  // Classic pin silhouette
  ctx.moveTo(0, s * 0.95);
  ctx.bezierCurveTo(-s * 0.95, s * 0.15, -s * 0.75, -s * 0.85, 0, -s * 0.85);
  ctx.bezierCurveTo(s * 0.75, -s * 0.85, s * 0.95, s * 0.15, 0, s * 0.95);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.strokeStyle = stroke || "#ffffff";
  ctx.stroke();
  // Inner hole
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/**
 * Beautiful billboard label with location pin — always faces camera.
 * @param {string} text
 * @param {THREE.Vector3} position
 * @param {{ id?: string, accent?: string }} [opts]
 */
function createLabel(text, position, opts = {}) {
  const theme = LABEL_THEME[opts.id] || { accent: "#0284c7", soft: "#e0f2fe", pin: "#38bdf8" };
  const compact = Boolean(theme.compact || opts.compact);
  const W = compact ? 640 : 900;
  const H = compact ? 160 : 220;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Soft outer glow plate
  ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
  roundRectPath(ctx, 8, 8, W - 16, H - 16, compact ? 28 : 40);
  ctx.fill();

  // Main card
  const padX = compact ? 18 : 24;
  const padY = compact ? 18 : 22;
  const cardX = padX;
  const cardY = padY;
  const cardW = W - padX * 2;
  const cardH = H - padY * 2 - (compact ? 0 : 18);
  const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  grad.addColorStop(0, "rgba(15, 23, 42, 0.96)");
  grad.addColorStop(1, "rgba(30, 41, 59, 0.94)");
  ctx.fillStyle = grad;
  roundRectPath(ctx, cardX, cardY, cardW, cardH, compact ? 26 : 36);
  ctx.fill();

  // Accent border
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = compact ? 4 : 6;
  roundRectPath(ctx, cardX + 2, cardY + 2, cardW - 4, cardH - 4, compact ? 24 : 32);
  ctx.stroke();

  // Soft accent strip on left
  ctx.fillStyle = theme.accent;
  roundRectPath(ctx, cardX + 4, cardY + 10, compact ? 10 : 14, cardH - 20, 8);
  ctx.fill();

  // Location pin
  const pinSize = compact ? 36 : 52;
  const pinX = cardX + (compact ? 58 : 78);
  const pinY = cardY + cardH / 2 + (compact ? 4 : 6);
  drawLocationPin(ctx, pinX, pinY, pinSize, theme.pin, "#ffffff");

  // Title text
  const textX = pinX + pinSize + (compact ? 28 : 36);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = `800 ${compact ? 52 : 72}px Inter, system-ui, sans-serif`;
  // slight text shadow for readability
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, textX, cardY + cardH / 2 - (compact ? 0 : 8));
  ctx.shadowColor = "transparent";

  if (!compact) {
    ctx.fillStyle = theme.soft;
    ctx.font = "700 28px Inter, system-ui, sans-serif";
    ctx.fillText("PROCESS NODE", textX, cardY + cardH / 2 + 38);
  }

  // Tiny pointer triangle under card (map marker feel)
  if (!compact) {
    const tipX = W / 2;
    const tipY = cardY + cardH;
    ctx.beginPath();
    ctx.moveTo(tipX - 18, tipY - 2);
    ctx.lineTo(tipX + 18, tipY - 2);
    ctx.lineTo(tipX, tipY + 22);
    ctx.closePath();
    ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tipX - 16, tipY);
    ctx.lineTo(tipX, tipY + 20);
    ctx.lineTo(tipX + 16, tipY);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
      opacity: 1,
    })
  );
  sprite.position.copy(position);
  if (compact) {
    sprite.scale.set(28, 7, 1);
  } else {
    // Large world-space billboards so names stay readable from orbit distance
    sprite.scale.set(40, 10, 1);
  }
  sprite.renderOrder = 20;
  return sprite;
}

function MiniRows({ cols, rows }) {
  const list = rows?.length ? rows : [];
  return (
    <table className="w-full text-left text-xs mb-1">
      <thead className="text-slate-400 border-b border-slate-600">
        <tr>
          {cols.map((c) => (
            <th key={c.key} className={`py-1 pr-2 font-semibold ${c.cls || ""}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="text-slate-300">
        {list.slice(0, 8).map((r, i) => (
          <tr key={i} className={r.mode === "Total" || r.cls ? "font-bold border-t border-slate-600 text-slate-100" : ""}>
            {cols.map((c) => (
              <td key={c.key} className={`py-0.5 pr-2 ${c.cls || ""}`}>{r[c.key] ?? "—"}</td>
            ))}
          </tr>
        ))}
        {!list.length && (
          <tr><td colSpan={cols.length} className="py-2 text-slate-500">No data for selected range</td></tr>
        )}
      </tbody>
    </table>
  );
}

/**
 * Full 3D Cut-to-Crush procurement scene (updated map controls, asphalt roads, mill donga).
 * Scene WebGL mounts once; KPI/tooltip props update without rebuilding the world.
 */
function ProcurementCutToCrushScene({
  fromDate,
  toDate,
  gateRows = [],
  centerVehRows = [],
  holdRows = [],
  centerTrips,
  avgCenterWait,
  truckHolding,
  yardRows = [],
  avgYardWait,
  caneHolding,
  avgDongaWait,
  millRows = [],
  summaryKpis = [],
  className = "",
}) {
  const hostRef = useRef(null);
  const canvasHostRef = useRef(null);
  const kpiRefs = useRef({ center: null, yard: null, mill: null });
  const dataRef = useRef({});
  const pointerDownRef = useRef({ x: 0, y: 0 });

  const [tooltip, setTooltip] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  dataRef.current = {
    gateRows, centerVehRows, holdRows, centerTrips, avgCenterWait,
    truckHolding, yardRows, avgYardWait, caneHolding, avgDongaWait, millRows,
  };

  const floating = useMemo(() => ({
    truckHolding: truckHolding != null && truckHolding !== "" ? Number(truckHolding).toFixed(2) : "—",
    yardWait: avgYardWait != null && avgYardWait !== "" ? Number(avgYardWait).toFixed(2) : "—",
    caneHolding: caneHolding != null && caneHolding !== "" ? Number(caneHolding).toFixed(2) : "—",
  }), [truckHolding, avgYardWait, caneHolding]);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const toggleFullscreen = useCallback(async () => {
    const el = hostRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      /* ignore fullscreen errors */
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);
    scene.fog = new THREE.FogExp2(0x1e293b, 0.0012);

    const camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);
    // Start in front of layout center (Farm −55 → Mill 105)
    camera.position.set(25, 62, 130);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    canvasHost.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 1000;
    controls.target.set(25, 1, 0);
    // Map-style: left = pan, right = rotate
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.screenSpacePanning = false;
    // Gentle orbit around vertical axis; pauses while user interacts
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.addEventListener("start", () => { controls.autoRotate = false; });
    controls.addEventListener("end", () => { controls.autoRotate = true; });

    const ambient = new THREE.AmbientLight(0xcbd5e1, 0.55);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.75);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff4e5, 1.35);
    dirLight.position.set(40, 120, 30);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 90;
    dirLight.shadow.camera.bottom = -90;
    dirLight.shadow.camera.left = -90;
    dirLight.shadow.camera.right = 90;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 320;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.00015;
    scene.add(dirLight);

    const fill = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fill.position.set(-60, 40, -40);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(1200, 120, 0xcbd5e1, 0x94a3b8);
    gridHelper.position.y = 0.02;
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    const interactiveObjects = [];
    const flows = [];
    const nodes = {};
    const factories = { farm: createFarm, center: createCenter, yard: createYard, mill: createMill };

    ["farm", "center", "yard", "mill"].forEach((id) => {
      const data = NODES_META[id];
      const node = factories[id](data.pos);
      scene.add(node.group);
      const labelY = id === "mill" ? 30 : id === "yard" ? 26 : 22;
      scene.add(createLabel(data.label, new THREE.Vector3(data.pos.x, labelY, data.pos.z), { id }));

      const hitSize = id === "mill" ? 40 : id === "yard" ? 24 : 15;
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(hitSize, 15, hitSize),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.copy(data.pos);
      // Keep yard hit volume on parking side so entry gates stay clickable
      if (id === "yard") hitBox.position.x += 6;
      hitBox.position.y = 7.5;
      hitBox.userData = { id, isNode: true };
      scene.add(hitBox);
      interactiveObjects.push(hitBox);
      nodes[id] = { ...node, object: hitBox };

      // Register clickable yard entry gates (visuals live inside yard group)
      if (id === "yard" && node.gates) {
        node.gates.forEach((g) => {
          const meta = NODES_META[g.id];
          if (!meta) return;
          scene.add(createLabel(meta.label, new THREE.Vector3(meta.pos.x, 14, meta.pos.z), { id: g.id }));
          const gHit = new THREE.Mesh(
            new THREE.BoxGeometry(12, 12, 12),
            new THREE.MeshBasicMaterial({ visible: false })
          );
          gHit.position.copy(meta.pos);
          gHit.position.y = 5;
          gHit.userData = { id: g.id, isNode: true };
          scene.add(gHit);
          interactiveObjects.push(gHit);
          const plate = new THREE.Mesh(
            new THREE.BoxGeometry(5.5, 0.12, 7.5),
            new THREE.MeshStandardMaterial({
              color: g.id === "gateVehicles" ? 0xf59e0b : 0x3b82f6,
              roughness: 0.55,
              transparent: true,
              opacity: 0.55,
            })
          );
          plate.position.copy(meta.pos);
          plate.position.y = 0.42;
          scene.add(plate);
          nodes[g.id] = { group: null, base: plate, id: g.id, object: gHit };
        });
      }
    });

    const createFlow = (fromId, toId, startOffset, endOffset, startHeight, endHeight) => {
      const start = NODES_META[fromId].pos.clone().add(startOffset);
      const end = NODES_META[toId].pos.clone().add(endOffset);
      start.y = startHeight;
      end.y = endHeight;
      const midPoint = new THREE.Vector3(
        (start.x + end.x) / 2,
        (startHeight + endHeight) / 2,
        (start.z + end.z) / 2
      );
      const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);

      const road = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 100, 1.8, 8, false),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
      );
      road.scale.y = 0.03;
      road.position.y = 0.02;
      road.receiveShadow = true;
      scene.add(road);

      const particles = [];
      for (let i = 0; i < 3; i++) {
        const truck = createTruck();
        scene.add(truck);
        particles.push(truck);
      }
      flows.push({ curve, particles, speed: 0.15 + Math.random() * 0.05 });
    };

    // Roads: Farm → Gate Vehicles; Centers → Center Vehicles; Yard → Mill
    createFlow("farm", "center", new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), 1.0, 0.55);
    createFlow("farm", "gateVehicles", new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), 1.0, 0.4);
    createFlow("center", "centerVehiclesGate", new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), 0.55, 0.4);
    createFlow("yard", "mill", new THREE.Vector3(0, 0, 0), new THREE.Vector3(-12, 0, 0), 0.38, 0.5);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredNode = null;
    let raf = 0;
    let disposed = false;

    const setSize = () => {
      const host = hostRef.current || canvasHost;
      const w = Math.max(1, host.clientWidth || canvasHost.clientWidth || 800);
      const h = Math.max(1, host.clientHeight || canvasHost.clientHeight || 600);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };
    setSize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => setSize()) : null;
    ro?.observe(canvasHost);
    if (hostRef.current && hostRef.current !== canvasHost) ro?.observe(hostRef.current);
    window.addEventListener("resize", setSize);

    const getLocalPoint = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
        clientX: event.clientX - rect.left,
        clientY: event.clientY - rect.top,
      };
    };

    const pickNodeId = (intersects) => {
      if (!intersects?.length) return null;
      const gateHit = intersects.find((x) => {
        const id = x.object?.userData?.id;
        return id === "gateVehicles" || id === "centerVehiclesGate";
      });
      return (gateHit || intersects[0]).object.userData.id;
    };

    const onMouseMove = (event) => {
      const p = getLocalPoint(event);
      mouse.x = p.x;
      mouse.y = p.y;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects);
      if (intersects.length > 0) {
        renderer.domElement.style.cursor = "pointer";
        const id = pickNodeId(intersects);
        if (hoveredNode !== id && nodes[id]?.base) {
          if (hoveredNode && nodes[hoveredNode]?.base?.material?.emissive) {
            nodes[hoveredNode].base.material.emissive.setHex(0x000000);
          }
          hoveredNode = id;
          if (nodes[id].base.material.emissive) {
            nodes[id].base.material.emissive.setHex(0x1e3a8a);
          }
        }
      } else {
        renderer.domElement.style.cursor = "default";
        if (hoveredNode && nodes[hoveredNode]?.base?.material?.emissive) {
          nodes[hoveredNode].base.material.emissive.setHex(0x000000);
          hoveredNode = null;
        }
      }
    };

    const onPointerDown = (event) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event) => {
      // Ignore if user dragged the map
      const dx = Math.abs(event.clientX - pointerDownRef.current.x);
      const dy = Math.abs(event.clientY - pointerDownRef.current.y);
      if (dx > 4 || dy > 4) return;

      const p = getLocalPoint(event);
      mouse.x = p.x;
      mouse.y = p.y;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects);
      if (intersects.length > 0) {
        const id = pickNodeId(intersects);
        setTooltip({ id, x: p.clientX + 16, y: p.clientY + 16 });
      } else {
        setTooltip(null);
      }
    };

    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

    // Beside nodes, just above building height (not mid-mesh, not sky-high)
    const floatingKpiConfig = [
      { key: "center", targetId: "center", offset: new THREE.Vector3(-12, 18, 4) },
      { key: "yard", targetId: "yard", offset: new THREE.Vector3(12, 20, -4) },
      { key: "mill", targetId: "mill", offset: new THREE.Vector3(-12, 22, 4) },
    ];

    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;

      flows.forEach((flow) => {
        flow.particles.forEach((truckContainer, index) => {
          const t = ((time * flow.speed) + (index / flow.particles.length)) % 1;
          const point = flow.curve.getPointAt(t);
          truckContainer.position.copy(point);
          const nextT = Math.min(t + 0.01, 1);
          const nextPoint = flow.curve.getPointAt(nextT);
          if (nextPoint.distanceTo(point) > 0.001) truckContainer.lookAt(nextPoint);
        });
      });

      // Advanced donga + conveyor
      const mill = nodes.mill;
      if (mill?.boomGroup) {
        mill.conveyorCanes?.forEach((cane) => {
          cane.position.x += 0.02;
          if (cane.position.x > 3.8) cane.position.x = -3.8;
        });

        const cycleTime = time % 6.0;
        let targetAngle = 0;
        let targetCableYScale = 1;
        let targetTeethRot = 0.2;
        let hasCane = false;

        if (cycleTime < 1.0) {
          targetAngle = Math.PI / 4.5;
          targetCableYScale = 1;
          targetTeethRot = 0.2;
        } else if (cycleTime < 1.5) {
          targetAngle = Math.PI / 4.5;
          targetCableYScale = 2.4;
          targetTeethRot = 0.2;
        } else if (cycleTime < 2.0) {
          targetAngle = Math.PI / 4.5;
          targetCableYScale = 2.4;
          targetTeethRot = 0.8;
          hasCane = true;
        } else if (cycleTime < 2.5) {
          targetAngle = Math.PI / 4.5;
          targetCableYScale = 1;
          targetTeethRot = 0.8;
          hasCane = true;
        } else if (cycleTime < 4.0) {
          targetAngle = -Math.PI / 2.2;
          targetCableYScale = 1;
          targetTeethRot = 0.8;
          hasCane = true;
        } else if (cycleTime < 4.5) {
          targetAngle = -Math.PI / 2.2;
          targetCableYScale = 1.0;
          targetTeethRot = 0.2;
          hasCane = false;
        } else {
          targetAngle = -Math.PI / 2.2;
          targetCableYScale = 1;
          targetTeethRot = 0.2;
        }

        mill.boomGroup.rotation.y += (targetAngle - mill.boomGroup.rotation.y) * 0.1;
        mill.cableGroup.scale.y += (targetCableYScale - mill.cableGroup.scale.y) * 0.2;
        mill.teethPivots.forEach((pivot) => {
          pivot.rotation.x += (targetTeethRot - pivot.rotation.x) * 0.25;
        });
        mill.grabbedCane.visible = hasCane;
      }

      const w = canvasHost.clientWidth || 1;
      const h = canvasHost.clientHeight || 1;
      floatingKpiConfig.forEach((kpi) => {
        const el = kpiRefs.current[kpi.key];
        if (!el || !NODES_META[kpi.targetId]) return;
        const targetPos = NODES_META[kpi.targetId].pos.clone().add(kpi.offset);
        targetPos.project(camera);
        if (targetPos.z < 1) {
          const x = (targetPos.x * 0.5 + 0.5) * w;
          const y = (targetPos.y * -0.5 + 0.5) * h;
          el.style.display = "block";
          el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
        } else {
          el.style.display = "none";
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", setSize);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, []);

  const tipId = tooltip?.id;
  const tipBody = useMemo(() => {
    if (!tipId) return null;
    const d = dataRef.current;
    if (tipId === "farm") {
      return (
        <p className="text-slate-300 text-sm">
          Cane origin. Vehicles split to <span className="text-amber-400 font-semibold">Gate Vehicles</span> (direct)
          or via <span className="text-sky-400 font-semibold">Collection Centers</span>.
        </p>
      );
    }
    if (tipId === "gateVehicles") {
      return (
        <MiniRows
          cols={[
            { key: "mode", label: "Mode" },
            { key: "veh", label: "Vehicles", cls: "text-right" },
            { key: "cane", label: "Cane (Q)", cls: "text-right" },
            { key: "time", label: "Time(H)", cls: "text-right" },
          ]}
          rows={d.gateRows}
        />
      );
    }
    if (tipId === "centerVehiclesGate") {
      return (
        <MiniRows
          cols={[
            { key: "mode", label: "Mode" },
            { key: "veh", label: "Veh", cls: "text-right" },
            { key: "cane", label: "Cane", cls: "text-right" },
          ]}
          rows={d.centerVehRows}
        />
      );
    }
    if (tipId === "center") {
      return (
        <div className="flex flex-col gap-2">
          <div className="bg-slate-700 p-2 rounded flex justify-between gap-4 border border-slate-600">
            <span className="text-slate-400">Total Trips</span>
            <span className="font-bold text-slate-100">{d.centerTrips != null ? Number(d.centerTrips).toLocaleString("en-IN") : "—"}</span>
          </div>
          <div className="bg-slate-700 p-2 rounded flex justify-between gap-4 border border-slate-600">
            <span className="text-slate-400">Avg Time</span>
            <span className="font-bold text-amber-500">{d.avgCenterWait != null ? `${Number(d.avgCenterWait).toFixed(2)} Hrs` : "—"}</span>
          </div>
          {d.holdRows?.length > 0 && (
            <MiniRows
              cols={[
                { key: "mode", label: "Mode" },
                { key: "h", label: "Hold (H)", cls: "text-right" },
              ]}
              rows={d.holdRows}
            />
          )}
          <p className="text-[10px] text-slate-400">Click the blue <strong className="text-sky-400">Center Vehicles</strong> gate for mode-wise vehicles &amp; cane.</p>
        </div>
      );
    }
    if (tipId === "yard") {
      return (
        <div>
          <div className="text-center mb-3">
            <div className="text-3xl font-bold text-rose-500">{d.avgYardWait != null ? Number(d.avgYardWait).toFixed(2) : "—"}</div>
            <div className="text-xs text-slate-400">Waiting Time (Hrs)</div>
          </div>
          <MiniRows
            cols={[
              { key: "mode", label: "Mode" },
              { key: "avg", label: "Avg Time", cls: "text-right" },
              { key: "dev", label: "Dev(>8H)", cls: "text-right" },
            ]}
            rows={d.yardRows}
          />
        </div>
      );
    }
    if (tipId === "mill") {
      return (
        <div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-700 p-2 rounded text-center border border-slate-600">
              <div className="text-xl font-bold text-amber-500">{d.caneHolding != null ? Number(d.caneHolding).toFixed(2) : "—"}</div>
              <div className="text-[10px] text-slate-400">Holding Time (H)</div>
            </div>
            <div className="bg-slate-700 p-2 rounded text-center border border-slate-600">
              <div className="text-xl font-bold text-emerald-500">{d.avgDongaWait != null ? Number(d.avgDongaWait).toFixed(2) : "—"}</div>
              <div className="text-[10px] text-slate-400">Time at Donga (H)</div>
            </div>
          </div>
          <MiniRows
            cols={[
              { key: "mode", label: "Mode" },
              { key: "avg", label: "Avg Time", cls: "text-right" },
              { key: "dev", label: "Dev(>0.5H)", cls: "text-right" },
            ]}
            rows={d.millRows}
          />
        </div>
      );
    }
    return <p className="text-slate-400 text-sm">No data available</p>;
  }, [tipId, gateRows, centerVehRows, holdRows, centerTrips, avgCenterWait, yardRows, avgYardWait, caneHolding, avgDongaWait, millRows]);

  const tipStyle = useMemo(() => {
    if (!tooltip || !hostRef.current) return { display: "none" };
    const w = hostRef.current.clientWidth;
    const h = hostRef.current.clientHeight;
    let x = tooltip.x;
    let y = tooltip.y;
    if (x + 320 > w) x = Math.max(8, w - 320);
    if (y + 260 > h) y = Math.max(8, h - 260);
    return { left: x, top: y };
  }, [tooltip]);

  return (
    <div
      ref={hostRef}
      className={`relative w-full h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-200 shadow-xl ${className}`}
    >
      <div ref={canvasHostRef} className="absolute inset-0 z-[1]" />

      <div className="absolute inset-0 z-10 pointer-events-none">
        <div
          ref={(el) => { kpiRefs.current.center = el; }}
          className="absolute hidden bg-slate-900/70 backdrop-blur-sm border border-slate-600/80 border-l-4 border-l-amber-500 rounded-lg px-2.5 py-1.5 shadow-lg shadow-black/40 text-center"
          style={{ minWidth: 110 }}
        >
          <div className="text-xl font-bold text-amber-500">{floating.truckHolding}</div>
          <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Truck Holding (H)</div>
        </div>
        <div
          ref={(el) => { kpiRefs.current.yard = el; }}
          className="absolute hidden bg-slate-900/70 backdrop-blur-sm border border-slate-600/80 border-l-4 border-l-rose-500 rounded-lg px-2.5 py-1.5 shadow-lg shadow-black/40 text-center"
          style={{ minWidth: 110 }}
        >
          <div className="text-xl font-bold text-rose-500">{floating.yardWait}</div>
          <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Waiting Time (Hrs)</div>
        </div>
        <div
          ref={(el) => { kpiRefs.current.mill = el; }}
          className="absolute hidden bg-slate-900/70 backdrop-blur-sm border border-slate-600/80 border-l-4 border-l-emerald-500 rounded-lg px-2.5 py-1.5 shadow-lg shadow-black/40 text-center"
          style={{ minWidth: 120 }}
        >
          <div className="text-xl font-bold text-emerald-500">{floating.caneHolding}</div>
          <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Cane Holding (Hrs)</div>
        </div>

        {/* Top strip: 5 summary KPIs + fullscreen */}
        <div className="absolute top-3 left-3 right-3 flex items-start gap-2 pointer-events-auto">
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 min-w-0">
            {summaryKpis.map((k) => (
              <BiKpiCard
                key={k.title}
                title={k.title}
                displayValue={k.value}
                value={100}
                pyValue={0}
                isDarkMode={true}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="shrink-0 rounded-xl border border-slate-700 bg-slate-800/90 backdrop-blur-md p-2.5 text-slate-200 hover:text-white hover:border-sky-500/60 transition-colors shadow-lg"
            title={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {tooltip && (
          <div
            className="absolute bg-slate-800/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl pointer-events-auto min-w-[280px] max-w-[340px] z-20"
            style={tipStyle}
          >
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
              <h3 className="text-sm font-bold text-sky-400">{NODES_META[tipId]?.label || tipId}</h3>
              <button type="button" onClick={hideTooltip} className="text-slate-400 hover:text-slate-200 transition-colors p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-slate-300 max-h-[240px] overflow-auto">{tipBody}</div>
          </div>
        )}

        <div className="absolute bottom-3 right-3 bg-slate-800/90 backdrop-blur-md border border-slate-700 p-2.5 rounded-lg pointer-events-auto shadow-lg">
          <p className="text-[10px] text-slate-300 font-medium mb-0.5"><span className="text-sky-400 font-semibold">Left drag:</span> Pan map</p>
          <p className="text-[10px] text-slate-300 font-medium mb-0.5"><span className="text-sky-400 font-semibold">Right drag:</span> Rotate</p>
          <p className="text-[10px] text-slate-300 font-medium mb-0.5"><span className="text-sky-400 font-semibold">Scroll:</span> Zoom</p>
          <p className="text-[10px] text-slate-300 font-medium"><span className="text-sky-400 font-semibold">Click:</span> View data</p>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProcurementCutToCrushScene);
