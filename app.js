import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

const $=id=>document.getElementById(id),viewport=$("viewport");
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1014);
const camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(12,10,14);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,1,0);controls.minDistance=2;controls.maxDistance=100;controls.maxPolarAngle=Math.PI/2.02;
scene.add(new THREE.HemisphereLight(0xc5d3df,0x20252c,2));const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(8,14,8);sun.castShadow=true;scene.add(sun);
scene.add(new THREE.GridHelper(40,80,0x4b5662,0x252c34));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x11161b,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);
$("loading").remove();

const objects=[];let selected=null,tool="select",start=null,preview=null,wallNo=1;
const undo=[],redo=[];let restoring=false;
function snap(){return objects.map(o=>({name:o.name,type:o.userData.type,pos:o.position.toArray(),rot:o.rotation.toArray(),scale:o.scale.toArray(),size:{...o.userData.size},material:o.userData.material,thickness:o.userData.thickness,opacity:o.userData.opacity,src:o.userData.src}))}
function color(m){return {Concrete:0x8f9aa6,Brick:0x8d6254,Glass:0x6f8799,Wood:0x8c6d4c,Steel:0x68747f}[m]||0x8f9aa6}
function addObject(d){
 let mesh;
 if(d.type==="ImageReference"){
  const mat=new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,opacity:d.opacity??1});
  mesh=new THREE.Mesh(new THREE.PlaneGeometry(d.size.x,d.size.y),mat);
  mesh.rotation.set(...d.rot);mesh.userData={...d};
 }else{
  mesh=new THREE.Mesh(new THREE.BoxGeometry(d.size.x,d.size.y,d.size.z),new THREE.MeshStandardMaterial({color:color(d.material),roughness:.65,transparent:d.material==="Glass",opacity:d.material==="Glass"?.45:1}));
  mesh.rotation.set(...d.rot);mesh.scale.set(...d.scale);mesh.userData={...d};
 }
 mesh.name=d.name;mesh.position.set(...d.pos);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);objects.push(mesh);return mesh;
}
function record(){if(restoring)return;undo.push(JSON.stringify(snap()));redo.length=0;updateHistory()}
function restore(data){restoring=true;objects.forEach(o=>scene.remove(o));objects.length=0;selected=null;data.forEach(addObject);restoring=false;props();updateHistory()}
function updateHistory(){$("undo").disabled=!undo.length;$("redo").disabled=!redo.length;$("undo").style.opacity=undo.length?1:.35;$("redo").style.opacity=redo.length?1:.35}
function undoDo(){if(!undo.length)return;redo.push(JSON.stringify(snap()));restore(JSON.parse(undo.pop()))}
function redoDo(){if(!redo.length)return;undo.push(JSON.stringify(snap()));restore(JSON.parse(redo.pop()))}
$("undo").onclick=undoDo;$("redo").onclick=redoDo;

function select(o){selected=o;props()}
function props(){
 const has=!!selected;$("empty").hidden=has;$("content").hidden=!has;if(!has)return;
 $("oname").textContent=selected.name;$("otype").textContent=selected.userData.type;
 ["px","py","pz"].forEach((id,i)=>$(id).value=selected.position.toArray()[i].toFixed(2));
 $("sx").value=selected.userData.size.x.toFixed(2);$("sy").value=selected.userData.size.y.toFixed(2);$("sz").value=selected.userData.size.z.toFixed(2);
 $("wallprops").hidden=selected.userData.type!=="Wall";$("imageprops").hidden=selected.userData.type!=="ImageReference";$("mat").value=selected.userData.material||"Concrete";
 if(selected.userData.type==="Wall")$("thick").value=selected.userData.thickness||.2;
 if(selected.userData.type==="ImageReference")$("opacity").value=selected.userData.opacity??1;
}
function cancel(){start=null;if(preview){scene.remove(preview);preview.geometry.dispose();preview.material.dispose();preview=null}$("hint").classList.remove("show");setTool("select",false)}
function setTool(t,s=true){if(s)click();tool=t;document.querySelectorAll(".tool").forEach(x=>x.classList.remove("active","wallactive"));const b=document.querySelector(`[data-tool="${t}"]`);if(b)b.classList.add(t==="wall"?"wallactive":"active");if(t==="wall"){$("hint").textContent="🧱 Стена: первая точка → вторая точка. Shift = ровно."; $("hint").classList.add("show")}else cancel()}
document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool,false));

const ray=new THREE.Raycaster(),ptr=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function gp(e){const q=renderer.domElement.getBoundingClientRect();ptr.x=(e.clientX-q.left)/q.width*2-1;ptr.y=-(e.clientY-q.top)/q.height*2+1;ray.setFromCamera(ptr,camera);const p=new THREE.Vector3();if(!ray.ray.intersectPlane(ground,p))return null;p.x=Math.round(p.x*2)/2;p.z=Math.round(p.z*2)/2;return p}
function endPoint(a,b,e){if(!e.shiftKey)return b;return Math.abs(b.x-a.x)>=Math.abs(b.z-a.z)?new THREE.Vector3(b.x,0,a.z):new THREE.Vector3(a.x,0,b.z)}
function makeWall(a,b){const L=Math.hypot(b.x-a.x,b.z-a.z);if(L<.25)return;record();const m=addObject({name:"Wall "+wallNo++,type:"Wall",pos:[(a.x+b.x)/2,1.5,(a.z+b.z)/2],rot:[0,-Math.atan2(b.z-a.z,b.x-a.x),0],scale:[1,1,1],size:{x:L,y:3,z:.2},material:"Concrete",thickness:.2});select(m)}
renderer.domElement.onpointerdown=e=>{
 if(tool==="wall"){let p=gp(e);if(!p)return;if(!start){start=p;preview=new THREE.Mesh(new THREE.BoxGeometry(1,.05,.05),new THREE.MeshBasicMaterial({color:0x77d995}));scene.add(preview)}else{p=endPoint(start,p,e);if(preview){scene.remove(preview);preview.geometry.dispose();preview.material.dispose();preview=null}makeWall(start,p);start=null}return}
 if(tool!=="select")return;const q=renderer.domElement.getBoundingClientRect();ptr.x=(e.clientX-q.left)/q.width*2-1;ptr.y=-(e.clientY-q.top)/q.height*2+1;ray.setFromCamera(ptr,camera);select(ray.intersectObjects(objects,false)[0]?.object||null)
};
renderer.domElement.onpointermove=e=>{const p=gp(e);if(!p)return;$("cx").textContent=p.x.toFixed(2);$("cy").textContent=p.y.toFixed(2);$("cz").textContent=p.z.toFixed(2);if(tool==="wall"&&start&&preview){const q=endPoint(start,p,e),L=Math.max(.01,Math.hypot(q.x-start.x,q.z-start.z));preview.scale.x=L;preview.position.set((q.x+start.x)/2,.03,(q.z+start.z)/2);preview.rotation.y=-Math.atan2(q.z-start.z,q.x-start.x)}};

$("imageBtn").onclick=()=>$("imageFile").click();
$("imageFile").onchange=e=>{
 const file=e.target.files[0];if(!file)return;const url=URL.createObjectURL(file);
 const img=new Image();img.onload=()=>{record();const ratio=img.width/img.height,max=10,w=ratio>=1?max:max*ratio,h=ratio>=1?max/ratio:max;
  const tex=new THREE.Texture(img);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
  m.position.set(0,h/2,0);m.rotation.x=-Math.PI/2;m.name="Reference Image";m.userData={type:"ImageReference",size:{x:w,y:h,z:0},material:"Image",opacity:1,src:file.name};
  scene.add(m);objects.push(m);select(m);URL.revokeObjectURL(url);};img.src=url;e.target.value="";
};
$("deleteTool").onclick=()=>{if(!selected)return;record();scene.remove(selected);objects.splice(objects.indexOf(selected),1);selected=null;props()};
$("del").onclick=()=>$("deleteTool").click();$("close").onclick=()=>select(null);
$("home").onclick=()=>{camera.position.set(12,10,14);controls.target.set(0,1,0);controls.update()};$("top").onclick=()=>{camera.position.set(0,25,.01);controls.target.set(0,0,0);controls.update()};
$("new").onclick=()=>location.reload();
$("save").onclick=()=>{const a=document.createElement("a"),b=new Blob([JSON.stringify(snap(),null,2)],{type:"application/json"});a.href=URL.createObjectURL(b);a.download="archiforge-project.json";a.click()};
$("png").onclick=()=>{renderer.render(scene,camera);const a=document.createElement("a");a.href=renderer.domElement.toDataURL();a.download="archiforge-view.png";a.click()};
["px","py","pz"].forEach((id,i)=>$(id).onchange=()=>{if(selected){record();selected.position.setComponent(i,Number($(id).value)||0);props()}});
["sx","sy","sz"].forEach((id,i)=>$(id).onchange=()=>{if(selected&&selected.userData.type!=="ImageReference"){record();const k=["x","y","z"][i],v=Math.max(.05,Number($(id).value)||.05),old=selected.userData.size[k];selected.scale.setComponent(i,selected.scale.getComponent(i)*v/old);selected.userData.size[k]=v;props()}});
$("thick").onchange=()=>{if(selected?.userData.type==="Wall"){record();const v=Math.max(.05,Number($("thick").value)||.2),old=selected.userData.thickness;selected.scale.z*=v/old;selected.userData.thickness=v;selected.userData.size.z=v;props()}};
$("opacity").oninput=()=>{if(selected?.userData.type==="ImageReference"){selected.userData.opacity=Number($("opacity").value);selected.material.opacity=selected.userData.opacity}};
$("mat").onchange=()=>{if(selected&&selected.userData.type!=="ImageReference"){record();selected.userData.material=$("mat").value;selected.material.color.setHex(color($("mat").value));props()}};
document.onkeydown=e=>{if(e.key==="Escape")cancel();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redoDo():undoDo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redoDo()}};
let ac=null;function click(){try{const C=AudioContext||webkitAudioContext;ac??=new C();const n=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(600,n);o.frequency.exponentialRampToValueAtTime(400,n+.05);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.035,n+.008);g.gain.exponentialRampToValueAtTime(.0001,n+.065);o.connect(g);g.connect(ac.destination);o.start();o.stop(n+.07)}catch{}}
document.addEventListener("click",e=>{if(e.target.closest("button,select"))click()},{passive:true});
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}addEventListener("resize",resize);resize();updateHistory();
(function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera)})();
