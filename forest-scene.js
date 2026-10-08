import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function buildForest(scene,coinPositions,obstacleZ,enemyZ,finishZ) {
  const names=['Tree_4_A_Color1','Tree_4_B_Color1','Tree_3_B_Color1','Bush_4_D_Color1','Bush_4_F_Color1','Rock_1_E_Color1','Rock_2_C_Color1','Grass_2_C_Color1','Grass_1_B_Color1'];
  const loader=new GLTFLoader();
  const assets=await Promise.all(names.map(name=>loader.loadAsync('./assets/forest/'+name+'.gltf')));
  const templates=assets.map(asset=>{
    const root=asset.scene,bounds=new THREE.Box3().setFromObject(root),height=bounds.max.y-bounds.min.y;
    root.position.sub(new THREE.Vector3((bounds.max.x+bounds.min.x)/2,bounds.min.y,(bounds.max.z+bounds.min.z)/2));
    const wrapper=new THREE.Group();wrapper.add(root);wrapper.scale.setScalar(1/height);
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.roughness=.88;}});
    return wrapper;
  });
  const group=new THREE.Group();group.name='adventure';group.visible=false;scene.add(group);
  const box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,32,24);
  const materials=Object.fromEntries(Object.entries({wood:0x8b5d3f,cut:0xd5ab78,gold:0xf2ba4b,white:0xfff6df,dark:0x193d36,stone:0xd8c9a6,green:0x538c63,rose:0xecaaa0})
    .map(([name,color])=>[name,new THREE.MeshStandardMaterial({color,roughness:name==='gold'?.28:.85,metalness:name==='gold'?.25:0})]));
  materials.slime=new THREE.MeshPhysicalMaterial({color:0x66c6a6,roughness:.2,clearcoat:1,clearcoatRoughness:.15});
  const mesh=(geometry,material,scale,position,parent=group)=>{
    const obj=new THREE.Mesh(geometry,material);obj.scale.fromArray(scale);obj.position.fromArray(position);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
  };
  let seed=418;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function texture(ground) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
    ctx.fillStyle=ground?'#73965e':'#d6bf8f';ctx.fillRect(0,0,256,256);
    for(let i=0;i<1600;i++) {
      ctx.fillStyle=ground?(i%2?'#83a56a':'#638354'):(i%3?'#c7ad7e':'#e2cda1');
      ctx.globalAlpha=.18+random()*.22;ctx.beginPath();ctx.ellipse(random()*256,random()*256,1+random()*3,ground?1:1+random()*2,random()*Math.PI,0,Math.PI*2);ctx.fill();
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(ground?16:2,ground?16:10);map.anisotropy=4;return map;
  }
  const earth=new THREE.MeshStandardMaterial({map:texture(true),roughness:1});
  const dirt=new THREE.MeshStandardMaterial({map:texture(false),roughness:1});
  const ground=mesh(new THREE.PlaneGeometry(60,60),earth,[1,1,1],[0,-.015,5]);ground.rotation.x=-Math.PI/2;
  const pathGeometry=new THREE.PlaneGeometry(1.8,17,4,40);pathGeometry.rotateX(-Math.PI/2);
  const verts=pathGeometry.attributes.position;
  for(let i=0;i<verts.count;i++) verts.setX(i,verts.getX(i)+.07*Math.sin((verts.getZ(i)+6)*1.15));
  pathGeometry.computeVertexNormals();mesh(pathGeometry,dirt,[1,1,1],[0,-.007,5]);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(40,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{top:{value:new THREE.Color(0xa8d9d4)},bottom:{value:new THREE.Color(0xf5edd3)}},
    vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);}',
    fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 world;void main(){float h=smoothstep(-0.06,0.65,normalize(world-cameraPosition).y);gl_FragColor=vec4(mix(bottom,top,h),1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  // Shader directives must begin on their own line.
  sky.material.fragmentShader=sky.material.fragmentShader.replace(';#include',';\n#include');sky.position.z=5;group.add(sky);
  const trees=[];
  function place(index,x,z,height,rotation=0) {
    const obj=templates[index].clone(true);obj.scale.multiplyScalar(height);obj.position.set(x,0,z);obj.rotation.y=rotation;group.add(obj);return obj;
  }
  for(const side of [-1,1]) {
    for(let i=0;i<8;i++) {
      const tree=place(i%3,side*(2.2+random()*.8),-.3+i*1.8,2.4+random()*1.2,random()*Math.PI*2);trees.push(tree);
      place(3+i%2,side*(1.18+random()*.25),i*1.65+.15,.3+random()*.3,random()*Math.PI*2);
      place(5+i%2,side*(1.50+random()*.6),i*1.55+.5,.25+random()*.45,random()*Math.PI*2);
    }
    for(let i=0;i<40;i++) place(7+i%2,side*(.94+random()*.72),-.6+i*.32,.09+random()*.18,random()*Math.PI*2);
    for(let i=0;i<8;i++) place(i%3,side*(4.5+random()*2),i*2,3.2+random()*1.5,random()*Math.PI*2);
  }
  const pebbleGeometry=new THREE.IcosahedronGeometry(1,1);
  for(let i=0;i<48;i++) mesh(pebbleGeometry,materials.stone,[.035+random()*.04,.018,.03+random()*.03],[(random()-.5)*1.55,.012,random()*11]);
  function label(text,position,width,parent=group) {
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(255,249,230,.94)';ctx.beginPath();ctx.roundRect(0,0,384,96,30);ctx.fill();
    ctx.font='bold 38px Microsoft YaHei';ctx.fillStyle='#3c6452';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,192,49);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,depthWrite:false}));sprite.position.fromArray(position);sprite.scale.set(width,width/4,1);parent.add(sprite);return sprite;
  }
  function star(radius) {
    const shape=new THREE.Shape();for(let i=0;i<10;i++){const r=i%2?radius*.45:radius,a=Math.PI/2+i*Math.PI/5;if(!i)shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}shape.closePath();
    return new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1});
  }
  const starGeometry=star(.10),disc=new THREE.CylinderGeometry(.15,.15,.038,32),rim=new THREE.TorusGeometry(.147,.015,8,32);
  const coins=coinPositions.map(z=>{
    const coin=new THREE.Group();coin.position.set(0,.62,z);group.add(coin);
    mesh(disc,materials.gold,[1,1,1],[0,0,0],coin).rotation.x=Math.PI/2;
    mesh(rim,materials.cut,[1,1,1],[0,0,-.023],coin);
    mesh(starGeometry,materials.white,[1,1,1],[0,0,-.041],coin);return coin;
  });
  const barrier=new THREE.Group();barrier.position.z=obstacleZ;group.add(barrier);
  const log=mesh(new THREE.CylinderGeometry(.13,.15,1.42,12),materials.wood,[1,1,1],[0,.15,0],barrier);log.rotation.z=Math.PI/2;
  for(const side of [-1,1]) {
    const cap=mesh(new THREE.CircleGeometry(.129,24),materials.cut,[1,1,1],[side*.716,.15,0],barrier);cap.rotation.y=side*Math.PI/2;
    for(const r of [.043,.08,.111]) mesh(new THREE.TorusGeometry(r,.004,5,24),materials.wood,[1,1,1],[side*.718,.15,0],barrier).rotation.y=side*Math.PI/2;
  }
  label('抬腿跨越',[0,.54,0],.76,barrier);
  const enemy=new THREE.Group();enemy.position.set(.43,0,enemyZ);group.add(enemy);
  mesh(sphere,materials.slime,[.37,.39,.32],[0,.40,0],enemy);
  for(const side of [-1,1]) {
    mesh(sphere,materials.slime,[.10,.07,.13],[side*.20,.065,-.07],enemy);
    mesh(sphere,materials.slime,[.08,.13,.09],[side*.36,.31,0],enemy).rotation.z=side*.3;
    mesh(sphere,materials.white,[.088,.11,.042],[side*.13,.45,-.285],enemy);
    mesh(sphere,materials.dark,[.043,.066,.025],[side*.13,.44,-.321],enemy);
    mesh(sphere,materials.white,[.015,.020,.009],[side*.13-.012,.463,-.342],enemy);
    mesh(sphere,materials.rose,[.052,.024,.009],[side*.245,.355,-.253],enemy);
    mesh(sphere,materials.green,[.065,.17,.033],[side*.08,.86,0],enemy).rotation.z=side*.7;
  }
  const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.065,.322,-.31),new THREE.Vector3(0,.300,-.322),new THREE.Vector3(.065,.322,-.31)]);
  mesh(new THREE.TubeGeometry(smile,12,.008,6,false),materials.dark,[1,1,1],[0,0,0],enemy);
  label('森林守卫',[0,1.17,0],.72,enemy);
  const healthGems=[-.15,0,.15].map(x=>mesh(sphere,new THREE.MeshStandardMaterial({color:0xef9c82,roughness:.5}),[.043,.043,.043],[x,.98,0],enemy));
  const arch=new THREE.CatmullRomCurve3([new THREE.Vector3(-.91,0,finishZ+.2),new THREE.Vector3(-.91,1.35,finishZ+.2),new THREE.Vector3(-.60,1.95,finishZ+.2),new THREE.Vector3(0,2.15,finishZ+.2),new THREE.Vector3(.60,1.95,finishZ+.2),new THREE.Vector3(.91,1.35,finishZ+.2),new THREE.Vector3(.91,0,finishZ+.2)]);
  mesh(new THREE.TubeGeometry(arch,48,.105,10,false),materials.stone,[1,1,1],[0,0,0]);
  for(const x of [-.91,.91]) {mesh(box,materials.stone,[.30,.17,.30],[x,.085,finishZ+.2]);place(4,x,finishZ+.2,.24);}
  label('终点',[0,2.37,finishZ+.2],.90);
  mesh(star(.16),materials.gold,[1,1,1],[0,1.89,finishZ+.10]);
  const hitRing=mesh(new THREE.TorusGeometry(.50,.025,8,48),materials.gold,[1,1,1],[.43,.40,enemyZ]);hitRing.visible=false;
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=32;const glowCtx=glowCanvas.getContext('2d');
  const glow=glowCtx.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'rgba(255,255,230,1)');glow.addColorStop(.3,'rgba(255,234,165,.8)');glow.addColorStop(1,'rgba(255,234,165,0)');glowCtx.fillStyle=glow;glowCtx.fillRect(0,0,32,32);
  const dust=new Float32Array(72*3);for(let i=0;i<dust.length;i+=3){dust[i]=(random()-.5)*5;dust[i+1]=.35+random()*2.5;dust[i+2]=random()*13-1;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(glowCanvas),color:0xffe4a2,size:.055,transparent:true,opacity:.65,depthWrite:false}));group.add(motes);
  return {group,coins,barrier,enemy,hitRing,trees,healthGems,motes};
}
