import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const isFirefox=/firefox\//i.test(navigator.userAgent||'');
const smoothEdgeLines=!isFirefox && !matchMedia('(pointer:coarse)').matches;
const smoothEdgeMaterials=new Set();
let boxEdgePositionsCache=null;

function registerSmoothEdgeMaterial(mat){
  if(!mat)return mat;
  smoothEdgeMaterials.add(mat);
  try{if(mat.resolution)mat.resolution.set(innerWidth,innerHeight);}catch(_){ }
  return mat;
}

export function updateCadEdgeResolution(){
  smoothEdgeMaterials.forEach(mat=>{
    try{if(mat?.resolution)mat.resolution.set(innerWidth,innerHeight);}catch(_){ }
  });
}

export function makeCadEdgeMaterial({
  color=0x2b2f30,opacity=.68,depthTest=true,depthWrite=false,
  transparent=true,linewidth=1.15,xray=false
}={}){
  if(smoothEdgeLines){
    const mat=new LineMaterial({
      color,transparent,opacity,depthTest,depthWrite,linewidth,
      worldUnits:false,toneMapped:false
    });
    try{mat.alphaToCoverage=true;}catch(_){ }
    return registerSmoothEdgeMaterial(mat);
  }
  if(isFirefox && color===0x2b2f30 && !xray){
    color=0x535a56;
    opacity=Math.min(opacity,.46);
  }
  return new THREE.LineBasicMaterial({color,transparent,opacity,depthTest,depthWrite,toneMapped:false});
}

function boxEdgePositions(){
  if(boxEdgePositionsCache)return boxEdgePositionsCache;
  const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1));
  boxEdgePositionsCache=Array.from(g.attributes.position.array||[]);
  g.dispose();
  return boxEdgePositionsCache;
}

export function makeBoxVisualEdges(material,{xray=false}={}){
  const renderOrder=xray?88:12;
  if(smoothEdgeLines && material?.isLineMaterial){
    const geo=new LineSegmentsGeometry();
    geo.setPositions(boxEdgePositions());
    const line=new LineSegments2(geo,material);
    line.userData.isVisualEdge=true;
    line.renderOrder=renderOrder;
    line.frustumCulled=false;
    return line;
  }
  const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),material);
  line.userData.isVisualEdge=true;
  line.renderOrder=renderOrder;
  return line;
}

export const cadEdgeCapabilities=Object.freeze({isFirefox,smoothEdgeLines});
