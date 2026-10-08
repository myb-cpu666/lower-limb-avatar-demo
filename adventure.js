import * as THREE from 'three';
import { buildForest } from './forest-scene.js';

const obstacleZ=2.3,enemyZ=4.8,finishZ=7.2;
const coinPositions=[.65,1.25,3.05,3.8,5.8,6.5];
const phaseOf=s=>s.done?'finished':!s.barrierCleared&&s.distance>=obstacleZ-.7?'obstacle':s.enemyHP>0&&s.distance>=enemyZ-.8?'battle':'walk';
const initialState=()=>({distance:0,visualDistance:0,score:0,coins:0,enemyHP:3,barrierCleared:false,done:false,lastSide:null});

function act(s,action) {
  const phase=phaseOf(s);
  if(phase==='finished') return '挑战完成！';
  if(phase==='battle') {
    if(action!=='squat') return '守卫挡住路线 · 屈膝发动攻击';
    s.enemyHP--;s.score+=s.enemyHP?30:120;
    return s.enemyHP?'命中！再屈膝 '+s.enemyHP+' 次':'击败守卫！继续前进';
  }
  if(phase==='obstacle') {
    if(!action.startsWith('cross')) return '遇到障碍 · 抬高一条腿跨越';
    s.barrierCleared=true;s.distance=obstacleZ+.45;s.score+=100;
    s.lastSide=action.endsWith('left')?'left':'right';
    return '成功跨越！+100';
  }
  if(action==='squat') return '交替抬腿，向终点前进';
  const side=action.endsWith('left')?'left':'right';
  if(side===s.lastSide) return '换另一条腿，交替前进';
  s.lastSide=side;
  const limit=!s.barrierCleared?obstacleZ-.7:s.enemyHP>0?enemyZ-.8:finishZ;
  s.distance=Math.min(limit,s.distance+.34);s.score+=10;
  while(s.coins<coinPositions.length&&s.distance>=coinPositions[s.coins]-.1) {s.coins++;s.score+=25;}
  if(s.distance>=finishZ) {s.done=true;s.score+=200;return '到达终点！挑战完成';}
  return '前进！左右腿交替抬起';
}

// One executable check covers alternating input, the obstacle gate and the three-hit enemy.
const test=initialState();act(test,'left');act(test,'left');
if(test.distance!==.34) throw new Error('重复同侧动作不应重复前进');
test.distance=obstacleZ-.7;act(test,'right');
if(test.barrierCleared) throw new Error('普通踏步不应越过障碍');
act(test,'cross-left');test.distance=enemyZ-.8;
for(let i=0;i<3;i++) act(test,'squat');
test.distance=finishZ-.1;act(test,test.lastSide==='left'?'right':'left');
if(!test.barrierCleared||test.enemyHP!==0||!test.done) throw new Error('闯关流程检查失败');

export async function createAdventure(scene,onInput) {
  const {group,coins,barrier,enemy,hitRing,trees,healthGems,motes}=await buildForest(scene,coinPositions,obstacleZ,enemyZ,finishZ);
  const ui=Object.fromEntries(['gameScore','gameCoins','gameHP','gameProgress','gameMission','gameResult','gameResultScore','gameAuto'].map(id=>[id,document.getElementById(id)]));
  const state=initialState();let command=null,time=0,lastTime=0,nextCommand=0,hitTime=-10,feedbackTime=-10,feedback='';
  const latched={left:false,right:false,squat:false};
  function renderHUD() {
    ui.gameScore.textContent=state.score;ui.gameCoins.textContent=state.coins+' / 6';ui.gameHP.textContent=state.enemyHP+' / 3';
    ui.gameProgress.value=state.distance;ui.gameResult.hidden=!state.done;ui.gameResultScore.textContent=state.score+' 分';
    const phase=phaseOf(state),prompt={walk:'交替抬腿前进 · 收集沿途金币',obstacle:'前方障碍 · 抬高一条腿跨越',battle:'遇到守卫 · 屈膝攻击 3 次',finished:'到达终点 · 挑战完成'}[phase];
    ui.gameMission.textContent=time-feedbackTime<.85?feedback:prompt;
    barrier.visible=!state.barrierCleared;enemy.visible=state.enemyHP>0;
    // Keep passed scenery out of the following camera's near field.
    trees.forEach(tree=>tree.visible=tree.position.z>=state.visualDistance-.45);
    healthGems.forEach((gem,i)=>gem.material.color.setHex(i<state.enemyHP?0xef9c82:0x738b7c));
    motes.position.y=.08*Math.sin(time*.5);
    coins.forEach((coin,i)=>{coin.visible=i>=state.coins;coin.rotation.y=time*2;coin.position.y=.65+.04*Math.sin(time*3+i);});
    const flash=time-hitTime;hitRing.visible=flash>=0&&flash<.45;
    if(hitRing.visible) hitRing.scale.setScalar(1+flash*1.5);
    enemy.scale.setScalar(1+.08*Math.sin(time*3));
  }
  function reset() {
    Object.assign(state,initialState());command=null;time=lastTime=nextCommand=0;hitTime=feedbackTime=-10;
    Object.keys(latched).forEach(key=>latched[key]=false);ui.gameAuto.checked=true;renderHUD();
  }
  function trigger(action,manual=false) {
    if(manual) {ui.gameAuto.checked=false;onInput();}
    if(command||state.done) return;
    command={action:action==='squat'?'squat':phaseOf(state)==='obstacle'?'cross-'+action:action,start:time};
  }
  document.querySelectorAll('[data-game-action]').forEach(button=>button.addEventListener('click',()=>trigger(button.dataset.gameAction,true)));
  window.addEventListener('keydown',event=>{
    const action={a:'left',d:'right',s:'squat'}[event.key.toLowerCase()];
    if(!group.visible||!action||event.repeat||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.altKey||event.metaKey) return;
    event.preventDefault();trigger(action,true);
  });
  ui.gameAuto.addEventListener('change',()=>{nextCommand=time;onInput();});
  function recognize(pose) {
    const squat=pose.leftKnee>45&&pose.rightKnee>45;
    const dispatch=action=>{feedback=act(state,action);feedbackTime=time;if(action==='squat'&&(feedback.startsWith('命中')||feedback.startsWith('击败')))hitTime=time;};
    if(squat&&!latched.squat) dispatch('squat');
    latched.squat=squat;
    for(const side of ['left','right']) {
      const raised=pose[side+'Hip']>24&&pose[side+'Knee']>30;
      const high=pose[side+'Hip']>42&&pose[side+'Knee']>50;
      if(!squat&&!latched[side]&&(phaseOf(state)==='obstacle'?high:raised)) dispatch(high?'cross-'+side:side);
      latched[side]=(phaseOf(state)==='obstacle'?high:raised)&&!squat;
    }
  }
  function sample(now) {
    time=now;const dt=Math.min(Math.max(time-lastTime,0),.1);lastTime=time;
    if(!command&&ui.gameAuto.checked&&!state.done&&time>=nextCommand) trigger(phaseOf(state)==='battle'?'squat':state.lastSide==='left'?'right':'left');
    const pose={leftHip:0,leftKnee:0,rightHip:0,rightKnee:0,levelFeet:true};
    if(command) {
      const duration=command.action==='squat'?1.15:command.action.startsWith('cross')?1.25:.85;
      const phase=(time-command.start)/duration,lift=phase<1?Math.sin(Math.PI*Math.max(phase,0))**2:0;
      if(command.action==='squat') {pose.leftHip=pose.rightHip=38*lift;pose.leftKnee=pose.rightKnee=76*lift;pose.rootY=-.17*lift;}
      else {
        const side=command.action.endsWith('left')?'left':'right',cross=command.action.startsWith('cross');
        pose[side+'Hip']=(cross?55:32)*lift;pose[side+'Knee']=(cross?78:48)*lift;
      }
      if(phase>=1) {command=null;nextCommand=time+.16;}
    }
    recognize(pose);
    state.visualDistance=THREE.MathUtils.lerp(state.visualDistance,state.distance,1-Math.exp(-dt*5));
    pose.rootZ=state.visualDistance;renderHUD();return pose;
  }
  reset();return {group,state,reset,sample};
}
