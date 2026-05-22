import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('canvasHolder');
const windInput = document.getElementById('wind');
const windValueLabel = document.getElementById('windValue');
const toggleVideoButton = document.getElementById('toggleVideo');
const videoElement = document.getElementById('lanternVideo');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04020b);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 8, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 35;
controls.maxPolarAngle = Math.PI * 0.9;

const ambient = new THREE.AmbientLight(0x9f86ff, 0.45);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0x98d3ff, 1.0);
moonLight.position.set(-10, 20, 10);
scene.add(moonLight);

const glow = new THREE.PointLight(0x7b5cff, 1.2, 60, 2);
glow.position.set(0, 14, -6);
scene.add(glow);

const tick = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectedLantern = null;
let dragOffset = new THREE.Vector3();
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const lanterns = [];
const autoRotateTargets = new Set();
let windStrength = 1;
let videoTexture = null;

createStarField();
createGalaxyMist();
createLanterns();
createGroundGlow();
setupEventHandlers();
animate();

function createStarField() {
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const radius = 70 + Math.random() * 40;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const brightness = 0.8 + Math.random() * 0.2;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starMaterial = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

function createGalaxyMist() {
  const geometry = new THREE.IcosahedronGeometry(55, 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x3a1f7e,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide,
  });
  const shell = new THREE.Mesh(geometry, material);
  scene.add(shell);
}

function createLanterns() {
  const colors = [0xff9966, 0x7ef0ff, 0xff7dfd, 0x86ff8a, 0xffd56e, 0x6790ff];
  const positions = [
    [-7, 3.4, -3],
    [-3.5, 4.2, 2],
    [0, 3.8, -1],
    [3.5, 4.5, 3],
    [6, 3.6, 0],
    [1.5, 4.8, -5],
  ];

  for (let i = 0; i < 6; i++) {
    const design = createLanternDesign(i, colors[i]);
    design.position.set(...positions[i]);
    design.userData = {
      basePosition: design.position.clone(),
      windOffset: Math.random() * Math.PI * 2,
      autoRotate: false,
      id: i,
    };
    lanterns.push(design);
    scene.add(design);
  }
}

function createLanternDesign(index, color) {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.1),
    roughness: 0.35,
    metalness: 0.08,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.2,
    metalness: 0.1,
  });

  const frame = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.8, 16, 1, true), bodyMaterial);
  frame.position.y = 0;
  group.add(frame);

  const top = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.9, 16), bodyMaterial);
  top.position.y = 1.8;
  group.add(top);

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 16), bodyMaterial);
  bottom.position.y = -1.5;
  group.add(bottom);

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 16, 1, true), glassMaterial);
  glass.position.y = -0.1;
  group.add(glass);

  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x2d1f10, roughness: 0.9 }));
  candle.position.y = -0.5;
  group.add(candle);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0xffcb55, emissive: 0xffa758, emissiveIntensity: 1.4, transparent: true, opacity: 0.95 }));
  flame.position.set(0, 0.05, 0);
  group.add(flame);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 12, 36), bodyMaterial);
  ring.position.y = 2.3;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const design = createDetailDesign(index, color);
  group.add(design);

  const halo = new THREE.PointLight(color, 0.45, 7, 2);
  halo.position.set(0, -0.1, 0);
  group.add(halo);

  return group;
}

function createDetailDesign(index, color) {
  const design = new THREE.Group();
  const shapeMaterial = new THREE.MeshStandardMaterial({
    color: 0x210f3d,
    emissive: new THREE.Color(color).multiplyScalar(0.04),
    roughness: 0.62,
  });

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.05), shapeMaterial);
  stripe.position.y = 0.8;
  design.add(stripe);

  const pattern = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 10, 24), shapeMaterial);
  pattern.position.set(0, -0.5, 0.9);
  pattern.rotation.x = Math.PI / 2;
  design.add(pattern);

  if (index % 2 === 0) {
    const accent = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4 }));
    accent.position.set(0, -0.1, 0.92);
    design.add(accent);
  }

  if (index === 1 || index === 4) {
    const rings = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65 - i * 0.12, 0.04, 8, 30), shapeMaterial);
      ring.position.y = 0.2 - i * 0.35;
      rings.add(ring);
    }
    design.add(rings);
  }

  if (index === 2) {
    const heart = new THREE.Mesh(new THREE.ShapeGeometry(createHeartShape()), new THREE.MeshStandardMaterial({ color: 0xff7fdb, emissive: 0xff7fdb, emissiveIntensity: 0.5, roughness: 0.2 }));
    heart.scale.set(0.24, 0.24, 0.24);
    heart.rotation.x = -Math.PI / 2;
    heart.position.set(0, -0.3, 0.92);
    design.add(heart);
  }

  if (index === 3) {
    const star = new THREE.Mesh(new THREE.ShapeGeometry(createStarShape()), new THREE.MeshStandardMaterial({ color: 0xfff1a9, emissive: 0xfff1a9, emissiveIntensity: 0.55, roughness: 0.18 }));
    star.scale.set(0.18, 0.18, 0.18);
    star.rotation.x = -Math.PI / 2;
    star.position.set(0.1, -0.25, 0.92);
    design.add(star);
  }

  return design;
}

function createHeartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0, 0.35, -0.4, 0.45, -0.4, 0.12);
  shape.bezierCurveTo(-0.4, -0.18, 0, -0.24, 0, -0.12);
  shape.bezierCurveTo(0, -0.24, 0.4, -0.18, 0.4, 0.12);
  shape.bezierCurveTo(0.4, 0.45, 0, 0.35, 0, 0);
  return shape;
}

function createStarShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.35);
  for (let i = 0; i < 5; i++) {
    shape.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 0.2, Math.sin((18 + i * 72) * Math.PI / 180) * 0.2);
    shape.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 0.08, Math.sin((54 + i * 72) * Math.PI / 180) * 0.08);
  }
  shape.closePath();
  return shape;
}

function createGroundGlow() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(26, 64),
    new THREE.MeshBasicMaterial({ color: 0x331269, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.7;
  scene.add(floor);
}

function setupEventHandlers() {
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  windInput.addEventListener('input', (event) => {
    windStrength = parseFloat(event.target.value);
    windValueLabel.textContent = windStrength.toFixed(2);
  });
  toggleVideoButton.addEventListener('click', applyVideoTexture);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function getPointerPosition(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerDown(event) {
  getPointerPosition(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(lanterns, true);
  if (hits.length > 0) {
    let root = hits[0].object;
    while (root.parent && !lanterns.includes(root)) {
      root = root.parent;
    }
    if (!lanterns.includes(root)) {
      return;
    }
    selectedLantern = root;
    selectedLantern.userData.autoRotate = true;
    autoRotateTargets.add(selectedLantern);
    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), selectedLantern.position);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
    dragOffset.copy(intersectionPoint).sub(selectedLantern.position);
  }
}

function onPointerMove(event) {
  if (!selectedLantern) return;
  getPointerPosition(event);
  raycaster.setFromCamera(pointer, camera);
  const intersectionPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
  selectedLantern.position.copy(intersectionPoint).sub(dragOffset);
  selectedLantern.userData.basePosition.copy(selectedLantern.position);
}

function onPointerUp() {
  selectedLantern = null;
}

function applyVideoTexture() {
  if (!videoTexture) {
    videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.encoding = THREE.sRGBEncoding;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;
  }

  videoElement.play().catch(() => {});
  lanterns.forEach((lantern, index) => {
    if (index === 0) {
      lantern.traverse((child) => {
        if (child.isMesh && child.material && child.material.transparent) {
          child.material.map = videoTexture;
          child.material.opacity = 0.7;
          child.material.needsUpdate = true;
        }
      });
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = tick.getElapsedTime();
  lanterns.forEach((lantern) => {
    const base = lantern.userData.basePosition;
    const sway = Math.sin(elapsed * 0.7 + lantern.userData.windOffset) * 0.55 * windStrength;
    const floatY = Math.sin(elapsed * 1.1 + lantern.userData.windOffset) * 0.18;
    lantern.position.x = base.x + sway;
    lantern.position.y = base.y + floatY;
    lantern.rotation.y += 0.002;
    if (lantern.userData.autoRotate) {
      lantern.rotation.y += 0.018;
      lantern.rotation.x = Math.sin(elapsed * 0.5 + lantern.userData.id) * 0.08;
    }
  });

  controls.update();
  renderer.render(scene, camera);
}
