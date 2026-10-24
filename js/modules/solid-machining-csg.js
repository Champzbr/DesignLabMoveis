// Operações booleanas locais de visualização, sem dependências externas.
// BSP de polígonos convexos adaptado ao espaço do Three.js.
const EPS = 1e-6;
class Vertex {
  constructor(pos, normal) { this.pos=pos; this.normal=normal; }
  clone(){return new Vertex(this.pos.clone(),this.normal.clone());}
  flip(){this.normal.negate();}
  interpolate(other,t){return new Vertex(this.pos.clone().lerp(other.pos,t),this.normal.clone().lerp(other.normal,t));}
}
class Plane {
  constructor(normal,w){this.normal=normal;this.w=w;}
  clone(){return new Plane(this.normal.clone(),this.w);}
  flip(){this.normal.negate();this.w=-this.w;}
  static fromPoints(a,b,c){const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();return new Plane(n,n.dot(a));}
  splitPolygon(poly,coplanarFront,coplanarBack,front,back){
    const types=[];let polygonType=0;
    for(const v of poly.vertices){const t=this.normal.dot(v.pos)-this.w;const type=t < -EPS?2:t>EPS?1:0;polygonType|=type;types.push(type);}
    switch(polygonType){
      case 0:(this.normal.dot(poly.plane.normal)>0?coplanarFront:coplanarBack).push(poly);break;
      case 1:front.push(poly);break;
      case 2:back.push(poly);break;
      case 3:{const f=[],b=[];for(let i=0;i<poly.vertices.length;i++){
        const j=(i+1)%poly.vertices.length,ti=types[i],tj=types[j],vi=poly.vertices[i],vj=poly.vertices[j];
        if(ti!==2)f.push(vi);if(ti!==1)b.push(ti!==2?vi.clone():vi);
        if((ti|tj)===3){const direction=vj.pos.clone().sub(vi.pos);const denom=this.normal.dot(direction);if(Math.abs(denom)<EPS)continue;const t=(this.w-this.normal.dot(vi.pos))/denom;const v=vi.interpolate(vj,t);f.push(v);b.push(v.clone());}
      }
      if(f.length>=3)front.push(new Polygon(f));if(b.length>=3)back.push(new Polygon(b));break;}
    }
  }
}
class Polygon {
  constructor(vertices){this.vertices=vertices;this.plane=Plane.fromPoints(vertices[0].pos,vertices[1].pos,vertices[2].pos);}
  clone(){return new Polygon(this.vertices.map(v=>v.clone()));}
  flip(){this.vertices.reverse().forEach(v=>v.flip());this.plane.flip();}
}
class Node {
  constructor(polygons=[]){this.plane=null;this.front=null;this.back=null;this.polygons=[];if(polygons.length)this.build(polygons);}
  clone(){const n=new Node();n.plane=this.plane?.clone()||null;n.front=this.front?.clone()||null;n.back=this.back?.clone()||null;n.polygons=this.polygons.map(p=>p.clone());return n;}
  invert(){this.polygons.forEach(p=>p.flip());this.plane?.flip();this.front?.invert();this.back?.invert();[this.front,this.back]=[this.back,this.front];}
  clipPolygons(polygons){if(!this.plane)return polygons.slice();let front=[],back=[];for(const p of polygons)this.plane.splitPolygon(p,front,back,front,back);if(this.front)front=this.front.clipPolygons(front);if(this.back)back=this.back.clipPolygons(back);else back=[];return front.concat(back);}
  clipTo(bsp){this.polygons=bsp.clipPolygons(this.polygons);this.front?.clipTo(bsp);this.back?.clipTo(bsp);}
  allPolygons(){return [...this.polygons,...(this.front?.allPolygons()||[]),...(this.back?.allPolygons()||[])];}
  build(polygons){if(!polygons.length)return;if(!this.plane)this.plane=polygons[0].plane.clone();const front=[],back=[];for(const p of polygons)this.plane.splitPolygon(p,this.polygons,this.polygons,front,back);if(front.length){this.front ||=new Node();this.front.build(front);}if(back.length){this.back ||=new Node();this.back.build(back);}}
}
function polygonsFromGeometry(THREE,geometry){
  const g=geometry.index?geometry.toNonIndexed():geometry,positions=g.getAttribute('position'),normals=g.getAttribute('normal');const polygons=[];
  for(let i=0;i<positions.count;i+=3){const verts=[];for(let j=0;j<3;j++){
    const k=i+j;verts.push(new Vertex(new THREE.Vector3(positions.getX(k),positions.getY(k),positions.getZ(k)),normals?new THREE.Vector3(normals.getX(k),normals.getY(k),normals.getZ(k)):new THREE.Vector3()));
  }
  if(verts[1].pos.clone().sub(verts[0].pos).cross(verts[2].pos.clone().sub(verts[0].pos)).lengthSq()>EPS*EPS)polygons.push(new Polygon(verts));
  }
  if(g!==geometry)g.dispose();return polygons;
}
function subtract(a,b){const x=new Node(a.map(p=>p.clone())),y=new Node(b.map(p=>p.clone()));x.invert();x.clipTo(y);y.clipTo(x);y.invert();y.clipTo(x);y.invert();x.build(y.allPolygons());x.invert();return x.allPolygons();}
function geometryFromPolygons(THREE,polygons){const coords=[];
  for(const p of polygons){for(let j=2;j<p.vertices.length;j++){
    const a=p.vertices[0].pos,b=p.vertices[j-1].pos,c=p.vertices[j].pos;
    if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<EPS*EPS)continue;
    for(const v of [a,b,c])coords.push(v.x,v.y,v.z);
  }}
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));geom.computeVertexNormals();return geom;
}
export function buildMachinedSolid(THREE,dimsMm,operations){
  const mm=0.001,dims=['x','y','z'].map(a=>Number(dimsMm[a])*mm);
  const box=new THREE.BoxGeometry(...dims);let polygons=polygonsFromGeometry(THREE,box);box.dispose();
  for(const cut of operations){let cutter;
    if(cut.type==='hole'){
      const radius=cut.diameter*mm/2,depth=(cut.depth+0.04)*mm;
      cutter=new THREE.CylinderGeometry(radius,radius,depth,28,1,false);
      if(cut.axis==='x')cutter.rotateZ(-Math.PI/2);
      if(cut.axis==='z')cutter.rotateX(Math.PI/2);
      cutter.translate((cut.center.x-dimsMm.x/2)*mm,(cut.center.y-dimsMm.y/2)*mm,(cut.center.z-dimsMm.z/2)*mm);
    }else{
      cutter=new THREE.BoxGeometry((cut.size.x+0.04)*mm,(cut.size.y+0.04)*mm,(cut.size.z+0.04)*mm);
      cutter.translate((cut.center.x-dimsMm.x/2)*mm,(cut.center.y-dimsMm.y/2)*mm,(cut.center.z-dimsMm.z/2)*mm);
    }
    const subtractPolygons=polygonsFromGeometry(THREE,cutter);cutter.dispose();
    polygons=subtract(polygons,subtractPolygons);
    if(polygons.length>45000)throw new Error('Limite de complexidade da malha de usinagem');
  }
  return geometryFromPolygons(THREE,polygons);
}
