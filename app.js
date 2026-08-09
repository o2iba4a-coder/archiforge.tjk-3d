import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const viewport=document.getElementById('viewport');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c1014);
const camera=new THREE.PerspectiveCamera(45,1,.1,500);
camera.position.set(10,9,12);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.07; controls.target.set(0,.8,0);
controls.minDistance=2; controls.maxDistance=80; controls.maxPolarAngle=Math.PI/2.02;

scene.add(new THREE.HemisphereLight(0xb9c8d8,0x20252c,2));
const sun=new THREE.DirectionalLight(0xffffff,2.6);
sun.position.set(7,14,8); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun);
scene.add(new THREE.GridHelper(40,40,0x4b5662,0x252c34));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x11161b,roughness:.88,metalness:.05}));
floor.rotation.x=-Math.PI/2; floor.position.y=-.015; floor.receiveShadow=true; scene.add(floor);

const objects=[];
let selected=null,currentTool='select';
function addBox(name,type,position,size,color=0x8f9aa6){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.05}));
  mesh.name=name; mesh.position.set(position.x,position.y,position.z); mesh.castShadow=true; mesh.receiveShadow=true;
  mesh.userData={type,size:{...size},material:'Concrete'}; scene.add(mesh); objects.push(mesh); return mesh;
}
addBox('Main Volume','Building',{x:0,y:1.5,z:0},{x:8,y:3,z:6},0x7e8994);
addBox('Upper Volume','Building',{x:.8,y:3.7,z:-.2},{x:5.4,y:1.4,z:4.2},0x9aa3ad);
addBox('Entrance Canopy','Canopy',{x:0,y:2.8,z:3.7},{x:3.2,y:.22,z:1.3},0x3f4851);
const glassMat=new THREE.MeshStandardMaterial({color:0x6f8799,transparent:true,opacity:.42,metalness:.15,roughness:.15});
for(let i=-2;i<=2;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(1.15,1.8,.06),glassMat);p.position.set(i*1.25,1.45,3.03);p.castShadow=true;p.name=`Window ${i+3}`;p.userData={type:'Window',size:{x:1.15,y:1.8,z:.06},material:'Glass'};scene.add(p);objects.push(p);}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)} window.addEventListener('resize',resize);resize();
function setSelected(obj){if(selected?.userData?.baseColor)selected.material.color.set(selected.userData.baseColor);selected=obj;if(selected){selected.userData.baseColor=selected.material.color.getHex();selected.material.color.offsetHSL(0,0,.16)}updateProperties();}
renderer.domElement.addEventListener('pointerdown',e=>{if(currentTool!=='select')return;const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(objects,false);setSelected(hits.length?hits[0].object:null)});
function updateProperties(){const empty=document.getElementById('emptyProperties'),content=document.getElementById('propertiesContent');if(!selected){empty.classList.remove('hidden');content.classList.add('hidden');return}empty.classList.add('hidden');content.classList.remove('hidden');document.getElementById('objectName').textContent=selected.name;document.getElementById('objectType').textContent=selected.userData.type||'Element';['x','y','z'].forEach((k,i)=>document.getElementById('pos'+k.toUpperCase()).value=selected.position[k].toFixed(2));['x','y','z'].forEach((k,i)=>document.getElementById('dim'+k.toUpperCase()).value=selected.userData.size[k].toFixed(2));document.getElementById('material').value=selected.userData.material||'Concrete';updateObjectCount();}
['X','Y','Z'].forEach((K,i)=>document.getElementById('pos'+K).addEventListener('change',e=>{if(selected)selected.position[['x','y','z'][i]]=Number(e.target.value)||0}));
['X','Y','Z'].forEach((K,i)=>document.getElementById('dim'+K).addEventListener('change',e=>{if(!selected)return;const k=['x','y','z'][i],v=Math.max(.05,Number(e.target.value)||.05);selected.scale[k]/=1;selected.scale[k]*=v/selected.userData.size[k];selected.userData.size[k]=v}));
document.getElementById('material').addEventListener('change',e=>{if(!selected)return;selected.userData.material=e.target.value;const c={Concrete:0x8f9aa6,Brick:0x8d6254,Glass:0x6f8799,Wood:0x8c6d4c,Steel:0x68747f};selected.material.color.set(c[e.target.value]||0x8f9aa6)});
document.getElementById('deleteObject').addEventListener('click',()=>{if(!selected)return;scene.remove(selected);objects.splice(objects.indexOf(selected),1);selected=null;updateProperties();updateObjectCount()});
document.querySelectorAll('.tool[data-tool]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tool[data-tool]').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentTool=b.dataset.tool}));
document.getElementById('homeView').addEventListener('click',()=>{camera.position.set(10,9,12);controls.target.set(0,1,0);controls.update()});
document.getElementById('topView').addEventListener('click',()=>{camera.position.set(0,20,.01);controls.target.set(0,0,0);controls.update()});
document.getElementById('closeProperties').addEventListener('click',()=>setSelected(null));
document.getElementById('newProject').addEventListener('click',()=>{if(confirm(t('confirmNew')))location.reload()});
document.getElementById('saveProject').addEventListener('click',()=>{const data=objects.map(o=>({name:o.name,type:o.userData.type,position:o.position.toArray(),size:o.userData.size,material:o.userData.material}));const blob=new Blob([JSON.stringify({version:'0.1.1',language:window.currentLanguage,objects:data},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='archiforge-project.json';a.click();URL.revokeObjectURL(a.href)});
document.getElementById('exportImage').addEventListener('click',()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='archiforge-view.png';a.click()});
renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect(),x=((e.clientX-r.left)/r.width)*2-1,y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera({x,y},camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,hit)){coordX.textContent=hit.x.toFixed(2);coordY.textContent=hit.y.toFixed(2);coordZ.textContent=hit.z.toFixed(2)}});
window.updateObjectCount=()=>document.getElementById('objectCount').textContent=`${objects.length} ${t('objects')}`;
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)} updateProperties();updateObjectCount();animate();
