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
