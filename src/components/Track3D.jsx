import { useEffect, useRef } from "react";
import * as THREE from "three";

const ROAD_W = 10, TRACK_LEN = 380, CAM_H = 3.6, CAM_B = 7, FOV = 66;


/* ── Textures ─────────────────────────────────────────────── */
function mkRoadTex() {
  const c = Object.assign(document.createElement("canvas"),{width:512,height:512});
  const x = c.getContext("2d");
  x.fillStyle="#555566"; x.fillRect(0,0,512,512);
  for(let i=0;i<5000;i++){const v=70+Math.random()*30|0;x.fillStyle=`rgba(${v},${v},${v+10},0.2)`;x.fillRect(Math.random()*512,Math.random()*512,2,2);}
  x.fillStyle="#fff"; x.fillRect(0,0,14,512); x.fillRect(498,0,14,512);
  x.fillStyle="#ffe033";
  for(let y=0;y<512;y+=80){x.fillRect(249,y,14,50);}
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1,8); return t;
}

function mkSkyTex() {
  const c=Object.assign(document.createElement("canvas"),{width:2,height:512});
  const x=c.getContext("2d"), g=x.createLinearGradient(0,0,0,512);
  g.addColorStop(0,"#1a0533"); g.addColorStop(0.25,"#5c0e7a");
  g.addColorStop(0.45,"#c4245a"); g.addColorStop(0.62,"#f0622a");
  g.addColorStop(0.75,"#f5a623"); g.addColorStop(0.88,"#f8d56a");
  g.addColorStop(1,"#ffeea0");
  x.fillStyle=g; x.fillRect(0,0,2,512);
  return new THREE.CanvasTexture(c);
}

function mkOceanTex() {
  const c=Object.assign(document.createElement("canvas"),{width:256,height:64});
  const x=c.getContext("2d"), g=x.createLinearGradient(0,0,0,64);
  g.addColorStop(0,"#3a8fc8"); g.addColorStop(0.5,"#1a5f9a"); g.addColorStop(1,"#0d3f6e");
  x.fillStyle=g; x.fillRect(0,0,256,64);
  x.fillStyle="rgba(255,255,255,0.3)";
  for(let i=0;i<8;i++){x.fillRect(Math.random()*256,Math.random()*64,40+Math.random()*60,2);}
  const t=new THREE.CanvasTexture(c); t.wrapS=THREE.RepeatWrapping; t.repeat.set(4,1); return t;
}

/* ── GTR Car ──────────────────────────────────────────────── */
function mkGTR() {
  const g=new THREE.Group();
  const blue=new THREE.MeshPhongMaterial({color:0x1a4fd6,shininess:160,specular:0x8888ff});
  const dkblue=new THREE.MeshPhongMaterial({color:0x0d2d8a,shininess:80});
  const blk=new THREE.MeshPhongMaterial({color:0x111118,shininess:40});
  const slv=new THREE.MeshPhongMaterial({color:0x9999aa,shininess:240});
  const red=new THREE.MeshBasicMaterial({color:0xff1100});
  const amb=new THREE.MeshBasicMaterial({color:0xff8800});
  const wht=new THREE.MeshBasicMaterial({color:0xffffff});
  const purp=new THREE.MeshBasicMaterial({color:0xcc44ff});
  const glass=new THREE.MeshPhongMaterial({color:0x0d1a33,transparent:true,opacity:0.82,shininess:300});

  // Main body
  const body=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.7,2.2),blue);
  body.position.set(0,0.42,0); g.add(body);
  // Side skirts
  [-1,1].forEach(s=>{
    const sk=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.22,2.3),dkblue);
    sk.position.set(s*1.89,0.15,0); g.add(sk);
  });
  // Cabin
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.15,0.62,1.55),blue);
  cab.position.set(0,1.13,0.12); g.add(cab);
  // Rear glass
  const rg=new THREE.Mesh(new THREE.BoxGeometry(1.95,0.5,0.06),glass);
  rg.position.set(0,1.06,-0.72); rg.rotation.x=0.18; g.add(rg);
  // Rear deck
  const dk=new THREE.Mesh(new THREE.BoxGeometry(2.85,0.12,0.7),blue);
  dk.position.set(0,0.85,-0.88); g.add(dk);
  // Wing blade
  const wb=new THREE.Mesh(new THREE.BoxGeometry(3.0,0.09,0.42),dkblue);
  wb.position.set(0,1.28,-0.98); g.add(wb);
  // Wing legs
  [-1.1,1.1].forEach(s=>{
    const wl=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.42,0.1),blk);
    wl.position.set(s,1.07,-0.98); g.add(wl);
  });
  // Rear bumper
  const rb=new THREE.Mesh(new THREE.BoxGeometry(3.65,0.32,0.24),dkblue);
  rb.position.set(0,0.18,-1.12); g.add(rb);
  // Diffuser
  const diff=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.18,0.35),blk);
  diff.position.set(0,0.09,-1.13); g.add(diff);

  // Taillights — GTR circular style (3 per side)
  [-1,1].forEach(s=>{
    [0.72,1.08].forEach((ox,i)=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.13,0.04,8,14),
        i===0?red:amb);
      ring.position.set(s*ox,0.52,-1.14); ring.rotation.y=Math.PI/2; g.add(ring);
      const inner=new THREE.Mesh(new THREE.CircleGeometry(0.09,10),
        i===0?red:amb);
      inner.position.set(s*ox,0.52,-1.155); inner.rotation.y=Math.PI/2; g.add(inner);
    });
  });
  // Center reverse light
  const crl=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.12,0.03),wht);
  crl.position.set(0,0.44,-1.15); g.add(crl);
  // License plate
  const lp=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.03),wht);
  lp.position.set(0,0.25,-1.16); g.add(lp);

  // Exhaust (quad, purple glow)
  [[-0.55,-0.2],[0.55,-0.2],[-0.55,0.2],[0.55,0.2]].forEach(([ex])=>{
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.065,0.22,10),slv);
    pipe.rotation.x=Math.PI/2; pipe.position.set(ex,0.13,-1.19); g.add(pipe);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(0.05,8),purp);
    glow.position.set(ex,0.13,-1.21); g.add(glow);
  });

  // Wheels
  const addW=(wx,wy,wz)=>{
    const tyre=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,0.26,16),blk);
    tyre.rotation.z=Math.PI/2; tyre.position.set(wx,wy,wz); g.add(tyre);
    // Rim spokes
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.27,8),slv);
    rim.rotation.z=Math.PI/2; rim.position.set(wx,wy,wz); g.add(rim);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.18,8),
      new THREE.MeshPhongMaterial({color:0xccccdd,shininess:300}));
    cap.rotation.z=Math.PI/2; cap.position.set(wx,wy,wz); g.add(cap);
  };
  addW(-1.88,0.38,-0.68); addW(1.88,0.38,-0.68);
  addW(-1.88,0.38,0.78); addW(1.88,0.38,0.78);

  // Nissan badge on rear
  const badge=new THREE.Mesh(new THREE.TorusGeometry(0.1,0.025,6,10),slv);
  badge.position.set(0,0.52,-1.155); badge.rotation.y=Math.PI/2; g.add(badge);

  return g;
}

/* ── Palm tree ─────────────────────────────────────────────── */
function mkPalm(h=7) {
  const g=new THREE.Group();
  // Trunk (slight curve via segments)
  const tk=new THREE.Mesh(
    new THREE.CylinderGeometry(0.1,0.22,h,7),
    new THREE.MeshPhongMaterial({color:0x8B6914})
  );
  tk.position.y=h/2; g.add(tk);
  // Fronds
  const fMat=new THREE.MeshPhongMaterial({color:0x2d8a2d,side:THREE.DoubleSide});
  for(let i=0;i<7;i++){
    const ang=i*(Math.PI*2/7);
    const frond=new THREE.Mesh(new THREE.PlaneGeometry(0.5,2.8),fMat);
    frond.position.set(Math.cos(ang)*1.2,h+0.6,Math.sin(ang)*1.2);
    frond.rotation.set(-0.6,ang,0);
    g.add(frond);
  }
  return g;
}

/* ── Rolling hill ──────────────────────────────────────────── */
function mkHill(side) {
  const w=45, d=TRACK_LEN+60;
  const geo=new THREE.PlaneGeometry(w,d,12,60);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i), x=pos.getX(i);
    pos.setZ(i, 2+Math.sin(y*0.05)*4+Math.cos(y*0.09+x*0.1)*2.5+Math.random()*0.4);
  }
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,
    new THREE.MeshPhongMaterial({color:0x2d8a2d,shininess:5}));
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(side*(ROAD_W/2+w/2+1.5),0.3,-d/2+20);
  return mesh;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function Track3D({
  speed,speedPct,progress,isFocused,focusStrength,
  turnState,modeKey,running,playerCarRef,finishLineRef,
}) {
  const mountRef=useRef(null);
  const rafRef=useRef(null);
  const propsRef=useRef({});
  const progressLabelRef=useRef(null);
  propsRef.current={speed,speedPct,progress,isFocused,focusStrength,turnState,modeKey,running};

  // Update progress label live without re-render
  useEffect(()=>{
    if(progressLabelRef.current)
      progressLabelRef.current.textContent=`${Math.round(progress*100)}%`;
  },[progress]);

  useEffect(()=>{
    const mount=mountRef.current; if(!mount) return;

    /* Renderer */
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.1;
    mount.appendChild(renderer.domElement);

    /* Scene */
    const scene=new THREE.Scene();
    scene.fog=new THREE.Fog(0xf5956a,120,340);

    /* Camera */
    const camera=new THREE.PerspectiveCamera(FOV,mount.clientWidth/mount.clientHeight,0.1,800);

    /* Lighting */
    scene.add(new THREE.AmbientLight(0xffd4a0,1.8));
    const sun=new THREE.DirectionalLight(0xffe0aa,3.0);
    sun.position.set(0,30,-200); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{near:0.5,far:400,left:-80,right:80,top:80,bottom:-80});
    scene.add(sun);
    const fill=new THREE.HemisphereLight(0xffd060,0x2d5a1a,0.8);
    scene.add(fill);

    /* Sky sphere */
    const skyGeo=new THREE.SphereGeometry(500,16,8);
    skyGeo.scale(-1,1,1);
    scene.add(new THREE.Mesh(skyGeo,
      new THREE.MeshBasicMaterial({map:mkSkyTex(),side:THREE.BackSide})));

    /* Sun glow on horizon */
    const sunGroup=new THREE.Group();
    sunGroup.position.set(0,28,-340);
    // Outer glow rings
    [[3.5,0xffe070,0.18],[2.8,0xffcc40,0.3],[2.2,0xfff0a0,0.55],[1.6,0xffffff,0.9]].forEach(([r,col,op])=>{
      const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),
        new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false}));
      sunGroup.add(m);
    });
    // Horizontal scan lines on sun (retrowave look)
    for(let i=-8;i<=8;i++){
      const bar=new THREE.Mesh(new THREE.PlaneGeometry(2.8,0.055),
        new THREE.MeshBasicMaterial({color:0xf5a020,transparent:true,opacity:0.6}));
      bar.position.set(0,i*0.17+0.22,0.01); sunGroup.add(bar);
    }
    scene.add(sunGroup);

    /* Ocean strip */
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(600,55),
      new THREE.MeshPhongMaterial({map:mkOceanTex(),shininess:120,specular:0xffffff}));
    ocean.rotation.x=-Math.PI/2;
    ocean.position.set(0,0.5,-310);
    scene.add(ocean);

    /* Clouds (purple/pink pixel-ish) */
    const cloudColors=[0xcc44aa,0xdd6688,0xee88cc,0xaa3399];
    for(let i=0;i<18;i++){
      const cc=cloudColors[i%cloudColors.length];
      const cMesh=new THREE.Mesh(
        new THREE.SphereGeometry(5+Math.random()*8,6,5),
        new THREE.MeshBasicMaterial({color:cc,transparent:true,opacity:0.7})
      );
      cMesh.scale.set(1+Math.random(),0.35+Math.random()*0.4,0.5);
      cMesh.position.set((Math.random()-0.5)*400,35+Math.random()*25,-80-Math.random()*200);
      scene.add(cMesh);
    }

    /* Hills */
    scene.add(mkHill(-1)); scene.add(mkHill(1));

    /* Road */
    const rTex=mkRoadTex();
    const road=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W,TRACK_LEN+30),
      new THREE.MeshPhongMaterial({map:rTex,shininess:30}));
    road.rotation.x=-Math.PI/2;
    road.position.set(0,0.01,-(TRACK_LEN/2)+10);
    road.receiveShadow=true; scene.add(road);

    /* Road shoulder (grey) */
    [-1,1].forEach(s=>{
      const sh=new THREE.Mesh(new THREE.PlaneGeometry(3,TRACK_LEN+30),
        new THREE.MeshPhongMaterial({color:0x888899}));
      sh.rotation.x=-Math.PI/2;
      sh.position.set(s*(ROAD_W/2+1.5),0,-(TRACK_LEN/2)+10); scene.add(sh);
    });

    /* Guardrails */
    [-1,1].forEach(s=>{
      const rail=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.55,TRACK_LEN+30),
        new THREE.MeshPhongMaterial({color:0xbbbbcc,shininess:120}));
      rail.position.set(s*(ROAD_W/2+0.12),0.55,-(TRACK_LEN/2)+10); scene.add(rail);
      // Posts
      for(let p=0;p<TRACK_LEN;p+=8){
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.1,0.12),
          new THREE.MeshPhongMaterial({color:0x999aaa}));
        post.position.set(s*(ROAD_W/2+0.12),0.55,-p); scene.add(post);
      }
    });

    /* Palm trees along sides */
    const palmPositions=[-30,-60,-100,-145,-195,-250,-295,-340];
    palmPositions.forEach(pz=>{
      [-1,1].forEach(s=>{
        const palm=mkPalm(7+Math.random()*4);
        palm.position.set(s*(ROAD_W/2+4+Math.random()*5),0,pz);
        palm.rotation.y=Math.random()*0.4-0.2;
        scene.add(palm);
      });
    });

    /* Finish line */
    const finishZ=-(TRACK_LEN-10);
    // Chequered pattern
    const fc=Object.assign(document.createElement("canvas"),{width:512,height:64});
    const fx=fc.getContext("2d");
    for(let col=0;col<16;col++) for(let row=0;row<2;row++){
      fx.fillStyle=(col+row)%2===0?"#fff":"#000";
      fx.fillRect(col*32,row*32,32,32);
    }
    const flagMesh=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W,1.5),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(fc)}));
    flagMesh.rotation.x=-Math.PI/2; flagMesh.position.set(0,0.05,finishZ); scene.add(flagMesh);
    // Arch
    const arch=new THREE.Mesh(
      new THREE.TorusGeometry(ROAD_W/2+0.5,0.3,6,18,Math.PI),
      new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0xffaa00,emissiveIntensity:0.8}));
    arch.rotation.z=Math.PI; arch.position.set(0,ROAD_W/2+0.5,finishZ); scene.add(arch);
    // Arch poles
    [-1,1].forEach(s=>{
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,ROAD_W/2+1,8),
        new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0xffaa00,emissiveIntensity:0.5}));
      pole.position.set(s*(ROAD_W/2+0.5),ROAD_W/4+0.5,finishZ); scene.add(pole);
    });
    // FINISH text sprite
    const lc=Object.assign(document.createElement("canvas"),{width:512,height:128});
    const lx=lc.getContext("2d");
    lx.fillStyle="#00ff88"; lx.font="bold 90px monospace";
    lx.textAlign="center"; lx.textBaseline="middle";
    lx.fillText("🏁 FINISH!", 256,64);
    const lSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(lc),transparent:true}));
    lSpr.scale.set(14,3.5,1); lSpr.position.set(0,10,finishZ); scene.add(lSpr);

    /* Player GTR */
    const car=mkGTR();
    scene.add(car);

    /* Another car ahead */
    const opp=mkGTR();
    opp.scale.setScalar(0.78);
    scene.add(opp);

    /* Exhaust particles */
    const PC=100;
    const pGeo=new THREE.BufferGeometry();
    const pPos=new Float32Array(PC*3);
    pGeo.setAttribute("position",new THREE.BufferAttribute(pPos,3));
    const pMat=new THREE.PointsMaterial({color:0xcc44ff,size:0.15,transparent:true,opacity:0.7,sizeAttenuation:true});
    const pSys=new THREE.Points(pGeo,pMat);
    scene.add(pSys);
    const pSt=Array.from({length:PC},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0}));

    /* Resize */
    const ro=new ResizeObserver(()=>{
      renderer.setSize(mount.clientWidth,mount.clientHeight);
      camera.aspect=mount.clientWidth/mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let prevT=performance.now(), camLean=0;

    const animate=()=>{
      rafRef.current=requestAnimationFrame(animate);
      const now=performance.now(), dt=Math.min((now-prevT)/1000,0.05); prevT=now;
      const {speedPct:sp,focusStrength:fs,turnState:ts,progress:prog}=propsRef.current;

      /* Car world position driven by progress */
      const carZ=-prog*TRACK_LEN;
      car.position.set(ts*-0.6,0,carZ);
      car.rotation.z=ts*-0.055;
      car.position.y=Math.sin(now*0.005*(1+sp))*0.022*sp;

      /* Camera follows car */
      camLean+=(ts*-0.05-camLean)*0.07;
      camera.position.set(carZ===0?0:car.position.x+camLean*3, carZ*0+CAM_H, carZ+CAM_B);
      camera.lookAt(car.position.x+camLean*8,2.2,carZ-55-sp*20);
      camera.rotation.z=camLean*0.07;

      /* Road texture scroll */
      rTex.offset.y+=sp*0.022+0.002;

      /* Opponent car */
      opp.position.set(2.2,0,carZ-32-prog*15);

      /* Sun shimmer */
      sunGroup.position.y=28+Math.sin(now*0.0008)*0.5;

      /* Exhaust particles */
      pMat.color.set(fs>0.8?0xcc44ff:0xffffff);
      pMat.opacity=sp>0.05?0.6*sp:0;
      if(sp>0.08){
        for(let i=0;i<4;i++){
          const d=pSt.findIndex(p=>p.life<=0);
          if(d>=0){
            const p=pSt[d];
            [p.x,p.y,p.z]=[car.position.x+(Math.random()-0.5)*0.5,0.13,carZ+CAM_B-1.2];
            [p.vx,p.vy,p.vz]=[(Math.random()-0.5)*0.03,fs>0.8?0.05:0.01,0.06+Math.random()*0.06];
            p.life=0.4+Math.random()*0.3;
          }
        }
      }
      for(let i=0;i<PC;i++){
        const p=pSt[i];
        if(p.life>0){p.life-=dt;p.x+=p.vx;p.y+=p.vy;p.z+=p.vz;}
        pPos[i*3]=p.life>0?p.x:9999; pPos[i*3+1]=p.life>0?p.y:9999; pPos[i*3+2]=p.life>0?p.z:9999;
      }
      pGeo.attributes.position.needsUpdate=true;

      renderer.render(scene,camera);
    };
    animate();

    return ()=>{
      cancelAnimationFrame(rafRef.current); ro.disconnect();
      renderer.dispose();
      if(mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.traverse(o=>{
        if(o.geometry) o.geometry.dispose();
        if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());
      });
    };
  },[]);

  return (
    <div ref={mountRef} style={{width:"100%",height:"100%",position:"relative",background:"#1a0533"}}>
      <div ref={finishLineRef} style={{position:"absolute",top:"38%",left:"10%",width:"80%",height:"4px",opacity:0,pointerEvents:"none"}}/>
      <div ref={playerCarRef} aria-label="Car" style={{position:"absolute",bottom:"40%",left:"46%",width:"8%",height:"14%",opacity:0,pointerEvents:"none"}}/>

      {/* ── Bottom UI overlay ── */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"22%",
        background:"linear-gradient(0deg,rgba(0,0,0,0.85) 0%,transparent 100%)",
        display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"0 24px 12px",
        pointerEvents:"none"}}>

        {/* Left gauge — mini compass */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{width:80,height:80,borderRadius:"50%",
            background:"radial-gradient(circle,#1a1a2e 60%,#00f5ff22)",
            border:"3px solid rgba(0,245,255,0.5)",
            boxShadow:"0 0 16px rgba(0,245,255,0.4)",
            display:"flex",alignItems:"center",justifyContent:"center",
            position:"relative"}}>
            <div style={{fontSize:22}}>🧭</div>
            <div style={{position:"absolute",bottom:6,fontSize:"0.5rem",
              color:"rgba(0,245,255,0.7)",letterSpacing:1,fontFamily:"monospace"}}>MINI MAP</div>
          </div>
        </div>

        {/* Center score */}
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"monospace",fontSize:"0.65rem",color:"#aaa",letterSpacing:3,textTransform:"uppercase"}}>
            race progress
          </div>
          <div ref={progressLabelRef} style={{
            fontFamily:"'Courier New',monospace",
            fontSize:"1.8rem",fontWeight:900,
            color:"#ffe033",
            textShadow:"0 0 20px rgba(255,224,51,0.9), 0 0 40px rgba(255,224,51,0.5)",
            letterSpacing:2}}>
            0%
          </div>
          <div style={{fontFamily:"monospace",fontSize:"0.6rem",color:"rgba(255,255,255,0.5)",letterSpacing:2}}>
            TO FINISH
          </div>
        </div>

        {/* Right gauge — nitro/speed */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{width:80,height:80,borderRadius:"50%",
            background:"radial-gradient(circle,#1a0a2e 60%,#a855f722)",
            border:"3px solid rgba(168,85,247,0.6)",
            boxShadow:"0 0 16px rgba(168,85,247,0.4)",
            display:"flex",alignItems:"center",justifyContent:"center",
            position:"relative"}}>
            <div style={{fontSize:"1.1rem",fontWeight:900,color:"#cc44ff",fontFamily:"monospace"}}>
              NITRO
            </div>
            <div style={{position:"absolute",bottom:6,fontSize:"0.5rem",
              color:"rgba(168,85,247,0.7)",letterSpacing:1,fontFamily:"monospace"}}>BOOST</div>
          </div>
        </div>
      </div>
    </div>
  );
}
