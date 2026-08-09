import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

/* =========================================================
   ARCHIFORGE 3D v0.4.1
   ========================================================= */

const $ = id => document.getElementById(id);

const viewport = $("viewport");

/* =========================================================
   SCENE
   ========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1014);

const camera = new THREE.PerspectiveCamera(
  45,
  1,
  0.1,
  500
);

camera.position.set(12, 10, 14);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 2)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

viewport.appendChild(renderer.domElement);


/* =========================================================
   CAMERA CONTROLS
   ========================================================= */

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.07;

controls.target.set(0, 1, 0);

controls.minDistance = 2;
controls.maxDistance = 100;

controls.maxPolarAngle = Math.PI / 2.02;


/* =========================================================
   LIGHT
   ========================================================= */

scene.add(
  new THREE.HemisphereLight(
    0xc5d3df,
    0x20252c,
    2
  )
);

const sun = new THREE.DirectionalLight(
  0xffffff,
  2.5
);

sun.position.set(8, 14, 8);
sun.castShadow = true;

scene.add(sun);


/* =========================================================
   GRID
   ========================================================= */

const grid = new THREE.GridHelper(
  40,
  80,
  0x4b5662,
  0x252c34
);

scene.add(grid);


/* =========================================================
   FLOOR
   ========================================================= */

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({
    color: 0x11161b,
    roughness: 0.9
  })
);

floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;

floor.receiveShadow = true;

scene.add(floor);


/* =========================================================
   REMOVE LOADING
   ========================================================= */

const loading = $("loading");

if (loading) {
  loading.remove();
}


/* =========================================================
   OBJECT STORAGE
   ========================================================= */

const objects = [];

let selected = null;

let currentTool = "select";

let wallStart = null;
let previewWall = null;

let wallNumber = 1;


/* =========================================================
   UNDO / REDO
   ========================================================= */

const undoStack = [];
const redoStack = [];

let restoring = false;


function saveHistory() {

  if (restoring) return;

  undoStack.push(
    JSON.stringify(getSceneData())
  );

  redoStack.length = 0;

  updateHistoryButtons();
}


function getSceneData() {

  return objects.map(object => {

    return {

      name: object.name,

      type: object.userData.type,

      position: object.position.toArray(),

      rotation: object.rotation.toArray(),

      scale: object.scale.toArray(),

      size: {
        ...object.userData.size
      },

      material:
        object.userData.material || "Concrete",

      thickness:
        object.userData.thickness || null,

      opacity:
        object.userData.opacity ?? null

    };

  });

}


function restoreScene(data) {

  restoring = true;

  objects.forEach(object => {

    scene.remove(object);

  });

  objects.length = 0;

  selected = null;

  data.forEach(dataObject => {

    createFromData(dataObject);

  });

  restoring = false;

  updateProperties();

  updateHistoryButtons();

}


function createFromData(data) {

  let object;

  if (data.type === "ImageReference") {

    const material =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: data.opacity ?? 1,
        side: THREE.DoubleSide
      });

    object = new THREE.Mesh(
      new THREE.PlaneGeometry(
        data.size.x,
        data.size.y
      ),
      material
    );

  } else {

    object = new THREE.Mesh(

      new THREE.BoxGeometry(
        data.size.x,
        data.size.y,
        data.size.z
      ),

      new THREE.MeshStandardMaterial({
        color: materialColor(
          data.material
        ),
        roughness: 0.65
      })

    );

  }

  object.name = data.name;

  object.position.fromArray(
    data.position
  );

  object.rotation.fromArray(
    data.rotation
  );

  object.scale.fromArray(
    data.scale
  );

  object.castShadow = true;
  object.receiveShadow = true;

  object.userData = {
    type: data.type,

    size: {
      ...data.size
    },

    material:
      data.material || "Concrete",

    thickness:
      data.thickness,

    opacity:
      data.opacity
  };

  scene.add(object);

  objects.push(object);

  return object;
}


function undo() {

  if (!undoStack.length) return;

  redoStack.push(
    JSON.stringify(getSceneData())
  );

  const previous =
    JSON.parse(undoStack.pop());

  restoreScene(previous);

}


function redo() {

  if (!redoStack.length) return;

  undoStack.push(
    JSON.stringify(getSceneData())
  );

  const next =
    JSON.parse(redoStack.pop());

  restoreScene(next);

}


function updateHistoryButtons() {

  const undoButton = $("undo");
  const redoButton = $("redo");

  if (undoButton) {

    undoButton.disabled =
      undoStack.length === 0;

    undoButton.style.opacity =
      undoStack.length ? "1" : "0.35";

  }

  if (redoButton) {

    redoButton.disabled =
      redoStack.length === 0;

    redoButton.style.opacity =
      redoStack.length ? "1" : "0.35";

  }

}


$("undo")?.addEventListener(
  "click",
  undo
);

$("redo")?.addEventListener(
  "click",
  redo
);


/* =========================================================
   MATERIAL COLORS
   ========================================================= */

function materialColor(material) {

  const colors = {

    Concrete: 0x8f9aa6,

    Brick: 0x8d6254,

    Glass: 0x6f8799,

    Wood: 0x8c6d4c,

    Steel: 0x68747f

  };

  return colors[material] || colors.Concrete;

}


/* =========================================================
   ADD BASIC BUILDING
   ========================================================= */

function addBox(
  name,
  type,
  position,
  size,
  material = "Concrete"
) {

  const mesh = new THREE.Mesh(

    new THREE.BoxGeometry(
      size.x,
      size.y,
      size.z
    ),

    new THREE.MeshStandardMaterial({

      color: materialColor(material),

      roughness: 0.65

    })

  );

  mesh.name = name;

  mesh.position.set(
    position.x,
    position.y,
    position.z
  );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.userData = {

    type,

    size: {
      ...size
    },

    material

  };

  scene.add(mesh);

  objects.push(mesh);

  return mesh;

}


/* =========================================================
   DEFAULT BUILDING
   ========================================================= */

addBox(
  "Main Volume",
  "Building",
  {
    x: 0,
    y: 1.5,
    z: 0
  },
  {
    x: 8,
    y: 3,
    z: 6
  }
);


addBox(
  "Upper Volume",
  "Building",
  {
    x: 0.8,
    y: 3.7,
    z: -0.2
  },
  {
    x: 5.4,
    y: 1.4,
    z: 4.2
  }
);


/* =========================================================
   RAYCASTER
   ========================================================= */

const raycaster =
  new THREE.Raycaster();

const pointer =
  new THREE.Vector2();

const groundPlane =
  new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
  );


function groundPoint(event) {

  const rect =
    renderer.domElement
      .getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) /
      rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) /
      rect.height) * 2 + 1;

  raycaster.setFromCamera(
    pointer,
    camera
  );

  const point =
    new THREE.Vector3();

  if (
    !raycaster.ray.intersectPlane(
      groundPlane,
      point
    )
  ) {

    return null;

  }

  /* GRID SNAP */

  point.x =
    Math.round(point.x * 2) / 2;

  point.z =
    Math.round(point.z * 2) / 2;

  point.y = 0;

  return point;

}


/* =========================================================
   WALL
   ========================================================= */

function createWall(start, end) {

  const dx =
    end.x - start.x;

  const dz =
    end.z - start.z;

  const length =
    Math.hypot(dx, dz);

  if (length < 0.25) return;

  saveHistory();

  const height = 3;

  const thickness = 0.2;

  const wall = new THREE.Mesh(

    new THREE.BoxGeometry(
      length,
      height,
      thickness
    ),

    new THREE.MeshStandardMaterial({

      color: 0x8f9aa6,

      roughness: 0.7

    })

  );

  wall.position.set(

    (start.x + end.x) / 2,

    height / 2,

    (start.z + end.z) / 2

  );

  wall.rotation.y =
    -Math.atan2(dz, dx);

  wall.name =
    "Wall " + wallNumber++;

  wall.castShadow = true;
  wall.receiveShadow = true;

  wall.userData = {

    type: "Wall",

    size: {

      x: length,

      y: height,

      z: thickness

    },

    material: "Concrete",

    thickness

  };

  scene.add(wall);

  objects.push(wall);

  selectObject(wall);

}


/* =========================================================
   WALL PREVIEW
   ========================================================= */

function updateWallPreview(
  start,
  end
) {

  if (!previewWall) return;

  const dx =
    end.x - start.x;

  const dz =
    end.z - start.z;

  const length =
    Math.max(
      Math.hypot(dx, dz),
      0.01
    );

  previewWall.scale.x =
    length;

  previewWall.position.set(

    (start.x + end.x) / 2,

    0.03,

    (start.z + end.z) / 2

  );

  previewWall.rotation.y =
    -Math.atan2(dz, dx);

}


/* =========================================================
   TOOL SYSTEM
   ========================================================= */

function setTool(tool) {

  currentTool = tool;

  document
    .querySelectorAll(".tool")
    .forEach(button => {

      button.classList.remove(
        "active",
        "wallactive"
      );

    });

  const button =
    document.querySelector(
      `[data-tool="${tool}"]`
    );

  if (button) {

    button.classList.add(
      tool === "wall"
        ? "wallactive"
        : "active"
    );

  }


  if (tool === "wall") {

    const hint = $("hint");

    if (hint) {

      hint.textContent =
        "🧱 Стена: нажмите первую точку, затем вторую. Shift — ровная стена.";

      hint.classList.add("show");

    }

  } else {

    cancelWall();

  }

}


document
  .querySelectorAll("[data-tool]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        setTool(
          button.dataset.tool
        );

        playSound();

      }
    );

  });


/* =========================================================
   CANCEL WALL
   ========================================================= */

function cancelWall() {

  wallStart = null;

  if (previewWall) {

    scene.remove(previewWall);

    previewWall.geometry.dispose();

    previewWall.material.dispose();

    previewWall = null;

  }

  const hint = $("hint");

  if (hint) {

    hint.classList.remove(
      "show"
    );

  }

}


/* =========================================================
   3D CLICK
   ========================================================= */

renderer.domElement.addEventListener(
  "pointerdown",
  event => {

    /* WALL */

    if (
      currentTool === "wall"
    ) {

      const point =
        groundPoint(event);

      if (!point) return;


      if (!wallStart) {

        wallStart = point;

        previewWall =
          new THREE.Mesh(

            new THREE.BoxGeometry(
              1,
              0.06,
              0.06
            ),

            new THREE.MeshBasicMaterial({
              color: 0x77d995
            })

          );

        previewWall.position.set(
          point.x,
          0.03,
          point.z
        );

        scene.add(
          previewWall
        );

      } else {

        let end = point;


        /* SHIFT = STRAIGHT */

        if (event.shiftKey) {

          const dx =
            Math.abs(
              end.x - wallStart.x
            );

          const dz =
            Math.abs(
              end.z - wallStart.z
            );

          if (dx >= dz) {

            end.z =
              wallStart.z;

          } else {

            end.x =
              wallStart.x;

          }

        }


        if (previewWall) {

          scene.remove(
            previewWall
          );

          previewWall.geometry.dispose();

          previewWall.material.dispose();

          previewWall = null;

        }


        createWall(
          wallStart,
          end
        );

        wallStart = null;

      }

      return;

    }


    /* SELECT */

    if (
      currentTool !== "select"
    ) {

      return;

    }


    const rect =
      renderer.domElement
        .getBoundingClientRect();

    pointer.x =
      ((event.clientX - rect.left) /
        rect.width) * 2 - 1;

    pointer.y =
      -((event.clientY - rect.top) /
        rect.height) * 2 + 1;


    raycaster.setFromCamera(
      pointer,
      camera
    );


    const hits =
      raycaster.intersectObjects(
        objects,
        false
      );


    selectObject(
      hits.length
        ? hits[0].object
        : null
    );

  }
);


/* =========================================================
   POINTER MOVE
   ========================================================= */

renderer.domElement.addEventListener(
  "pointermove",
  event => {

    const point =
      groundPoint(event);

    if (!point) return;


    $("cx").textContent =
      point.x.toFixed(2);

    $("cy").textContent =
      point.y.toFixed(2);

    $("cz").textContent =
      point.z.toFixed(2);


    if (
      currentTool === "wall" &&
      wallStart &&
      previewWall
    ) {

      let end = point;


      if (event.shiftKey) {

        const dx =
          Math.abs(
            end.x - wallStart.x
          );

        const dz =
          Math.abs(
            end.z - wallStart.z
          );

        if (dx >= dz) {

          end.z =
            wallStart.z;

        } else {

          end.x =
            wallStart.x;

        }

      }


      updateWallPreview(
        wallStart,
        end
      );

    }

  }
);


/* =========================================================
   SELECTION
   ========================================================= */

function selectObject(object) {

  if (
    selected &&
    selected.material &&
    selected.userData
      .originalColor !== undefined
  ) {

    selected.material.color.setHex(
      selected.userData.originalColor
    );

  }


  selected = object;


  if (selected) {

    if (
      selected.material &&
      selected.material.color
    ) {

      if (
        selected.userData
          .originalColor === undefined
      ) {

        selected.userData
          .originalColor =
          selected.material.color.getHex();

      }

      selected.material.color
        .offsetHSL(
          0,
          0,
          0.12
        );

    }

  }


  updateProperties();

}


/* =========================================================
   PROPERTIES
   ========================================================= */

function updateProperties() {

  const hasObject =
    !!selected;

  $("empty").hidden =
    hasObject;

  $("content").hidden =
    !hasObject;


  if (!selected) return;


  $("oname").textContent =
    selected.name;

  $("otype").textContent =
    selected.userData.type ||
    "Element";


  const position =
    selected.position;


  $("px").value =
    position.x.toFixed(2);

  $("py").value =
    position.y.toFixed(2);

  $("pz").value =
    position.z.toFixed(2);


  $("sx").value =
    selected.userData.size.x.toFixed(2);

  $("sy").value =
    selected.userData.size.y.toFixed(2);

  $("sz").value =
    selected.userData.size.z.toFixed(2);


  $("wallprops").hidden =
    selected.userData.type !== "Wall";


  $("imageprops").hidden =
    selected.userData.type !==
    "ImageReference";


  $("mat").value =
    selected.userData.material ||
    "Concrete";


  if (
    selected.userData.type ===
    "Wall"
  ) {

    $("thick").value =
      selected.userData.thickness ||
      0.2;

  }


  if (
    selected.userData.type ===
    "ImageReference"
  ) {

    $("opacity").value =
      selected.userData.opacity ??
      1;

  }

}


/* =========================================================
   IMAGE UPLOAD
   ========================================================= */

$("imageBtn")?.addEventListener(
  "click",
  () => {

    playSound();

    $("imageFile")?.click();

  }
);


$("imageFile")?.addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];

    if (!file) return;


    const url =
      URL.createObjectURL(file);

    const image =
      new Image();


    image.onload = () => {

      saveHistory();


      const ratio =
        image.width /
        image.height;


      const maxSize = 8;


      let width;
      let height;


      if (ratio >= 1) {

        width = maxSize;

        height =
          maxSize / ratio;

      } else {

        height = maxSize;

        width =
          maxSize * ratio;

      }


      const texture =
        new THREE.Texture(
          image
        );

      texture.colorSpace =
        THREE.SRGBColorSpace;

      texture.needsUpdate =
        true;


      const material =
        new THREE.MeshBasicMaterial({

          map: texture,

          transparent: true,

          opacity: 1,

          side:
            THREE.DoubleSide

        });


      const imagePlane =
        new THREE.Mesh(

          new THREE.PlaneGeometry(
            width,
            height
          ),

          material

        );


      /*
       * Изображение лежит
       * на полу 3D-сцены.
       */

      imagePlane.rotation.x =
        -Math.PI / 2;


      imagePlane.position.set(
        0,
        0.02,
        0
      );


      imagePlane.name =
        "Reference Image";


      imagePlane.userData = {

        type:
          "ImageReference",

        size: {

          x: width,

          y: height,

          z: 0

        },

        material:
          "Image",

        opacity: 1,

        originalFile:
          file.name

      };


      scene.add(
        imagePlane
      );

      objects.push(
        imagePlane
      );


      selectObject(
        imagePlane
      );


      URL.revokeObjectURL(
        url
      );

    };


    image.src = url;


    event.target.value = "";

  }
);


/* =========================================================
   DELETE
   ========================================================= */

function deleteSelected() {

  if (!selected) return;


  saveHistory();


  scene.remove(
    selected
  );


  const index =
    objects.indexOf(
      selected
    );


  if (index >= 0) {

    objects.splice(
      index,
      1
    );

  }


  selected = null;

  updateProperties();

  playSound();

}


$("deleteTool")?.addEventListener(
  "click",
  deleteSelected
);


$("del")?.addEventListener(
  "click",
  deleteSelected
);


/* =========================================================
   CLOSE PROPERTY PANEL
   ========================================================= */

$("close")?.addEventListener(
  "click",
  () => {

    selectObject(null);

    playSound();

  }
);


/* =========================================================
   HOME
   ========================================================= */

$("home")?.addEventListener(
  "click",
  () => {

    camera.position.set(
      12,
      10,
      14
    );

    controls.target.set(
      0,
      1,
      0
    );

    controls.update();

    playSound();

  }
);


/* =========================================================
   TOP VIEW
   ========================================================= */

$("top")?.addEventListener(
  "click",
  () => {

    camera.position.set(
      0,
      25,
      0.01
    );

    controls.target.set(
      0,
      0,
      0
    );

    controls.update();

    playSound();

  }
);


/* =========================================================
   NEW PROJECT
   ========================================================= */

$("new")?.addEventListener(
  "click",
  () => {

    playSound();

    const answer =
      confirm(
        "Создать новый проект?"
      );

    if (answer) {

      location.reload();

    }

  }
);


/* =========================================================
   SAVE PROJECT
   ========================================================= */

$("save")?.addEventListener(
  "click",
  () => {

    const data =
      getSceneData();


    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );


    const link =
      document.createElement(
        "a"
      );

    link.href =
      URL.createObjectURL(
        blob
      );

    link.download =
      "archiforge-project.json";

    link.click();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          link.href
        ),
      1000
    );


    playSound();

  }
);


/* =========================================================
   PNG
   ========================================================= */

$("png")?.addEventListener(
  "click",
  () => {

    renderer.render(
      scene,
      camera
    );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      renderer.domElement
        .toDataURL(
          "image/png"
        );


    link.download =
      "archiforge-view.png";


    link.click();

    playSound();

  }
);


/* =========================================================
   POSITION EDITING
   ========================================================= */

["px", "py", "pz"]
  .forEach(
    (id, index) => {

      $(id)?.addEventListener(
        "change",
        () => {

          if (!selected)
            return;


          saveHistory();


          const value =
            Number(
              $(id).value
            ) || 0;


          selected.position
            .setComponent(
              index,
              value
            );


          updateProperties();

        }
      );

    }
  );


/* =========================================================
   SIZE EDITING
   ========================================================= */

["sx", "sy", "sz"]
  .forEach(
    (id, index) => {

      $(id)?.addEventListener(
        "change",
        () => {

          if (
            !selected ||
            selected.userData
              .type ===
              "ImageReference"
          ) {

            return;

          }


          saveHistory();


          const keys =
            ["x", "y", "z"];

          const key =
            keys[index];


          const value =
            Math.max(
              0.05,
              Number(
                $(id).value
              ) || 0.05
            );


          const old =
            selected.userData
              .size[key];


          selected.scale
            .setComponent(
              index,
              selected.scale
                .getComponent(
                  index
                ) *
                value /
                old
            );


          selected.userData
            .size[key] =
            value;


          updateProperties();

        }
      );

    }
  );


/* =========================================================
   WALL THICKNESS
   ========================================================= */

$("thick")?.addEventListener(
  "change",
  () => {

    if (
      !selected ||
      selected.userData.type !==
        "Wall"
    ) {

      return;

    }


    saveHistory();


    const value =
      Math.max(
        0.05,
        Number(
          $("thick").value
        ) || 0.2
      );


    const old =
      selected.userData
        .thickness;


    selected.scale.z *=
      value / old;


    selected.userData
      .thickness =
      value;


    selected.userData
      .size.z =
      value;


    updateProperties();

  }
);


/* =========================================================
   IMAGE OPACITY
   ========================================================= */

$("opacity")?.addEventListener(
  "input",
  () => {

    if (
      !selected ||
      selected.userData.type !==
        "ImageReference"
    ) {

      return;

    }


    const value =
      Number(
        $("opacity").value
      );


    selected.userData
      .opacity =
      value;


    selected.material
      .opacity =
      value;

  }
);


/* =========================================================
   MATERIAL
   ========================================================= */

$("mat")?.addEventListener(
  "change",
  () => {

    if (!selected) return;


    if (
      selected.userData.type ===
      "ImageReference"
    ) {

      return;

    }


    saveHistory();


    const material =
      $("mat").value;


    selected.userData
      .material =
      material;


    selected.material
      .color.setHex(
        materialColor(
          material
        )
      );


    updateProperties();

  }
);


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    /* ESC */

    if (
      event.key ===
      "Escape"
    ) {

      cancelWall();

      setTool(
        "select"
      );

      playSound();

      return;

    }


    /* DELETE */

    if (
      event.key ===
      "Delete"
    ) {

      deleteSelected();

      return;

    }


    /* CTRL / CMD + Z */

    if (
      (event.ctrlKey ||
       event.metaKey) &&
      event.key.toLowerCase() ===
        "z"
    ) {

      event.preventDefault();

      if (event.shiftKey) {

        redo();

      } else {

        undo();

      }

      return;

    }


    /* CTRL / CMD + Y */

    if (
      (event.ctrlKey ||
       event.metaKey) &&
      event.key.toLowerCase() ===
        "y"
    ) {

      event.preventDefault();

      redo();

    }

  }
);


/* =========================================================
   BUTTON SOUND
   ========================================================= */

let audioContext = null;


function playSound() {

  try {

    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioCtx)
      return;


    if (!audioContext) {

      audioContext =
        new AudioCtx();

    }


    if (
      audioContext.state ===
      "suspended"
    ) {

      audioContext.resume();

    }


    const now =
      audioContext.currentTime;


    const oscillator =
      audioContext
        .createOscillator();


    const gain =
      audioContext
        .createGain();


    oscillator.type =
      "sine";


    oscillator.frequency
      .setValueAtTime(
        620,
        now
      );


    oscillator.frequency
      .exponentialRampToValueAtTime(
        380,
        now + 0.06
      );


    gain.gain
      .setValueAtTime(
        0.0001,
        now
      );


    gain.gain
      .exponentialRampToValueAtTime(
        0.035,
        now + 0.008
      );


    gain.gain
      .exponentialRampToValueAtTime(
        0.0001,
        now + 0.07
      );


    oscillator.connect(
      gain
    );

    gain.connect(
      audioContext.destination
    );


    oscillator.start(
      now
    );

    oscillator.stop(
      now + 0.08
    );

  } catch (error) {

    console.log(
      "Audio unavailable"
    );

  }

}


/* =========================================================
   RESIZE
   ========================================================= */

function resize() {

  const width =
    viewport.clientWidth;

  const height =
    viewport.clientHeight;


  if (
    !width ||
    !height
  ) {

    return;

  }


  renderer.setSize(
    width,
    height,
    false
  );


  camera.aspect =
    width / height;


  camera.updateProjectionMatrix();

}


window.addEventListener(
  "resize",
  resize
);


/* =========================================================
   START
   ========================================================= */

resize();

updateProperties();

updateHistoryButtons();


function animate() {

  requestAnimationFrame(
    animate
  );

  controls.update();

  renderer.render(
    scene,
    camera
  );

}


animate();
