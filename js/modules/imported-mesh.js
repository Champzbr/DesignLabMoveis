// Malha SketchUp: somente visualização 3D. Nunca converter automaticamente em corte.
export function applyImportedMeshGeometry(THREE,mesh,data){
  if(!mesh||!data||!Array.isArray(data.positions)||data.positions.length<9||data.positions.length%9!==0)return false;
  const positions=data.positions;
  if(positions.length>900000||positions.some(v=>!Number.isFinite(v)||Math.abs(v)>2))return false;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.computeVertexNormals();geo.computeBoundingBox();
  if(mesh.geometry)mesh.geometry.dispose();
  mesh.geometry=geo;
  // A geometria importada já representa o contorno verdadeiro; esconder arestas da caixa.
  if(mesh.userData.visualEdges)mesh.userData.visualEdges.visible=false;
  mesh.userData.importedMesh={positions:positions.slice(),source:data.source||'SketchUp DAE'};
  mesh.userData.excludeFromCutList=true;
  mesh.userData.forms=[];
  mesh.material=new THREE.MeshStandardMaterial({color:0x91cbb6,roughness:.8,metalness:0,side:THREE.DoubleSide});
  mesh.material.needsUpdate=true;
  return true;
}

// CNC/Aspire: extrai APENAS o perímetro das faces superiores planas.
// Recusa geometria sem tampa planar fechada; jamais usa bounding-box como contorno.
export function sketchupTopContours(mesh){
  const a=mesh?.userData?.importedMesh?.positions;
  const w=Number(mesh?.userData?.width)*1000,d=Number(mesh?.userData?.depth)*1000,t=Number(mesh?.userData?.height)*1000;
  if(!Array.isArray(a)||a.length<9||a.length%9||!Number.isFinite(w)||!Number.isFinite(d)||!Number.isFinite(t)||w<=0||d<=0||t<=0)throw new Error('Dimensões/triângulos inválidos na peça SketchUp.');
  if(a.length>900000)throw new Error('Componente grande demais para exportação CNC.');
  let top=-Infinity;
  for(let i=1;i<a.length;i+=3)top=Math.max(top,a[i]);
  const edges=new Map(), coords=new Map();let count=0;
  const key=(x,y)=>`${Math.round(x*100)}:${Math.round(y*100)}`; // precisão 0,01 mm
  for(let i=0;i<a.length;i+=9){
    const v=[];
    for(let j=0;j<3;j++){const at=i+3*j;v.push({x:(a[at]+.5)*w,y:(a[at+2]+.5)*d,z:a[at+1]});}
    if(!v.every(q=>Math.abs(q.z-top)<0.00005))continue;
    const keys=v.map(q=>key(q.x,q.y));if(new Set(keys).size!==3)continue;
    const area=Math.abs((v[1].x-v[0].x)*(v[2].y-v[0].y)-(v[2].x-v[0].x)*(v[1].y-v[0].y));
    if(area<.0001)continue;
    count++;
    v.forEach((q,j)=>coords.set(keys[j],[Number(q.x.toFixed(2)),Number(q.y.toFixed(2))]));
    for(let j=0;j<3;j++){
      const l=keys[j],r=keys[(j+1)%3],id=[l,r].sort().join('|');
      const e=edges.get(id)||{l,r,n:0};e.n++;edges.set(id,e);
    }
  }
  if(!count)throw new Error('Peça sem superfície superior plana: não é seguro gerar contorno CNC automaticamente.');
  const boundary=[...edges.values()].filter(e=>e.n===1);
  if(!boundary.length||[...edges.values()].some(e=>e.n>2))throw new Error('Malha da face superior não possui contorno válido.');
  const adj=new Map();
  for(const e of boundary)for(const [u,v] of [[e.l,e.r],[e.r,e.l]]){if(!adj.has(u))adj.set(u,[]);adj.get(u).push(v)}
  if([...adj.values()].some(v=>v.length!==2))throw new Error('Contorno aberto ou ramificado. Corrija o componente no SketchUp.');
  const visited=new Set(),loops=[];
  for(const start of adj.keys()){
    if(visited.has(start))continue;
    const chain=[];let prev=null,at=start;
    do{
      if(chain.length>adj.size+1)throw new Error('Contorno CNC inválido.');
      chain.push(at);visited.add(at);
      const neighbors=adj.get(at),next=neighbors.find(x=>x!==prev);prev=at;at=next;
    }while(at!==start);
    if(chain.length<3)throw new Error('Contorno CNC degenerado.');
    loops.push(chain.map(k=>coords.get(k)));
  }
  return {loops,width:w,depth:d,thickness:t};
}
export function sketchupContoursDxf(contours){
  const fmt=n=>String(Number(n.toFixed(3)));
  const pair=(code,value)=>`${code}\r\n${value}\r\n`;
  let s=pair(0,'SECTION')+pair(2,'HEADER')+pair(9,'$INSUNITS')+pair(70,4)+pair(0,'ENDSEC')+pair(0,'SECTION')+pair(2,'ENTITIES');
  for(let i=0;i<contours.loops.length;i++){
    const pts=contours.loops[i];
    s+=pair(0,'LWPOLYLINE')+pair(8,i===0?'PERFIL_CNC':'CONTORNO_CNC_'+(i+1))+pair(90,pts.length)+pair(70,1);
    for(const [x,y] of pts)s+=pair(10,fmt(x))+pair(20,fmt(y));
  }
  return s+pair(0,'ENDSEC')+pair(0,'EOF');
}
export function sketchupContoursSvg(c,name='SketchUp'){
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const paths=c.loops.map(loop=>`<polygon points="${loop.map(p=>p.map(v=>Number(v.toFixed(2))).join(',')).join(' ')}" fill="none" stroke="#087e89" stroke-width="2"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 ${c.width+10} ${c.depth+10}" width="900" height="600"><rect width="${c.width}" height="${c.depth}" fill="#f5f7f7" stroke="#bbb"/>${paths}<text x="8" y="18" font-size="12">${esc(name)} · ${c.thickness.toFixed(1)} mm · Conferir no Aspire</text></svg>`;
}
