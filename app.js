import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createAdventure } from './adventure.js';

const stage = document.querySelector('#stage');
const loading = document.querySelector('#loading');
const inputs = Object.fromEntries(['leftHip','leftKnee','rightHip','rightKnee'].map(n => [n,document.getElementById(n)]));
const deg = THREE.MathUtils.degToRad;
const check = (ok,message) => { if (!ok) throw new Error(message); };
const fitSettings = { hipClearanceM:.070, waistForwardTilt:.30, thighHarnessDepthScale:1.22 };
const bodyFitSettings = { waistWidthScale:.92, waistDepthScale:.78, thighRadiusScale:.80, thighPosteriorShiftM:.012 };

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35,1,.05,30);
  const sourceCamera=camera.clone();
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.35; controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI*.88;
  controls.target.set(0,.86,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0x9ba898,2.0));
  const key = new THREE.DirectionalLight(0xfff5e9,3.4);
  key.position.set(3,5,4); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-1.4,right:1.4,top:2.4,bottom:-1.0,near:.1,far:12});
  key.shadow.normalBias = .018;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe0eef6,1.6); fill.position.set(-3,2,-3); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(.72,80),new THREE.MeshStandardMaterial({color:0xd7ddd3,roughness:1}));
  floor.rotation.x = -Math.PI/2; floor.position.y = -.004; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(3,30,0xd7dcd3,0xd7dcd3); grid.position.y=-.006; grid.material.transparent=true; grid.material.opacity=.33; scene.add(grid);
  const userScene=scene.clone();
  let currentView='iso',demoMode='follow',demoTick=null,lastRender=-Infinity;
  const cameraRoot=new THREE.Vector3();
  const stairCount=6,stairRise=.16,stairTread=.34,stepDuration=1.35;
  const stairGeometry=new THREE.BoxGeometry(1,1,1),stairEdges=new THREE.EdgesGeometry(stairGeometry);
  const stairMaterial=new THREE.MeshStandardMaterial({color:0xaebcad,roughness:.92});
  const edgeMaterial=new THREE.LineBasicMaterial({color:0x697e70,transparent:true,opacity:.48});
  const stairGroups=[scene,userScene].map(s=>{const group=new THREE.Group();group.name='stairs';group.visible=false;s.add(group);return group;});
  function showStairs(mode) {
    const descending=mode==='stairsDown';
    for(const group of stairGroups) {
      group.clear();group.visible=mode.startsWith('stairs');
      if(!group.visible) continue;
      const addStep=(z,depth,top)=>{
        const height=Math.max(top,.025),step=new THREE.Mesh(stairGeometry,stairMaterial);
        step.scale.set(1.10,height,depth);step.position.set(0,top-height/2,z);
        step.receiveShadow=true;step.castShadow=true;step.add(new THREE.LineSegments(stairEdges,edgeMaterial));group.add(step);
      };
      addStep(-.22,.66,descending?stairCount*stairRise:0);
      for(let n=1;n<=stairCount;n++) addStep(.11+(n-.5)*stairTread,stairTread,(descending?stairCount-n:n)*stairRise);
      addStep(.11+stairCount*stairTread+.33,.66,descending?0:stairCount*stairRise);
    }
    floor.visible=mode==='follow';userScene.children.find(o=>o.isMesh&&o.geometry===floor.geometry).visible=mode==='follow'||mode==='adventure';
    grid.visible=mode!=='adventure';
  }
  const modelViewHeight=()=>Math.max(stage.clientHeight-(demoMode==='adventure'?110:165),120);
  function renderPair() {
    const width=stage.clientWidth,height=modelViewHeight(),half=Math.floor(width/2);
    renderer.setScissorTest(true);
    if(demoMode==='adventure') {
      key.position.set(3,6,cameraRoot.z-2);key.target.position.set(0,0,cameraRoot.z+2);key.target.updateMatrixWorld(true);
      renderer.setViewport(0,45,width,height);renderer.setScissor(0,45,width,height);renderer.render(scene,camera);
      const insetWidth=Math.min(168,width*.22),insetHeight=Math.min(215,height*.47);
      stage.parentElement.style.setProperty('--preview-w',insetWidth+'px');stage.parentElement.style.setProperty('--preview-h',insetHeight+'px');
      sourceCamera.copy(camera);sourceCamera.aspect=insetWidth/insetHeight;sourceCamera.position.set(1.25,1.15,3.6);sourceCamera.lookAt(0,.86,0);sourceCamera.updateProjectionMatrix();
      renderer.setViewport(18,65,insetWidth,insetHeight);renderer.setScissor(18,65,insetWidth,insetHeight);renderer.render(userScene,sourceCamera);return;
    }
    renderer.setViewport(0,45,half,height);renderer.setScissor(0,45,half,height);renderer.render(userScene,demoMode==='adventure'?sourceCamera:camera);
    renderer.setViewport(half,45,width-half,height);renderer.setScissor(half,45,width-half,height);renderer.render(scene,camera);
  }
  let needsRender = true;
  controls.addEventListener('change',()=>{needsRender=true;});
    const resize = () => { const {width,height}=stage.getBoundingClientRect(); renderer.setSize(width,height);camera.aspect=width/((demoMode==='adventure'?1:2)*modelViewHeight());camera.updateProjectionMatrix();view(currentView);needsRender=true; };
  new ResizeObserver(resize).observe(stage); resize();
  function view(name) {
    currentView=name;
    const stairView=demoMode.startsWith('stairs');
    const gameView=demoMode==='adventure';
    camera.aspect=stage.clientWidth/((gameView?1:2)*modelViewHeight());camera.updateProjectionMatrix();
    const views={front:[0,.055,1],back:[0,.055,-1],side:[1,.055,0],iso:gameView?[.28,.45,-1.2]:stairView?[1.1,.48,.8]:[.55,.10,.90]};
    const distance=Math.max((gameView?4.2:stairView?2.30:1.23)/(2*Math.tan(deg(camera.fov/2))*camera.aspect),(gameView?3.3:stairView?2.60:1.93)/(2*Math.tan(deg(camera.fov/2))))*1.03;
    controls.target.set(0,gameView?.75:.86,gameView?.75:0).add(cameraRoot);
    camera.position.fromArray(views[name]).normalize().multiplyScalar(distance).add(controls.target);controls.update();
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click',()=>view(b.dataset.view)));
  view('iso');
  renderer.setAnimationLoop(now=>{controls.update();demoTick?.(now);if(needsRender&&now-lastRender>=1000/30){renderPair();needsRender=false;lastRender=now;}});
  const loader = new GLTFLoader();
  const [humanAsset,exoAsset,meta] = await Promise.all([
    loader.loadAsync('./assets/human.glb'), loader.loadAsync('./assets/halo.glb'),
    fetch('./assets/halo.json').then(r=>{check(r.ok,'外骨骼分组文件加载失败');return r.json();})
  ]);
  const human = humanAsset.scene;
  scene.add(human); human.updateMatrixWorld(true);
  const skins=[];
  human.traverse(o=>{if(o.isSkinnedMesh){skins.push(o);o.material=new THREE.MeshStandardMaterial({color:0xb8bcb9,roughness:.82,metalness:0});o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  check(skins.length>0,'人体模型未包含可用蒙皮');
  const bones = Object.fromEntries(['pelvis','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'].map(n=>[n,human.getObjectByName(n)]));
  check(Object.values(bones).every(b=>b?.isBone),'人体模型缺少下肢骨骼');
  const position = obj => obj.getWorldPosition(new THREE.Vector3());
  // Shape only: bone locations, lengths and skin weights remain the original template's.
  const bodyHipHeight=(position(bones.thigh_l).y+position(bones.thigh_r).y)*.5;
  const legAxes=['l','r'].map(s=>{
    const hip=position(bones['thigh_'+s]),axis=position(bones['calf_'+s]).sub(hip);
    return {name:'thigh_'+s,hip,axis,lengthSq:axis.lengthSq()};
  });
  let shapedVertices=0,maxBodyAdjustment=0;
  const point=new THREE.Vector3(),original=new THREE.Vector3(),centre=new THREE.Vector3();
  for(const skin of skins) {
    skin.geometry=skin.geometry.clone();
    const vertices=skin.geometry.getAttribute('position');
    const originalNormals=skin.geometry.getAttribute('normal').clone(),changed=new Uint8Array(vertices.count);
    const indices=skin.geometry.getAttribute('skinIndex'),weights=skin.geometry.getAttribute('skinWeight');
    check(indices&&weights,'人体缺少蒙皮权重');
    const inverse=skin.matrixWorld.clone().invert();
    for(let i=0;i<vertices.count;i++) {
      const influence={torso:0,thigh_l:0,thigh_r:0};
      for(const get of ['getX','getY','getZ','getW']) {
        const name=skin.skeleton.bones[indices[get](i)]?.name,weight=weights[get](i);
        if(name==='pelvis'||name?.startsWith('spine_')) influence.torso+=weight;
        if(name==='thigh_l'||name==='thigh_r') influence[name]+=weight;
      }
      point.fromBufferAttribute(vertices,i).applyMatrix4(skin.matrixWorld);original.copy(point);
      const waist=THREE.MathUtils.smoothstep(point.y,bodyHipHeight+.005,bodyHipHeight+.045)
        *(1-THREE.MathUtils.smoothstep(point.y,bodyHipHeight+.145,bodyHipHeight+.210))*influence.torso;
      const waistCentreZ=.032+.35*(point.y-bodyHipHeight-.075);
      point.x*=1-(1-bodyFitSettings.waistWidthScale)*waist;
      point.z=waistCentreZ+(point.z-waistCentreZ)*(1-(1-bodyFitSettings.waistDepthScale)*waist);
      for(const leg of legAxes) {
        const t=centre.copy(point).sub(leg.hip).dot(leg.axis)/leg.lengthSq;
        const blend=THREE.MathUtils.smoothstep(t,.06,.35)*(1-THREE.MathUtils.smoothstep(t,.85,1.06))*influence[leg.name];
        if(blend<=0) continue;
        centre.copy(leg.hip).addScaledVector(leg.axis,t);
        point.sub(centre).multiplyScalar(1-(1-bodyFitSettings.thighRadiusScale)*blend).add(centre);
        point.z-=bodyFitSettings.thighPosteriorShiftM*blend;
      }
      const adjustment=point.distanceTo(original);
      if(adjustment>1e-6) {shapedVertices++;changed[i]=1;}
      maxBodyAdjustment=Math.max(maxBodyAdjustment,adjustment);
      point.applyMatrix4(inverse);vertices.setXYZ(i,point.x,point.y,point.z);
    }
    vertices.needsUpdate=true;
    skin.geometry.computeVertexNormals();
    // Rejoin normals across UV seams so the sculpted skin keeps a smooth surface.
    const normals=skin.geometry.getAttribute('normal'),seams=new Map();
    const key=i=>[vertices.getX(i),vertices.getY(i),vertices.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
    for(let i=0;i<vertices.count;i++) {
      const k=key(i),sum=seams.get(k)||new THREE.Vector3();
      sum.add(new THREE.Vector3().fromBufferAttribute(normals,i));seams.set(k,sum);
    }
    for(let i=0;i<vertices.count;i++) {
      const normal=changed[i]?seams.get(key(i)).normalize():new THREE.Vector3().fromBufferAttribute(originalNormals,i);
      normals.setXYZ(i,normal.x,normal.y,normal.z);
    }
    normals.needsUpdate=true;
    skin.geometry.computeBoundingBox();skin.geometry.computeBoundingSphere();
  }
  check(shapedVertices>1000&&maxBodyAdjustment<.04,'人体局部形状调整超出预期范围');
  // Clone after shaping, before attaching Halo: two independent rigs share static mesh buffers.
  const user=cloneSkeleton(human),userSkins=[];
  user.traverse(o=>{if(o.isSkinnedMesh){userSkins.push(o);o.material=o.material.clone();o.material.color.setHex(0xa5b7c1);}});
  userScene.add(user);user.updateMatrixWorld(true);
  check(userSkins.length===skins.length&&userSkins[0].skeleton!==skins[0].skeleton,'两个人体没有独立骨架');
  check(!user.getObjectByName('waist'),'模拟用户不应包含外骨骼');
  const targets={};
  for(const [side,sign] of [['left',1],['right',-1]]) {
    const s=side==='left'?'l':'r';
    const offset=new THREE.Vector3(sign*fitSettings.hipClearanceM,0,0);
    targets[side]={hip:position(bones['thigh_'+s]).add(offset),knee:position(bones['calf_'+s]).add(offset),ankle:position(bones['foot_'+s]).add(offset)};
  }
  const mid=targets.left.hip.clone().add(targets.right.hip).multiplyScalar(.5);
  const waistScale=(targets.left.hip.x-targets.right.hip.x)/(meta.pivots.leftHip[0]-meta.pivots.rightHip[0]);
  // ponytail: a fixed avatar and rigid cuffs; add body-specific fitting or cloth deformation only when needed.
  function segmentMatrix(srcStart,srcEnd,dstStart,dstEnd) {
    const a=srcEnd.clone().sub(srcStart), b=dstEnd.clone().sub(dstStart);
    const u=a.clone().normalize(); const ratio=b.length()/a.length();
    const scale=new THREE.Matrix4().set(
      1+(ratio-1)*u.x*u.x,(ratio-1)*u.x*u.y,(ratio-1)*u.x*u.z,0,
      (ratio-1)*u.y*u.x,1+(ratio-1)*u.y*u.y,(ratio-1)*u.y*u.z,0,
      (ratio-1)*u.z*u.x,(ratio-1)*u.z*u.y,1+(ratio-1)*u.z*u.z,0,0,0,0,1);
    return new THREE.Matrix4().makeTranslation(...dstStart.toArray())
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(u,b.normalize())))
      .multiply(scale).multiply(new THREE.Matrix4().makeTranslation(...srcStart.clone().negate().toArray()));
  }
  const groups={}; const markerLocal={}; let exoMeshCount=0;
  exoAsset.scene.updateMatrixWorld(true);
  for(const name of ['waist','leftThigh','rightThigh','leftShank','rightShank']) {
    const group=exoAsset.scene.getObjectByName(name); check(group,'缺少外骨骼运动组：'+name);
    let bone,fit,marker;
    if(name==='waist') {
      bone=bones.pelvis;
      fit=new THREE.Matrix4().makeTranslation(...mid.toArray()).multiply(new THREE.Matrix4().makeScale(waistScale,1,1));
    } else {
      const side=name.startsWith('left')?'left':'right';const s=side==='left'?'l':'r';
      const hip=new THREE.Vector3().fromArray(meta.pivots[side+'Hip']);
      const knee=new THREE.Vector3().fromArray(meta.pivots[side+'Knee']);
      if(name.endsWith('Thigh')) {
        bone=bones['thigh_'+s];fit=segmentMatrix(hip,knee,targets[side].hip,targets[side].knee);marker={hip,knee};
      } else {
        bone=bones['calf_'+s];fit=segmentMatrix(knee,knee.clone().add(new THREE.Vector3(0,-meta.nominalShankReference_m,0)),targets[side].knee,targets[side].ankle);marker={knee};
      }
    }
    const localFit=bone.matrixWorld.clone().invert().multiply(fit);
    group.traverse(o=>{if(o.isMesh){
      let correction=new THREE.Matrix4();
      // Fit the waist above fixed hip housings; visual warp does not change the source CAD.
      if(name==='waist'&&!/_Hip(Housing|Cover|Trim|Face|InnerPlate)$/.test(o.name))
        correction.set(1,0,0,0, 0,1,0,0, 0,fitSettings.waistForwardTilt,1,0, 0,0,0,1);
      if(name.endsWith('Thigh')&&o.name.includes('_Thigh_')&&o.material.roughness>.9)
        correction.makeScale(1,1,fitSettings.thighHarnessDepthScale);
      o.geometry=o.geometry.clone();
      o.geometry.applyMatrix4(localFit.clone().multiply(correction).multiply(o.matrixWorld));
      o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);o.castShadow=true;o.receiveShadow=true;exoMeshCount++;
    }});
    group.position.set(0,0,0);group.quaternion.identity();group.scale.set(1,1,1);bone.add(group);groups[name]=group;
    if(marker) markerLocal[name]=Object.fromEntries(Object.entries(marker).map(([n,p])=>[n,p.clone().applyMatrix4(localFit)]));
  }
  check(exoMeshCount>0,'外骨骼网格为空');
  const joints={};
  for(const [key,boneName,sign] of [['leftHip','thigh_l',-1],['leftKnee','calf_l',1],['rightHip','thigh_r',-1],['rightKnee','calf_r',1]]) {
    const bone=bones[boneName],inverse=bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    const userBone=user.getObjectByName(boneName);
    check(userBone?.isBone&&userBone!==bone,'用户与数字下肢骨骼未独立：'+boneName);
    joints[key]={bone,userBone,base:userBone.quaternion.clone(),axis:new THREE.Vector3(1,0,0).applyQuaternion(inverse),sign};
    if(key.endsWith('Hip')) {
      joints[key].sideAxis=new THREE.Vector3(0,0,1).applyQuaternion(inverse);
      joints[key].twistAxis=position(bones[key.startsWith('left')?'calf_l':'calf_r']).sub(position(bone)).normalize().applyQuaternion(inverse);
      joints[key].sideSign=key.startsWith('left')?1:-1;
    }
  }
  const userPelvis=user.getObjectByName('pelvis'),pelvisBase=userPelvis.quaternion.clone();
  const pelvisInverse=bones.pelvis.getWorldQuaternion(new THREE.Quaternion()).invert();
  const pelvisYawAxis=new THREE.Vector3(0,1,0).applyQuaternion(pelvisInverse);
  const pelvisRollAxis=new THREE.Vector3(0,0,1).applyQuaternion(pelvisInverse);
  const turn=(axis,angle)=>new THREE.Quaternion().setFromAxisAngle(axis,deg(angle));
  const humanOrigin=human.position.clone(),userOrigin=user.position.clone();
  const feet=Object.fromEntries(['left','right'].map(side=>{
    const bone=bones[side==='left'?'foot_l':'foot_r'],userBone=user.getObjectByName(bone.name);
    return [side,{bone,userBone,base:userBone.quaternion.clone(),axis:new THREE.Vector3(1,0,0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert())}];
  }));
  function applyPose(values) {
    const root=new THREE.Vector3(0,values.rootY??0,values.rootZ??0),followRoot=root.clone();
    user.position.copy(userOrigin).add(root);human.position.copy(humanOrigin).add(root);
    if(demoMode==='adventure') {user.position.z=userOrigin.z;followRoot.y=0;}
    const delta=followRoot.clone().sub(cameraRoot);
    camera.position.add(delta);controls.target.add(delta);cameraRoot.copy(followRoot);
    userPelvis.quaternion.copy(pelvisBase).multiply(turn(pelvisYawAxis,values.pelvisYaw??0)).multiply(turn(pelvisRollAxis,values.pelvisRoll??0));
    for(const [key,j] of Object.entries(joints)) {
      const angle=Number(values[key]??0);check(Number.isFinite(angle),'姿态角度不是有效数字');
      j.userBone.quaternion.copy(j.base).multiply(turn(j.axis,angle*j.sign));
      if(j.sideAxis) j.userBone.quaternion.multiply(turn(j.sideAxis,(values[key+'Side']??0)*j.sideSign))
        .multiply(turn(j.twistAxis,-(values[key+'Twist']??0)*j.sideSign));
    }
    for(const [side,foot] of Object.entries(feet)) {
      foot.userBone.quaternion.copy(foot.base);
      if(values.levelFeet) foot.userBone.quaternion.multiply(turn(foot.axis,(values[side+'Hip']??0)-(values[side+'Knee']??0)));
      foot.bone.quaternion.copy(foot.userBone.quaternion);
    }
    user.updateMatrixWorld(true);userSkins.forEach(s=>s.skeleton.update());
    // The digital avatar consumes the simulated user's joint state; it has no separate motion controller.
    for(const j of Object.values(joints)) j.bone.quaternion.copy(j.userBone.quaternion);
    bones.pelvis.quaternion.copy(userPelvis.quaternion);
    human.updateMatrixWorld(true);skins.forEach(s=>s.skeleton.update());
  }
  const followError=()=>Math.max(bones.pelvis.quaternion.angleTo(userPelvis.quaternion),...Object.values(joints).map(j=>j.bone.quaternion.angleTo(j.userBone.quaternion)),...Object.values(feet).map(f=>f.bone.quaternion.angleTo(f.userBone.quaternion)));
  const marker=(group,n)=>markerLocal[group][n].clone().applyMatrix4(groups[group].matrixWorld);
  function alignment() {
    return Math.max(...['left','right'].map(side=>marker(side+'Thigh','knee').distanceTo(marker(side+'Shank','knee'))));
  }
  // One runnable kinematic check: both knees stay connected while each side moves independently.
  const neutral=position(bones.foot_l); const untouched=position(bones.foot_r);
  applyPose({leftHip:35,leftKnee:55});
  check(followError()<1e-6,'数字下肢未跟随用户动作');
  check(position(bones.foot_l).distanceTo(neutral)>.1,'左腿未产生运动');
  check(position(bones.foot_r).distanceTo(untouched)<1e-6,'单侧动作影响了另一侧');
  let gap=alignment();
  applyPose({leftHip:70,leftKnee:110,rightHip:-15,rightKnee:85});gap=Math.max(gap,alignment());
  check(gap<1e-5,'膝部随动连接检查失败');
  applyPose({});check(position(bones.foot_l).distanceTo(neutral)<1e-6,'初始姿态恢复失败');
  const legRest=Object.fromEntries(['left','right'].map(side=>{
    const s=side==='left'?'l':'r',hip=position(bones['thigh_'+s]),knee=position(bones['calf_'+s]),ankle=position(bones['foot_'+s]);
    const a=knee.clone().sub(hip),b=ankle.clone().sub(knee);
    return [side,{hip,ankle,upper:Math.hypot(a.y,a.z),lower:Math.hypot(b.y,b.z),hipAngle:Math.atan2(a.z,-a.y),shankAngle:Math.atan2(b.z,-b.y)}];
  }));
  const stairOffsetZ=-.15-(legRest.left.ankle.z+legRest.right.ankle.z)/2;
  const ease=t=>(1-Math.cos(Math.PI*THREE.MathUtils.clamp(t,0,1)))*.5;
  // ponytail: scripted foot paths with planar two-link IK; measured stair height can replace these demo constants later.
  function sampleStairs(time,descending) {
    const activeTime=(stairCount+1)*stepDuration,cycle=activeTime+1.4,t=time%cycle;
    const completed=Math.min(Math.floor(t/stepDuration),stairCount+1),phase=Math.min(t/stepDuration-completed,1);
    const progress=ease(phase),levels=[0,0];
    for(let i=0;i<completed;i++) levels[i%2]=Math.min(i+1,stairCount);
    const moving=completed%2,target=Math.min(completed+1,stairCount),before=levels[moving];
    const height=n=>(descending?stairCount-n:n)*stairRise;
    const stepZ=levels.map(n=>n*stairTread),stepY=levels.map(height);
    if(completed<=stairCount) {
      stepZ[moving]=THREE.MathUtils.lerp(before,target,progress)*stairTread;
      stepY[moving]=THREE.MathUtils.lerp(height(before),height(target),progress);
    }
    const crouch=.11*ease(t/.4)*(1-ease((t-activeTime+.4)/.4));
    const values={rootZ:stairOffsetZ+(stepZ[0]+stepZ[1])/2,rootY:(stepY[0]+stepY[1])/2-crouch,levelFeet:true};
    if(completed<=stairCount) stepY[moving]+=(descending?.12:.19)*Math.sin(Math.PI*phase);
    for(const [i,side] of ['left','right'].entries()) {
      const leg=legRest[side],down=leg.hip.y+values.rootY-leg.ankle.y-stepY[i];
      const forward=leg.ankle.z+stairOffsetZ+stepZ[i]-leg.hip.z-values.rootZ;
      const knee=Math.acos(THREE.MathUtils.clamp((down*down+forward*forward-leg.upper**2-leg.lower**2)/(2*leg.upper*leg.lower),-1,1));
      const hip=Math.atan2(forward,down)+Math.atan2(leg.lower*Math.sin(knee),leg.upper+leg.lower*Math.cos(knee));
      values[side+'Hip']=THREE.MathUtils.radToDeg(hip-leg.hipAngle);
      values[side+'Knee']=THREE.MathUtils.radToDeg(knee-leg.hipAngle+leg.shankAngle);
    }
    values.stairStep=Math.min(completed+1,stairCount);
    values.finished=completed>stairCount;
    values.fade=Math.min(1,t/.35,(cycle-t)/.35);
    return values;
  }
  check(sampleStairs(2,false).rootY>sampleStairs(0,false).rootY&&sampleStairs(2,true).rootY<sampleStairs(0,true).rootY,'上下楼方向检查失败');
  function update(values=Object.fromEntries(Object.entries(inputs).map(([n,input])=>[n,Number(input.value)]))) {
    applyPose(values);
    for(const [n,input] of Object.entries(inputs)) {const angle=Number(values[n]??0);input.value=String(Math.round(angle));document.getElementById(n+'Value').innerHTML=Math.round(angle)+'<small>°</small>';}
    stage.dataset.pose=JSON.stringify(values);
    stage.dataset.followError=String(followError());
    stage.dataset.alignment=String(alignment());
    stage.dataset.feet=JSON.stringify({left:position(bones.foot_l).toArray(),right:position(bones.foot_r).toArray()});
    stage.dataset.rootPosition=JSON.stringify(user.position.toArray());
    needsRender=true;
  }
  let playing=true,demoTime=8,previousTick=null;
  const playButton=document.getElementById('play');
  function setPlaying(value) {
    playing=value;previousTick=null;
    if(!playing) renderer.domElement.style.opacity='1';
    playButton.textContent=playing?'暂停演示':demoMode==='adventure'&&adventure.state.done?'再玩一次':'播放演示';playButton.setAttribute('aria-pressed',String(playing));
    document.body.dataset.playback=playing?'playing':'paused';
  }
  const demoMotions=[
    {label:'左腿抬起',pose:{leftHip:35,leftKnee:55}},
    {label:'右腿抬起',pose:{rightHip:35,rightKnee:55}},
    {label:'左腿向外侧摆',pose:{leftHipSide:24}},
    {label:'右腿向外侧摆',pose:{rightHipSide:24}},
    {label:'左髋向外转动',pose:{leftHip:12,leftKnee:25,leftHipTwist:24}},
    {label:'右髋向外转动',pose:{rightHip:12,rightKnee:25,rightHipTwist:24}},
    {label:'骨盆向左转动',pose:{pelvisYaw:30}},
    {label:'骨盆向右转动',pose:{pelvisYaw:-30}},
    {label:'左腿斜向抬起 · 骨盆侧倾',pose:{leftHip:28,leftKnee:45,leftHipSide:18,pelvisRoll:7}},
    {label:'右腿斜向抬起 · 骨盆侧倾',pose:{rightHip:28,rightKnee:45,rightHipSide:18,pelvisRoll:-7}}
  ];
  const currentMotion=time=>demoMotions[Math.floor(time/4)%demoMotions.length];
  function sampleMotion(time) {
    const phase=time%4;
    const lift=phase<1.2?ease(phase/1.2):phase<2?1:phase<3.2?1-ease((phase-2)/1.2):0;
    const values={leftHip:0,leftKnee:0,rightHip:0,rightKnee:0};
    for(const [key,angle] of Object.entries(currentMotion(time).pose)) values[key]=angle*lift;
    return values;
  }
  check(sampleMotion(0).leftHip===0&&sampleMotion(1.6).leftHip===35&&sampleMotion(5.6).rightKnee===55
    &&sampleMotion(3.8).leftKnee===0&&Math.abs(sampleMotion(2.6).leftHip-17.5)<1e-6,'演示动作采样检查失败');
  const adventure=await createAdventure(scene,()=>setPlaying(true));
  demoTick=now=>{
    if(!playing){previousTick=null;return;}
    if(previousTick!==null) demoTime+=Math.min((now-previousTick)/1000,.1);
    previousTick=now;stage.dataset.demoTime=String(demoTime);
    const pose=demoMode==='adventure'?adventure.sample(demoTime):demoMode==='follow'?sampleMotion(demoTime):sampleStairs(demoTime,demoMode==='stairsDown');
    update(pose);renderer.domElement.style.opacity=String(pose.fade??1);
    const phase=demoTime%4;
    const message=demoMode==='adventure'?'模拟用户动作 → 游戏角色响应':demoMode!=='follow'?(pose.finished?'到达平台':(demoMode==='stairsUp'?'上楼':'下楼')+' · 第 '+pose.stairStep+' / '+stairCount+' 级')+' · 数字下肢跟随':phase<2?currentMotion(demoTime).label+' · 数字下肢跟随':phase<3.2?'动作回位 · 数字下肢跟随':'恢复站立 · 数字下肢跟随';
    const status=document.getElementById('motionStatus');
    if(status.textContent!==message) status.textContent=message;
    if(demoMode==='adventure') {
      stage.dataset.gameState=JSON.stringify(adventure.state);
      if(adventure.state.done) {update({leftHip:0,leftKnee:0,rightHip:0,rightKnee:0,levelFeet:true,rootZ:adventure.state.distance});renderPair();setPlaying(false);}
    }
  };
  const modeSelect=document.getElementById('demoMode');
  function selectDemo(mode) {
    demoMode=mode;modeSelect.value=mode;demoTime=mode==='follow'?8:0;
    const isGame=mode==='adventure';adventure.group.visible=isGame;document.getElementById('gamePanel').hidden=!isGame;
    document.body.classList.toggle('is-game',isGame);
    scene.fog=isGame?new THREE.Fog(0xdce7c9,8,21):null;
    userScene.background=isGame?new THREE.Color(0xeaf0e4):null;
    renderer.toneMappingExposure=isGame?1.14:1.04;
    key.intensity=isGame?2.7:3.4;
    Object.assign(key.shadow.camera,{left:isGame?-5:-1.4,right:isGame?5:1.4,top:isGame?5:2.4,bottom:isGame?-5:-1.0,far:isGame?22:12});key.shadow.camera.updateProjectionMatrix();
    if(!isGame){key.position.set(3,5,4);key.target.position.set(0,0,0);key.target.updateMatrixWorld(true);}
    skins.forEach(s=>{s.material.color.setHex(isGame?0xe0e4cd:0xb8bcb9);s.material.roughness=isGame?.56:.82;});
    document.getElementById('reset').textContent=isGame?'重新闯关':'恢复站立';
    document.querySelector('.panel-heading h2').textContent=isGame?'体感闯关演示':'动作跟随演示';
    document.querySelector('.caption strong').textContent=isGame?'HALO · 林间试炼':'HALO · 动作复现';
    document.querySelector('.digital small').textContent=isGame?'穿戴外骨骼 · 游戏角色':'穿戴外骨骼 · 跟随动作';
    if(isGame) adventure.reset();
    stage.dataset.demoMode=mode;showStairs(mode);renderer.domElement.style.opacity='1';
    update(isGame?adventure.sample(0):mode==='follow'?sampleMotion(demoTime):sampleStairs(0,mode==='stairsDown'));
    view(mode==='follow'?currentView:'iso');setPlaying(true);
  }
  modeSelect.disabled=false;modeSelect.addEventListener('change',e=>selectDemo(e.target.value));
  for(const input of Object.values(inputs)){input.disabled=false;input.addEventListener('input',()=>{
    const values=Object.fromEntries(Object.entries(inputs).map(([n,i])=>[n,Number(i.value)]));
    if(demoMode!=='follow') selectDemo('follow');
    setPlaying(false);document.getElementById('motionStatus').textContent='手动模拟用户动作 · 数字下肢跟随';update(values);
  });}
  playButton.disabled=false;playButton.addEventListener('click',()=>{if(demoMode==='adventure'&&adventure.state.done)selectDemo('adventure');else setPlaying(!playing);});setPlaying(true);
  document.getElementById('manualPanel').addEventListener('toggle',e=>{if(e.target.open)setPlaying(false);});
  document.getElementById('reset').disabled=false;
  document.getElementById('reset').addEventListener('click',()=>{if(demoMode==='adventure'){selectDemo('adventure');return;}setPlaying(false);demoTime=0;Object.values(inputs).forEach(i=>i.value='0');update(demoMode==='follow'?{}:sampleStairs(0,demoMode==='stairsDown'));document.getElementById('motionStatus').textContent='站立 · 等待用户动作';});
  document.getElementById('showHuman').addEventListener('change',e=>{[...skins,...userSkins].forEach(o=>o.visible=e.target.checked);needsRender=true;});
  document.getElementById('showExo').addEventListener('change',e=>{Object.values(groups).forEach(o=>o.visible=e.target.checked);needsRender=true;});
  stage.dataset.demoMode=demoMode;update();renderPair();
  stage.dataset.triangles=String(renderer.info.render.triangles);
  stage.dataset.validation=JSON.stringify({passed:true,models:2,independentSkeletons:true,sourceHasExoskeleton:false,followError_rad:followError(),exoGroups:5,exoMeshes:exoMeshCount,maxKneeGap_m:gap,bones:skins[0].skeleton.bones.length,bodyFit:{shapedVertices,maxAdjustment_m:maxBodyAdjustment}});
  document.body.dataset.state='ready';
  document.getElementById('status').textContent='模拟用户动作 → 数字下肢同步复现';
  loading.hidden=true;
}
start().catch(error=>{console.error(error);document.body.dataset.state='error';loading.classList.add('error');loading.textContent='模型未能加载\n'+error.message;document.getElementById('status').textContent='加载未完成';});
