import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import "./i18n.js";

const $=id=>document.getElementById(id);
const viewport=$("viewport");
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
controls.enableDamping=true;controls.target.set(0,1,0);
controls.minDistance=2;controls.maxDistance=80;
controls.maxPolarAngle=Math.PI/2.02;

scene.add(new THREE.HemisphereLight(0xc5d3df,0x20252c,2));
const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.position.set(7,14,8);sun.castShadow=true;scene.add(sun);
scene.add(new THREE.GridHelper(40,80,0x4b5662,0x252c34));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x11161b,roughness:.9}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);

const objects=[];
let selected=null,tool="select",start=null,preview=null,wallNo=1;
const undoStack=[],redoStack=[];
let historyLock=false;

let audio=null;
function clickSound(){
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  audio??=new C();if(audio.state==="suspended")audio.resume();
  const n=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
  o.type="sine";o.frequency.setValueAtTime(650,n);o.frequency.exponentialRampToValueAtTime(420,n+.06);
  g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.04,n+.008);g.gain.exponentialRampToValueAtTime(.0001,n+.075);
  o.connect(g);g.connect(audio.destination);o.start();o.stop(n+.08);
 }catch(e){}
}
document.addEventListener("click",e=>{if(e.target.closest("button,.tool,select"))clickSound()},{passive:true});

function addBox(name,type,pos,size,color){
 const m=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),new THREE.MeshStandardMaterial({color,roughness:.65}));
 m.name=name;m.position.set(pos.x,pos.y,pos.z);m.castShadow=m.receiveShadow=true;
 m.userData={type,size:{...size},material:"Concrete"};
 scene.add(m);objects.push(m);return m;
}
addBox("Main Volume","Building",{x:0,y:1.5,z:0},{x:8,y:3,z:6},0x7e8994);
addBox("Upper Volume","Building",{x:.8,y:3.7,z:-.2},{x:5.4,y:1.4,z:4.2},0x9aa3ad);

function snapshot(){
 return objects.map(o=>({name:o.name,type:o.userData.type,pos:o.position.toArray(),rot:o.rotation.toArray(),scale:o.scale.toArray(),size:{...o.userData.size},material:o.userData.material,thickness:o.userData.thickness}));
}
function restore(data){
 objects.slice().forEach(o=>scene.remove(o));objects.length=0;selected=null;
 data.forEach(d=>{
  const color={Concrete:0x8f9aa6,Brick:0x8d6254,Glass:0x6f8799,Wood:0x8c6d4c,Steel:0x68747f}[d.material]||0x7e8994;
  const m=addBox(d.name,d.type,{x:d.pos[0],y:d.pos[1],z:d.pos[2]},d.size,color);
  m.rotation.fromArray(d.rot);m.scale.fromArray(d.scale);m.userData.material=d.material;m.userData.thickness=d.thickness;
 });
 updateProps();updateHistory();
}
function commit(){
 if(historyLock)return;
 undoStack.push(JSON.stringify(snapshot()));if(undoStack.length>60)undoStack.shift();redoStack.length=0;updateHistory();
}
function undo(){
 if(!undoStack.length)return;
 const current=JSON.stringify(snapshot());redoStack.push(current);
 const previous=undoStack.pop();historyLock=true;restore(JSON.parse(previous));historyLock=false;updateHistory();
}
function redo(){
 if(!redoStack.length)return;
 const current=JSON.stringify(snapshot());undoStack.push(current);
 const next=redoStack.pop();historyLock=true;restore(JSON.parse(next));historyLock=false;updateHistory();
}
function updateHistory(){
 const u=$("undo"),r=$("redo");
 if(u){u.classList.toggle("undo-disabled",!undoStack.length);u.disabled=!undoStack.length}
 if(r){r.classList.toggle("undo-disabled",!redoStack.length);r.disabled=!redoStack.length}
}

const ray=new THREE.Raycaster(),ptr=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function point(e){
 const q=renderer.domElement.getBoundingClientRect();ptr.x=(e.clientX-q.left)/q.width*2-1;ptr.y=-(e.clientY-q.top)/q.height*2+1;
 ray.setFromCamera(ptr,camera);const p=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,p))return null;
 p.x=Math.round(p.x*2)/2;p.z=Math.round(p.z*2)/2;p.y=0;return p;
}
function straight(a,b,e){
 if(!e.shiftKey)return b;
 const dx=Math.abs(b.x-a.x),dz=Math.abs(b.z-a.z);
 return dx>=dz?new THREE.Vector3(b.x,0,a.z):new THREE.Vector3(a.x,0,b.z);
}
function wall(a,b){
 const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);if(L<.25)return;
 commit();
 const m=addBox("Wall "+wallNo++,"Wall",{x:(a.x+b.x)/2,y:1.5,z:(a.z+b.z)/2},{x:L,y:3,z:.2},0x8f9aa6);
 m.rotation.y=-Math.atan2(dz,dx);m.userData.thickness=.2;
 select(m);
}
function select(o){
 if(selected&&selected.userData.originalColor!=null)selected.material.color.setHex(selected.userData.originalColor);
 selected=o;
 if(selected){selected.userData.originalColor=selected.userData.originalColor??selected.material.color.getHex();selected.material.color.offsetHSL(0,0,.12)}
 updateProps();
}
function updateProps(){
 const has=!!selected;$("empty").hidden=has;$("content").hidden=!has;if(!has)return;
 $("oname").textContent=selected.name;$("otype").textContent=selected.userData.type;
 $("px").value=selected.position.x.toFixed(2);$("py").value=selected.position.y.toFixed(2);$("pz").value=selected.position.z.toFixed(2);
 $("sx").value=selected.userData.size.x.toFixed(2);$("sy").value=selected.userData.size.y.toFixed(2);$("sz").value=selected.userData.size.z.toFixed(2);
 $("wallprops").hidden=selected.userData.type!=="Wall";$("mat").value=selected.userData.material||"Concrete";
 if(selected.userData.type==="Wall"){$("length").textContent=selected.userData.size.x.toFixed(2)+" m";$("thick").value=selected.userData.thickness||.2}
}
function cancelDrawing(){
 start=null;if(preview){scene.remove(preview);preview.geometry.dispose();preview.material.dispose();preview=null}
 $("wallHint").classList.remove("show");setTool("select",false);
}
function setTool(t,sound=true){
 if(sound)clickSound();tool=t;
 document.querySelectorAll(".tool").forEach(b=>b.classList.remove("active","wallactive"));
 const b=document.querySelector(`[data-tool="${t}"]`);if(b)b.classList.add(t==="wall"?"wallactive":"active");
 if(t==="wall"){$("wallHint").classList.add("show")}else cancelDrawing();
}
document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool,false));

renderer.domElement.addEventListener("pointerdown",e=>{
 if(tool==="wall"){
  let p=point(e);if(!p)return;p=straight(start||p,p,e);
  if(!start){start=p;preview=new THREE.Mesh(new THREE.BoxGeometry(1,.06,.06),new THREE.MeshBasicMaterial({color:0x77d995}));scene.add(preview)}
  else{if(preview){scene.remove(preview);preview.geometry.dispose();preview.material.dispose();preview=null}wall(start,p);start=null}
  return;
 }
 if(tool!=="select")return;
 const q=renderer.domElement.getBoundingClientRect();ptr.x=(e.clientX-q.left)/q.width*2-1;ptr.y=-(e.clientY-q.top)/q.height*2+1;ray.setFromCamera(ptr,camera);
 const hits=ray.intersectObjects(objects,false);select(hits[0]?.object||null);
});
renderer.domElement.addEventListener("pointermove",e=>{
 const p=point(e);if(!p)return;$("cx").textContent=p.x.toFixed(2);$("cy").textContent=p.y.toFixed(2);$("cz").textContent=p.z.toFixed(2);
 if(tool==="wall"&&start&&preview){const q=straight(start,p,e),L=Math.max(Math.hypot(q.x-start.x,q.z-start.z),.01);preview.scale.x=L;preview.position.set((q.x+start.x)/2,.03,(q.z+start.z)/2);preview.rotation.y=-Math.atan2(q.z-start.z,q.x-start.x)}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")cancelDrawing();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}});

$("undo").onclick=undo;$("redo").onclick=redo;
$("deleteTool").onclick=()=>{if(!selected)return;commit();scene.remove(selected);objects.splice(objects.indexOf(selected),1);selected=null;updateProps()};
$("del").onclick=$("deleteTool").onclick;
$("home").onclick=()=>{camera.position.set(12,10,14);controls.target.set(0,1,0);controls.update()};
$("top").onclick=()=>{camera.position.set(0,25,.01);controls.target.set(0,0,0);controls.update()};
$("new").onclick=()=>{if(confirm(window.t("confirmNew"))){location.reload()}};
$("save").onclick=()=>{const b=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="archiforge-project.json";a.click()};
$("png").onclick=()=>{renderer.render(scene,camera);const a=document.createElement("a");a.href=renderer.domElement.toDataURL("image/png");a.download="archiforge-view.png";a.click()};
$("close").onclick=()=>select(null);

["px","py","pz"].forEach((id,i)=>$(id).onchange=()=>{if(selected){commit();selected.position.setComponent(i,Number($(id).value)||0);updateProps()}});
["sx","sy","sz"].forEach((id,i)=>$(id).onchange=()=>{if(selected){commit();const v=Math.max(.05,Number($(id).value)||.05),old=selected.userData.size[["x","y","z"][i]];selected.scale.setComponent(i,selected.scale.getComponent(i)*v/old);selected.userData.size[["x","y","z"][i]]=v;updateProps()}});
$("thick").onchange=()=>{if(selected?.userData.type==="Wall"){commit();const v=Math.max(.05,Number($("thick").value)||.2),old=selected.userData.thickness||.2;selected.scale.z*=v/old;selected.userData.thickness=v;selected.userData.size.z=v;updateProps()}};
$("mat").onchange=()=>{if(selected){commit();const c={Concrete:0x8f9aa6,Brick:0x8d6254,Glass:0x6f8799,Wood:0x8c6d4c,Steel:0x68747f};selected.userData.material=$("mat").value;selected.material.color.setHex(c[$("mat").value]);}};

function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener("resize",resize);resize();updateHistory();updateProps();
(function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera)})();
