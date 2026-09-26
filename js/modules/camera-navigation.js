// DesignLabMoveis 1.311.00 · Navegação, zoom e vistas 2D/3D.
export function createCameraNavigationModule(ctx){
  const { THREE, perspectiveCamera, renderer, controls, cadZoomNdc, cadZoomRaycaster, CAD_ZOOM_DEFAULT_SPEED, CAD_ZOOM_TOUCH_SPEED, CAD_ZOOM_CLOSE_SPEED, CAD_ZOOM_SLOW_ZONE, CAD_ZOOM_SURFACE_GAP, CAD_ZOOM_NEAR_DEFAULT, CAD_ZOOM_NEAR_MIN, last3DView, orthoCamera, objectInsideSpaceRoot, getBounds, pieceThicknessInfo, $, setPieceVisualEdgesVisible, updateXray3DButton, toast }=ctx;
  const runtimeModel=ctx.runtimeModel;
function cadZoomPhysicalObjects(){
  if(typeof runtimeModel.objects==='undefined')return [];
  return runtimeModel.objects.filter(o=>{
    if(!o||o.visible===false||!o.isObject3D)return false;
    const u=o.userData||{};
    if(u.kind==='hardware-visual'||u.kind==='cylinder')return false;
    if(u.isVisualEdge||u.isMachiningVisual||u.isSpacePick||u.kind==='space-cell'||u.kind==='space-root-outline')return false;
    return o.isMesh===true;
  });
}
function cadZoomSurfaceDistance(clientX,clientY){
  if(ctx.camera!==perspectiveCamera||ctx.viewMode2D)return Infinity;
  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return Infinity;
  cadZoomNdc.set(
    ((clientX-rect.left)/rect.width)*2-1,
    -((clientY-rect.top)/rect.height)*2+1
  );
  cadZoomRaycaster.setFromCamera(cadZoomNdc,perspectiveCamera);
  const hits=cadZoomRaycaster.intersectObjects(cadZoomPhysicalObjects(),false);
  return hits.length?hits[0].distance:Infinity;
}
function cadZoomAdaptiveSpeed(distance){
  if(!Number.isFinite(distance))return CAD_ZOOM_DEFAULT_SPEED;
  const t=THREE.MathUtils.clamp(
    (distance-CAD_ZOOM_SURFACE_GAP)/(CAD_ZOOM_SLOW_ZONE-CAD_ZOOM_SURFACE_GAP),
    0,1
  );
  // curva suave: mantém controle fino sem dar a impressão de travar perto.
  const smooth=t*t*(3-2*t);
  return THREE.MathUtils.lerp(CAD_ZOOM_CLOSE_SPEED,CAD_ZOOM_DEFAULT_SPEED,smooth);
}
function cadZoomTuneNearPlane(distance){
  let next=CAD_ZOOM_NEAR_DEFAULT;
  if(Number.isFinite(distance)&&distance<.08){
    next=THREE.MathUtils.clamp(distance*.20,CAD_ZOOM_NEAR_MIN,CAD_ZOOM_NEAR_DEFAULT);
  }
  if(Math.abs(perspectiveCamera.near-next)>1e-7){
    perspectiveCamera.near=next;
    perspectiveCamera.updateProjectionMatrix();
  }
}
function cadZoomPrepareIn(clientX,clientY){
  const d=cadZoomSurfaceDistance(clientX,clientY);
  controls.zoomSpeed=cadZoomAdaptiveSpeed(d);
  cadZoomTuneNearPlane(d);
  return d;
}
// 1.300.17 · No touch a velocidade não pode depender da altura onde os dedos
// estão na tela. Usar o centro da pinça fazia a metade inferior parecer mais
// lenta em algumas perspectivas. A pinça agora mede a aproximação no foco
// estável do OrbitControls (target projetado na tela); se não houver superfície
// naquele raio, usa a distância câmera→target como fallback.
function cadZoomStableTouchDistance(){
  if(ctx.camera!==perspectiveCamera||ctx.viewMode2D)return Infinity;
  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return Infinity;
  const p=controls.target.clone().project(perspectiveCamera);
  if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&p.z>=-1.2&&p.z<=1.2){
    const x=rect.left+(p.x*.5+.5)*rect.width;
    const y=rect.top+(-p.y*.5+.5)*rect.height;
    const d=cadZoomSurfaceDistance(x,y);
    if(Number.isFinite(d))return d;
  }
  const fallback=perspectiveCamera.position.distanceTo(controls.target);
  return Number.isFinite(fallback)?fallback:Infinity;
}
function cadZoomPrepareTouchIn(){
  const d=cadZoomStableTouchDistance();
  // Touch usa velocidade fixa: a resposta da pinça não muda entre topo e base
  // da tela. O OrbitControls continua responsável por DOLLY_PAN e rotação.
  controls.zoomSpeed=CAD_ZOOM_TOUCH_SPEED;
  cadZoomTuneNearPlane(d);
  return d;
}
function cadZoomResetOut({touch=false}={}){
  controls.zoomSpeed=touch?CAD_ZOOM_TOUCH_SPEED:CAD_ZOOM_DEFAULT_SPEED;
  cadZoomTuneNearPlane(Infinity);
}


function remember3DView(){
  if(ctx.camera===perspectiveCamera && !ctx.viewMode2D){
    last3DView.position.copy(perspectiveCamera.position);
    last3DView.up.copy(perspectiveCamera.up);
    last3DView.target.copy(controls.target);
  }
}
function useCamera(next){
  ctx.camera=next;
  controls.object=ctx.camera;
  ctx.camera.updateProjectionMatrix();
  ctx.camera.updateMatrixWorld(true);
  controls.update();
}
function orthographicFrustum(viewW,viewH){
  const aspect=Math.max(.2,innerWidth/Math.max(1,innerHeight));
  const w=Math.max(.05,viewW), h=Math.max(.05,viewH);
  const halfV=Math.max(h/2,w/(2*aspect))*1.12;
  orthoCamera.left=-halfV*aspect; orthoCamera.right=halfV*aspect;
  orthoCamera.top=halfV; orthoCamera.bottom=-halfV;
  orthoCamera.near=.001; orthoCamera.far=1000;
  orthoCamera.zoom=1; orthoCamera.updateProjectionMatrix();
}
// Vista técnica 2D: a peça externa voltada para a câmera fica levemente
// transparente para revelar prateleiras, divisões e ferragens internas.
// Ao voltar ao 3D, todos os materiais retornam exatamente ao estado anterior.
const technical2DFaded = [];
function restoreTechnical2DTransparency(){
  while(technical2DFaded.length){
    const rec=technical2DFaded.pop();
    const mesh=rec.mesh;
    if(!mesh)continue;
    if(rec.renderOrder!=null) mesh.renderOrder=rec.renderOrder;
    const mats=mesh.userData?.faceMaterials||[];
    mats.forEach((mat,i)=>{
      const st=rec.materials[i]; if(!mat||!st)return;
      mat.transparent=st.transparent;
      mat.opacity=st.opacity;
      mat.depthWrite=st.depthWrite;
      mat.depthTest=st.depthTest;
      mat.needsUpdate=true;
    });
    const ve=mesh.userData?.visualEdges;
    if(ve&&rec.edge){
      ve.visible=rec.edge.visible;
      ve.renderOrder=rec.edge.renderOrder ?? 12;
      if(ve.material){
        if(rec.edge.color!=null) ve.material.color.setHex(rec.edge.color);
        ve.material.transparent=rec.edge.transparent;
        ve.material.opacity=rec.edge.opacity;
        ve.material.depthTest=rec.edge.depthTest;
        ve.material.depthWrite=rec.edge.depthWrite;
        ve.material.needsUpdate=true;
      }
    }
  }
}
function objectBelongsToRootFor2D(o,root){
  if(!o||!root||o.visible===false)return false;
  return o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root);
}
function pieceIsCameraCover(o,root,view){
  if(!objectBelongsToRootFor2D(o,root) || o.userData?.kind==='cylinder')return false;
  const b=getBounds(o);
  const rb={
    minX:root.x-root.width/2,maxX:root.x+root.width/2,
    minY:root.yBase,maxY:root.yBase+root.height,
    minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2
  };
  const ti=pieceThicknessInfo(o);
  const tol=.003; // 3 mm para tolerar pequenas folgas/vãos
  if(view==='right') return ti?.axis==='x' && Math.abs(b.maxX-rb.maxX)<=tol;
  if(view==='left')  return ti?.axis==='x' && Math.abs(b.minX-rb.minX)<=tol;
  if(view==='front') return ti?.axis==='z' && Math.abs(b.maxZ-rb.maxZ)<=tol;
  if(view==='back')  return ti?.axis==='z' && Math.abs(b.minZ-rb.minZ)<=tol;
  if(view==='top')   return ti?.axis==='y' && Math.abs(b.maxY-rb.maxY)<=tol;
  if(view==='bottom')return ti?.axis==='y' && Math.abs(b.minY-rb.minY)<=tol;
  return false;
}
function applyTechnical2DTransparency(root,view){
  restoreTechnical2DTransparency();
  if(!root||!view)return;
  // v59: contornos X-Ray. Em vista técnica 2D, as bordas de TODAS as peças
  // do móvel são desenhadas acima da casca externa translúcida. Isso garante
  // que uma prateleira vista de lado/frente continue visível mesmo atrás de
  // lateral, porta, fundo, tampo ou base.
  for(const o of runtimeModel.objects){
    if(!objectBelongsToRootFor2D(o,root))continue;
    const mats=o.userData?.faceMaterials||[];
    const ve=o.userData?.visualEdges;
    const rec={mesh:o,renderOrder:o.renderOrder,materials:mats.map(mat=>({
      transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite,depthTest:mat.depthTest
    })),edge:null};
    if(ve){
      rec.edge={
        visible:ve.visible,
        renderOrder:ve.renderOrder,
        color:ve.material?.color?.getHex?.(),
        transparent:ve.material?.transparent,
        opacity:ve.material?.opacity,
        depthTest:ve.material?.depthTest,
        depthWrite:ve.material?.depthWrite
      };
      ve.visible=true;
      ve.renderOrder=95;
      if(ve.material){
        ve.material.color.setHex(0x050505);
        ve.material.transparent=true;
        ve.material.opacity=1;
        ve.material.depthTest=false; // X-Ray: não deixa a peça da frente esconder a prateleira
        ve.material.depthWrite=false;
        ve.material.needsUpdate=true;
      }
    }
    technical2DFaded.push(rec);
  }

  const candidates=runtimeModel.objects.filter(o=>pieceIsCameraCover(o,root,view));
  for(const mesh of candidates){
    const mats=mesh.userData?.faceMaterials||[];
    mats.forEach(mat=>{
      mat.transparent=true;
      mat.opacity=.14;      // casca bem leve: mantém referência sem tapar o interior
      mat.depthWrite=false; // não grava profundidade, evitando ocultar linhas internas
      mat.depthTest=true;
      mat.needsUpdate=true;
    });
    mesh.renderOrder=10;
  }
}
function setViewModeBadge(view=null){
  const b=$('viewModeBadge'); if(!b)return;
  if(!ctx.viewMode2D){b.style.display='none';return;}
  const names={front:'Frente',back:'Trás',left:'Lateral esq.',right:'Lateral dir.',top:'Cima',bottom:'Baixo'};
  b.textContent=`2D ${names[view]||''} · 3D`; b.style.display='block';
}
function returnTo3D({restore=true,notify=true}={}){
  if(ctx.cameraSwitching)return; ctx.cameraSwitching=true;
  const was2D=ctx.viewMode2D||ctx.camera===orthoCamera;
  restoreTechnical2DTransparency();
  ctx.viewMode2D=false; ctx.current2DView=null;
  perspectiveCamera.aspect=innerWidth/Math.max(1,innerHeight);
  perspectiveCamera.updateProjectionMatrix();
  if(restore){
    perspectiveCamera.position.copy(last3DView.position);
    perspectiveCamera.up.copy(last3DView.up);
    controls.target.copy(last3DView.target);
    perspectiveCamera.lookAt(controls.target);
  }
  useCamera(perspectiveCamera);
  setViewModeBadge(null);
  setPieceVisualEdgesVisible(true);
  updateXray3DButton();
  ctx.cameraSwitching=false;
  if(was2D&&notify)toast('Vista 3D');
}

  return {cadZoomPhysicalObjects,cadZoomSurfaceDistance,cadZoomAdaptiveSpeed,cadZoomTuneNearPlane,cadZoomPrepareIn,cadZoomStableTouchDistance,cadZoomPrepareTouchIn,cadZoomResetOut,remember3DView,useCamera,orthographicFrustum,restoreTechnical2DTransparency,objectBelongsToRootFor2D,pieceIsCameraCover,applyTechnical2DTransparency,setViewModeBadge,returnTo3D};
}
