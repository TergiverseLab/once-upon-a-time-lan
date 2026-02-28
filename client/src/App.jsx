import{useState,useEffect,useRef,useCallback}from'react';
import socket from'./socket';
import'./App.css';

// ═══ CONSTANTS ═══
const TL={character:'Personaje',place:'Lugar',object:'Objeto',aspect:'Aspecto',event:'Acontecimiento',ending:'Final'};
const TI={character:'👤',place:'🏰',object:'💎',aspect:'✨',event:'⚡',ending:'🏆'};
const TC={character:'#c2185b',place:'#2e7d32',object:'#e65100',aspect:'#7b1fa2',event:'#1565c0',ending:'#d4af37'};
const PC=[{bg:'#7b1fa2',l:'#ce93d8'},{bg:'#c62828',l:'#ef9a9a'},{bg:'#00695c',l:'#80cbc4'},{bg:'#e65100',l:'#ffcc80'},{bg:'#283593',l:'#9fa8da'},{bg:'#4e342e',l:'#bcaaa4'}];
function pc(i){return PC[Math.max(0,i)%PC.length];}
function wcLabel(c){return c?.isInterruption?`Comodín de ${TL[c.type]}`:TL[c.type]||'';}
function cardLabel(c){if(!c)return'?';return`${TI[c.type]||''} ${c.name} (${TL[c.type]||c.type})${c.isInterruption?' ↻':''}`;}
function cardLabelShort(c){return c?`${TI[c.type]} ${c.name}`:'';}
function typeTag(c){return c?`${TI[c.type]} ${TL[c.type]}`:'';}

// ═══ AUDIO — global mute ═══
let _muted=false;
function sfx(type){if(_muted)return;try{const ac=new(window.AudioContext||window.webkitAudioContext)();const t=ac.currentTime;
  const mk=(freq,dur,vol=.08)=>{const o=ac.createOscillator();const g=ac.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.01);};
  const seq=(freqs,gap=.07,dur=.15,vol=.08)=>freqs.forEach((f,i)=>{if(!f)return;const o=ac.createOscillator();const g=ac.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(vol,t+i*gap);g.gain.exponentialRampToValueAtTime(.001,t+i*gap+dur);o.connect(g);g.connect(ac.destination);o.start(t+i*gap);o.stop(t+i*gap+dur+.01);});
  switch(type){case'tick':mk(880,.08,.12);break;case'tickUrgent':mk(1200,.12,.15);break;case'cardSelect':seq([523,659,784]);break;case'textSelect':mk(660,.12);break;case'denied':mk(150,.35,.12);break;case'interrupt':seq([880,1100],.1,.12,.12);break;case'veto':mk(100,.4,.12);break;case'swap':mk(600,.1);break;case'vote':mk(660,.08);break;case'turn':seq([523,784],.12,.3,.1);break;case'victory':seq([523,659,784,1047,784,1047,1319],.12,.4,.06);break;case'approved':seq([523,659,784,1047],.08,.2,.1);break;case'trumpet':seq([392,523,659,784],.1,.25,.12);break;}}catch(e){}}

// ═══ AMBIENT MUSIC — real MP3 tracks ═══
const TRACKS=[
  {id:'macabre',name:'Macabre Pace',file:'/sounds/macabre.mp3'},
  {id:'isobel',name:'Isobel & Lenora',file:'/sounds/isobel.mp3'},
  {id:'ludwig',name:'Ludwig Knew It',file:'/sounds/ludwig.mp3'},
  {id:'none',name:'Sin música',file:null},
];
let _musicAudio=null;let _musicPlaying=false;let _currentTrack='macabre';
function startMusic(trackId){
  stopMusic();
  if(_muted)return;
  const t=TRACKS.find(x=>x.id===(trackId||_currentTrack));
  if(!t||!t.file)return;
  _currentTrack=t.id;
  try{
    _musicAudio=new Audio(t.file);
    _musicAudio.loop=true;_musicAudio.volume=0.15;
    _musicAudio.play().catch(()=>{});
    _musicPlaying=true;
  }catch(e){}
}
function stopMusic(){
  _musicPlaying=false;
  if(_musicAudio){try{_musicAudio.pause();_musicAudio.src='';}catch(e){}_musicAudio=null;}
}
function setMusicVolume(v){if(_musicAudio)_musicAudio.volume=Math.max(0,Math.min(1,v));}
function toggleMute(){_muted=!_muted;if(_muted)stopMusic();return _muted;}

// ═══ WORD PARSER ═══
function parseWords(text){if(!text)return[];const ws=[];let i=0;
  while(i<text.length){if(text[i]===' '||text[i]==='\n'){ws.push({t:text[i],s:i,e:i+1,sp:true});i++;}
  else{let j=i;while(j<text.length&&text[j]!==' '&&text[j]!=='\n')j++;ws.push({t:text.slice(i,j),s:i,e:j,sp:false});i=j;}}return ws;}

// ═══ CARD IMAGE ═══
function CardImg({img,size}){if(!img)return null;return <img src={`/cards/${img}`} alt="" className={`cimg cimg-${size||'md'}`} loading="lazy"/>;}

// ═══ STORY WORDS — renders enchanted/sealed/pending spans ═══
function StoryWords({text,integrations,sealedPos,pendingVote,players,dropEnabled,onWordDrop,dragOverWord,setDragOverWord}){
  if(!text)return null;const ws=parseWords(text);
  const pvS=pendingVote?.fragment?.start??-1;const pvE=pendingVote?.fragment?.end??-1;
  const pvWords=[];ws.forEach((w,idx)=>{if(!w.sp&&pvS>=0&&w.s>=pvS&&w.e<=pvE)pvWords.push(idx);});
  const firstPv=pvWords[0]??-1;const lastPv=pvWords[pvWords.length-1]??-1;
  const pIdx=pendingVote?players?.findIndex(p=>p.id===pendingVote.initiatorId):-1;
  const pvColor=pIdx>=0?pc(pIdx):null;
  const isInt=pendingVote?.type==='interrupt';

  function wordDragHandlers(w){
    if(!dropEnabled||w.sp)return {};
    return {
      onDragOver:e=>{e.preventDefault();e.dataTransfer.dropEffect='move';setDragOverWord?.({s:w.s,e:w.e,t:w.t});},
      onDragEnter:e=>{e.preventDefault();setDragOverWord?.({s:w.s,e:w.e,t:w.t});},
      onDragLeave:()=>{},
      onDrop:e=>{e.preventDefault();e.stopPropagation();const cardId=e.dataTransfer.getData('cardId');if(cardId&&onWordDrop)onWordDrop(cardId,{text:w.t,start:w.s,end:w.e});setDragOverWord?.(null);}
    };
  }
  const dw=dragOverWord;

  return(<>{ws.map((w,idx)=>{
    if(w.sp)return <span key={idx}>{w.t==='\n'?<br/>:' '}</span>;
    const isDropTarget=dropEnabled&&!w.sp;
    const isHover=dw&&w.s===dw.s;
    let ig=null;if(integrations?.length)for(const x of integrations)if(w.s>=x.start&&w.e<=x.end){ig=x;break;}
    const inVote=pvS>=0&&w.s>=pvS&&w.e<=pvE;
    if(ig){const pi=players?.findIndex(p=>p.id===ig.playerId)??-1;const ic=pi>=0?pc(pi):null;
      return <span key={idx} id={inVote&&idx===firstPv?'pv-anchor':undefined} className={`sw sw-enchanted ${isHover?'sw-drophover':''}`} style={{'--ic':TC[ig.conceptType],'--pc':ic?.l||TC[ig.conceptType]}} title={`✦ ${ig.conceptName} — ${ig.playerName}`} {...wordDragHandlers(w)}>{w.t}</span>;}
    if(inVote&&!ig){const isF=idx===firstPv;const isL=idx===lastPv;
      return(<span key={idx} id={isF?'pv-anchor':undefined}
        className={`sw sw-pending ${isF?'pv-first':''} ${isL?'pv-last':''} ${isInt?'pv-interrupt':''} ${isHover?'sw-drophover':''}`}
        style={{'--pc':pvColor?.l||'#fff','--pbg':pvColor?.bg||'#333'}} {...wordDragHandlers(w)}>{w.t}</span>);}
    if(w.e<=sealedPos)return <span key={idx} className={`sw sw-sealed ${isHover?'sw-drophover':''} ${isDropTarget?'sw-droptarget':''}`} {...wordDragHandlers(w)}>{w.t}</span>;
    return <span key={idx} className={`sw ${isHover?'sw-drophover':''} ${isDropTarget?'sw-droptarget':''}`} {...wordDragHandlers(w)}>{w.t}</span>;
  })}</>);
}

// ═══ FLOATING CARD OVERLAY — tracks #pv-anchor via rAF ═══
function FloatingCardOverlay({vote,players}){
  const[pos,setPos]=useState(null);const raf=useRef(null);
  const pIdx=vote?players?.findIndex(p=>p.id===vote.initiatorId):-1;
  const pvC=pIdx>=0?pc(pIdx):null;const c=vote?.concept;const isInt=vote?.type==='interrupt';
  useEffect(()=>{if(!vote){setPos(null);return;}let on=true;
    function track(){if(!on)return;const el=document.getElementById('pv-anchor');
      if(el){const r=el.getBoundingClientRect();setPos({x:r.left,y:r.top});}else setPos(null);
      raf.current=requestAnimationFrame(track);}
    raf.current=requestAnimationFrame(track);
    return()=>{on=false;if(raf.current)cancelAnimationFrame(raf.current);};
  },[vote?.id]);
  if(!vote||!c||!pos)return null;
  return(<div className={`fco ${isInt?'fco-int':''}`} style={{left:pos.x+'px',top:pos.y+'px','--pc':pvC?.l||'#fff','--pbg':pvC?.bg||'#333','--tc':TC[c.type]||'#d4af37'}}>
    <span className="fco-body">{c.img?<img src={`/cards/${c.img}`} className="fco-img" alt=""/>:<span className="fco-icon">{TI[c.type]}</span>}<span className="fco-label">{c.name}</span></span>
    <span className="fco-connector"/><span className="fco-sparkles">{[0,1,2,3,4].map(i=><span key={i} className="fco-spark" style={{'--si':i}}/>)}</span></div>);
}

// ═══ VOTE CORNER — inline below log, veto-only ═══
function VoteCorner({vote,players,myId,onVote,isSpec,config}){
  const[reason,setReason]=useState('');
  const[myVote,setMyVote]=useState(null);
  const canVote=vote.eligible?.includes(myId)&&!vote.votedPlayerIds?.includes(myId);
  const hasVoted=vote.votedPlayerIds?.includes(myId);
  const labs={integrate:'JUGAR CARTA',interrupt:'INTERRUPCIÓN',ending:'FINAL'};
  const maxTime=vote.round===2?(config?.tiebreakTime||8):(config?.voteTime||20);
  const tP=Math.min(100,(vote.timeLeft/maxTime)*100);
  const iIdx=players.findIndex(p=>p.id===vote.initiatorId);
  const pC=iIdx>=0?pc(iIdx):pc(0);const isInt=vote.type==='interrupt';
  const details=vote.voteDetails||[];
  function submitApprove(){setMyVote(true);onVote(true,'');setReason('');}
  function submitVeto(){setMyVote(false);onVote(false,reason.trim());setReason('');}
  const didApprove=myVote===true||(hasVoted&&vote.voteDetails?.find(d=>d.id===myId)?.approved===true);
  return(<div className={`vcorner ${isInt?'vc-int':''}`} style={{'--vpc':pC.l,'--vpbg':pC.bg}}>
    <div className="vc-bar"><div className="vc-bar-fill" style={{width:tP+'%',background:tP<30?'#ff1744':tP<60?'#ff9100':pC.l}}/></div>
    <div className="vc-head"><span className="vc-type" style={{color:isInt?'#ef9a9a':vote.type==='ending'?'var(--gold)':'#81c784'}}>{labs[vote.type]||'CARTA'}</span>{vote.round===2&&<span className="vc-tie">DESEMPATE</span>}<span className="vc-time" style={{color:tP<30?'#ff1744':pC.l}}>{vote.timeLeft}s</span></div>
    <div className="vc-desc">
      <span className="vc-player" style={{color:pC.l}}>{vote.initiatorName}</span>
      <span>{isInt?' interrumpe con ':vote.type==='ending'?' intenta el final':' juega '}</span>
      {vote.concept&&<span style={{color:TC[vote.concept.type]}}><strong>{TI[vote.concept.type]} {vote.concept.name}</strong> <small>({vote.concept.isInterruption?`↻ ${TL[vote.concept.type]}`:TL[vote.concept.type]})</small></span>}
    </div>
    {vote.fragment?.text&&<div className="vc-frag" style={{borderColor:pC.l}}>con «{vote.fragment.text.substring(0,80)}»</div>}
    {vote.justification&&<div className="vc-just"><strong>Justificación:</strong> «{vote.justification}»</div>}
    {details.length>0&&<div className="vc-votes">{details.map((d,i)=>(
      <div key={i} className={`vc-vr ${d.approved?'vc-vr-yes':'vc-vr-no'}`}>
        <span className="vc-vr-icon">{d.approved?'—':'✗'}</span>
        <span className="vc-vr-name">{d.name}</span>
        {d.reason&&<span className="vc-vr-reason">«{d.reason}»</span>}
      </div>))}</div>}
    <div className="vc-dots">{(vote.eligible||[]).map(pid=>{const v=vote.votedPlayerIds?.includes(pid);return <span key={pid} className={`vc-dot ${v?'voted':''} ${pid===myId?'me':''}`} style={v?{background:pC.l,borderColor:pC.l}:{}} title={players.find(p=>p.id===pid)?.name}/>})}</div>
    {canVote&&!isSpec&&<>
      <input className="vc-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo del veto (opcional)" maxLength={80}/>
      <div className="vc-btns"><button className="vc-yes" onClick={submitApprove}>OK</button><button className="vc-no" onClick={submitVeto}>✗ VETAR</button></div>
      <div className="vc-hint2">Si nadie veta antes del tiempo, se aprueba</div>
    </>}
    {hasVoted&&<div className="vc-wait">{didApprove?'VOTO ENVIADO ✓':'VETO ENVIADO ■'}</div>}
    {isSpec&&<div className="vc-wait">OBSERVANDO</div>}
  </div>);
}

// ═══ INTERRUPT WINDOW — golden popup for eligible players ═══
function InterruptWindow({iw,myHand,myId,narratorId,onUse,onDecline}){
  if(!iw||!myHand)return null;
  const compatCards=myHand.filter(c=>c.isInterruption&&c.type===iw.cardType);
  if(!compatCards.length||myId===narratorId)return null;
  const maxT=8;const pct=Math.min(100,(iw.timeLeft/maxT)*100);
  return(<div className="iw-overlay"><div className="iw-box">
    <div className="iw-glow"/>
    <div className="iw-bar"><div className="iw-bar-fill" style={{width:pct+'%'}}/></div>
    <div className="iw-head"><span className="iw-icon">⚜</span><span className="iw-title">INTERRUPCIÓN DORADA</span><span className="iw-timer">{iw.timeLeft}s</span></div>
    <div className="iw-info">El narrador ha jugado <strong style={{color:TC[iw.cardType]}}>{TI[iw.cardType]} {iw.conceptName} ({TL[iw.cardType]})</strong></div>
    <div className="iw-sub">¡Tienes carta{compatCards.length>1?'s':''} de interrupción compatible{compatCards.length>1?'s':''}!</div>
    <div className="iw-cards">{compatCards.map(c=>(
      <div key={c.id} className="iw-card" style={{'--tc':TC[c.type]}} onClick={()=>onUse(c.id)}>
        <div className="iw-card-glow"/>
        {c.img&&<img src={`/cards/${c.img}`} className="iw-card-img" alt=""/>}
        <div className="iw-card-name">{c.name}</div>
        <div className="iw-card-type">↻ Comodín {TL[c.type]}</div>
        <div className="iw-card-action">⚡ INTERRUMPIR</div>
      </div>))}</div>
    <button className="iw-decline" onClick={onDecline}>NO INTERRUMPIR</button>
  </div></div>);
}

// ═══ NARRATOR EDITOR — LOCAL STATE for responsive textarea ═══
function NarratorEditor({story,integrations,sealedPos,frozenPos,pendingVote,players,activeCard,pendingSel,isVoting,isInterruptWindow,onUpdate,onTextSelected,isDraggingCard,onWordDrop,dragOverWord,setDragOverWord}){
  const frozen=frozenPos||0;
  const sealedText=(story||'').substring(0,frozen);
  const serverEditable=(story||'').substring(frozen);
  const enchCount=integrations?.length||0;
  const taRef=useRef(null);

  // LOCAL STATE — updates on keystroke, syncs from server on external changes
  const[localText,setLocalText]=useState(serverEditable);
  const lastSentRef=useRef(serverEditable);
  const prevFrozenRef=useRef(frozen);

  // Sync from server when text changes externally (another client edited)
  // Use a flag to distinguish our own echoes from real external changes
  const isLocalChangeRef=useRef(false);
  useEffect(()=>{
    if(isLocalChangeRef.current){
      // This is our own echo from the server — skip overwrite
      isLocalChangeRef.current=false;
      lastSentRef.current=serverEditable;
      return;
    }
    if(serverEditable!==lastSentRef.current){
      setLocalText(serverEditable);
      lastSentRef.current=serverEditable;
    }
  },[serverEditable]);

  // Sync when frozen position changes (sealed zone grows after card approval)
  useEffect(()=>{
    if(frozen!==prevFrozenRef.current){
      console.log('[NarratorEditor] frozen changed:',prevFrozenRef.current,'→',frozen,'story.length=',(story||'').length);
      prevFrozenRef.current=frozen;
      const newEditable=(story||'').substring(frozen);
      setLocalText(newEditable);
      lastSentRef.current=newEditable;
    }
  },[frozen,story]);

  // Auto-focus textarea when this component mounts (narrator gained control)
  useEffect(()=>{if(taRef.current&&!isDraggingCard)taRef.current.focus();},[isDraggingCard]);

  function handleChange(e){
    const val=e.target.value;
    setLocalText(val);
    const fullText=sealedText+val;
    lastSentRef.current=val;
    isLocalChangeRef.current=true;
    onUpdate(fullText);
  }

  function handleMouseUp(){
    const sel=window.getSelection();if(!sel||sel.rangeCount===0||!sel.toString().trim())return;
    const text=sel.toString().trim();
    const idx=localText.lastIndexOf(text);
    if(idx>=0)onTextSelected({text,start:frozen+idx,end:frozen+idx+text.length});
  }

  // Prevent textarea from accepting dropped content
  function handleDragOver(e){if(isDraggingCard){e.preventDefault();e.dataTransfer.dropEffect='none';}}
  function handleDrop(e){if(isDraggingCard){e.preventDefault();e.stopPropagation();}}

  return(<div className={`editor-wrap ${activeCard||pendingSel?'card-mode':''}`}>
    {frozen>0&&!isDraggingCard&&(
      <div className="sealed-zone">
        <div className="sealed-header"><span className="sealed-icon">⚜</span><span className="sealed-label">TEXTO SELLADO</span>{enchCount>0&&<span className="sealed-count">{enchCount} carta{enchCount!==1?'s':''}</span>}</div>
        <div className="sealed-body"><StoryWords text={sealedText} integrations={integrations} sealedPos={sealedPos} pendingVote={pendingVote} players={players} dropEnabled={isDraggingCard} onWordDrop={onWordDrop} dragOverWord={dragOverWord} setDragOverWord={setDragOverWord}/></div>
        <div className="seal-div">⚜ ═══════════════ ⚜</div>
      </div>)}
    {isVoting&&<div className="voting-indicator">⚖ VOTACIÓN EN CURSO — sigue escribiendo</div>}
    {isInterruptWindow&&<div className="voting-indicator iw-indicator">⚜ VENTANA DE INTERRUPCIÓN — sigue escribiendo</div>}
    <div style={{position:'relative',flex:1,display:'flex',flexDirection:'column'}}>
      <textarea ref={taRef} className="editor-ta" value={localText} onChange={handleChange} onMouseUp={handleMouseUp}
        onDragOver={handleDragOver} onDrop={handleDrop}
        placeholder={frozen>0?"Continúa la historia...":"Érase una vez..."} spellCheck={false}
        style={isDraggingCard?{opacity:0,position:'absolute',pointerEvents:'none'}:{}}/>
      {isDraggingCard&&<div className="drag-overlay"
        onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}}
        onDrop={e=>{e.preventDefault();e.stopPropagation();setDragOverWord?.(null);}}>
        {localText?<StoryWords text={frozen>0?(sealedText+localText):localText} integrations={integrations} sealedPos={sealedPos} pendingVote={pendingVote} players={players} dropEnabled={true} onWordDrop={onWordDrop} dragOverWord={dragOverWord} setDragOverWord={setDragOverWord}/>
        :<span className="ph" style={{pointerEvents:'none'}}>Escribe algo primero, luego arrastra...</span>}
      </div>}
    </div>
  </div>);
}

// ═══ PIXEL BOOK ═══
function PixelBook(){return(<div className="px-book"><svg viewBox="0 0 64 48" className="px-book-svg" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="8" width="26" height="36" fill="#2a1a0a" stroke="#d4af37" strokeWidth="2"/><rect x="34" y="8" width="26" height="36" fill="#2a1a0a" stroke="#d4af37" strokeWidth="2"/><rect x="6" y="10" width="22" height="32" fill="#3d2b1a"/><rect x="36" y="10" width="22" height="32" fill="#3d2b1a"/><line x1="30" y1="6" x2="30" y2="44" stroke="#d4af37" strokeWidth="3"/>{[0,1,2,3,4,5].map(i=><rect key={i} x="9" y={14+i*5} width={14-i%3*2} height="2" fill="rgba(212,175,55,0.25)"/>)}{[0,1,2,3,4].map(i=><rect key={i} x="39" y={14+i*5} width={16-i%2*4} height="2" fill="rgba(212,175,55,0.25)"/>)}</svg><div className="px-quill"><svg viewBox="0 0 24 32" className="px-quill-svg" xmlns="http://www.w3.org/2000/svg"><path d="M4 28 L8 8 L12 2 L14 6 L10 24 L6 30 Z" fill="#f5e6a3" stroke="#d4af37" strokeWidth="1"/><path d="M6 26 L8 14 L10 10 L10 22 Z" fill="#d4af37" opacity="0.5"/><rect x="4" y="28" width="4" height="3" fill="#4a4235"/></svg></div></div>);}

// ═══ ACTION LOG ═══
function ActionLog({entries}){const ref=useRef(null);useEffect(()=>{ref.current&&(ref.current.scrollTop=ref.current.scrollHeight);},[entries?.length]);
  if(!entries?.length)return null;return(<div className="alog" ref={ref}>{entries.map(e=>(<div key={e.id} className={`le le-${e.type}`}><span className="lt">{new Date(e.timestamp).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span><span className="lm">{e.message}</span></div>))}</div>);}

// ═══ RANKING ═══
function RankingBar({players,myId,handSize}){const sorted=[...players].sort((a,b)=>(a.handCount-1)-(b.handCount-1));
  return(<div className="ranking"><div className="rank-title">RANKING</div><div className="rank-ladder">{sorted.map((p,i)=>{const pi=players.findIndex(x=>x.id===p.id);const me=p.id===myId;const cc=Math.max(0,p.handCount-1);const prog=handSize>0?((handSize-cc)/handSize)*100:0;
    return(<div key={p.id} className={`rank-step ${i===0?'rank-first':''} ${me?'rank-me':''}`}><div className="rank-pos">{i+1}</div><div className="avsm" style={{background:pc(pi).bg}}>{p.name[0]}</div><div className="rank-info"><span className="rank-name">{p.name}{me?' ★':''}</span><div className="rank-bar-bg"><div className="rank-bar-fill" style={{width:Math.min(100,prog)+'%'}}/></div></div><span className="rank-count">{cc}/{handSize}</span></div>);})}</div></div>);}

// ═══ MAIN APP ═══
export default function App(){
  const[connected,setConnected]=useState(socket.connected);
  const[screen,setScreen]=useState('home');
  const[myId,setMyId]=useState(null);const[myName,setMyName]=useState('');
  const[roomCode,setRoomCode]=useState('');
  const[lobbyData,setLobbyData]=useState({players:[],config:{}});
  const[gs,setGs]=useState(null);
  const[notif,setNotif]=useState(null);
  const[activeCard,setActiveCard]=useState(null);
  const[pendingSel,setPendingSel]=useState(null);
  const[popup,setPopup]=useState(null);const[just,setJust]=useState('');
  const[showPass,setShowPass]=useState(false);
  const[vr,setVr]=useState(null);
  const[inact,setInact]=useState({s:0,limit:30});
  const[banner,setBanner]=useState(null);const[announce,setAnnounce]=useState(null);
  const[showRules,setShowRules]=useState(false);
  const[isSpec,setIsSpec]=useState(false);
  const[sparkle,setSparkle]=useState(false);
  const[swappedId,setSwappedId]=useState(null);
  const[isDraggingCard,setIsDraggingCard]=useState(false);
  const[dragOverWord,setDragOverWord]=useState(null);
  const[showCfg,setShowCfg]=useState(false);
  const[popupTime,setPopupTime]=useState(0);const popupTimerRef=useRef(null);
  const[cardPreview,setCardPreview]=useState(null);
  const[homeTab,setHomeTab]=useState('create');const[homeName,setHomeName]=useState('');const[homeCode,setHomeCode]=useState('');
  const[muted,setMuted]=useState(false);
  const[showSound,setShowSound]=useState(false);
  const[musicTrack,setMusicTrack]=useState('none');
  const[musicVol,setMusicVol]=useState(15);
  const[iwDismissed,setIwDismissed]=useState(false);
  const[showVetoModal,setShowVetoModal]=useState(false);const[vetoReason,setVetoReason]=useState('');
  const[rewindTarget,setRewindTarget]=useState(null);const rewindRef=useRef(null);
  const[screenShake,setScreenShake]=useState(false);
  const[confetti,setConfetti]=useState(false);
  const vrT=useRef(null);const prevNarr=useRef(null);

  useEffect(()=>()=>{clearPopupTimer();clearTimeout(vrT.current);stopMusic();},[]);
  const notify=useCallback((msg,dur=3000)=>{setNotif(msg);setTimeout(()=>setNotif(null),dur);},[]);
  function doToggleMute(){const m=toggleMute();setMuted(m);if(!m&&screen==='game')startMusic(musicTrack);}
  function doChangeTrack(id){setMusicTrack(id);_currentTrack=id;if(screen==='game'&&!muted)startMusic(id);}
  function doChangeVol(v){setMusicVol(v);setMusicVolume(v/100);}
  // Start music when game begins
  useEffect(()=>{if(screen==='game'&&!muted)startMusic(musicTrack);if(screen!=='game')stopMusic();return()=>stopMusic();},[screen]);
  function showBanner(t,dur=3000){setBanner(t);setTimeout(()=>setBanner(null),dur);}
  function showAnnouncement(t,sub,color,dur=2500){setAnnounce({text:t,sub,color});setTimeout(()=>setAnnounce(null),dur);}
  function startPopupTimer(){clearPopupTimer();let left=15;setPopupTime(left);popupTimerRef.current=setInterval(()=>{left--;setPopupTime(left);if(left<=3)sfx('tickUrgent');if(left<=0){clearPopupTimer();clearSel();notify('⏰ TIME OUT');}},1000);}
  function clearPopupTimer(){if(popupTimerRef.current){clearInterval(popupTimerRef.current);popupTimerRef.current=null;}setPopupTime(0);}

  // ═══ SOCKET LISTENERS ═══
  useEffect(()=>{
    socket.on('connect',()=>{setConnected(true);
      // Auto-reconnect to room on socket reconnection (network drop)
      const s=localStorage.getItem('ouat');if(s){try{const d=JSON.parse(s);socket.emit('reconnect-player',{roomCode:d.roomCode,playerId:d.myId},r=>{if(r?.success){setMyId(d.myId);setRoomCode(d.roomCode);}});}catch(e){}}
    });socket.on('disconnect',()=>setConnected(false));
    socket.on('lobby-update',d=>{setLobbyData({players:d.players,config:d.config||{}});setRoomCode(d.code);setScreen('lobby');});
    socket.on('game-state',state=>{
      console.log('[game-state] narratorId=',state.narratorId,'myId=',state.myId,'frozenPos=',state.frozenPos,'sealedPos=',state.sealedPos,'integrations=',state.integrations?.length,'vote=',state.currentVote?.type||'none');
      setGs(state);if(state.isSpectator)setIsSpec(true);if(state.phase!=='lobby')setScreen('game');
    });
    socket.on('story-updated',({text})=>{setGs(p=>p?{...p,story:text}:p);setPendingSel(null);});
    socket.on('vote-tick',({timeLeft})=>setGs(p=>{if(!p?.currentVote)return p;return{...p,currentVote:{...p.currentVote,timeLeft}};}));
    socket.on('inactivity-tick',({seconds,limit})=>{setInact({s:seconds,limit});if(seconds>=limit-5&&seconds<limit)sfx('tickUrgent');else if(seconds>=limit-10&&seconds%2===0)sfx('tick');});
    socket.on('interrupt-window-tick',({timeLeft})=>setGs(p=>{if(!p?.interruptWindow)return p;return{...p,interruptWindow:{...p.interruptWindow,timeLeft}};}));
    socket.on('narrator-changed',({narratorId,narratorName})=>{
      console.log('[narrator-changed] new narrator:',narratorName,'(',narratorId,')');
      // This fires BEFORE game-state for interrupts. Show immediate feedback.
    });
    socket.on('vote-resolved',({type,approved,initiatorId,initiatorName,conceptName,conceptType,conceptImg,voters})=>{
      const icon=conceptType?TI[conceptType]:'';const typeName=conceptType?TL[conceptType]:'';
      const cardStr=conceptName?` — ${icon} ${conceptName} (${typeName})`:'';
      // Vote result flash with voter breakdown
      let voterStr='';if(voters?.length){voterStr=voters.map(v=>`${v.approved?'✓':'✗'} ${v.name}${v.reason?' «'+v.reason+'»':''}`).join('  ·  ');}
      setVr({msg:`${approved?'✅':'❌'} ${approved?'APROBADA':'VETADA'}${cardStr}`,sub:voterStr,approved});
      clearTimeout(vrT.current);vrT.current=setTimeout(()=>setVr(null),voterStr?6000:4000);
      // Consequence banners for the affected player
      const isMe=initiatorId===myId;
      if(isMe&&!approved){
        if(type==='interrupt')showBanner('❌ Interrupción vetada — pierdes la carta y robas 2',4000);
        else if(type==='integrate')showBanner('❌ Carta vetada — no se integra',3000);
        else if(type==='ending')showBanner('❌ Final rechazado — nuevo final + 1 carta narrativa',3500);
      }else if(isMe&&approved){
        if(type==='integrate')showBanner('✅ Carta integrada al relato',2500);
        else if(type==='interrupt')showBanner('✅ ¡Interrupción aceptada! Eres narrador',3000);
        else if(type==='ending')showBanner('🏆 ¡VICTORIA!',4000);
      }
      if(approved){sfx('approved');setSparkle(true);setTimeout(()=>setSparkle(false),1800);
        if(type==='integrate'){
          // Direct DOM — bypasses React render cycle entirely
          const color=TC[conceptType]||'#d4af37';
          const sx=window.innerWidth-180,sy=window.innerHeight-200;
          const dx=Math.round(window.innerWidth*0.3)-sx,dy=120-sy;
          const el=document.createElement('div');el.className='card-fly';
          el.style.cssText=`left:${sx}px;top:${sy}px;--fly-dx:${dx}px;--fly-dy:${dy}px;`;
          if(conceptImg){const img=document.createElement('img');img.src='/cards/'+conceptImg;
            img.style.cssText=`width:80px;height:110px;object-fit:cover;border-radius:3px;border:2px solid ${color};box-shadow:0 0 24px ${color};`;
            el.appendChild(img);
          }else{const b=document.createElement('div');b.style.cssText=`width:80px;height:110px;background:${color};border-radius:3px;border:2px solid #fff;box-shadow:0 0 24px ${color};`;el.appendChild(b);}
          document.body.appendChild(el);
          const fl=document.createElement('div');fl.className='card-fly-flash';
          fl.style.cssText=`left:${sx+dx+40}px;top:${sy+dy+55}px;width:20px;height:20px;background:${color};animation-delay:.5s;`;
          document.body.appendChild(fl);
          setTimeout(()=>{el.remove();fl.remove();},1000);
        }
        if(type==='ending'){setConfetti(true);setTimeout(()=>setConfetti(false),4000);}
      }else{sfx('denied');setScreenShake(true);setTimeout(()=>setScreenShake(false),450);}
    });
    socket.on('story-rewind',({text})=>{setRewindTarget(text);});
    return()=>{['connect','disconnect','lobby-update','game-state','story-updated','vote-tick','interrupt-window-tick','inactivity-tick','narrator-changed','vote-resolved','story-rewind'].forEach(e=>socket.off(e));};
  },[]);

  // ═══ EFFECTS — narrator change detection ═══
  useEffect(()=>{if(!gs||!myId)return;
    const wasNarr=prevNarr.current===myId;
    const amNarr=gs.narratorId===myId;
    if(amNarr&&!wasNarr&&prevNarr.current!==null&&gs.phase==='playing'){
      console.log('[NARRATOR CHANGE] I am now narrator! frozenPos=',gs.frozenPos,'sealedPos=',gs.sealedPos);
      showBanner('✍ TE TOCA ESCRIBIR');sfx('turn');
    }
    if(!amNarr&&wasNarr&&gs.phase==='playing'){
      console.log('[NARRATOR CHANGE] I lost narrator status');
    }
    prevNarr.current=gs.narratorId;
  },[gs?.narratorId,myId,gs?.phase]);
  useEffect(()=>{if(myId&&roomCode)localStorage.setItem('ouat',JSON.stringify({myId,roomCode}));},[myId,roomCode]);
  // ═══ VICTORY CONFETTI on game finish ═══
  const prevPhaseRef=useRef(null);
  useEffect(()=>{if(gs?.phase==='finished'&&prevPhaseRef.current==='playing'){setConfetti(true);setTimeout(()=>setConfetti(false),4000);sfx('approved');}prevPhaseRef.current=gs?.phase||null;},[gs?.phase]);
  useEffect(()=>{const s=localStorage.getItem('ouat');if(s){try{const d=JSON.parse(s);socket.emit('reconnect-player',{roomCode:d.roomCode,playerId:d.myId},r=>{if(r?.success){setMyId(d.myId);setRoomCode(d.roomCode);}else localStorage.removeItem('ouat');});}catch(e){localStorage.removeItem('ouat');}};},[]);

  // Reset dismiss when new interrupt window appears
  const prevIwRef=useRef(null);
  useEffect(()=>{if(gs?.interruptWindow&&!prevIwRef.current)setIwDismissed(false);prevIwRef.current=gs?.interruptWindow||null;},[gs?.interruptWindow]);

  // ═══ STORY REWIND ANIMATION ═══
  useEffect(()=>{
    if(rewindTarget===null)return;
    const target=rewindTarget;setRewindTarget(null);
    // Animate by removing chars rapidly
    const currentStory=gs?.story||'';
    if(target.length>=currentStory.length){setGs(p=>p?{...p,story:target}:p);return;}
    let idx=currentStory.length;
    const step=()=>{if(idx<=target.length){clearInterval(rewindRef.current);rewindRef.current=null;setGs(p=>p?{...p,story:target}:p);return;}
      idx=Math.max(target.length,idx-3);// 3 chars per tick for speed
      setGs(p=>p?{...p,story:currentStory.substring(0,idx)}:p);};
    rewindRef.current=setInterval(step,15);
    return()=>{if(rewindRef.current){clearInterval(rewindRef.current);rewindRef.current=null;}};
  },[rewindTarget]);

  const sealedPos=gs?.sealedPos||0;
  const frozenPos=gs?.frozenPos||0;
  const isNarr=gs&&gs.myId===gs.narratorId&&!isSpec;
  const isVoting=!!gs?.currentVote;
  const myPriv=gs?.private;const handSize=gs?.config?._effectiveHandSize||gs?.config?.handSize||5;

  // ═══ BIDIRECTIONAL: card→text OR text→card ═══
  function onCardClick(card){
    if(gs?.phase!=='playing')return;
    if(card.isEnding&&!isNarr){notify('SOLO EL NARRADOR USA EL FINAL');return;}
    // Block NEW card plays during vote or interrupt window — but narrator can still TYPE
    if(gs.currentVote){notify('VOTO EN CURSO');return;}
    if(gs.interruptWindow){notify('⚜ VENTANA DE INTERRUPCIÓN');return;}
    if(pendingSel){setActiveCard(card);sfx('cardSelect');setPopup({card,fragment:pendingSel,action:isNarr?'integrate':'interrupt'});setPendingSel(null);startPopupTimer();return;}
    if(activeCard?.id===card.id){setActiveCard(null);setCardPreview(null);return;}
    setActiveCard(card);setCardPreview(card);sfx('cardSelect');setTimeout(()=>setCardPreview(null),2500);
  }
  function onTextSelected(fragment){
    if(gs?.phase!=='playing')return;
    // Block text selection for card plays during vote — but narrator can still TYPE
    if(gs.currentVote){notify('VOTO EN CURSO — espera al resultado');return;}
    if(fragment.start<sealedPos){notify('⚜ TEXTO SELLADO — no jugable');return;}
    const igs=gs.integrations||[];for(const ig of igs)if(fragment.start<ig.end&&fragment.end>ig.start){notify('✦ YA ENCANTADO');return;}
    if(activeCard){sfx('textSelect');setPopup({card:activeCard,fragment,action:isNarr?'integrate':'interrupt'});startPopupTimer();}
    else{setPendingSel(fragment);sfx('textSelect');notify('► SELECCIONA UNA CARTA',2000);}
  }
  function clearSel(){setActiveCard(null);setPopup(null);setJust('');setPendingSel(null);setCardPreview(null);clearPopupTimer();}

  // ═══ DRAG & DROP — card dropped on a word ═══
  function onCardDrop(cardId,fragment){
    setIsDraggingCard(false);setDragOverWord(null);
    if(gs?.phase!=='playing')return;
    if(gs.currentVote){notify('VOTO EN CURSO');return;}
    if(gs.interruptWindow){notify('⚜ VENTANA DE INTERRUPCIÓN');return;}
    const myHand=myPriv?.hand||[];
    const card=myHand.find(c=>c.id===cardId);
    if(!card){notify('Carta no encontrada');return;}
    if(card.isEnding&&!isNarr){notify('SOLO EL NARRADOR USA EL FINAL');return;}
    // Check sealed/enchanted
    if(fragment.start<sealedPos){notify('⚜ TEXTO SELLADO — no jugable');return;}
    const igs=gs.integrations||[];for(const ig of igs)if(fragment.start<ig.end&&fragment.end>ig.start){notify('✦ YA ENCANTADO');return;}
    sfx('cardSelect');sfx('textSelect');
    setActiveCard(card);
    setPopup({card,fragment,action:isNarr?'integrate':'interrupt'});
    startPopupTimer();
  }

  function handleCardDragStart(e,card){
    e.dataTransfer.setData('cardId',card.id);
    e.dataTransfer.effectAllowed='move';
    // Create a small drag image
    const el=e.target.cloneNode(true);el.style.cssText='width:80px;height:auto;opacity:0.8;position:absolute;top:-1000px;';
    document.body.appendChild(el);e.dataTransfer.setDragImage(el,40,40);
    setTimeout(()=>document.body.removeChild(el),0);
    setIsDraggingCard(true);
  }
  function handleCardDragEnd(){setIsDraggingCard(false);setDragOverWord(null);}

  // ═══ ACTIONS ═══
  function doCreateRoom(name){if(!name)return notify('Escribe tu nombre');setMyName(name);socket.emit('create-room',{playerName:name},r=>{if(r.error)return notify(r.error);setMyId(r.playerId);setRoomCode(r.code);});}
  function joinRoom2(code,name){if(!name)return notify('Escribe tu nombre');if(!code)return notify('Escribe el código');setMyName(name);socket.emit('join-room',{roomCode:code,playerName:name},r=>{if(r.error)return notify(r.error);setMyId(r.playerId);setRoomCode(r.code);if(r.reconnected){notify('🔄 ¡Reconectado!',2000);setIsSpec(false);}else if(r.isSpectator)setIsSpec(true);});}
  function joinProj(code){socket.emit('join-projector',{roomCode:code},r=>{if(r.error)return notify(r.error);setRoomCode(r.code);setScreen('projector');});}
  function doStart(){socket.emit('start-game',null,r=>{if(r?.error)notify(r.error);});}
  function updateStory(text){socket.emit('story-update',{text});}
  function updateConfig(cfg){socket.emit('update-config',{config:cfg},r=>{if(r?.error)notify(r.error);else notify('✅ CONFIG OK',1500);});}
  function goHome(){stopMusic();socket.emit('leave-room');setScreen('home');setGs(null);setIsSpec(false);setShowSound(false);setShowCfg(false);localStorage.removeItem('ouat');}
  function doAction(){
    if(!popup)return;const data={conceptId:popup.card.id,fragment:popup.fragment,justification:just.trim()};
    console.log('[doAction]',popup.action,'card=',popup.card.name,'fragment=',popup.fragment);
    const pName=gs.players.find(p=>p.id===gs.myId)?.name||'';
    const cl=cardLabel(popup.card);
    if(popup.action==='integrate'){sfx('trumpet');showAnnouncement(`${pName} JUEGA`,cl,TC[popup.card.type]);socket.emit('integrate-concept',data,r=>{if(r?.error)notify(r.error);});}
    else{sfx('interrupt');showAnnouncement(`⚡ ${pName} INTERRUMPE`,cl,TC[popup.card.type]);socket.emit('interrupt',data,r=>{if(r?.error)notify(r.error);});}
    clearSel();
  }
  function doPass(id){sfx('swap');setSwappedId(id);setTimeout(()=>setSwappedId(null),1500);showBanner('↻ Pasas turno — descartas 1 carta, robas 1',3000);socket.emit('pass-turn',{discardConceptId:id},r=>{if(r?.error)notify(r.error);});setShowPass(false);}
  function doVeto(){setShowVetoModal(true);setVetoReason('');}
  function confirmVeto(reason){sfx('veto');socket.emit('veto-narrator',{reason:reason||vetoReason},r=>{if(r?.error)notify(r.error);});setShowVetoModal(false);setVetoReason('');}
  function doVote(a,reason){sfx('vote');socket.emit('cast-vote',{approve:a,reason:reason||''});}
  function useGoldenInterrupt(cardId){sfx('interrupt');setIwDismissed(true);socket.emit('use-interrupt-window',{conceptId:cardId},r=>{if(r?.error)notify(r.error);});}
  function declineInterrupt(){setIwDismissed(true);}
  function doRestart(){socket.emit('restart-game',null,r=>{if(r?.error)notify(r.error);setScreen('lobby');setIsSpec(false);});}
  function downloadStory(){const b=new Blob([gs?.story||''],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='historia.txt';a.click();}

  const isFinished=gs?.phase==='finished';

  // ═══ RENDER ═══
  return(<div className={`app ${screenShake?'shake':''}`}><div className="scanlines"/>
    {notif&&<div className="notif">{notif}</div>}
    {vr&&<div className={`vote-flash ${vr.approved?'vf-yes':'vf-no'}`}><div>{vr.msg}</div>{vr.sub&&<div className="vf-sub">{vr.sub}</div>}</div>}
    {!connected&&<div className="conn-bar">◄ RECONECTANDO... ►</div>}
    {banner&&<div className="turn-banner-ov"><div className="turn-banner">{banner}</div></div>}
    {announce&&<div className="announce-ov"><div className="announce" style={{borderColor:announce.color}}><div className="ann-text">{announce.text}</div><div className="ann-sub" style={{color:announce.color}}>{announce.sub}</div></div></div>}
    {sparkle&&<div className="sparkle-ov">{Array.from({length:24}).map((_,i)=><div key={i} className="sparkle-p" style={{'--sx':(Math.random()*100)+'vw','--sy':(Math.random()*100)+'vh','--sd':(Math.random()*1.2+.4)+'s','--ss':(Math.random()*6+4)+'px'}}/>)}</div>}
    {confetti&&<div className="confetti-ov">{Array.from({length:60}).map((_,i)=>{
      const colors=['#d4af37','#f5e6a3','#b8860b','#ff6b6b','#4fc3f7','#81c784','#ce93d8','#fff'];
      return<div key={i} className="confetti-piece" style={{
        '--cx':(Math.random()*100)+'vw','--cc':colors[i%colors.length],
        '--cd':(Math.random()*2+2)+'s','--cs':(Math.random()*1.5+1)+'s',
        '--cr':(Math.random()*720+360)+'deg','--crx':(Math.random()*360)+'deg',
        '--cw':(Math.random()*6+5)+'px','--ch':(Math.random()*8+6)+'px',
        '--csw':(Math.random()*30+10)+'px',animationDelay:(Math.random()*1.5)+'s'
      }}/>;})}</div>}
    {cardPreview&&<div className="cprev-ov"><div className="cprev" style={{'--tc':TC[cardPreview.type]}}>{cardPreview.img&&<img src={`/cards/${cardPreview.img}`} className="cprev-img" alt=""/>}<div className="cprev-name">{cardPreview.name}</div><div className="cprev-type">{cardPreview.isInterruption?wcLabel(cardPreview):TL[cardPreview.type]}</div></div></div>}

    {/* ═══ RULES MODAL ═══ */}
    {showRules&&<div className="modalbg" onClick={()=>setShowRules(false)}><div className="modalbox" onClick={e=>e.stopPropagation()}><div className="modhead"><h2 className="stitle">■ REGLAS ■</h2><button className="xb big" onClick={()=>setShowRules(false)}>×</button></div>
      {[{t:'OBJETIVO',d:'Juega todas tus cartas mencionando sus conceptos en la historia y llévala a tu final secreto.'},{t:'JUGAR CARTA',d:'Selecciona texto + carta (o carta + texto). Ambos órdenes funcionan.'},{t:'SELLADO',d:'Cada vez que se juega una carta, todo el texto hasta ese punto se sella y no se puede borrar.'},{t:'INTERRUMPIR',d:'Si NO eres narrador: selecciona texto + carta. Si es rechazada, pierdes la carta y robas 2.'},{t:'VOTAR',d:'La votación aparece sin bloquear la partida. El narrador sigue escribiendo.'},{t:'FINAL',d:'Cuando hayas jugado todas tus cartas, se desbloquea tu FINAL. Solo el narrador.'},{t:'PASAR',d:'Descarta 1 carta → robas 1 nueva.'}].map((r,i)=><div key={i} className="rule"><div className="rule-t">► {r.t}</div><div className="rule-d">{r.d}</div></div>)}</div></div>}

    {/* ═══ HOME ═══ */}
    {screen==='home'&&<div className="screen ctr"><div className="title-block"><PixelBook/><h1 className="main-title">ONCE UPON<br/>A TIME</h1><div className="sub-lbl">— ÉRASE UNA VEZ —</div></div>
      <div className="card hcard"><div className="tbar"><button className={`tb ${homeTab==='create'?'on':''}`} onClick={()=>setHomeTab('create')}>CREAR</button><button className={`tb ${homeTab==='join'?'on':''}`} onClick={()=>setHomeTab('join')}>UNIRSE</button><button className={`tb ${homeTab==='projector'?'on':''}`} onClick={()=>setHomeTab('projector')}>TV</button></div>
        {homeTab!=='projector'&&<input className="inp" value={homeName} onChange={e=>setHomeName(e.target.value)} placeholder="► Tu nombre" maxLength={16} onKeyDown={e=>{if(e.key==='Enter'&&homeTab==='create')doCreateRoom(homeName.trim());}}/>}
        {(homeTab==='join'||homeTab==='projector')&&<input className="inp" value={homeCode} onChange={e=>setHomeCode(e.target.value.toUpperCase())} placeholder="► Código" maxLength={12}/>}
        <button className="btn-pri" onClick={()=>{if(homeTab==='create')doCreateRoom(homeName.trim());else if(homeTab==='join')joinRoom2(homeCode.trim(),homeName.trim());else joinProj(homeCode.trim());}}>{homeTab==='create'?'★ CREAR':homeTab==='join'?'► ENTRAR':'◄► TV'}</button>
      </div><button className="btn-ghost" onClick={()=>setShowRules(true)}>? REGLAS</button></div>}

    {/* ═══ LOBBY ═══ */}
    {screen==='lobby'&&(()=>{const{players,config}=lobbyData;const isHost=players.find(p=>p.id===myId)?.isHost;
      return(<div className="screen ctr"><h2 className="stitle">■ SALA ■</h2>
        <div className="code-box" onClick={()=>navigator.clipboard?.writeText(roomCode)}><span className="cl">CÓDIGO</span><span className="cv">{roomCode}</span><span className="ch">► copiar</span></div>
        <div className="card" style={{maxWidth:500,width:'100%'}}><div className="slbl">PLAYERS ({players.length}/6)</div>
          <div className="llist">{players.map((p,i)=>(<div key={p.id} className="lp"><div className="av" style={{background:pc(i).bg}}>{p.name[0]?.toUpperCase()}</div><span className="pn">{p.name}</span>{p.isHost&&<span className="bdg host">♛</span>}{p.id===myId&&<span className="bdg you">TÚ</span>}</div>))}</div>
          {isHost&&<>
            <button className="btn-ghost cfg-toggle" onClick={()=>setShowCfg(!showCfg)}>{showCfg?'▲ OCULTAR CONFIG':'▼ CONFIGURACIÓN'}</button>
            {showCfg&&<div className="cfg-panel">
              <div className="cfg-row"><label>Cartas por jugador</label>
                <select value={config.handSize||'auto'} onChange={e=>updateConfig({handSize:e.target.value==='auto'?'auto':+e.target.value})}>
                  <option value="auto">Auto ({players.length<=2?10:players.length===3?8:players.length===4?7:players.length===5?6:5})</option>
                  {[3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="cfg-row"><label>Tiempo de voto (s)</label><input type="number" min="10" max="60" value={config.voteTime||20} onChange={e=>updateConfig({voteTime:+e.target.value})}/></div>
              <div className="cfg-row"><label>Inactividad máx (s)</label><input type="number" min="15" max="120" value={config.inactLimit||30} onChange={e=>updateConfig({inactLimit:+e.target.value})}/></div>
              <div className="cfg-row"><label>Ventana interrupción (s)</label><input type="number" min="4" max="15" value={config.interruptWindowTime||8} onChange={e=>updateConfig({interruptWindowTime:+e.target.value})}/></div>
            </div>}
            <button className="btn-pri" onClick={doStart} disabled={players.length<2} style={{marginTop:12}}>► START</button>
          </>}
          {!isHost&&<div className="hint">Esperando al host...</div>}
        </div>
        <div style={{display:'flex',gap:10,marginTop:10}}>
          <button className="btn-ghost" onClick={()=>setShowRules(true)}>? REGLAS</button>
          <button className="btn-ghost" onClick={goHome}>◄ SALIR</button>
        </div></div>);})()}

    {/* ═══ GAME ═══ */}
    {screen==='game'&&gs&&!isFinished&&(()=>{
      const narrator=gs.players.find(p=>p.id===gs.narratorId);const nIdx=gs.players.findIndex(p=>p.id===gs.narratorId);
      const alreadyVetoed=gs.vetoVotes?.includes(gs.myId);
      const conceptCards=myPriv?.hand?.filter(c=>!c.isEnding)||[];
      const endingCard=myPriv?.hand?.find(c=>c.isEnding);const allDone=conceptCards.length===0;
      const timeLeft=isNarr?Math.max(0,inact.limit-inact.s):0;const pct=isNarr?(inact.s/inact.limit)*100:0;

      function handleReaderMouseUp(){const sel=window.getSelection();if(!sel||sel.rangeCount===0||!sel.toString().trim())return;
        const text=sel.toString().trim();const story=gs.story||'';
        let idx=story.lastIndexOf(text);
        if(idx>=0&&idx<sealedPos){const idx2=story.indexOf(text,sealedPos);if(idx2>=0)idx=idx2;}
        if(idx>=0)onTextSelected({text,start:idx,end:idx+text.length});}

      return(<div className="glayout">
        <div className="my-name-bar"><span className="mname">► {myName||gs.players.find(p=>p.id===gs.myId)?.name||''}</span>
          {isSpec&&<span className="spec-tag">ESPECTADOR</span>}{isNarr&&<span className="narr-tag">✍ NARRANDO</span>}</div>
        <div className="topbar">
          <div className="tbl"><span className="tlogo">📖</span><span className="ttl">ONCE UPON A TIME</span><span className="rbdg">{gs.code}</span>
            <button className="bicon" onClick={()=>setShowRules(true)}>?</button>
            <div className="sound-wrap">
              <button className="bicon" onClick={()=>setShowSound(!showSound)} title={muted?'Activar sonido':'Sonido'}>{muted?'🔇':'🔊'}</button>
              {showSound&&<div className="sound-menu" onClick={e=>e.stopPropagation()}>
                <div className="sm-head">SONIDO</div>
                <button className={`sm-mute ${muted?'on':''}`} onClick={doToggleMute}>{muted?'🔇 SILENCIADO':'🔊 ACTIVADO'}</button>
                <div className="sm-sep"/>
                <div className="sm-head">MÚSICA</div>
                {TRACKS.map(t=>(
                  <button key={t.id} className={`sm-track ${musicTrack===t.id?'on':''}`} onClick={()=>doChangeTrack(t.id)}>{musicTrack===t.id?'♪ ':'  '}{t.name}</button>
                ))}
                <div className="sm-sep"/>
                <div className="sm-vol"><span>VOL</span><input type="range" min="0" max="40" value={musicVol} onChange={e=>doChangeVol(+e.target.value)}/><span>{musicVol}%</span></div>
                <button className="sm-close" onClick={()=>setShowSound(false)}>✕ CERRAR</button>
              </div>}
            </div></div>
          <RankingBar players={gs.players} myId={gs.myId} handSize={handSize}/>
          <div className="tbr"><span className="nl">NARR:</span><div className="nchip nchip-glow" style={{borderColor:pc(nIdx).bg,'--nc':pc(nIdx).bg}}><div className="avsm" style={{background:pc(nIdx).bg}}>{narrator?.name?.[0]}</div><span style={{color:pc(nIdx).l}}>{narrator?.name}</span></div>
            <button className="btn-exit" onClick={()=>{if(confirm('¿Salir al menú principal?'))goHome();}}>◄ SALIR</button></div></div>

        {isDraggingCard&&!popup&&<div className="active-card-bar drag-hint" style={{borderColor:'#d4af37',background:'rgba(212,175,55,.1)'}}>
          <span>🎯 <strong style={{color:'#d4af37'}}>ARRASTRA SOBRE UNA PALABRA</strong> de la historia para jugar la carta</span></div>}
        {(activeCard||pendingSel)&&!popup&&<div className="active-card-bar" style={{borderColor:activeCard?TC[activeCard.type]:pendingSel?'#fff':'var(--faint)'}}>
          {activeCard&&<><CardImg img={activeCard.img} size="sm"/><span>CARTA: <strong style={{color:TC[activeCard.type]}}>{TI[activeCard.type]} {activeCard.name}</strong> — SELECCIONA TEXTO</span></>}
          {!activeCard&&pendingSel&&<span>TEXTO: «{pendingSel.text.substring(0,30)}» — SELECCIONA UNA CARTA</span>}
          <button className="xb" onClick={clearSel}>✕</button></div>}

        {isNarr&&gs.phase==='playing'&&!popup&&(
          <div className={`cd-bar ${pct>85?'crit':pct>60?'warn':''}`}>
            <div className="cd-num" style={{color:pct>85?'#ff1744':pct>60?'#ff9100':'#d4af37'}}>{timeLeft}</div>
            <div className="cd-track"><div className="cd-fill" style={{width:(100-pct)+'%'}}/></div></div>)}

        <div className="gmain">
          <div className="scol"><div className="slbl story-lbl">HISTORIA</div>
            {isNarr
              ?<NarratorEditor story={gs.story} integrations={gs.integrations} sealedPos={sealedPos} frozenPos={frozenPos} pendingVote={gs.currentVote} players={gs.players} activeCard={activeCard} pendingSel={pendingSel} isVoting={isVoting} isInterruptWindow={!!gs.interruptWindow} onUpdate={updateStory} onTextSelected={onTextSelected} isDraggingCard={isDraggingCard} onWordDrop={onCardDrop} dragOverWord={dragOverWord} setDragOverWord={setDragOverWord}/>
              :(<div className={`sdisp ${activeCard||pendingSel?'card-mode':''} ${isDraggingCard?'drag-active':''}`} onMouseUp={handleReaderMouseUp}
                onDragOver={e=>{if(isDraggingCard){e.preventDefault();e.dataTransfer.dropEffect='move';}}}
                onDrop={e=>{if(isDraggingCard){e.preventDefault();setDragOverWord(null);}}}>
                <StoryWords text={gs.story} integrations={gs.integrations} sealedPos={sealedPos} pendingVote={gs.currentVote} players={gs.players} dropEnabled={isDraggingCard} onWordDrop={onCardDrop} dragOverWord={dragOverWord} setDragOverWord={setDragOverWord}/>
                {gs.story&&gs.phase==='playing'&&<span className="story-cursor"/>}
                {!gs.story&&<span className="ph">...</span>}</div>)}
            {popup&&(<div className="ipopup">
              <div className="ip-card-vis" style={{'--tc':TC[popup.card.type]}}>{popup.card.img?<img src={`/cards/${popup.card.img}`} className="ipcv-img" alt=""/>:<div className="ipcv-top">{TI[popup.card.type]}</div>}<div className="ipcv-name">{popup.card.name}</div><div className="ipcv-type">{popup.card.isInterruption?wcLabel(popup.card):TL[popup.card.type]}</div></div>
              <div className="ip-right">
                <div className="ip-timer"><div className="ip-timer-fill" style={{width:(popupTime/15*100)+'%',background:popupTime<=5?'#ff1744':popupTime<=10?'#ff9100':'#d4af37'}}/><span className="ip-timer-num" style={{color:popupTime<=5?'#ff1744':'#d4af37'}}>{popupTime}</span></div>
                <div className="ip-frag">«{popup.fragment.text.substring(0,60)}»</div>
                <textarea className="ip-just" value={just} onChange={e=>setJust(e.target.value)} placeholder="Justificación (opcional)" rows={2}/>
                <div className="ip-btns"><button className="btn-sec" onClick={clearSel}>CANCELAR</button>
                  {popup.action==='integrate'&&<button className={`btn-int ${popup.card.isEnding?'end':''}`} onClick={doAction}>{popup.card.isEnding?'★ FINAL':'► JUGAR CARTA'}</button>}
                  {popup.action==='interrupt'&&<button className="btn-irpt" onClick={doAction}>⚡ INTERRUMPIR</button>}</div></div></div>)}
            <div className="bottom-split">
              <div className="bottom-log"><ActionLog entries={gs.actionLog}/></div>
              <div className="bottom-play">
                {isVoting&&gs.currentVote?<VoteCorner vote={gs.currentVote} players={gs.players} myId={gs.myId} onVote={doVote} isSpec={isSpec} config={gs.config}/>
                :<div className="bp-idle">—</div>}
              </div>
            </div></div>

          <div className="span">
            {myPriv&&!isSpec&&<>
              <div className="slbl">CARTAS ({conceptCards.length}/{handSize})</div>
              <div className="hand">{conceptCards.map(c=>(
                <div key={c.id} className={`gcard ${c.isInterruption?'gcard-interrupt':''} ${activeCard?.id===c.id?'active':''} ${swappedId===c.id?'swapped':''}`} style={{'--tc':c.isInterruption?'#d4af37':TC[c.type]}}
                  onClick={()=>onCardClick(c)} draggable="true" onDragStart={e=>handleCardDragStart(e,c)} onDragEnd={handleCardDragEnd}>
                  <div className="gc-face">{c.isInterruption&&<div className="gc-int-badge">⚜ INTERRUPCIÓN</div>}<CardImg img={c.img} size="lg"/><div className="gc-info"><div className="gc-name">{c.name}</div><div className="gc-type">{c.isInterruption?`↻ Comodín de ${TL[c.type]}`:TL[c.type]}</div></div><div className="gc-icon">{TI[c.type]}</div></div></div>))}
                {!conceptCards.length&&<div className="empty-h">★ TODAS JUGADAS</div>}
                {endingCard&&(<div className={`gcard ending-card ${activeCard?.id===endingCard.id?'active':''} ${!allDone?'locked':''}`} style={{'--tc':'#d4af37'}}
                  onClick={()=>{if(!allDone){notify('JUEGA TODAS TUS CARTAS PRIMERO');return;}if(!isNarr){notify('SOLO EL NARRADOR');return;}onCardClick(endingCard);}}>
                  <div className="gc-face end-face"><div className="gc-icon end-icon">★</div><div className="gc-info end-info"><div className="gc-name ending-name">FINAL</div><div className="gc-end-full">«{endingCard.text}»</div></div>{!allDone&&<div className="gc-lock">🔒</div>}</div></div>)}</div>
              {myPriv.integrated.length>0&&<><div className="slbl">JUGADAS</div><div className="chips">{myPriv.integrated.map((c,i)=><span key={i} className={`chip ${c.isInterruption?'chip-int':''}`} style={{'--tc':c.isInterruption?'#d4af37':TC[c.type]}}>{TI[c.type]} {c.name} <small>({c.isInterruption?`↻ ${TL[c.type]}`:TL[c.type]})</small></span>)}</div></>}
              <div className="drow"><span className="dcount">MAZO {gs.deckSize}</span><span className="dcount">FINALES {gs.endingsDeckSize}</span></div>
              <div className="aarea">
                {isNarr&&!showPass&&!popup&&<button className="btn-pass" onClick={()=>setShowPass(true)}>↻ PASAR</button>}
                {!isNarr&&!popup&&<>{!alreadyVetoed&&<button className="btn-veto" onClick={doVeto}>✖ VETAR ({gs.vetoVotes?.length||0}/{gs.vetoThreshold})</button>}{alreadyVetoed&&<div className="vdone">VETO OK</div>}</>}</div>
              {showPass&&<div className="pass-ov"><div className="pass-mod"><div className="pm-t">↻ DESCARTA UNA CARTA</div>
                <div className="pm-cards">{conceptCards.map(c=>(<div key={c.id} className="gcard disc" style={{'--tc':TC[c.type]}} onClick={()=>doPass(c.id)}><div className="gc-face"><CardImg img={c.img} size="md"/><div className="gc-info"><div className="gc-name">{c.name}</div></div></div></div>))}</div>
                <button className="btn-sec" onClick={()=>setShowPass(false)}>CANCELAR</button></div></div>}
              {showVetoModal&&<div className="pass-ov"><div className="pass-mod veto-mod">
                <div className="pm-t">🚫 VETAR NARRADOR</div>
                <div className="veto-reasons">
                  {['No para de desvariar','Escribe cosas sin sentido','Juega cartas sin justificarlas','Ignora la historia','No respeta el turno','Está AFK / inactivo'].map(r=>(
                    <button key={r} className={`veto-reason-btn ${vetoReason===r?'vr-sel':''}`} onClick={()=>setVetoReason(vetoReason===r?'':r)}>{r}</button>))}
                </div>
                <input className="veto-custom" value={vetoReason} onChange={e=>setVetoReason(e.target.value)} placeholder="O escribe tu motivo..." maxLength={80}/>
                <div className="ip-btns"><button className="btn-sec" onClick={()=>setShowVetoModal(false)}>CANCELAR</button>
                  <button className="btn-veto" disabled={!vetoReason.trim()} onClick={()=>confirmVeto()}>🚫 ENVIAR VETO</button></div>
              </div></div>}
            </>}
            {isSpec&&<div className="spec-n">◄ ESPECTADOR ►</div>}
            <div className="slbl" style={{marginTop:8}}>PLAYERS</div>
            <div className="plist">{gs.players.map((p,i)=>(<div key={p.id} className={`pli ${p.id===gs.narratorId?'pnarr':''} ${!p.connected?'pdc':''}`}><div className="avsm" style={{background:pc(i).bg}}>{p.name[0]}</div><div className="plinfo"><span className="pln">{p.name}{p.id===gs.myId?' (tú)':''}</span><span className="plst">{Math.max(0,p.handCount-1)}/{handSize} ✅{p.integratedCount}</span></div>{p.id===gs.narratorId&&<span>✍</span>}</div>))}</div>
          </div>
        </div>

        {/* ═══ GOLDEN INTERRUPT WINDOW ═══ */}
        {gs.interruptWindow&&!isSpec&&!iwDismissed&&<InterruptWindow iw={gs.interruptWindow} myHand={myPriv?.hand} myId={gs.myId} narratorId={gs.narratorId} onUse={useGoldenInterrupt} onDecline={declineInterrupt}/>}
      </div>);})()}

    {/* ═══ VICTORY ═══ */}
    {screen==='game'&&gs&&isFinished&&(()=>{const w=gs.players.find(p=>p.id===gs.winnerId);const wi=gs.players.findIndex(p=>p.id===gs.winnerId);const isHost=gs.players.find(p=>p.id===gs.myId)?.isHost;
      return(<div className="screen ctr"><div className="vcrown">♛</div><h1 className="vtit">VICTORIA</h1>
        <div className="avlg" style={{background:pc(wi).bg}}>{w?.name?.[0]}</div><div className="vname" style={{color:pc(wi).l}}>{w?.name}</div><div className="vsub">ha completado su historia</div>
        {gs.story&&<div className="srecap"><div className="rtxt">{gs.story}</div></div>}
        <div style={{display:'flex',gap:12,marginTop:20,flexWrap:'wrap',justifyContent:'center'}}>
          <button className="btn-gold" onClick={downloadStory}>▼ DESCARGAR</button>
          {isHost&&<button className="btn-pri" onClick={doRestart} style={{maxWidth:220}}>► NUEVA PARTIDA</button>}
          <button className="btn-sec" onClick={goHome}>◄ MENÚ</button></div></div>);})()}

    {/* ═══ PROJECTOR ═══ */}
    {screen==='projector'&&gs&&(()=>{const n=gs.players?.find(p=>p.id===gs.narratorId);const sp=gs.sealedPos||0;
      return(<div className="proj"><div className="ptop"><h1 className="pttl">ONCE UPON A TIME</h1><span className="rbdg">{gs.code}</span><div className="ppnarr">✍ {n?.name}</div></div>
        <div className="pplayers">{gs.players?.map((p,i)=>(<div key={p.id} className={`pp ${p.id===gs.narratorId?'ppact':''}`}><div className="av" style={{background:pc(i).bg}}>{p.name[0]}</div><span>{p.name}</span><span className="ppst">{p.handCount}■</span></div>))}</div>
        <div className="pstory"><StoryWords text={gs.story} integrations={gs.integrations} sealedPos={sp} pendingVote={gs.currentVote} players={gs.players}/>{gs.story&&gs.phase==='playing'&&<span className="story-cursor"/>}{!gs.story&&<span className="ph">...</span>}</div>
        {gs.currentVote&&<div className="pvote">⚖ VOTACIÓN — {gs.currentVote.timeLeft}s</div>}
        {gs.currentVote&&<FloatingCardOverlay vote={gs.currentVote} players={gs.players}/>}
        <ActionLog entries={gs.actionLog}/></div>);})()}
  </div>);
}
