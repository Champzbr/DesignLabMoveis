// DesignLabMoveis 1.310.00 · criação do palco Three.js, câmeras, luzes, grade e eixos.
export function createCadScene({THREE,OrbitControls,container,cadBackgroundHex,cadFloorHex,cadShadowsVisible}){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(cadBackgroundHex());

  const perspectiveCamera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,0.001,1000);
  perspectiveCamera.position.set(3.4,2.8,4.8);
  const orthoCamera=new THREE.OrthographicCamera(-1,1,1,-1,0.001,1000);

  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  const cadRenderPixelRatio=Math.min(Math.max(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1:2.5),3);
  renderer.setPixelRatio(cadRenderPixelRatio);
  renderer.setSize(innerWidth,innerHeight);
  renderer.domElement.style.touchAction='none';
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=!!cadShadowsVisible;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff,0x222222,1.12));
  const dirLight=new THREE.DirectionalLight(0xffffff,1.28);
  dirLight.position.set(4,8,5);
  dirLight.castShadow=true;
  dirLight.shadow.mapSize.set(1024,1024);
  dirLight.shadow.camera.left=-8;dirLight.shadow.camera.right=8;
  dirLight.shadow.camera.top=8;dirLight.shadow.camera.bottom=-8;
  dirLight.shadow.camera.near=.1;dirLight.shadow.camera.far=30;
  scene.add(dirLight);
  const fillLight=new THREE.DirectionalLight(0xcfe2ff,.34);
  fillLight.position.set(-4,3,-5);scene.add(fillLight);
  const bottomFillLight=new THREE.DirectionalLight(0xfff4df,.58);
  bottomFillLight.position.set(2.5,-5.5,3.5);bottomFillLight.castShadow=false;scene.add(bottomFillLight);
  scene.add(new THREE.AmbientLight(0xffffff,.16));

  const visualFloorMat=new THREE.MeshStandardMaterial({color:cadFloorHex(),roughness:.95,metalness:0});
  const visualFloor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),visualFloorMat);
  visualFloor.rotation.x=-Math.PI/2;visualFloor.position.y=-.004;visualFloor.receiveShadow=true;visualFloor.visible=false;scene.add(visualFloor);

  const grid=new THREE.GridHelper(20,200,0xb9c1c5,0xd9dddf);
  grid.material.transparent=true;grid.material.opacity=.52;grid.material.depthWrite=false;grid.position.y=.001;scene.add(grid);

  function makeWorldAxis(points,color){
    const mat=new THREE.LineBasicMaterial({color,depthTest:true,depthWrite:false,transparent:true,opacity:.96});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);
    line.renderOrder=4;scene.add(line);return line;
  }
  const worldAxisX=makeWorldAxis([new THREE.Vector3(-20,.003,0),new THREE.Vector3(20,.003,0)],0xff3b30);
  const worldAxisY=makeWorldAxis([new THREE.Vector3(0,-20,0),new THREE.Vector3(0,20,0)],0x2979ff);
  const worldAxisZ=makeWorldAxis([new THREE.Vector3(0,.003,-20),new THREE.Vector3(0,.003,20)],0xffd23f);
  worldAxisX.userData.tapeAxis='x';worldAxisY.userData.tapeAxis='y';worldAxisZ.userData.tapeAxis='z';
  const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

  const controls=new OrbitControls(perspectiveCamera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.target.set(0,.45,0);
  controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};

  return {scene,perspectiveCamera,orthoCamera,renderer,cadRenderPixelRatio,dirLight,visualFloorMat,visualFloor,grid,worldAxisX,worldAxisY,worldAxisZ,groundPlane,controls};
}
