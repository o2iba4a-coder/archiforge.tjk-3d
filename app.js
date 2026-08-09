import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

/* ============================================================
   ARCHIFORGE 3D v0.5
   Professional architectural prototype
   ============================================================ */

const $ = id => document.getElementById(id);

const viewport = $("viewport");

if (!viewport) {
  throw new Error("ArchiForge: #viewport not found");
}


/* ============================================================
   BASIC STATE
   ============================================================ */

let currentTool = "select";

let selected = null;

let wallStart = null;
let previewWall = null;

let measureStart = null;
let measureLine = null;
let measureLabel = null;

let objectCounter = 1;
let wallCounter = 1;

const objects = [];

const undoStack = [];
const redoStack = [];

let restoring = false;


/* ============================================================
   SCENE
   ============================================================ */

const scene = new THREE.Scene();

scene.background =
  new THREE.Color(0x0c1014);


/* ============================================================
   CAMERA
   ============================================================ */

const camera =
  new THREE.PerspectiveCamera(
    45,
    1,
    0.1,
    500
  );

camera.position.set(
  12,
  10,
  14
);


/* ============================================================
   RENDERER
   ============================================================ */

const renderer =
  new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true
  });

renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio || 1,
    2
  )
);

renderer.outputColorSpace =
  THREE.SRGBColorSpace;

renderer.shadowMap.enabled = true;

viewport.appendChild(
  renderer.domElement
);


/* ============================================================
   CAMERA CONTROLS
   ============================================================ */

const controls =
  new OrbitControls(
    camera,
    renderer.domElement
  );

controls.enableDamping = true;

controls.dampingFactor = 0.07;

controls.target.set(
  0,
  1,
  0
);

controls.minDistance = 2;

controls.maxDistance = 100;

controls.maxPolarAngle =
  Math.PI / 2.02;


/* ============================================================
   LIGHTING
   ============================================================ */

scene.add(
  new THREE.HemisphereLight(
    0xc5d3df,
    0x20252c,
    2
  )
);

const sun =
  new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

sun.position.set(
  8,
  14,
  8
);

sun.castShadow = true;

scene.add(sun);


/* ============================================================
   GRID
   ============================================================ */

const grid =
  new THREE.GridHelper(
    40,
    80,
    0x4b5662,
    0x252c34
  );

scene.add(grid);


/* ============================================================
   FLOOR
   ============================================================ */

const floor =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      40,
      40
    ),
    new THREE.MeshStandardMaterial({
      color: 0x11161b,
      roughness: 0.9
    })
  );

floor.rotation.x =
  -Math.PI / 2;

floor.position.y =
  -0.01;

floor.receiveShadow =
  true;

scene.add(floor);


/* ============================================================
   REMOVE LOADING
   ============================================================ */

if ($("loading")) {
  $("loading").remove();
}


/* ============================================================
   MATERIALS
   ============================================================ */

const MATERIAL_COLORS = {

  Concrete: 0x8f9aa6,

  Brick: 0x8d6254,

  Glass: 0x6f8799,

  Wood: 0x8c6d4c,

  Steel: 0x68747f

};


function materialColor(name) {

  return (
    MATERIAL_COLORS[name] ||
    MATERIAL_COLORS.Concrete
  );

}


/* ============================================================
   RAYCAST
   ============================================================ */

const raycaster =
  new THREE.Raycaster();

const pointer =
  new THREE.Vector2();

const groundPlane =
  new THREE.Plane(
    new THREE.Vector3(
      0,
      1,
      0
    ),
    0
  );


function screenPointer(event) {

  const rect =
    renderer.domElement
      .getBoundingClientRect();

  pointer.x =
    (
      (event.clientX - rect.left) /
      rect.width
    ) * 2 - 1;

  pointer.y =
    -(
      (event.clientY - rect.top) /
      rect.height
    ) * 2 + 1;

}


/* ============================================================
   GROUND POINT + GRID SNAP
   ============================================================ */

function groundPoint(event) {

  screenPointer(event);

  raycaster.setFromCamera(
    pointer,
    camera
  );

  const point =
    new THREE.Vector3();

  const hit =
    raycaster.ray.intersectPlane(
      groundPlane,
      point
    );

  if (!hit) return null;

  const snap = 0.5;

  point.x =
    Math.round(
      point.x / snap
    ) * snap;

  point.z =
    Math.round(
      point.z / snap
    ) * snap;

  point.y = 0;

  return point;

}


/* ============================================================
   STRAIGHT ANGLE SNAP
   ============================================================ */

function snapDirection(
  start,
  end,
  forceStraight = false
) {

  const result =
    end.clone();

  if (!forceStraight) {

    return result;

  }

  const dx =
    Math.abs(
      end.x - start.x
    );

  const dz =
    Math.abs(
      end.z - start.z
    );

  if (dx >= dz) {

    result.z =
      start.z;

  } else {

    result.x =
      start.x;

  }

  return result;

}


/* ============================================================
   OBJECT HELPERS
   ============================================================ */

function addObject(
  object,
  type,
  size,
  material = "Concrete"
) {

  object.userData = {

    type,

    size: {
      ...size
    },

    material,

    thickness:
      type === "Wall"
        ? size.z
        : undefined

  };

  object.castShadow = true;

  object.receiveShadow = true;

  scene.add(object);

  objects.push(object);

  return object;

}


/* ============================================================
   DEFAULT ARCHITECTURAL BLOCKS
   ============================================================ */

function createBox(
  position,
  size,
  name = null
) {

  const mesh =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        size.x,
        size.y,
        size.z
      ),

      new THREE.MeshStandardMaterial({
        color:
          materialColor(
            "Concrete"
          ),
        roughness: 0.65
      })

    );

  mesh.position.copy(
    position
  );

  mesh.name =
    name ||
    `Object ${objectCounter++}`;

  addObject(
    mesh,
    "Box",
    size
  );

  return mesh;

}


/* Initial building volume */

const mainBuilding =
  createBox(
    new THREE.Vector3(
      0,
      1.5,
      0
    ),
    {
      x: 8,
      y: 3,
      z: 6
    },
    "Main Volume"
  );

mainBuilding.userData.type =
  "Building";


const upperBuilding =
  createBox(
    new THREE.Vector3(
      0.8,
      3.7,
      -0.2
    ),
    {
      x: 5.4,
      y: 1.4,
      z: 4.2
    },
    "Upper Volume"
  );

upperBuilding.userData.type =
  "Building";


/* ============================================================
   SELECTION
   ============================================================ */

function clearHighlight() {

  if (!selected)
    return;

  if (
    selected.material &&
    selected.userData &&
    selected.userData.originalColor
      !== undefined
  ) {

    selected.material.color.setHex(
      selected.userData.originalColor
    );

  }

}


function highlight(object) {

  if (
    !object ||
    !object.material ||
    !object.material.color
  ) {
    return;
  }

  object.userData.originalColor =
    object.material.color.getHex();

  object.material.color.offsetHSL(
    0,
    0,
    0.13
  );

}


function selectObject(object) {

  clearHighlight();

  selected =
    object || null;

  if (selected) {

    highlight(
      selected
    );

  }

  updateProperties();

}


/* ============================================================
   PROPERTIES
   ============================================================ */

function updateProperties() {

  const empty =
    $("empty");

  const content =
    $("content");

  if (!selected) {

    if (empty)
      empty.hidden = false;

    if (content)
      content.hidden = true;

    return;

  }

  if (empty)
    empty.hidden = true;

  if (content)
    content.hidden = false;


  if ($("oname"))
    $("oname").textContent =
      selected.name;

  if ($("otype"))
    $("otype").textContent =
      selected.userData.type ||
      "Object";


  if ($("px"))
    $("px").value =
      selected.position.x.toFixed(2);

  if ($("py"))
    $("py").value =
      selected.position.y.toFixed(2);

  if ($("pz"))
    $("pz").value =
      selected.position.z.toFixed(2);


  if ($("sx"))
    $("sx").value =
      selected.userData.size.x.toFixed(2);

  if ($("sy"))
    $("sy").value =
      selected.userData.size.y.toFixed(2);

  if ($("sz"))
    $("sz").value =
      selected.userData.size.z.toFixed(2);


  if ($("wallprops")) {

    $("wallprops").hidden =
      selected.userData.type !==
      "Wall";

  }


  if ($("imageprops")) {

    $("imageprops").hidden =
      selected.userData.type !==
      "ImageReference";

  }


  if ($("mat")) {

    $("mat").value =
      selected.userData.material ||
      "Concrete";

  }


  if (
    selected.userData.type ===
    "Wall" &&
    $("thick")
  ) {

    $("thick").value =
      selected.userData
        .thickness ||
      0.2;

  }


  if (
    selected.userData.type ===
    "ImageReference" &&
    $("opacity")
  ) {

    $("opacity").value =
      selected.userData
        .opacity ??
      1;

  }

}


/* ============================================================
   HISTORY SERIALIZATION
   ============================================================ */

function serializeScene() {

  return objects.map(
    object => {

      return {

        name:
          object.name,

        type:
          object.userData.type,

        position:
          object.position.toArray(),

        rotation:
          object.rotation.toArray(),

        scale:
          object.scale.toArray(),

        size: {
          ...object.userData.size
        },

        material:
          object.userData.material,

        thickness:
          object.userData.thickness,

        opacity:
          object.userData.opacity

      };

    }
  );

}


function saveHistory() {

  if (restoring)
    return;

  undoStack.push(
    JSON.stringify(
      serializeScene()
    )
  );

  if (
    undoStack.length > 50
  ) {

    undoStack.shift();

  }

  redoStack.length = 0;

  updateHistoryButtons();

}


/* ============================================================
   RESTORE
   ============================================================ */

function clearSceneObjects() {

  objects.forEach(
    object => {

      scene.remove(
        object
      );

      if (
        object.geometry
      ) {

        object.geometry.dispose();

      }

      if (
        object.material
      ) {

        if (
          object.material.map
        ) {

          object.material.map.dispose();

        }

        object.material.dispose();

      }

    }
  );

  objects.length = 0;

}


function recreateObject(data) {

  let object;


  /* IMAGE */

  if (
    data.type ===
    "ImageReference"
  ) {

    const material =
      new THREE.MeshBasicMaterial({

        color: 0xffffff,

        transparent: true,

        opacity:
          data.opacity ??
          1,

        side:
          THREE.DoubleSide

      });


    object =
      new THREE.Mesh(

        new THREE.PlaneGeometry(
          data.size.x,
          data.size.y
        ),

        material

      );


    object.rotation.x =
      -Math.PI / 2;


    object.userData = {

      type:
        "ImageReference",

      size: {
        ...data.size
      },

      material:
        "Image",

      opacity:
        data.opacity ??
        1

    };

  }

  else {

    object =
      new THREE.Mesh(

        new THREE.BoxGeometry(
          data.size.x,
          data.size.y,
          data.size.z
        ),

        new THREE.MeshStandardMaterial({

          color:
            materialColor(
              data.material
            ),

          roughness: 0.65

        })

      );


    object.userData = {

      type:
        data.type,

      size: {
        ...data.size
      },

      material:
        data.material ||
        "Concrete",

      thickness:
        data.thickness

    };

  }


  object.name =
    data.name;

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

  scene.add(
    object
  );

  objects.push(
    object
  );

}


function restoreScene(data) {

  restoring = true;

  clearSceneObjects();

  selected = null;

  data.forEach(
    item => {

      recreateObject(
        item
      );

    }
  );

  restoring = false;

  updateProperties();

  updateHistoryButtons();

}


/* ============================================================
   UNDO / REDO
   ============================================================ */

function undo() {

  if (
    undoStack.length === 0
  ) {

    return;

  }

  redoStack.push(
    JSON.stringify(
      serializeScene()
    )
  );

  const state =
    JSON.parse(
      undoStack.pop()
    );

  restoreScene(
    state
  );

  playSound();

}


function redo() {

  if (
    redoStack.length === 0
  ) {

    return;

  }

  undoStack.push(
    JSON.stringify(
      serializeScene()
    )
  );

  const state =
    JSON.parse(
      redoStack.pop()
    );

  restoreScene(
    state
  );

  playSound();

}


function updateHistoryButtons() {

  const undo =
    $("undo");

  const redo =
    $("redo");


  if (undo) {

    undo.disabled =
      undoStack.length === 0;

    undo.style.opacity =
      undo.disabled
        ? "0.35"
        : "1";

  }


  if (redo) {

    redo.disabled =
      redoStack.length === 0;

    redo.style.opacity =
      redo.disabled
        ? "0.35"
        : "1";

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


/* ============================================================
   TOOLBAR
   ============================================================ */

function setTool(tool) {

  cancelTemporaryTool();

  currentTool =
    tool;


  document
    .querySelectorAll(
      ".tool"
    )
    .forEach(
      button => {

        button.classList.remove(
          "active",
          "wallactive"
        );

      }
    );


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


  const hint =
    $("hint");


  if (!hint)
    return;


  if (
    tool === "wall"
  ) {

    hint.textContent =
      "СТЕНА • первая точка → вторая точка • Shift = 90°";

    hint.classList.add(
      "show"
    );

  }

  else if (
    tool === "measure"
  ) {

    hint.textContent =
      "ИЗМЕРЕНИЕ • выберите две точки";

    hint.classList.add(
      "show"
    );

  }

  else {

    hint.classList.remove(
      "show"
    );

  }

}


document
  .querySelectorAll(
    "[data-tool]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          setTool(
            button.dataset.tool
          );

          playSound();

        }
      );

    }
  );


/* ============================================================
   TEMPORARY TOOL CLEANUP
   ============================================================ */

function cancelTemporaryTool() {

  wallStart = null;

  if (previewWall) {

    scene.remove(
      previewWall
    );

    previewWall.geometry.dispose();

    previewWall.material.dispose();

    previewWall = null;

  }


  measureStart = null;

  if (measureLine) {

    scene.remove(
      measureLine
    );

    measureLine.geometry.dispose();

    measureLine.material.dispose();

    measureLine = null;

  }


  if (measureLabel) {

    measureLabel.remove();

    measureLabel = null;

  }

}


/* ============================================================
   WALL CREATION
   ============================================================ */

function createWall(
  start,
  end
) {

  const dx =
    end.x - start.x;

  const dz =
    end.z - start.z;

  const length =
    Math.hypot(
      dx,
      dz
    );


  if (
    length < 0.25
  ) {

    return null;

  }


  saveHistory();


  const height = 3;

  const thickness =
    0.2;


  const wall =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        length,
        height,
        thickness
      ),

      new THREE.MeshStandardMaterial({

        color:
          materialColor(
            "Concrete"
          ),

        roughness:
          0.7

      })

    );


  wall.position.set(

    (start.x + end.x) / 2,

    height / 2,

    (start.z + end.z) / 2

  );


  wall.rotation.y =
    -Math.atan2(
      dz,
      dx
    );


  wall.name =
    `Wall ${wallCounter++}`;


  addObject(

    wall,

    "Wall",

    {
      x: length,
      y: height,
      z: thickness
    }

  );


  wall.userData.thickness =
    thickness;


  selectObject(
    wall
  );


  playSound();


  return wall;

}


/* ============================================================
   WALL PREVIEW
   ============================================================ */

function updateWallPreview(
  start,
  end
) {

  if (!previewWall)
    return;


  const dx =
    end.x - start.x;

  const dz =
    end.z - start.z;

  const length =
    Math.max(
      Math.hypot(
        dx,
        dz
      ),
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
    -Math.atan2(
      dz,
      dx
    );

}


/* ============================================================
   BOX TOOL
   ============================================================ */

function createBoxTool(
  point
) {

  saveHistory();


  const box =
    createBox(

      new THREE.Vector3(
        point.x,
        1,
        point.z
      ),

      {
        x: 2,
        y: 2,
        z: 2
      },

      `Box ${objectCounter++}`

    );


  selectObject(
    box
  );


  playSound();

}


/* ============================================================
   RECTANGLE TOOL
   ============================================================ */

function createRectangle(
  point
) {

  saveHistory();


  const rectangle =
    createBox(

      new THREE.Vector3(
        point.x,
        0.5,
        point.z
      ),

      {
        x: 4,
        y: 1,
        z: 2
      },

      `Rectangle ${objectCounter++}`

    );


  selectObject(
    rectangle
  );


  playSound();

}


/* ============================================================
   CYLINDER TOOL
   ============================================================ */

function createCylinder(
  point
) {

  saveHistory();


  const geometry =
    new THREE.CylinderGeometry(
      1,
      1,
      2,
      32
    );


  const cylinder =
    new THREE.Mesh(

      geometry,

      new THREE.MeshStandardMaterial({

        color:
          materialColor(
            "Concrete"
          ),

        roughness:
          0.65

      })

    );


  cylinder.position.set(
    point.x,
    1,
    point.z
  );


  cylinder.name =
    `Cylinder ${objectCounter++}`;


  addObject(

    cylinder,

    "Cylinder",

    {
      x: 2,
      y: 2,
      z: 2
    }

  );


  selectObject(
    cylinder
  );


  playSound();

}


/* ============================================================
   MOUSE / TOUCH DOWN
   ============================================================ */

renderer.domElement.addEventListener(
  "pointerdown",
  event => {

    const point =
      groundPoint(
        event
      );


    if (!point)
      return;


    /* ==========================================
       WALL
       ========================================== */

    if (
      currentTool ===
      "wall"
    ) {

      if (!wallStart) {

        wallStart =
          point;


        previewWall =
          new THREE.Mesh(

            new THREE.BoxGeometry(
              1,
              0.06,
              0.06
            ),

            new THREE.MeshBasicMaterial({

              color:
                0x77d995

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


      }

      else {

        const end =
          snapDirection(
            wallStart,
            point,
            event.shiftKey
          );


        if (
          previewWall
        ) {

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


    /* ==========================================
       BOX
       ========================================== */

    if (
      currentTool ===
      "box"
    ) {

      createBoxTool(
        point
      );

      return;

    }


    /* ==========================================
       RECTANGLE
       ========================================== */

    if (
      currentTool ===
      "rectangle"
    ) {

      createRectangle(
        point
      );

      return;

    }


    /* ==========================================
       CYLINDER
       ========================================== */

    if (
      currentTool ===
      "cylinder"
    ) {

      createCylinder(
        point
      );

      return;

    }


    /* ==========================================
       MEASURE
       ========================================== */

    if (
      currentTool ===
      "measure"
    ) {

      handleMeasure(
        point
      );

      return;

    }


    /* ==========================================
       SELECT
       ========================================== */

    if (
      currentTool !==
      "select"
    ) {

      return;

    }


    screenPointer(
      event
    );


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


/* ============================================================
   POINTER MOVE
   ============================================================ */

renderer.domElement.addEventListener(
  "pointermove",
  event => {

    const point =
      groundPoint(
        event
      );


    if (!point)
      return;


    if ($("cx"))
      $("cx").textContent =
        point.x.toFixed(2);

    if ($("cy"))
      $("cy").textContent =
        point.y.toFixed(2);

    if ($("cz"))
      $("cz").textContent =
        point.z.toFixed(2);


    if (
      currentTool ===
      "wall" &&
      wallStart &&
      previewWall
    ) {

      const end =
        snapDirection(
          wallStart,
          point,
          event.shiftKey
        );


      updateWallPreview(
        wallStart,
        end
      );

    }

  }
);


/* ============================================================
   MEASUREMENT
   ============================================================ */

function handleMeasure(
  point
) {

  if (!measureStart) {

    measureStart =
      point.clone();


    if (measureLine) {

      scene.remove(
        measureLine
      );

    }


    measureLine =
      new THREE.Line(

        new THREE.BufferGeometry()
          .setFromPoints([
            measureStart,
            measureStart
          ]),

        new THREE.LineBasicMaterial({
          color:
            0x77d995
        })

      );


    scene.add(
      measureLine
    );


    return;

  }


  const end =
    point.clone();


  const distance =
    measureStart.distanceTo(
      end
    );


  const geometry =
    new THREE.BufferGeometry()
      .setFromPoints([
        measureStart,
        end
      ]);


  measureLine.geometry.dispose();

  measureLine.geometry =
    geometry;


  showMeasureLabel(
    end,
    distance
  );


  measureStart = null;


  playSound();

}


function showMeasureLabel(
  position,
  distance
) {

  if (measureLabel) {

    measureLabel.remove();

  }


  measureLabel =
    document.createElement(
      "div"
    );


  measureLabel.style.position =
    "fixed";

  measureLabel.style.zIndex =
    "100";

  measureLabel.style.padding =
    "6px 10px";

  measureLabel.style.background =
    "#111820";

  measureLabel.style.border =
    "1px solid #4e6274";

  measureLabel.style.borderRadius =
    "6px";

  measureLabel.style.color =
    "#dce7ef";

  measureLabel.style.fontSize =
    "12px";

  measureLabel.style.pointerEvents =
    "none";


  measureLabel.textContent =
    `📏 ${distance.toFixed(2)} m`;


  document.body.appendChild(
    measureLabel
  );


  const vector =
    position.clone()
      .project(camera);


  measureLabel.style.left =
    (
      (vector.x + 1) / 2 *
      window.innerWidth
    ) + "px";


  measureLabel.style.top =
    (
      (-vector.y + 1) / 2 *
      window.innerHeight
    ) + "px";

}


/* ============================================================
   IMAGE IMPORT
   ============================================================ */

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


    if (!file)
      return;


    const url =
      URL.createObjectURL(
        file
      );


    const image =
      new Image();


    image.onload =
      () => {

        saveHistory();


        const ratio =
          image.width /
          image.height;


        const max =
          8;


        let width;
        let height;


        if (
          ratio >= 1
        ) {

          width =
            max;

          height =
            max /
            ratio;

        }

        else {

          height =
            max;

          width =
            max *
            ratio;

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

            map:
              texture,

            transparent:
              true,

            opacity:
              0.8,

            side:
              THREE.DoubleSide

          });


        const plane =
          new THREE.Mesh(

            new THREE.PlaneGeometry(
              width,
              height
            ),

            material

          );


        plane.rotation.x =
          -Math.PI / 2;


        plane.position.set(
          0,
          0.02,
          0
        );


        plane.name =
          "Reference Image";


        plane.userData = {

          type:
            "ImageReference",

          size: {

            x: width,

            y: height,

            z: 0

          },

          material:
            "Image",

          opacity:
            0.8,

          filename:
            file.name

        };


        scene.add(
          plane
        );


        objects.push(
          plane
        );


        selectObject(
          plane
        );


        URL.revokeObjectURL(
          url
        );

      };


    image.src =
      url;


    event.target.value =
      "";

  }
);


/* ============================================================
   DELETE
   ============================================================ */

function deleteSelected() {

  if (!selected)
    return;


  saveHistory();


  scene.remove(
    selected
  );


  const index =
    objects.indexOf(
      selected
    );


  if (
    index !== -1
  ) {

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


/* ============================================================
   CLOSE
   ============================================================ */

$("close")?.addEventListener(
  "click",
  () => {

    selectObject(
      null
    );

    playSound();

  }
);


/* ============================================================
   HOME
   ============================================================ */

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


/* ============================================================
   TOP
   ============================================================ */

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


/* ============================================================
   NEW PROJECT
   ============================================================ */

$("new")?.addEventListener(
  "click",
  () => {

    playSound();


    if (
      confirm(
        "Создать новый проект?"
      )
    ) {

      location.reload();

    }

  }
);


/* ============================================================
   SAVE
   ============================================================ */

$("save")?.addEventListener(
  "click",
  () => {

    const data =
      serializeScene();


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
      () => {

        URL.revokeObjectURL(
          link.href
        );

      },
      1000
    );


    playSound();

  }
);


/* ============================================================
   PNG
   ============================================================ */

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


/* ============================================================
   POSITION INPUTS
   ============================================================ */

const positionInputs = [
  "px",
  "py",
  "pz"
];


positionInputs.forEach(
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


/* ============================================================
   SIZE INPUTS
   ============================================================ */

const sizeInputs = [
  "sx",
  "sy",
  "sz"
];


sizeInputs.forEach(
  (id, index) => {

    $(id)?.addEventListener(
      "change",
      () => {

        if (!selected)
          return;


        if (
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


        const scale =
          selected.scale
            .getComponent(
              index
            );


        selected.scale
          .setComponent(

            index,

            scale *
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


/* ============================================================
   WALL THICKNESS
   ============================================================ */

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
        .thickness ||
      0.2;


    selected.scale.z *=
      value /
      old;


    selected.userData
      .thickness =
      value;


    selected.userData
      .size.z =
      value;


    updateProperties();

  }
);


/* ============================================================
   OPACITY
   ============================================================ */

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


    selected.material.opacity =
      value;


    selected.userData
      .opacity =
      value;

  }
);


/* ============================================================
   MATERIAL
   ============================================================ */

$("mat")?.addEventListener(
  "change",
  () => {

    if (!selected)
      return;


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


    if (
      selected.material &&
      selected.material.color
    ) {

      selected.material.color.setHex(
        materialColor(
          material
        )
      );

    }


    updateProperties();

  }
);


/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

document.addEventListener(
  "keydown",
  event => {

    /* ESC */

    if (
      event.key ===
      "Escape"
    ) {

      cancelTemporaryTool();

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


    /* CTRL/CMD + Z */

    if (
      (
        event.ctrlKey ||
        event.metaKey
      ) &&
      event.key.toLowerCase()
      === "z"
    ) {

      event.preventDefault();


      if (event.shiftKey) {

        redo();

      }

      else {

        undo();

      }


      return;

    }


    /* CTRL/CMD + Y */

    if (
      (
        event.ctrlKey ||
        event.metaKey
      ) &&
      event.key.toLowerCase()
      === "y"
    ) {

      event.preventDefault();

      redo();

    }

  }
);


/* ============================================================
   SOUND
   ============================================================ */

let audioContext =
  null;


function playSound() {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioContext)
      return;


    if (!audioContext) {

      audioContext =
        new AudioContext();

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
        now + 0.075
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

  }

  catch (
    error
  ) {

    console.log(
      "Audio unavailable"
    );

  }

}


/* ============================================================
   RESIZE
   ============================================================ */

function resize() {

  const width =
    viewport.clientWidth;

  const height =
    viewport.clientHeight;


  if (
    width <= 0 ||
    height <= 0
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


/* ============================================================
   START
   ============================================================ */

resize();

updateProperties();

updateHistoryButtons();

setTool(
  "select"
);


/* ============================================================
   RENDER LOOP
   ============================================================ */

function animate() {

  requestAnimationFrame(
    animate
  );


  controls.update();


  /* Update measurement label */

  if (
    measureLabel &&
    measureLine
  ) {

    const position =
      measureLine.geometry
        .attributes
        .position;


    const x =
      position.getX(1);

    const y =
      position.getY(1);

    const z =
      position.getZ(1);


    const vector =
      new THREE.Vector3(
        x,
        y,
        z
      ).project(
        camera
      );


    measureLabel.style.left =
      (
        (vector.x + 1) / 2 *
        window.innerWidth
      ) + "px";


    measureLabel.style.top =
      (
        (-vector.y + 1) / 2 *
        window.innerHeight
      ) + "px";

  }


  renderer.render(
    scene,
    camera
  );

}


animate();
