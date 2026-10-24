import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
export async function initViewer(assembly){
 const host=document.getElementById('canvas3d'),info=document.getElementById('viewerInfo');
 if(!host||!assembly||!Array.isArray(assembly.objects))return;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#dae3e8');
 scene.add(new THREE.HemisphereLight(0xffffff,0xb2bcc0,2.1));
 const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(4,9,5);scene.add(sun);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 host.replaceChildren(renderer.domElement);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';renderer.domElement.style.display='block';
 const group=new THREE.Group(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),parts=[];scene.add(group);
 const bounds=new THREE.Box3();
 for(const part of assembly.objects){
  if(!part||!Array.isArray(part.size)||!Array.isArray(part.position)||!Array.isArray(part.rotation))continue;
  let geometry;
  if(Array.isArray(part.mesh)&&part.mesh.length>=9&&part.mesh.length%9===0){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.mesh,3));geometry.computeVertexNormals();}
  else geometry=new THREE.BoxGeometry(1,1,1);
  const kind=String(part.kind||part.name||'').toLowerCase();const isDoor=/porta|door/.test(kind);const isFront=/frente|front/.test(kind);const color=isDoor?'#e9a33f':isFront?'#f0b653':'#e9c36c';
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,side:THREE.DoubleSide}));
  mesh.position.set(...part.position);mesh.scale.set(...part.size);mesh.rotation.order='XYZ';mesh.rotation.set(...part.rotation);
  mesh.userData.isDoor=isDoor;mesh.userData.isFront=isFront;mesh.userData.partName=String(part.name||'Peça');mesh.userData.color=color;mesh.userData.partId=String(part.id||'');
  group.add(mesh);parts.push(mesh);mesh.updateMatrixWorld(true);bounds.expandByObject(mesh);
 }
 if(!parts.length)throw Error('O pedido não possui componentes 3D válidos.');
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),radius=Math.max(size.length(),.4);
 const camera=new THREE.PerspectiveCamera(42,1,.001,Math.max(100,radius*50));let yaw=.7,pitch=.45,distance=radius*1.65;
 // Explosão progressiva: cada peça parte de sua posição original e segue um vetor
 // radial em relação ao centro da montagem; sem modificar os dados do pedido.
 const explodeInput=document.getElementById('explodeAmount');
 const explodeOutput=document.getElementById('explodeValue');
 const original=parts.map(mesh=>mesh.position.clone());
 const offsets=parts.map((mesh,i)=>{
   const partCenter=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
   const vector=partCenter.sub(center);
   if(vector.lengthSq()<0.000001){const angle=2*Math.PI*i/Math.max(parts.length,1);vector.set(Math.cos(angle),.35,Math.sin(angle));}
   return vector.normalize();
 });
 function explode(value){
  const amount=Math.max(0,Math.min(100,Number(value)||0));
  // Deslocamento máximo proporcional à dimensão total do móvel.
  const travel=Math.max(size.x,size.y,size.z,0.1)*0.9*amount/100;
  parts.forEach((mesh,i)=>mesh.position.copy(original[i]).addScaledVector(offsets[i],travel));
  if(explodeOutput)explodeOutput.textContent=Math.round(amount)+'%';
  render();
 }
 if(explodeInput)explodeInput.addEventListener('input',()=>explode(explodeInput.value));
 const assembledButton=document.getElementById('assembleView');
 if(assembledButton)assembledButton.addEventListener('click',()=>{if(explodeInput)explodeInput.value='0';explode(0);});
 const doors=document.getElementById('hideDoors'),fronts=document.getElementById('hideFronts'),machining=document.getElementById('showMachining');
 const machiningObjects=[];
 // Somente desenha operações realmente fornecidas na montagem (nunca inventa furações).
 parts.forEach((mesh,i)=>{const operations=assembly.objects.find(p=>String(p?.id||'')===mesh.userData.partId)?.machining;if(!Array.isArray(operations))return;
  for(const op of operations.slice(0,200)){
   if(!op||!Array.isArray(op.position)||op.position.length!==3||op.position.some(x=>!Number.isFinite(x)||Math.abs(x)>2))continue;
   const radius=Number(op.radius)||0.005;if(!(radius>0&&radius<.2))continue;
   const marker=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({color:0x1776ee,depthTest:false}));
   marker.position.set(...op.position);mesh.add(marker);machiningObjects.push(marker);
  }
 });
 const updateVisibility=()=>{parts.forEach(mesh=>{mesh.visible=!(doors?.checked&&mesh.userData.isDoor)&&!(fronts?.checked&&mesh.userData.isFront);});machiningObjects.forEach(m=>{m.visible=!!machining?.checked;});render();};
 [doors,fronts,machining].forEach(el=>el?.addEventListener('change',updateVisibility));
 const countLabel=document.getElementById('viewerCount');if(countLabel)countLabel.textContent=parts.length+' peça(s) 3D';
 const render=()=>{const w=Math.max(host.clientWidth,200),h=Math.max(host.clientHeight,200);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();camera.position.set(center.x+distance*Math.cos(pitch)*Math.sin(yaw),center.y+distance*Math.sin(pitch),center.z+distance*Math.cos(pitch)*Math.cos(yaw));camera.lookAt(center);renderer.render(scene,camera);};
 updateVisibility();
 const reset=()=>{yaw=.7;pitch=.45;distance=radius*1.65;render();};document.getElementById('resetView').onclick=reset;
 const active=new Map();let lastPinch=0,moved=false,downX=0,downY=0;
 host.addEventListener('pointerdown',e=>{active.set(e.pointerId,[e.clientX,e.clientY]);host.setPointerCapture(e.pointerId);if(active.size===1){moved=false;downX=e.clientX;downY=e.clientY;}});
 host.addEventListener('pointermove',e=>{if(!active.has(e.pointerId))return;const before=active.get(e.pointerId);active.set(e.pointerId,[e.clientX,e.clientY]);if(active.size===1){yaw-=(e.clientX-before[0])*.007;pitch=Math.max(-1.45,Math.min(1.45,pitch+(e.clientY-before[1])*.007));moved=moved||Math.hypot(e.clientX-downX,e.clientY-downY)>6;}else if(active.size===2){const a=[...active.values()];const pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(lastPinch)distance=Math.max(radius*.12,Math.min(radius*12,distance*lastPinch/pinch));lastPinch=pinch;moved=true;}render();});
 const end=e=>{active.delete(e.pointerId);lastPinch=0;};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
 host.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(radius*.12,Math.min(radius*12,distance*Math.exp(e.deltaY*.001)));render();},{passive:false});
 host.addEventListener('click',e=>{if(moved)return;const rect=host.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(parts,false)[0];if(hit){parts.forEach(o=>o.material.emissive.setHex(0));hit.object.material.emissive.setHex(0x264e44);info.textContent='Peça selecionada: '+hit.object.userData.partName;render();}});
 const resizeObserver=new ResizeObserver(render);resizeObserver.observe(host);render();
}
window.initViewer=initViewer;

window.dispatchEvent(new Event('designlab-viewer-ready'));
