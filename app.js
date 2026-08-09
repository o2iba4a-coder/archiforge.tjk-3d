import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = id => document.getElementById(id);
const viewport=$("viewport"), wallHint=$("wallHint"), empty=$("empty"), content=$("content");
const oname=$("oname"), otype=$("otype"), px=$("px"), py=$("py"), pz=$("pz");
const sx=$("sx"), sy=$("sy"), sz=$("sz"), wallprops=$("wallprops"), lengthEl=$("length");
const thick=$("thick"), mat=$("mat"), cx=$("cx"), cy=$("cy"), cz=$("cz");

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c1014);

const camera=new THREE.PerspectiveCamera(45,1,.1,500);
camera.position.set(12,10,14);

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
viewport.appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.07;
controls.target.set(0,1,0);
controls.minDistance=2;
controls.maxDistance=80;
controls.maxPolarAngle=Math.PI/2.02;

scene.add(new THREE.HemisphereLight(0xc5d3df,0x20252c,2));
const sun=new THREE.DirectionalLight(0xffffff,2.6);
sun.position.set(7,14,8);
sun.castShadow=true;
scene.add(sun);
scene.add(new THREE.GridHelper(40,80,0x4b5662,0x252c34));

const floor=new THREE.Mesh(
  new THREE.PlaneGeometry(40,40),
  new THREE.MeshStandardMaterial({color:0x11161b,roughness:.9})
);
floor.rotation.x=-Math.PI/2;
floor.position.y=-.01;
floor.receiveShadow=true;
scene.add(floor);

const objects=[];
let selected=null;
let currentTool="select";
let wallStart=null;
let previewWall=null;
let wallNumber=1;

/* ---------- UI helpers ---------- */

function makeButton(id,text,handler){
  let b=$(id);
  if(!b) return null;
  b.addEventListener("click",e=>{buttonSound();handler(e)});
  return b;
}

/* ---------- Button sound ---------- */
/* No external audio file is needed. The browser creates a short professional UI click. */
let audioCtx=null;
function buttonSound(){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended") audioCtx.resume();
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(720,audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420,audioCtx.currentTime+.055);
    gain.gain.setValueAtTime(.0001,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055,audioCtx.currentTime+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.075);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime+.08);
  }catch(e){}
}

document.querySelectorAll("button,.tool").forEach(b=>{
  b.addEventListener("click",()=>buttonSound(),{passive:true});
});

/* ---------- Scene ---------- */

function addBox(name,type,pos,size,color){
  const m=new THREE.Mesh(
    new THREE.BoxGeometry(size.x,size.y,size.z),
    new THREE.MeshStandardMaterial({color,roughness:.65})
  );
  m.name=name;
  m.position.set(pos.x,pos.y,pos.z);
  m.castShadow=true;m.receiveShadow=true;
  m.userData={type,size:{...size},material:"Concrete"};
  scene.add(m);objects.push(m);
  return m;
}

addBox("Main Volume","Building",{x:0,y:1.5,z:0},{x:8,y:3,z:6},0x7e8994);
addBox("Upper Volume","Building",{x:.8,y:3.7,z:-.2},{x:5.4,y:1.4,z:4.2},0x9aa3ad);

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

function groundPoint(e){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const p=new THREE.Vector3();
  if(!raycaster.ray.intersectPlane(groundPlane,p)) return null;
  p.x=Math.round(p.x*2)/2;
  p.z=Math.round(p.z*2)/2;
  p.y=0;
  return p;
}

function createWall(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);
  if(L<.25) return null;

  const height=3, thickness=.2;
  const wall=new THREE.Mesh(
    new THREE.BoxGeometry(L,height,thickness),
    new THREE.MeshStandardMaterial({color:0x8f9aa6,roughness:.7})
  );

  wall.position.set((a.x+b.x)/2,height/2,(a.z+b.z)/2);
  wall.rotation.y=-Math.atan2(dz,dx);
  wall.name=`Wall ${wallNumber++}`;
  wall.castShadow=true;wall.receiveShadow=true;
  wall.userData={
    type:"Wall",
    size:{x:L,y:height,z:thickness},
    material:"Concrete",
    thickness
  };
  scene.add(wall);objects.push(wall);
  selectObject(wall);
  return wall;
}

function updatePreview(a,b){
  if(!previewWall)return;
  const dx=b.x-a.x,dz=b.z-a.z,L=Math.max(Math.hypot(dx,dz),.01);
  previewWall.scale.x=L;
  previewWall.position.set((a.x+b.x)/2,.03,(a.z+b.z)/2);
  previewWall.rotation.y=-Math.atan2(dz,dx);
}

/* ---------- Wall cancel button ---------- */

function createCancelButton(){
  let old=$("cancelWall");
  if(old) return old;

  const b=document.createElement("button");
  b.id="cancelWall";
  b.type="button";
  b.textContent="✕  Отменить";
  b.style.cssText=
    "position:absolute;top:112px;left:18px;z-index:20;padding:9px 13px;border:1px solid #70434a;border-radius:6px;background:#24191c;color:#e5a1aa;font-size:10px;cursor:pointer;box-shadow:0 6px 20px #0006";
  viewport.appendChild(b);
  b.addEventListener("click",()=>{buttonSound();cancelWall();});
  return b;
}

function removeCancelButton(){
  const b=$("cancelWall");
  if(b)b.remove();
}

function cancelWall(){
  wallStart=null;
  if(previewWall){
    scene.remove(previewWall);
    previewWall.geometry.dispose();
    previewWall.material.dispose();
    previewWall=null;
  }
  wallHint.classList.remove("show");
  removeCancelButton();
  setSelectTool(false);
}

function setWallTool(playSound=true){
  if(playSound)buttonSound();
  currentTool="wall";
  wallStart=null;
  if(previewWall){
    scene.remove(previewWall);
    previewWall=null;
  }
  wallHint.classList.add("show");
  createCancelButton();

  document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active","wallactive"));
  const b=document.querySelector('[data-tool="wall"]');
  if(b)b.classList.add("wallactive");
}

function setSelectTool(playSound=true){
  if(playSound)buttonSound();
  currentTool="select";
  wallStart=null;
  if(previewWall){
    scene.remove(previewWall);
    previewWall.geometry.dispose();
    previewWall.material.dispose();
    previewWall=null;
  }
  wallHint.classList.remove("show");
  removeCancelButton();

  document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active","wallactive"));
  const b=document.querySelector('[data-tool="select"]');
  if(b)b.classList.add("active");
}

/* ---------- Selection ---------- */

function selectObject(o){
  if(selected&&selected.userData.originalColor!==undefined)
    selected.material.color.setHex(selected.userData.originalColor);

  selected=o;

  if(selected){
    if(selected.userData.originalColor===undefined)
      selected.userData.originalColor=selected.material.color.getHex();
    selected.material.color.offsetHSL(0,0,.12);
  }
  updateProperties();
}

function updateProperties(){
  empty.hidden=!!selected;
  content.hidden=!selected;
  if(!selected)return;

  oname.textContent=selected.name;
  otype.textContent=selected.userData.type||"Element";
  px.value=selected.position.x.toFixed(2);
  py.value=selected.position.y.toFixed(2);
  pz.value=selected.position.z.toFixed(2);
  sx.value=selected.userData.size.x.toFixed(2);
  sy.value=selected.userData.size.y.toFixed(2);
  sz.value=selected.userData.size.z.toFixed(2);
  wallprops.hidden=selected.userData.type!=="Wall";

  if(selected.userData.type==="Wall"){
    lengthEl.textContent=selected.userData.size.x.toFixed(2)+" m";
    thick.value=selected.userData.thickness;
  }
  mat.value=selected.userData.material||"Concrete";
}

/* ---------- 3D interaction ---------- */

renderer.domElement.addEventListener("pointerdown",e=>{
  if(currentTool==="wall"){
    const p=groundPoint(e);
    if(!p)return;

    if(!wallStart){
      wallStart=p;
      previewWall=new THREE.Mesh(
        new THREE.BoxGeometry(1,.06,.06),
        new THREE.MeshBasicMaterial({color:0x77d995})
      );
      previewWall.position.set(p.x,.03,p.z);
      scene.add(previewWall);
    }else{
      const end=p;
      if(previewWall){
        scene.remove(previewWall);
        previewWall.geometry.dispose();
        previewWall.material.dispose();
        previewWall=null;
      }
      createWall(wallStart,end);
      wallStart=null;
    }
    return;
  }

  if(currentTool!=="select")return;

  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);

  const hits=raycaster.intersectObjects(objects,false);
  selectObject(hits.length?hits[0].object:null);
});

renderer.domElement.addEventListener("pointermove",e=>{
  const p=groundPoint(e);
  if(!p)return;

  if(currentTool==="wall"&&wallStart&&previewWall)
    updatePreview(wallStart,p);

  cx.textContent=p.x.toFixed(2);
  cy.textContent=p.y.toFixed(2);
  cz.textContent=p.z.toFixed(2);
});

/* ---------- Tool buttons ---------- */

document.querySelectorAll("[data-tool]").forEach(b=>{
  b.addEventListener("click",()=>{
    if(b.dataset.tool==="wall")setWallTool();
    else setSelectTool(false);
  });
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    buttonSound();
    cancelWall();
  }
});

/* ---------- Other controls ---------- */

makeButton("close","",()=>selectObject(null));

makeButton("del","",()=>{
  if(!selected)return;
  scene.remove(selected);
  const i=objects.indexOf(selected);
  if(i>=0)objects.splice(i,1);
  selected=null;
  updateProperties();
});

makeButton("home","",()=>{
  camera.position.set(12,10,14);
  controls.target.set(0,1,0);
  controls.update();
});

makeButton("top","",()=>{
  camera.position.set(0,25,.01);
  controls.target.set(0,0,0);
  controls.update();
});

makeButton("new","",()=>{
  if(confirm((window.t?t("confirmNew"):"Создать новый проект?"))){
    location.reload();
  }
});

makeButton("save","",()=>{
  const data=objects.map(o=>({
    name:o.name,
    type:o.userData.type,
    position:o.position.toArray(),
    size:o.userData.size,
    material:o.userData.material
  }));
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="archiforge-project.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

makeButton("png","",()=>{
  renderer.render(scene,camera);
  const a=document.createElement("a");
  a.href=renderer.domElement.toDataURL("image/png");
  a.download="archiforge-view.png";
  a.click();
});

/* ---------- Property editing ---------- */

function numberInput(input,fn){
  input.addEventListener("change",()=>{
    if(selected)fn(Number(input.value)||0);
  });
}

numberInput(px,v=>selected.position.x=v);
numberInput(py,v=>selected.position.y=v);
numberInput(pz,v=>selected.position.z=v);

numberInput(sx,v=>{
  const value=Math.max(.05,v),old=selected.userData.size.x;
  selected.scale.x*=value/old;
  selected.userData.size.x=value;
  if(selected.userData.type==="Wall")lengthEl.textContent=value.toFixed(2)+" m";
});

numberInput(sy,v=>{
  const value=Math.max(.05,v),old=selected.userData.size.y;
  selected.scale.y*=value/old;
  selected.userData.size.y=value;
});

numberInput(sz,v=>{
  const value=Math.max(.05,v),old=selected.userData.size.z;
  selected.scale.z*=value/old;
  selected.userData.size.z=value;
});

thick.addEventListener("change",()=>{
  if(!selected||selected.userData.type!=="Wall")return;
  const value=Math.max(.05,Number(thick.value)||.2);
  const old=selected.userData.thickness;
  selected.scale.z*=value/old;
  selected.userData.thickness=value;
  selected.userData.size.z=value;
});

mat.addEventListener("change",()=>{
  if(!selected)return;
  const colors={
    Concrete:0x8f9aa6,
    Brick:0x8d6254,
    Glass:0x6f8799,
    Wood:0x8c6d4c,
    Steel:0x68747f
  };
  selected.userData.material=mat.value;
  selected.material.color.setHex(colors[mat.value]||colors.Concrete);
});

/* ---------- Resize / render ---------- */

function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  if(!w||!h)return;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize",resize);
resize();
updateProperties();

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();
