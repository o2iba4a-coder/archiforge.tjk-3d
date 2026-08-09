import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);
const viewport = $("viewport");
const wallHint = $("wallHint");
const empty = $("empty");
const content = $("content");
const oname = $("oname");
const otype = $("otype");
const px = $("px"), py = $("py"), pz = $("pz");
const sx = $("sx"), sy = $("sy"), sz = $("sz");
const wallprops = $("wallprops");
const lengthEl = $("length"), thick = $("thick");
const mat = $("mat");
const cx = $("cx"), cy = $("cy"), cz = $("cz");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1014);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(12, 10, 14);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 1, 0);
controls.minDistance = 2;
controls.maxDistance = 80;
controls.maxPolarAngle = Math.PI / 2.02;

scene.add(new THREE.HemisphereLight(0xc5d3df, 0x20252c, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.position.set(7, 14, 8);
sun.castShadow = true;
scene.add(sun);

const grid = new THREE.GridHelper(40, 80, 0x4b5662, 0x252c34);
scene.add(grid);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x11161b, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

const objects = [];
let selected = null;
let currentTool = "select";
let wallStart = null;
let previewWall = null;
let wallNumber = 1;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function addBox(name, type, position, size, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
  );
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    type,
    size: { ...size },
    material: "Concrete"
  };
  scene.add(mesh);
  objects.push(mesh);
  return mesh;
}

addBox(
  "Main Volume",
  "Building",
  { x: 0, y: 1.5, z: 0 },
  { x: 8, y: 3, z: 6 },
  0x7e8994
);

addBox(
  "Upper Volume",
  "Building",
  { x: 0.8, y: 3.7, z: -0.2 },
  { x: 5.4, y: 1.4, z: 4.2 },
  0x9aa3ad
);

function getGroundPoint(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const point = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(groundPlane, point)) {
    return null;
  }

  // 0.5 m architectural snap
  point.x = Math.round(point.x * 2) / 2;
  point.z = Math.round(point.z * 2) / 2;
  point.y = 0;

  return point;
}

function createWall(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const wallLength = Math.hypot(dx, dz);

  if (wallLength < 0.25) {
    return null;
  }

  const height = 3;
  const thickness = 0.2;

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(wallLength, height, thickness),
    new THREE.MeshStandardMaterial({
      color: 0x8f9aa6,
      roughness: 0.7
    })
  );

  wall.position.set(
    (a.x + b.x) / 2,
    height / 2,
    (a.z + b.z) / 2
  );

  wall.rotation.y = -Math.atan2(dz, dx);
  wall.name = `Wall ${wallNumber++}`;
  wall.castShadow = true;
  wall.receiveShadow = true;

  wall.userData = {
    type: "Wall",
    size: {
      x: wallLength,
      y: height,
      z: thickness
    },
    material: "Concrete",
    thickness
  };

  scene.add(wall);
  objects.push(wall);
  selectObject(wall);

  return wall;
}

function updatePreview(a, b) {
  if (!previewWall) return;

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L = Math.max(Math.hypot(dx, dz), 0.01);

  previewWall.scale.x = L;
  previewWall.position.set(
    (a.x + b.x) / 2,
    0.03,
    (a.z + b.z) / 2
  );
  previewWall.rotation.y = -Math.atan2(dz, dx);
}

function selectObject(object) {
  if (selected && selected.material && selected.userData.originalColor !== undefined) {
    selected.material.color.setHex(selected.userData.originalColor);
  }

  selected = object;

  if (selected) {
    if (selected.userData.originalColor === undefined) {
      selected.userData.originalColor = selected.material.color.getHex();
    }
    selected.material.color.offsetHSL(0, 0, 0.12);
  }

  updateProperties();
}

function updateProperties() {
  empty.hidden = Boolean(selected);
  content.hidden = !selected;

  if (!selected) return;

  oname.textContent = selected.name;
  otype.textContent = selected.userData.type || "Element";

  px.value = selected.position.x.toFixed(2);
  py.value = selected.position.y.toFixed(2);
  pz.value = selected.position.z.toFixed(2);

  sx.value = selected.userData.size.x.toFixed(2);
  sy.value = selected.userData.size.y.toFixed(2);
  sz.value = selected.userData.size.z.toFixed(2);

  wallprops.hidden = selected.userData.type !== "Wall";

  if (selected.userData.type === "Wall") {
    lengthEl.textContent = selected.userData.size.x.toFixed(2) + " m";
    thick.value = selected.userData.thickness;
  }

  mat.value = selected.userData.material || "Concrete";
}

function setSelectTool() {
  currentTool = "select";
  wallStart = null;

  if (previewWall) {
    scene.remove(previewWall);
    previewWall.geometry.dispose();
    previewWall.material.dispose();
    previewWall = null;
  }

  wallHint.classList.remove("show");

  document.querySelectorAll(".tool").forEach((button) => {
    button.classList.remove("active", "wallactive");
  });

  const selectButton = document.querySelector('[data-tool="select"]');
  if (selectButton) selectButton.classList.add("active");
}

function setWallTool() {
  currentTool = "wall";
  wallStart = null;

  if (previewWall) {
    scene.remove(previewWall);
    previewWall.geometry.dispose();
    previewWall.material.dispose();
    previewWall = null;
  }

  wallHint.classList.add("show");

  document.querySelectorAll(".tool").forEach((button) => {
    button.classList.remove("active", "wallactive");
  });

  const wallButton = document.querySelector('[data-tool="wall"]');
  if (wallButton) wallButton.classList.add("wallactive");
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (currentTool === "wall") {
    const point = getGroundPoint(event);

    if (!point) return;

    // First click
    if (!wallStart) {
      wallStart = point;

      previewWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.06, 0.06),
        new THREE.MeshBasicMaterial({
          color: 0x77d995
        })
      );

      previewWall.position.set(point.x, 0.03, point.z);
      scene.add(previewWall);

      return;
    }

    // Second click
    const endPoint = point;

    if (previewWall) {
      scene.remove(previewWall);
      previewWall.geometry.dispose();
      previewWall.material.dispose();
      previewWall = null;
    }

    createWall(wallStart, endPoint);
    wallStart = null;

    // Stay in wall mode so several walls can be created.
    return;
  }

  if (currentTool !== "select") return;

  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(objects, false);
  selectObject(hits.length ? hits[0].object : null);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (currentTool === "wall" && wallStart && previewWall) {
    const point = getGroundPoint(event);
    if (point) updatePreview(wallStart, point);
  }

  const point = getGroundPoint(event);
  if (point) {
    cx.textContent = point.x.toFixed(2);
    cy.textContent = point.y.toFixed(2);
    cz.textContent = point.z.toFixed(2);
  }
});

document.querySelectorAll('[data-tool]').forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.tool === "wall") {
      setWallTool();
    } else {
      setSelectTool();
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSelectTool();
  }
});

$("close").addEventListener("click", () => selectObject(null));

$("del").addEventListener("click", () => {
  if (!selected) return;

  scene.remove(selected);
  const index = objects.indexOf(selected);
  if (index >= 0) objects.splice(index, 1);

  selected = null;
  updateProperties();
});

$("home").addEventListener("click", () => {
  camera.position.set(12, 10, 14);
  controls.target.set(0, 1, 0);
  controls.update();
});

$("top").addEventListener("click", () => {
  camera.position.set(0, 25, 0.01);
  controls.target.set(0, 0, 0);
  controls.update();
});

$("new").addEventListener("click", () => {
  location.reload();
});

$("save").addEventListener("click", () => {
  const data = objects.map((object) => ({
    name: object.name,
    type: object.userData.type,
    position: object.position.toArray(),
    size: object.userData.size,
    material: object.userData.material
  }));

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "archiforge-project.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$("png").addEventListener("click", () => {
  renderer.render(scene, camera);

  const link = document.createElement("a");
  link.href = renderer.domElement.toDataURL("image/png");
  link.download = "archiforge-view.png";
  link.click();
});

function bindNumberInput(input, callback) {
  input.addEventListener("change", () => {
    if (selected) callback(Number(input.value) || 0);
  });
}

bindNumberInput(px, (v) => selected.position.x = v);
bindNumberInput(py, (v) => selected.position.y = v);
bindNumberInput(pz, (v) => selected.position.z = v);

bindNumberInput(sx, (v) => {
  const value = Math.max(0.05, v);
  const old = selected.userData.size.x;
  selected.scale.x *= value / old;
  selected.userData.size.x = value;
});

bindNumberInput(sy, (v) => {
  const value = Math.max(0.05, v);
  const old = selected.userData.size.y;
  selected.scale.y *= value / old;
  selected.userData.size.y = value;
});

bindNumberInput(sz, (v) => {
  const value = Math.max(0.05, v);
  const old = selected.userData.size.z;
  selected.scale.z *= value / old;
  selected.userData.size.z = value;
});

thick.addEventListener("change", () => {
  if (!selected || selected.userData.type !== "Wall") return;

  const value = Math.max(0.05, Number(thick.value) || 0.2);
  const old = selected.userData.thickness;

  selected.scale.z *= value / old;
  selected.userData.thickness = value;
  selected.userData.size.z = value;
});

mat.addEventListener("change", () => {
  if (!selected) return;

  const colors = {
    Concrete: 0x8f9aa6,
    Brick: 0x8d6254,
    Glass: 0x6f8799,
    Wood: 0x8c6d4c,
    Steel: 0x68747f
  };

  selected.userData.material = mat.value;
  selected.material.color.setHex(colors[mat.value] || colors.Concrete);
});

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;

  if (!width || !height) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();
updateProperties();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
