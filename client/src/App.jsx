import{useState,useEffect,useRef,useCallback,useMemo,memo}from'react';
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
let _audioCtx=null;
function getAudioCtx(){if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(_audioCtx.state==='suspended')_audioCtx.resume().catch(()=>{});return _audioCtx;}
function sfx(type){if(_muted)return;try{const ac=getAudioCtx();const t=ac.currentTime;
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

// ═══ TUTORIAL DATA ═══
const TUTORIAL_PLAYERS=[
  {id:'t1',name:'Elena',handCount:6,integratedCount:0,integrated:[],connected:true,isHost:true},
  {id:'t2',name:'Marco',handCount:6,integratedCount:0,integrated:[],connected:true,isHost:false},
  {id:'t3',name:'Lucía',handCount:6,integratedCount:0,integrated:[],connected:true,isHost:false},
];
const TUTORIAL_HAND=[
  {id:'tc1',name:'Princesa',type:'character',isInterruption:false,isEnding:false,img:'carta_003.png'},
  {id:'tc2',name:'Bosque',type:'place',isInterruption:false,isEnding:false,img:'carta_131.png'},
  {id:'tc3',name:'Corona',type:'object',isInterruption:false,isEnding:false,img:'carta_015.png'},
  {id:'tc4',name:'Perdido(a)',type:'aspect',isInterruption:false,isEnding:false,img:'carta_100.png'},
  {id:'tc5',name:'Un viaje',type:'event',isInterruption:false,isEnding:false,img:'carta_096.png'},
  {id:'tc6',name:'Caballo',type:'character',isInterruption:true,isEnding:false,img:'carta_091.png'},
];
const TUTORIAL_ENDING={id:'te1',name:'Y vivieron felices para siempre.',text:'Y vivieron felices para siempre.',type:'ending',isInterruption:false,isEnding:true};
const TUTORIAL_STEPS=[
  {id:'welcome',title:'BIENVENIDO AL TUTORIAL',
   body:'Esto es <strong>Once Upon a Time</strong>, un juego de cartas donde creas historias entre todos.<br><br>Cada jugador tiene cartas narrativas y una carta de Final secreta. El objetivo: mencionar todas tus cartas en la historia y llevarla a tu final.'},
  {id:'cards',title:'TUS CARTAS NARRATIVAS',
   body:'Estas son tus cartas. Cada una tiene un <strong>tipo</strong>:<br>👤 Personaje · 🏰 Lugar · 💎 Objeto · ✨ Aspecto · ⚡ Acontecimiento<br><br>Tu objetivo es mencionar <strong>todas</strong> en la historia para poder jugarlas. La carta con ⚜ es especial (la veremos luego).'},
  {id:'ending',title:'TU CARTA DE FINAL',
   body:'Tu carta dorada es tu <strong>Final secreto</strong> 🔒. Está bloqueada hasta que juegues todas tus cartas narrativas. La historia que escribas debe desembocar en tu final para poder ganar.'},
  {id:'timers',title:'TEMPORIZADORES',
   body:'El narrador tiene <strong>dos temporizadores</strong>:<br><br>⏱ <strong>Inactividad</strong> (barra superior): si no escribes, pierdes turno.<br>🟣 <strong>Límite para jugar carta</strong> (barra morada): si no juegas una carta antes de que se acabe, pierdes turno.<br><br>¡No te duermas!'},
  {id:'narrator',title:'EL NARRADOR',
   body:'El jugador con el icono <strong>✍</strong> es el narrador. Solo él puede escribir la historia. Los demás observan y pueden interrumpir o vetar.'},
  {id:'story',title:'ESCRIBIR LA HISTORIA',
   body:'Cuando eres narrador, escribes libremente en el área de texto. Fíjate en las palabras de colores: son texto <strong>sellado</strong> (vinculado a cartas ya jugadas). El texto sellado <strong>no se puede borrar ni editar</strong> — aparece con un tono más oscuro.'},
  {id:'play-card',title:'JUGAR UNA CARTA',
   body:'Hay 3 formas de jugar una carta:<br><br><strong>① Click carta → selecciona texto:</strong> Haz clic en tu carta, luego selecciona palabras de la historia.<br><strong>② Selecciona texto → click carta:</strong> Selecciona texto primero, luego haz clic en la carta.<br><strong>③ Arrastra la carta</strong> directamente sobre una palabra de la historia.'},
  {id:'vote',title:'VOTACIÓN',
   body:'Cuando alguien juega una carta, los demás <strong>votan</strong>. Si nadie veta antes de que se agote el tiempo, se aprueba automáticamente (el silencio es consentimiento).<br><br>Solo debes vetar cuando el uso de la carta te parezca <strong>ilegítimo o absurdo</strong> — por ejemplo, si dice «princesa» refiriéndose a un gato. El narrador sigue escribiendo durante la votación.'},
  {id:'interrupt',title:'INTERRUPCIÓN',
   body:'Si <strong>no eres narrador</strong>, puedes interrumpir: selecciona texto de la historia y una de tus cartas, o arrastra tu carta sobre una palabra. Si la votación aprueba tu interrupción, <strong>te conviertes en narrador</strong>.<br><br>⚠ Si la interrupción es rechazada, <strong>pierdes la carta</strong> y robas 1 del mazo.'},
  {id:'golden',title:'COMODINES DE INTERRUPCIÓN ⚜',
   body:'Las cartas con <strong>⚜ y el símbolo ↻</strong> son especiales. Tienen <strong>doble función</strong>:<br><br><strong>1)</strong> Puedes jugarla como carta normal (por ejemplo, «Caballo» como Personaje).<br><strong>2)</strong> Puedes usarla como <strong>comodín</strong>: si el narrador juega cualquier carta del mismo tipo (ej. cualquier 👤 Personaje), aparece una ventana ⚜ para robar el turno <strong>SIN votación</strong>.<br><br>Ejemplo: El narrador juega 👤 Princesa → si tienes ↻ Caballo (comodín de Personaje), puedes interrumpir instantáneamente porque ambos son del tipo Personaje.'},
  {id:'pass',title:'PASAR TURNO',
   body:'Si no puedes o no quieres seguir narrando, pulsa <strong>↻ PASAR</strong>. Descartas una carta narrativa y robas otra nueva del mazo. El turno pasa al siguiente jugador.'},
  {id:'veto',title:'VETAR AL NARRADOR',
   body:'Si no eres narrador, puedes <strong>vetar</strong> su turno indicando un motivo. Cuando la mitad de los jugadores <strong>vetan</strong>, el narrador pierde turno y roba 1 carta de penalización.<br><br>⚠ El veto solo debe usarse cuando alguien <strong>claramente está saboteando</strong> la partida: escribiendo texto sin sentido, troleando o ignorando la historia.'},
  {id:'play-ending',title:'JUGAR EL FINAL',
   body:'Cuando te hayas descartado de <strong>todas</strong> tus cartas narrativas y solo te quede tu carta de Final, esta se <strong>desbloquea ★</strong>. Escribe la historia para que desemboque naturalmente en tu final, selecciona el texto relevante y juégala.<br><br>Los demás votarán si tiene sentido. Si se aprueba, <strong>¡ganas!</strong>'},
  {id:'victory',title:'¡VICTORIA!',
   body:'Si tu final es aprobado, <strong>¡ganas la partida!</strong> Se muestra un ranking con los jugadores ordenados por cartas restantes — el que menos tiene, mejor posición.'},
  {id:'done',title:'¡LISTO!',
   body:'Ya conoces todas las mecánicas. ¡Crea una sala, invita a tus amigos y que empiece la historia!'},
];

function TutArrow({dir,label}){
  const cls=`tut-arrow tut-arrow-${dir||'down'}`;
  return <div className={cls}><div className="tut-arrow-head">▼</div>{label&&<div className="tut-arrow-label">{label}</div>}</div>;
}

function Tutorial({onClose}){
  const[step,setStep]=useState(0);
  const s=TUTORIAL_STEPS[step];
  const total=TUTORIAL_STEPS.length;
  const fakeStory='Érase una vez una princesa que vivía en un bosque encantado. Un día encontró una corona brillante entre los árboles.';
  const fakeIntegrations=[
    {conceptName:'Princesa',conceptType:'character',isInterruption:false,fragment:'princesa',start:16,end:24,playerId:'t1',playerName:'Elena'},
    {conceptName:'Bosque',conceptType:'place',isInterruption:false,fragment:'bosque encantado',start:40,end:56,playerId:'t1',playerName:'Elena'},
    {conceptName:'Corona',conceptType:'object',isInterruption:false,fragment:'corona brillante',start:79,end:95,playerId:'t2',playerName:'Marco'},
  ];
  const conceptCards=TUTORIAL_HAND.filter(c=>!c.isInterruption);
  const interruptCard=TUTORIAL_HAND.find(c=>c.isInterruption);
  const endingCard=TUTORIAL_ENDING;
  const showEnding=s.id==='ending'||s.id==='play-ending';
  const endingUnlocked=s.id==='play-ending';
  const showTimers=s.id==='timers';
  const showInterruptCard=s.id==='golden'||s.id==='cards';

  return(<div className="tut-overlay">
    <div className="tut-scene">
      {/* Simulated topbar */}
      <div className={`tut-topbar ${s.id==='narrator'?'tut-hl':''}`}>
        <div className="tut-topbar-left">
          <span className="tlogo">📖</span><span className="ttl" style={{fontSize:14}}>ONCE UPON A TIME</span>
          <span className="rbdg">TUTORIAL</span>
        </div>
        <div className="tut-ranking">
          {TUTORIAL_PLAYERS.map((p,i)=><span key={p.id} className="tut-rank-chip"><span className="avsm" style={{background:pc(i).bg}}>{p.name[0]}</span><span style={{color:pc(i).l,fontSize:13}}>{p.name}</span></span>)}
        </div>
        <div className={`tut-narr-chip ${s.id==='narrator'?'tut-hl-el':''}`} style={{position:'relative'}}>
          <span style={{color:'var(--dim)',fontSize:12}}>NARR:</span>
          <span className="avsm" style={{background:pc(0).bg}}>E</span>
          <span style={{color:pc(0).l}}>Elena ✍</span>
          {s.id==='narrator'&&<TutArrow dir="up" label="Narrador actual"/>}
        </div>
      </div>

      {/* Simulated timers */}
      {showTimers&&<div className="tut-timers-sim">
        <div className="tut-timer-row" style={{position:'relative'}}>
          <div className="tut-timer-label">⏱ INACTIVIDAD</div>
          <div className="tut-timer-num">22</div>
          <div className="tut-timer-track"><div className="tut-timer-fill" style={{width:'73%',background:'#d4af37'}}/></div>
          <TutArrow dir="left" label="Si llega a 0, pierdes turno"/>
        </div>
        <div className="tut-timer-row" style={{position:'relative'}}>
          <div className="tut-timer-label">🟣 CARTA</div>
          <div className="tut-timer-num" style={{color:'#7b1fa2'}}>1:38</div>
          <div className="tut-timer-track"><div className="tut-timer-fill" style={{width:'82%',background:'#7b1fa2'}}/></div>
          <TutArrow dir="left" label="Si no juegas carta, pierdes turno"/>
        </div>
      </div>}

      {/* Simulated game area */}
      <div className="tut-main">
        <div className={`tut-story-area ${s.id==='story'?'tut-hl':''}`} style={{position:'relative'}}>
          <div className="slbl">HISTORIA</div>
          <div className="tut-story-text">
            <StoryWords text={fakeStory} integrations={fakeIntegrations} sealedPos={95} pendingVote={null} players={TUTORIAL_PLAYERS}/>
            <span className="story-cursor"/>
          </div>
          {s.id==='story'&&<div className="tut-sealed-note">
            <TutArrow dir="up" label=""/>
            <span>Las palabras de colores son texto <strong>sellado</strong> — no se puede borrar</span>
          </div>}
          {s.id==='play-card'&&<div className="tut-drag-anim">
            <div className="tut-drag-card">👤 Princesa</div>
            <div className="tut-drag-path"/>
            <div className="tut-drag-target">«princesa»</div>
          </div>}
          {s.id==='interrupt'&&<div className="tut-interrupt-sim">
            <div className="tut-int-typing">Marco escribe: «El camino era largo y...»</div>
            <div className="tut-int-action">⚡ Tú arrastras tu carta sobre «camino» → ¡INTERRUPCIÓN!</div>
          </div>}
        </div>

        <div className="tut-sidebar">
          <div className={`tut-cards-area ${s.id==='cards'||s.id==='play-card'||s.id==='interrupt'?'tut-hl':''}`} style={{position:'relative'}}>
            <div className="slbl">CARTAS ({conceptCards.length+1}/6)</div>
            <div className="tut-hand">
              {conceptCards.map(c=>(
                <div key={c.id} className={`gcard tut-gcard ${s.id==='cards'||s.id==='play-card'?'tut-hl-el':''}`} style={{'--tc':TC[c.type]}}>
                  <div className="gc-face"><CardImg img={c.img} size="lg"/><div className="gc-info"><div className="gc-name">{c.name}</div><div className="gc-type">{TL[c.type]}</div></div><div className="gc-icon">{TI[c.type]}</div></div>
                </div>))}
              {showInterruptCard&&interruptCard&&<div className={`gcard tut-gcard gcard-interrupt ${s.id==='golden'?'tut-hl-el':''}`} style={{'--tc':'#d4af37',position:'relative'}}>
                <div className="gc-face"><div className="gc-int-badge">⚜ INTERRUPCIÓN</div><CardImg img={interruptCard.img} size="lg"/><div className="gc-info"><div className="gc-name">{interruptCard.name}</div><div className="gc-type">↻ Comodín de {TL[interruptCard.type]}</div></div><div className="gc-icon">{TI[interruptCard.type]}</div></div>
                {s.id==='golden'&&<TutArrow dir="up" label="Doble función"/>}
              </div>}
            </div>
            {showEnding&&endingCard&&<div className={`tut-ending-full ${endingUnlocked?'tut-ending-unlocked':'tut-ending-locked'}`}>
              <div className="tut-ending-star">{endingUnlocked?'★':'🔒'}</div>
              <div className="tut-ending-label">FINAL</div>
              <div className="tut-ending-text">«{endingCard.text}»</div>
              {s.id==='ending'&&<TutArrow dir="left" label="Bloqueada hasta jugar todas"/>}
              {s.id==='play-ending'&&<TutArrow dir="left" label="¡Desbloqueada!"/>}
            </div>}
          </div>
          <div className={`tut-actions ${s.id==='pass'||s.id==='veto'?'tut-hl':''}`}>
            <div className={`tut-btn-fake ${s.id==='pass'?'tut-hl-el':''}`} style={{position:'relative'}}>↻ PASAR
              {s.id==='pass'&&<TutArrow dir="up" label="Descarta 1, roba 1"/>}
            </div>
            <div className={`tut-btn-fake tut-btn-veto ${s.id==='veto'?'tut-hl-el':''}`} style={{position:'relative'}}>✖ VETAR (0/1)
              {s.id==='veto'&&<TutArrow dir="up" label="Solo contra sabotaje"/>}
            </div>
          </div>
        </div>
      </div>

      {/* Simulated vote — in the story area, not overlapping dialog */}
      {s.id==='vote'&&<div className="tut-vote-sim">
        <div className="tut-vote-head">⚖ VOTACIÓN — 15s</div>
        <div className="tut-vote-body">Marco juega <strong style={{color:TC.object}}>💎 Corona (Objeto)</strong></div>
        <div className="tut-vote-btns"><span className="tut-vb-yes">OK</span><span className="tut-vb-no">✗ VETAR</span></div>
        <div className="tut-vote-note">Si nadie veta → se aprueba</div>
      </div>}

      {/* Golden interrupt window sim */}
      {s.id==='golden'&&<div className="tut-golden-sim">
        <div className="tut-golden-glow"/>
        <div className="tut-golden-head">⚜ INTERRUPCIÓN DORADA — 8s</div>
        <div className="tut-golden-body">El narrador jugó <strong style={{color:TC.character}}>👤 Princesa (Personaje)</strong></div>
        <div className="tut-golden-sub">Tienes ↻ Caballo (Comodín de Personaje) — mismo tipo!</div>
        <div className="tut-golden-btn">⚡ INTERRUMPIR SIN VOTO</div>
      </div>}

      {/* Victory sim */}
      {s.id==='victory'&&<div className="tut-victory-sim">
        <div className="tut-vic-crown">♛</div>
        <div className="tut-vic-title">VICTORIA</div>
        <div className="tut-vic-name" style={{color:pc(0).l}}>Elena</div>
        <div className="tut-vic-ranking">
          <div className="tut-vic-row">🥇 Elena — <span style={{color:'var(--gold)'}}>★ GANADOR</span></div>
          <div className="tut-vic-row">🥈 Marco — 2 cartas</div>
          <div className="tut-vic-row">🥉 Lucía — 3 cartas</div>
        </div>
      </div>}
    </div>

    {/* Tutorial dialog */}
    <div className="tut-dialog">
      <div className="tut-step-bar"><span className="tut-step-num">PASO {step+1}/{total}</span><div className="tut-progress"><div className="tut-progress-fill" style={{width:((step+1)/total*100)+'%'}}/></div></div>
      <div className="tut-title">{s.title}</div>
      <div className="tut-body" dangerouslySetInnerHTML={{__html:s.body}}/>
      <div className="tut-nav">
        {step>0&&<button className="btn-sec" onClick={()=>setStep(step-1)}>◄ ANTERIOR</button>}
        {step<total-1&&<button className="btn-gold" onClick={()=>setStep(step+1)}>SIGUIENTE ►</button>}
        {step===total-1&&<button className="btn-gold" onClick={onClose}>★ EMPEZAR A JUGAR</button>}
        <button className="btn-sec tut-skip" onClick={onClose}>SALIR</button>
      </div>
    </div>
  </div>);
}

// ═══ WORD PARSER ═══
function parseWords(text){if(!text)return[];const ws=[];let i=0;
  while(i<text.length){if(text[i]===' '||text[i]==='\n'){ws.push({t:text[i],s:i,e:i+1,sp:true});i++;}
  else{let j=i;while(j<text.length&&text[j]!==' '&&text[j]!=='\n')j++;ws.push({t:text.slice(i,j),s:i,e:j,sp:false});i=j;}}return ws;}

// ═══ CARD IMAGE ═══
function CardImg({img,size}){if(!img)return null;return <img src={`/cards/${img}`} alt="" className={`cimg cimg-${size||'md'}`} loading="lazy"/>;}

// ═══ STORY WORDS — renders enchanted/sealed/pending spans ═══
const StoryWords=memo(function StoryWords({text,integrations,sealedPos,pendingVote,players,dropEnabled,onWordDrop,dragOverWord,setDragOverWord,tappable,onWordTap}){
  if(!text)return null;const ws=useMemo(()=>parseWords(text),[text]);
  const pvS=pendingVote?.fragment?.start??-1;const pvE=pendingVote?.fragment?.end??-1;
  const pvWords=[];ws.forEach((w,idx)=>{if(!w.sp&&pvS>=0&&w.s>=pvS&&w.e<=pvE)pvWords.push(idx);});
  const firstPv=pvWords[0]??-1;const lastPv=pvWords[pvWords.length-1]??-1;
  const pIdx=pendingVote?players?.findIndex(p=>p.id===pendingVote.initiatorId):-1;
  const pvColor=pIdx>=0?pc(pIdx):null;
  const isInt=pendingVote?.type==='interrupt';

  function wordHandlers(w){
    const h={};
    // Tap support: when a card is selected, tapping a word plays it there
    if(tappable&&!w.sp){h.onClick=()=>onWordTap?.({text:w.t,start:w.s,end:w.e});}
    if(!dropEnabled||w.sp)return h;
    h.onDragOver=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';setDragOverWord?.({s:w.s,e:w.e,t:w.t});};
    h.onDragEnter=e=>{e.preventDefault();setDragOverWord?.({s:w.s,e:w.e,t:w.t});};
    h.onDragLeave=()=>{};
    h.onDrop=e=>{e.preventDefault();e.stopPropagation();const cardId=e.dataTransfer.getData('cardId');if(cardId&&onWordDrop)onWordDrop(cardId,{text:w.t,start:w.s,end:w.e});setDragOverWord?.(null);};
    return h;
  }
  const dw=dragOverWord;
  const tap=tappable;

  return(<>{ws.map((w,idx)=>{
    if(w.sp)return <span key={idx}>{w.t==='\n'?<br/>:' '}</span>;
    const isDropTarget=dropEnabled&&!w.sp;
    const isHover=dw&&w.s===dw.s;
    const isTap=tap&&!w.sp;
    let ig=null;if(integrations?.length)for(const x of integrations)if(w.s>=x.start&&w.e<=x.end){ig=x;break;}
    const inVote=pvS>=0&&w.s>=pvS&&w.e<=pvE;
    if(ig){const pi=players?.findIndex(p=>p.id===ig.playerId)??-1;const ic=pi>=0?pc(pi):null;
      return <span key={idx} id={inVote&&idx===firstPv?'pv-anchor':undefined} className={`sw sw-enchanted ${isHover?'sw-drophover':''} ${isTap?'sw-tappable':''}`} style={{'--ic':TC[ig.conceptType],'--pc':ic?.l||TC[ig.conceptType]}} title={`✦ ${ig.conceptName} — ${ig.playerName}`} {...wordHandlers(w)}>{w.t}</span>;}
    if(inVote&&!ig){const isF=idx===firstPv;const isL=idx===lastPv;
      return(<span key={idx} id={isF?'pv-anchor':undefined}
        className={`sw sw-pending ${isF?'pv-first':''} ${isL?'pv-last':''} ${isInt?'pv-interrupt':''} ${isHover?'sw-drophover':''} ${isTap?'sw-tappable':''}`}
        style={{'--pc':pvColor?.l||'#fff','--pbg':pvColor?.bg||'#333'}} {...wordHandlers(w)}>{w.t}</span>);}
    if(w.e<=sealedPos)return <span key={idx} className={`sw sw-sealed ${isHover?'sw-drophover':''} ${isDropTarget?'sw-droptarget':''} ${isTap?'sw-tappable':''}`} {...wordHandlers(w)}>{w.t}</span>;
    return <span key={idx} className={`sw ${isHover?'sw-drophover':''} ${isDropTarget?'sw-droptarget':''} ${isTap?'sw-tappable':''}`} {...wordHandlers(w)}>{w.t}</span>;
  })}</>);
});

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
      {vote.concept&&vote.type!=='ending'&&<span style={{color:TC[vote.concept.type]}}><strong>{TI[vote.concept.type]} {vote.concept.name}</strong> <small>({vote.concept.isInterruption?`↻ ${TL[vote.concept.type]}`:TL[vote.concept.type]})</small></span>}
      {vote.concept&&vote.type==='ending'&&<span style={{color:'#d4af37'}}><strong>🏆 «{vote.concept.name.substring(0,60)}{vote.concept.name.length>60?'...':''}»</strong></span>}
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
      <div className="vc-hint2">Si nadie veta antes del tiempo, se aprueba</div>
      <input className="vc-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo del veto (opcional)" maxLength={80}/>
      <div className="vc-btns"><button className="vc-yes" onClick={submitApprove}>OK</button><button className="vc-no" onClick={submitVeto}>✗ VETAR</button></div>
    </>}
    {hasVoted&&<div className="vc-wait">{didApprove?'VOTO ENVIADO ✓':'VETO ENVIADO ■'}</div>}
    {isSpec&&<div className="vc-wait">OBSERVANDO</div>}
  </div>);
}

// ═══ FLOATING VOTE — draggable vote panel ═══
function FloatingVote({vote,players,myId,onVote,isSpec,config}){
  const ref=useRef(null);const drag=useRef({active:false,ox:0,oy:0});
  const[pos,setPos]=useState(null);
  function onDown(e){
    if(e.button&&e.button!==0)return;
    const el=ref.current;if(!el)return;
    const r=el.getBoundingClientRect();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    drag.current={active:true,ox:clientX-r.left,oy:clientY-r.top};
    function onMove(ev){
      if(!drag.current.active)return;
      const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
      const cy=ev.touches?ev.touches[0].clientY:ev.clientY;
      setPos({x:Math.max(0,Math.min(window.innerWidth-100,cx-drag.current.ox)),y:Math.max(0,Math.min(window.innerHeight-50,cy-drag.current.oy))});
    }
    function onUp(){drag.current.active=false;document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.removeEventListener('touchmove',onMove);document.removeEventListener('touchend',onUp);}
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);document.addEventListener('touchmove',onMove,{passive:false});document.addEventListener('touchend',onUp);
  }
  const style=pos?{left:pos.x,top:pos.y,bottom:'auto',right:'auto'}:{};
  return(<div ref={ref} className="vote-float" style={style}>
    <div className="vote-float-handle" onMouseDown={onDown} onTouchStart={onDown}><span>VOTACIÓN</span>⋮⋮</div>
    <VoteCorner vote={vote} players={players} myId={myId} onVote={onVote} isSpec={isSpec} config={config}/>
  </div>);
}

// ═══ INTERRUPT WINDOW — golden popup for eligible players ═══
function InterruptWindow({iw,myHand,myId,narratorId,onUse,onDecline,config}){
  if(!iw||!myHand)return null;
  const compatCards=myHand.filter(c=>c.isInterruption&&c.type===iw.cardType);
  if(!compatCards.length||myId===narratorId)return null;
  const maxT=config?.interruptWindowTime||8;const pct=Math.min(100,(iw.timeLeft/maxT)*100);
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
  // Auto-scroll textarea to bottom as text grows
  useEffect(()=>{if(taRef.current)taRef.current.scrollTop=taRef.current.scrollHeight;},[localText]);

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
  function handleTouchEnd(){setTimeout(()=>{
    const sel=window.getSelection();if(!sel||sel.rangeCount===0||!sel.toString().trim())return;
    const text=sel.toString().trim();
    const idx=localText.lastIndexOf(text);
    if(idx>=0)onTextSelected({text,start:frozen+idx,end:frozen+idx+text.length});
  },100);}

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
      <textarea ref={taRef} className="editor-ta" value={localText} onChange={handleChange} onMouseUp={handleMouseUp} onTouchEnd={handleTouchEnd}
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
  const medals=['👑','🥈','🥉'];
  return(<div className="ranking"><div className="rank-title">RANKING</div><div className="rank-ladder">{sorted.map((p,i)=>{const pi=players.findIndex(x=>x.id===p.id);const me=p.id===myId;const cc=Math.max(0,p.handCount-1);const prog=handSize>0?((handSize-cc)/handSize)*100:0;
    return(<div key={p.id} className={`rank-step ${i===0?'rank-first':''} ${me?'rank-me':''}`}>
      {i===0&&<span className="rank-crown">👑</span>}
      <div className="rank-pos">{medals[i]||`${i+1}º`}</div><div className="avsm" style={{background:pc(pi).bg}}>{p.name[0]}</div><div className="rank-info"><span className="rank-name">{p.name}{me?' ★':''}</span><div className="rank-bar-bg"><div className="rank-bar-fill" style={{width:Math.min(100,prog)+'%',background:i===0?'var(--gold)':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--dim)'}}/></div></div><span className="rank-count">{cc}/{handSize}</span></div>);})}</div></div>);}

// ═══ MAIN APP ═══
export default function App(){
  const[connected,setConnected]=useState(true);
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
  const[homeTab,setHomeTab]=useState('create');const[homeName,setHomeName]=useState('');const[homeCode,setHomeCode]=useState('');const[hostOnly,setHostOnly]=useState(false);const[showTutorial,setShowTutorial]=useState(false);
  const[activeRooms,setActiveRooms]=useState([]);const[roomsLoading,setRoomsLoading]=useState(false);
  const[muted,setMuted]=useState(false);
  const[showSound,setShowSound]=useState(false);
  const[musicTrack,setMusicTrack]=useState('none');
  const[musicVol,setMusicVol]=useState(15);
  const[iwDismissed,setIwDismissed]=useState(false);
  const[showVetoModal,setShowVetoModal]=useState(false);const[vetoReason,setVetoReason]=useState('');
  const[rewindTarget,setRewindTarget]=useState(null);const rewindRef=useRef(null);
  const[screenShake,setScreenShake]=useState(false);
  const[vetoFlash,setVetoFlash]=useState(false);
  const[confetti,setConfetti]=useState(false);
  const[interruptAlert,setInterruptAlert]=useState(null);const interruptAlertT=useRef(null);
  const[cardPlay,setCardPlay]=useState({s:0,limit:120});
  const vrT=useRef(null);const prevNarr=useRef(null);const cfgTimer=useRef(null);const myIdRef=useRef(null);
  const[storyUnread,setStoryUnread]=useState(false);

  useEffect(()=>{myIdRef.current=myId;},[myId]);
  useEffect(()=>()=>{clearPopupTimer();clearTimeout(vrT.current);clearTimeout(cfgTimer.current);clearTimeout(storyThrottleRef.current);stopMusic();},[]);
  const notify=useCallback((msg,dur=3000)=>{setNotif(msg);setTimeout(()=>setNotif(null),dur);},[]);
  function doToggleMute(){const m=toggleMute();setMuted(m);if(!m&&screen==='game')startMusic(musicTrack);}
  function doChangeTrack(id){setMusicTrack(id);_currentTrack=id;if(screen==='game'&&!muted)startMusic(id);}
  function doChangeVol(v){setMusicVol(v);setMusicVolume(v/100);}
  // Start music when game begins
  useEffect(()=>{if(screen==='game'&&!muted)startMusic(musicTrack);if(screen!=='game')stopMusic();return()=>stopMusic();},[screen]);
  useEffect(()=>{if(!showSound)return;const h=e=>{if(!e.target.closest('.sound-wrap'))setShowSound(false);};document.addEventListener('click',h);return()=>document.removeEventListener('click',h);},[showSound]);
  function showBanner(t,dur=3000){setBanner(t);setTimeout(()=>setBanner(null),dur);}
  function showAnnouncement(t,sub,color,dur=2500){setAnnounce({text:t,sub,color});setTimeout(()=>setAnnounce(null),dur);}
  function startPopupTimer(){clearPopupTimer();let left=15;setPopupTime(left);popupTimerRef.current=setInterval(()=>{left--;setPopupTime(left);if(left<=3)sfx('tickUrgent');if(left<=0){clearPopupTimer();clearSel();notify('⏰ TIME OUT');}},1000);}
  function clearPopupTimer(){if(popupTimerRef.current){clearInterval(popupTimerRef.current);popupTimerRef.current=null;}setPopupTime(0);}

  // ═══ SOCKET LISTENERS ═══
  useEffect(()=>{
    const _evts=['connect','disconnect','lobby-update','game-state','story-updated','vote-tick','interrupt-window-tick','inactivity-tick','narrator-changed','vote-resolved','story-rewind','interrupt-alert','cardplay-tick','kicked'];
    _evts.forEach(e=>socket.off(e));
    socket.on('connect',()=>{setConnected(true);
      // Auto-reconnect to room on socket reconnection (network drop)
      const s=sessionStorage.getItem('ouat');if(s){try{const d=JSON.parse(s);socket.emit('reconnect-player',{roomCode:d.roomCode,playerId:d.myId},r=>{if(r?.success){setMyId(d.myId);setRoomCode(d.roomCode);}else{sessionStorage.removeItem('ouat');}});}catch(e){sessionStorage.removeItem('ouat');}}
    });socket.on('disconnect',()=>setConnected(false));
    socket.on('lobby-update',d=>{setLobbyData({players:d.players,config:d.config||{}});setRoomCode(d.code);setScreen('lobby');});
    socket.on('game-state',state=>{
      console.log('[game-state] narratorId=',state.narratorId,'myId=',state.myId,'frozenPos=',state.frozenPos,'sealedPos=',state.sealedPos,'integrations=',state.integrations?.length,'vote=',state.currentVote?.type||'none');
      setGs(state);if(state.isSpectator)setIsSpec(true);if(state.phase!=='lobby')setScreen('game');
    });
    socket.on('story-updated',({text})=>{setGs(p=>{if(!p||p.story===text)return p;return{...p,story:text};});setPendingSel(null);});
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
      const isMe=initiatorId===myIdRef.current;
      if(isMe&&!approved){
        if(type==='interrupt')showBanner('❌ Interrupción vetada — pierdes la carta y robas 1',4000);
        else if(type==='integrate')showBanner('❌ Carta vetada — no se integra',3000);
        else if(type==='ending')showBanner('❌ Final rechazado — nuevo final + 1 carta narrativa',3500);
      }else if(isMe&&approved){
        if(type==='integrate')showBanner('✅ Carta integrada al relato',2500);
        else if(type==='interrupt')showBanner('✅ ¡Interrupción aceptada! Eres narrador',3000);
        else if(type==='ending')showBanner('🏆 ¡VICTORIA!',4000);
      }
      if(approved){sfx('approved');setSparkle(true);setTimeout(()=>setSparkle(false),1800);
        if(type==='integrate'||type==='interrupt'){
          // Spectacular card fly + impact — direct DOM for performance
          const color=TC[conceptType]||'#d4af37';
          const sx=window.innerWidth-180,sy=window.innerHeight-200;
          const tx=Math.round(window.innerWidth*0.35),ty=130;
          const dx=tx-sx,dy=ty-sy;
          // Main flying card
          const el=document.createElement('div');el.className='card-fly';
          el.style.cssText=`left:${sx}px;top:${sy}px;--fly-dx:${dx}px;--fly-dy:${dy}px;--fly-color:${color};`;
          if(conceptImg){const img=document.createElement('img');img.src='/cards/'+conceptImg;
            img.style.cssText=`width:90px;height:125px;object-fit:cover;border-radius:4px;border:3px solid ${color};box-shadow:0 0 30px ${color},0 0 60px ${color}40;`;
            el.appendChild(img);
          }else{const b=document.createElement('div');b.style.cssText=`width:90px;height:125px;background:linear-gradient(135deg,${color},${color}80);border-radius:4px;border:3px solid #fff;box-shadow:0 0 30px ${color};`;el.appendChild(b);}
          document.body.appendChild(el);
          // Trailing particles along flight path
          for(let i=0;i<5;i++){
            const tr=document.createElement('div');tr.className='card-fly-trail';
            const progress=(i+1)*0.15;
            tr.style.cssText=`left:${sx+dx*progress}px;top:${sy+dy*progress}px;width:${12-i*2}px;height:${12-i*2}px;background:${color};box-shadow:0 0 10px ${color};animation-delay:${i*0.08}s;`;
            document.body.appendChild(tr);
            setTimeout(()=>tr.remove(),800);
          }
          // Impact flash at destination
          const fl=document.createElement('div');fl.className='card-fly-flash';
          fl.style.cssText=`left:${tx}px;top:${ty}px;width:30px;height:30px;background:${color};box-shadow:0 0 40px ${color};animation-delay:.6s;`;
          document.body.appendChild(fl);
          // Impact ring
          const ring=document.createElement('div');ring.className='card-impact-ring';
          ring.style.cssText=`left:${tx}px;top:${ty}px;--fly-color:${color};animation-delay:.55s;`;
          document.body.appendChild(ring);
          // Screen-wide impact glow
          const glow=document.createElement('div');glow.className='card-impact-ov';
          glow.style.cssText=`--ix:${Math.round(tx/window.innerWidth*100)}%;--iy:${Math.round(ty/window.innerHeight*100)}%;--fly-color:${color}60;animation-delay:.5s;`;
          document.body.appendChild(glow);
          // Mini screen shake on impact
          setTimeout(()=>{setScreenShake(true);setTimeout(()=>setScreenShake(false),300);},550);
          setTimeout(()=>{el.remove();fl.remove();ring.remove();glow.remove();},1200);
        }
        if(type==='ending'){setConfetti(true);setTimeout(()=>setConfetti(false),4000);}
      }else{sfx('denied');setScreenShake(true);setVetoFlash(true);setTimeout(()=>setScreenShake(false),600);setTimeout(()=>setVetoFlash(false),700);}
    });
    socket.on('story-rewind',({text})=>{setRewindTarget(text);});
    socket.on('interrupt-alert',({playerName,conceptName,conceptType,isInterruption})=>{
      clearTimeout(interruptAlertT.current);
      setInterruptAlert({playerName,conceptName,conceptType,isInterruption});
      interruptAlertT.current=setTimeout(()=>setInterruptAlert(null),3000);
    });
    socket.on('cardplay-tick',({seconds,limit})=>{setCardPlay({s:seconds,limit});});
    socket.on('kicked',(reason)=>{sessionStorage.removeItem('ouat');setScreen('home');setGs(null);setIsSpec(false);setNotif(reason||'Sesión reemplazada desde otro dispositivo');setTimeout(()=>setNotif(null),4000);});
    return()=>{_evts.forEach(e=>socket.off(e));if(rewindRef.current){clearInterval(rewindRef.current);rewindRef.current=null;}clearTimeout(interruptAlertT.current);};
  },[]);

  // ═══ EFFECTS — narrator change detection ═══
  useEffect(()=>{if(!gs||!myId)return;
    const wasNarr=prevNarr.current===myId;
    const amNarr=gs.narratorId===myId;
    if(amNarr&&!wasNarr&&prevNarr.current!==null&&gs.phase==='playing'){
      console.log('[NARRATOR CHANGE] I am now narrator! frozenPos=',gs.frozenPos,'sealedPos=',gs.sealedPos);
      // Don't show generic banner if I just interrupted (vote-resolved will show a specific one)
      const myInterrupt=gs.currentVote?.type==='interrupt'&&gs.currentVote?.initiatorId===myId;
      if(!myInterrupt){showBanner('✍ TE TOCA ESCRIBIR');sfx('turn');}
      else sfx('turn');
    }
    if(!amNarr&&wasNarr&&gs.phase==='playing'){
      console.log('[NARRATOR CHANGE] I lost narrator status');
    }
    prevNarr.current=gs.narratorId;
  },[gs?.narratorId,myId,gs?.phase]);
  useEffect(()=>{if(myId&&roomCode)sessionStorage.setItem('ouat',JSON.stringify({myId,roomCode}));},[myId,roomCode]);
  // ═══ VICTORY CONFETTI on game finish ═══
  const prevPhaseRef=useRef(null);
  useEffect(()=>{if(gs?.phase==='finished'&&prevPhaseRef.current==='playing'){setConfetti(true);setTimeout(()=>setConfetti(false),4000);sfx('approved');}prevPhaseRef.current=gs?.phase||null;},[gs?.phase]);
  // Removed duplicate reconnect — handled by socket.on('connect') above

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
    const el=e.target.cloneNode(true);el.style.cssText='width:80px;height:auto;opacity:0.8;position:absolute;top:-1000px;';
    document.body.appendChild(el);e.dataTransfer.setDragImage(el,40,40);
    setTimeout(()=>document.body.removeChild(el),0);
    e.target.classList.add('dragging');
    setIsDraggingCard(true);
  }
  function handleCardDragEnd(e){e.target.classList.remove('dragging');setIsDraggingCard(false);setDragOverWord(null);}

  // ═══ ACTIONS ═══
  function fetchRooms(){setRoomsLoading(true);socket.emit('list-rooms',null,list=>{setActiveRooms(list||[]);setRoomsLoading(false);});}
  useEffect(()=>{if(homeTab==='rooms')fetchRooms();},[homeTab]);
  function doCreateRoom(name){if(!name)return notify('Escribe tu nombre');sessionStorage.removeItem('ouat');setMyName(name);socket.emit('create-room',{playerName:name,hostOnly},r=>{if(r.error)return notify(r.error);setMyId(r.playerId);setRoomCode(r.code);setScreen('lobby');if(r.isSpectator)setIsSpec(true);});}
  function joinRoom2(code,name){if(!name)return notify('Escribe tu nombre');if(!code)return notify('Escribe el código');sessionStorage.removeItem('ouat');setMyName(name);socket.emit('join-room',{roomCode:code,playerName:name},r=>{if(r.error)return notify(r.error);setMyId(r.playerId);setRoomCode(r.code);setScreen('lobby');if(r.reconnected){notify('🔄 ¡Reconectado!',2000);setIsSpec(false);}else if(r.isSpectator)setIsSpec(true);});}
  function joinProj(code){socket.emit('join-projector',{roomCode:code},r=>{if(r.error)return notify(r.error);setRoomCode(r.code);setScreen('projector');});}
  function doStart(){socket.emit('start-game',null,r=>{if(r?.error)notify(r.error);});}
  const storyThrottleRef=useRef(null);const pendingStoryRef=useRef(null);
  function updateStory(text){setGs(p=>p?{...p,story:text}:p);pendingStoryRef.current=text;if(!storyThrottleRef.current){socket.emit('story-update',{text});storyThrottleRef.current=setTimeout(()=>{storyThrottleRef.current=null;if(pendingStoryRef.current!==text)socket.emit('story-update',{text:pendingStoryRef.current});},150);}}
  function updateConfig(patch){const next={...lobbyData.config,...patch};setLobbyData(p=>({...p,config:next}));clearTimeout(cfgTimer.current);cfgTimer.current=setTimeout(()=>socket.emit('update-config',{config:next},r=>{if(r?.error)notify(r.error);}),300);}
  function goHome(){stopMusic();socket.emit('leave-room');setScreen('home');setGs(null);setIsSpec(false);setShowSound(false);setShowCfg(false);sessionStorage.removeItem('ouat');}
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
  function useGoldenInterrupt(cardId){sfx('interrupt');socket.emit('use-interrupt-window',{conceptId:cardId},r=>{if(r?.error){notify(r.error);return;}setIwDismissed(true);});}
  function declineInterrupt(){setIwDismissed(true);}
  function doReclaim(playerId){socket.emit('reclaim-seat',{roomCode,playerId},r=>{if(r?.error)return notify(r.error);setMyId(r.playerId);setIsSpec(false);notify('🔄 ¡Puesto reclamado!',2000);});}
  function doRestart(){socket.emit('restart-game',null,r=>{if(r?.error)notify(r.error);setScreen('lobby');setIsSpec(false);});}
  function downloadStory(){
    const story=gs?.story||'';const igs=gs?.integrations||[];const players=gs?.players||[];
    // Build HTML with colored integrations
    let html='';let i=0;
    // Sort integrations by start position
    const sorted=[...igs].sort((a,b)=>a.start-b.start);
    for(const ig of sorted){
      if(ig.start>i)html+=escHtml(story.substring(i,ig.start));
      const color=TC[ig.conceptType]||'#d4af37';
      html+=`<span style="color:${color};font-weight:bold;border-bottom:2px solid ${color};cursor:help;" title="${escHtml(ig.conceptName)} — ${escHtml(ig.playerName)} (${TL[ig.conceptType]||ig.conceptType})">${escHtml(story.substring(ig.start,ig.end))}</span>`;
      i=ig.end;
    }
    if(i<story.length)html+=escHtml(story.substring(i));
    html=html.replace(/\n/g,'<br>');
    // Build legend
    let legend='<h2 style="color:#d4af37;font-family:serif;margin-top:30px;border-top:2px solid #d4af37;padding-top:15px;">Cartas jugadas</h2><table style="border-collapse:collapse;width:100%;margin-top:10px;">';
    legend+='<tr style="border-bottom:2px solid #333;"><th style="text-align:left;padding:6px;color:#888;">Carta</th><th style="text-align:left;padding:6px;color:#888;">Tipo</th><th style="text-align:left;padding:6px;color:#888;">Jugador</th><th style="text-align:left;padding:6px;color:#888;">Fragmento</th></tr>';
    for(const ig of sorted){
      const color=TC[ig.conceptType]||'#d4af37';
      legend+=`<tr style="border-bottom:1px solid #222;"><td style="padding:6px;color:${color};font-weight:bold;">${TI[ig.conceptType]||''} ${escHtml(ig.conceptName)}${ig.isInterruption?' ↻':''}</td><td style="padding:6px;color:#888;">${TL[ig.conceptType]||''}</td><td style="padding:6px;color:#ccc;">${escHtml(ig.playerName)}</td><td style="padding:6px;color:#aaa;font-style:italic;">«${escHtml(ig.fragment||'')}»</td></tr>`;
    }
    legend+='</table>';
    // Players summary
    let playersSummary='<h2 style="color:#d4af37;font-family:serif;margin-top:20px;">Jugadores</h2><ul style="list-style:none;padding:0;">';
    const winner=gs?.winnerId;
    for(const p of players){
      const isW=p.id===winner;
      playersSummary+=`<li style="padding:4px 0;color:${isW?'#d4af37':'#ccc'};">${isW?'🏆 ':''}${escHtml(p.name)} — ${isW?'GANADOR':Math.max(0,p.handCount-1)+' cartas restantes'}</li>`;
    }
    playersSummary+='</ul>';
    const fullHtml=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Once Upon a Time — Historia</title><style>body{background:#0a0a12;color:#c8c0b0;font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px 20px;line-height:1.8;font-size:18px;}h1{font-family:'Cinzel Decorative',serif;color:#d4af37;text-align:center;font-size:32px;margin-bottom:5px;}h2{font-size:20px;}.subtitle{text-align:center;color:#7a6f60;font-size:14px;margin-bottom:30px;}@media print{body{background:#fff;color:#222;}h1,h2{color:#8B6914;}span[style]{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><h1>Once Upon a Time</h1><div class="subtitle">${gs?.code||''} — ${new Date().toLocaleDateString('es')}</div><div style="border:1px solid #333;padding:20px;border-radius:4px;margin-bottom:20px;">${html}</div>${legend}${playersSummary}<div style="margin-top:30px;text-align:center;color:#4a4235;font-size:12px;">Generado con Once Upon a Time LAN</div></body></html>`;
    const w=window.open('','_blank');if(w){w.document.write(fullHtml);w.document.close();}
  }
  function escHtml(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  const isFinished=gs?.phase==='finished';

  // ═══ Story auto-scroll — smart: only if near bottom ═══
  const storyRef=useRef(null);
  useEffect(()=>{const el=storyRef.current;if(!el)return;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;if(atBottom){el.scrollTop=el.scrollHeight;setStoryUnread(false);}else{setStoryUnread(true);}},[gs?.story]);

  // ═══ RENDER ═══
  return(<div className={`app ${screenShake?'shake':''}`}><div className="scanlines"/>
    {vetoFlash&&<div className="veto-flash-ov"/>}
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
    {interruptAlert&&<div className="int-alert-ov" onClick={()=>setInterruptAlert(null)}><div className="int-alert">
      <div className="int-alert-icon">⚡</div>
      <div className="int-alert-title">INTERRUPCIÓN</div>
      <div className="int-alert-body"><strong style={{color:TC[interruptAlert.conceptType]||'#d4af37'}}>{interruptAlert.playerName}</strong> ha interrumpido con {interruptAlert.isInterruption?'un comodín de interrupción':'una carta'}:</div>
      <div className="int-alert-card" style={{borderColor:TC[interruptAlert.conceptType]||'#d4af37'}}>{TI[interruptAlert.conceptType]} {interruptAlert.conceptName} <small>({TL[interruptAlert.conceptType]})</small></div>
      <div className="int-alert-explain">{interruptAlert.isInterruption?'Un comodín de interrupción permite robar el turno de narrador cuando la carta es del mismo tipo que la última jugada.':'Esta carta interrumpe la narración actual.'}</div>
      <div className="int-alert-dismiss">toca para cerrar</div>
    </div></div>}

    {/* ═══ RULES MODAL ═══ */}
    {showRules&&<div className="modalbg" onClick={()=>setShowRules(false)}><div className="modalbox" onClick={e=>e.stopPropagation()}><div className="modhead"><h2 className="stitle">■ REGLAS ■</h2><button className="xb big" onClick={()=>setShowRules(false)}>×</button></div>
      {[{t:'OBJETIVO',d:'Juega todas tus cartas mencionando sus conceptos en la historia y llévala a tu final secreto.'},{t:'JUGAR CARTA',d:'Selecciona texto + carta (o carta + texto). Ambos órdenes funcionan.'},{t:'SELLADO',d:'Cada vez que se juega una carta, todo el texto hasta ese punto se sella y no se puede borrar.'},{t:'INTERRUMPIR',d:'Si NO eres narrador: selecciona texto + carta. Si es rechazada, pierdes la carta y robas 1.'},{t:'VOTAR',d:'La votación aparece sin bloquear la partida. El narrador sigue escribiendo.'},{t:'FINAL',d:'Cuando hayas jugado todas tus cartas, se desbloquea tu FINAL. Solo el narrador.'},{t:'PASAR',d:'Descarta 1 carta → robas 1 nueva.'}].map((r,i)=><div key={i} className="rule"><div className="rule-t">► {r.t}</div><div className="rule-d">{r.d}</div></div>)}</div></div>}

    {/* ═══ HOME ═══ */}
    {screen==='home'&&<div key="home" className="screen ctr screen-enter"><div className="title-block"><PixelBook/><h1 className="main-title">ONCE UPON<br/>A TIME</h1><div className="sub-lbl">— ÉRASE UNA VEZ —</div></div>
      <div className="card hcard"><div className="tbar"><button className={`tb ${homeTab==='create'?'on':''}`} onClick={()=>setHomeTab('create')}>CREAR</button><button className={`tb ${homeTab==='join'?'on':''}`} onClick={()=>setHomeTab('join')}>UNIRSE</button><button className={`tb ${homeTab==='rooms'?'on':''}`} onClick={()=>setHomeTab('rooms')}>SALAS</button><button className={`tb ${homeTab==='projector'?'on':''}`} onClick={()=>setHomeTab('projector')}>TV</button></div>
        {homeTab!=='projector'&&homeTab!=='rooms'&&<input className="inp" value={homeName} onChange={e=>setHomeName(e.target.value)} placeholder="► Tu nombre" maxLength={16} onKeyDown={e=>{if(e.key==='Enter'&&homeTab==='create')doCreateRoom(homeName.trim());}}/>}
        {(homeTab==='join'||homeTab==='projector')&&<input className="inp" value={homeCode} onChange={e=>setHomeCode(e.target.value.toUpperCase())} placeholder="► Código" maxLength={12}/>}
        {homeTab==='create'&&<label className="host-only-lbl"><input type="checkbox" checked={hostOnly} onChange={e=>setHostOnly(e.target.checked)}/><span>Solo host (no jugar, solo observar)</span></label>}
        {homeTab!=='rooms'&&<button className="btn-pri" onClick={()=>{if(homeTab==='create')doCreateRoom(homeName.trim());else if(homeTab==='join')joinRoom2(homeCode.trim(),homeName.trim());else joinProj(homeCode.trim());}}>{homeTab==='create'?'★ CREAR':homeTab==='join'?'► ENTRAR':'◄► TV'}</button>}
        {homeTab==='rooms'&&<div className="rooms-browser">
          <div className="rooms-header"><span className="slbl">SALAS ACTIVAS ({activeRooms.length})</span><button className="btn-sec rooms-refresh" onClick={fetchRooms} disabled={roomsLoading}>{roomsLoading?'...':'↻ REFRESCAR'}</button></div>
          {activeRooms.length===0&&<div className="rooms-empty">{roomsLoading?'Buscando salas...':'No hay salas activas'}</div>}
          <div className="rooms-list">{activeRooms.map(r=>{
            const phaseLabel=r.phase==='lobby'?'EN LOBBY':r.phase==='playing'?'JUGANDO':r.phase==='finished'?'TERMINADA':'?';
            const phaseClass=r.phase==='lobby'?'rp-lobby':r.phase==='playing'?'rp-playing':'rp-finished';
            return(<div key={r.code} className="room-item">
              <div className="ri-top">
                <span className="ri-code">{r.code}</span>
                <span className={`ri-phase ${phaseClass}`}>{phaseLabel}</span>
              </div>
              <div className="ri-info">
                <span className="ri-host">♛ {r.hostName}</span>
                <span className="ri-counts">👤 {r.playerCount}/6{r.spectatorCount>0&&` · 👁 ${r.spectatorCount}`}</span>
              </div>
              {r.playerNames.length>0&&<div className="ri-players">{r.playerNames.join(', ')}</div>}
              <div className="ri-actions">
                {r.phase==='lobby'&&<button className="btn-sec ri-btn" onClick={()=>{if(!homeName.trim()){notify('Escribe tu nombre primero');setHomeTab('join');return;}joinRoom2(r.code,homeName.trim());}}>► UNIRSE</button>}
                {r.phase!=='lobby'&&<button className="btn-sec ri-btn" onClick={()=>{if(!homeName.trim()){notify('Escribe tu nombre primero');setHomeTab('join');return;}joinRoom2(r.code,homeName.trim());}}>👁 ESPECTADOR</button>}
                {r.phase!=='lobby'&&<button className="btn-sec ri-btn" onClick={()=>{if(!homeName.trim()){notify('Escribe tu nombre primero');setHomeTab('join');return;}joinRoom2(r.code,homeName.trim());}}>🔄 RECONECTAR</button>}
              </div>
            </div>);})}</div>
          {homeTab==='rooms'&&<input className="inp" value={homeName} onChange={e=>setHomeName(e.target.value)} placeholder="► Tu nombre (para unirte)" maxLength={16} style={{marginTop:8}}/>}
        </div>}
      </div><div style={{display:'flex',gap:10}}><button className="btn-ghost" onClick={()=>setShowRules(true)}>? REGLAS</button><button className="btn-ghost" onClick={()=>setShowTutorial(true)}>📖 TUTORIAL</button></div></div>}

    {showTutorial&&<Tutorial onClose={()=>setShowTutorial(false)}/>}

    {/* ═══ LOBBY ═══ */}
    {screen==='lobby'&&(()=>{const{players,config}=lobbyData;const isHost=players.find(p=>p.id===myId)?.isHost;const activePlayers=players.filter(p=>!p.isSpectatorHost);
      return(<div key="lobby" className="screen ctr screen-enter"><h2 className="stitle">■ SALA ■</h2>
        <div className="code-box" onClick={()=>navigator.clipboard?.writeText(roomCode)}><span className="cl">CÓDIGO</span><span className="cv">{roomCode}</span><span className="ch">► copiar</span></div>
        <div className="card" style={{maxWidth:500,width:'100%'}}><div className="slbl">PLAYERS ({activePlayers.length}/6)</div>
          <div className="llist">{players.map((p,i)=>(<div key={p.id} className="lp"><div className="av" style={{background:pc(i).bg}}>{p.name[0]?.toUpperCase()}</div><span className="pn">{p.name}</span>{p.isHost&&!p.isSpectatorHost&&<span className="bdg host">♛</span>}{p.isSpectatorHost&&<span className="bdg host">♛ HOST</span>}{p.id===myId&&<span className="bdg you">TÚ</span>}</div>))}</div>
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
              <div className="cfg-row"><label>Límite jugar carta (s)</label><input type="number" min="30" max="300" step="10" value={config.cardPlayLimit||120} onChange={e=>updateConfig({cardPlayLimit:+e.target.value})}/><span className="cfg-hint">{Math.floor((config.cardPlayLimit||120)/60)}m {(config.cardPlayLimit||120)%60}s</span></div>
            </div>}
            <button className="btn-pri" onClick={doStart} disabled={activePlayers.length<2} style={{marginTop:12}}>► START</button>
            {activePlayers.length<2&&<div className="hint">Se necesitan al menos 2 jugadores</div>}
          </>}
          {!isHost&&<div className="hint">Esperando al host...</div>}
        </div>
        <div style={{display:'flex',gap:10,marginTop:10}}>
          <button className="btn-ghost" onClick={()=>setShowRules(true)}>? REGLAS</button>
          <button className="btn-ghost" onClick={goHome}>◄ SALIR</button>
        </div></div>);})()}

    {/* ═══ GAME — loading fallback ═══ */}
    {screen==='game'&&!gs&&<div key="game-loading" className="screen ctr screen-enter"><div className="stitle">CARGANDO PARTIDA...</div><button className="btn-ghost" style={{marginTop:16}} onClick={goHome}>◄ VOLVER AL MENÚ</button></div>}

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
      function handleReaderTouchEnd(){setTimeout(()=>{const sel=window.getSelection();if(!sel||sel.rangeCount===0||!sel.toString().trim())return;
        const text=sel.toString().trim();const story=gs.story||'';
        let idx=story.lastIndexOf(text);
        if(idx>=0&&idx<sealedPos){const idx2=story.indexOf(text,sealedPos);if(idx2>=0)idx=idx2;}
        if(idx>=0)onTextSelected({text,start:idx,end:idx+text.length});},100);}
      function handleWordTap(fragment){onTextSelected(fragment);}

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
                <div className="sm-vol"><span>VOL</span><input type="range" min="0" max="100" value={musicVol} onChange={e=>doChangeVol(+e.target.value)}/><span>{musicVol}%</span></div>
                <button className="sm-close" onClick={()=>setShowSound(false)}>✕ CERRAR</button>
              </div>}
            </div></div>
          <RankingBar players={gs.players} myId={gs.myId} handSize={handSize}/>
          <div className="tbr"><span className="nl">NARR:</span><div className="nchip nchip-glow" style={{borderColor:pc(nIdx).bg,'--nc':pc(nIdx).bg}}><div className="avsm" style={{background:pc(nIdx).bg}}>{narrator?.name?.[0]}</div><span style={{color:pc(nIdx).l}}>{narrator?.name}</span><span className="nchip-quill">✍</span></div>
            <button className="btn-exit" onClick={()=>{if(confirm('¿Salir al menú principal?'))goHome();}}>◄ SALIR</button></div></div>

        {!isNarr&&gs.phase==='playing'&&narrator&&<div className="writing-banner">
          <span className="writing-banner-icon">✍</span>
          <span className="writing-banner-text">ESCRIBIENDO</span>
          <span className="writing-banner-name" style={{color:pc(nIdx).l}}>{narrator.name}</span>
          <span className="writing-banner-dots"><span/><span/><span/></span>
        </div>}
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
        {isNarr&&gs.phase==='playing'&&!popup&&gs.config?.cardPlayLimit>0&&(()=>{const cpLeft=Math.max(0,cardPlay.limit-cardPlay.s);const cpPct=(cardPlay.s/cardPlay.limit)*100;return(
          <div className={`cd-bar cd-bar-card ${cpPct>85?'crit':cpPct>60?'warn':''}`}>
            <div className="cd-label">CARTA</div>
            <div className="cd-num" style={{color:cpPct>85?'#ff1744':cpPct>60?'#ff9100':'#7b1fa2'}}>{Math.floor(cpLeft/60)}:{String(cpLeft%60).padStart(2,'0')}</div>
            <div className="cd-track"><div className="cd-fill" style={{width:(100-cpPct)+'%',background:cpPct>85?'#ff1744':cpPct>60?'#ff9100':'#7b1fa2'}}/></div></div>);})()}

        <div className="gmain">
          <div className="scol"><div className="slbl story-lbl">HISTORIA</div>
            {isNarr
              ?<NarratorEditor story={gs.story} integrations={gs.integrations} sealedPos={sealedPos} frozenPos={frozenPos} pendingVote={gs.currentVote} players={gs.players} activeCard={activeCard} pendingSel={pendingSel} isVoting={isVoting} isInterruptWindow={!!gs.interruptWindow} onUpdate={updateStory} onTextSelected={onTextSelected} isDraggingCard={isDraggingCard} onWordDrop={onCardDrop} dragOverWord={dragOverWord} setDragOverWord={setDragOverWord}/>
              :(<div ref={storyRef} className={`sdisp ${activeCard||pendingSel?'card-mode':''} ${isDraggingCard?'drag-active':''}`} onMouseUp={handleReaderMouseUp} onTouchEnd={handleReaderTouchEnd}
                onDragOver={e=>{if(isDraggingCard){e.preventDefault();e.dataTransfer.dropEffect='move';}}}
                onDrop={e=>{if(isDraggingCard){e.preventDefault();setDragOverWord(null);}}}>
                <StoryWords text={gs.story} integrations={gs.integrations} sealedPos={sealedPos} pendingVote={gs.currentVote} players={gs.players} dropEnabled={isDraggingCard} onWordDrop={onCardDrop} dragOverWord={dragOverWord} setDragOverWord={setDragOverWord} tappable={!!activeCard&&!isDraggingCard} onWordTap={handleWordTap}/>
                {gs.story&&gs.phase==='playing'&&<span className="story-cursor"/>}
                {!gs.story&&<span className="ph">...</span>}</div>)}
            {storyUnread&&!isNarr&&<button className="scroll-indicator" onClick={()=>{const el=storyRef.current;if(el){el.scrollTop=el.scrollHeight;setStoryUnread(false);}}}>↓ Nuevo texto</button>}
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
            </div></div>

          <div className={`span${isSpec?' span-spec':''}`}>
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
                {isNarr&&!showPass&&!popup&&<button className="btn-pass" onClick={()=>{if(conceptCards.length===0){sfx('swap');showBanner('↻ Pasas turno — robas 1 carta',3000);socket.emit('pass-turn',{},r=>{if(r?.error)notify(r.error);});}else setShowPass(true);}}>↻ PASAR</button>}
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
            {isSpec&&<div className="spec-n">◄ ESPECTADOR ►
              {gs.players.filter(p=>!p.connected).map(p=>(
                <button key={p.id} className="btn-reclaim" onClick={()=>doReclaim(p.id)}>🔄 RECLAMAR PUESTO DE {p.name}</button>))}
            </div>}
            <div className="slbl" style={{marginTop:8}}>PLAYERS</div>
            <div className="plist">{gs.players.map((p,i)=>(<div key={p.id} className={`pli ${p.id===gs.narratorId?'pnarr':''} ${!p.connected?'pdc':''}`}><div className="avsm" style={{background:pc(i).bg}}>{p.name[0]}</div><div className="plinfo"><span className="pln">{p.name}{p.id===gs.myId?' (tú)':''}</span><span className="plst">{Math.max(0,p.handCount-1)}/{handSize} ✅{p.integratedCount}</span></div>{p.id===gs.narratorId&&<span>✍</span>}</div>))}</div>
          </div>
        </div>

        {/* ═══ GOLDEN INTERRUPT WINDOW ═══ */}
        {gs.interruptWindow&&!isSpec&&!iwDismissed&&<InterruptWindow iw={gs.interruptWindow} myHand={myPriv?.hand} myId={gs.myId} narratorId={gs.narratorId} onUse={useGoldenInterrupt} onDecline={declineInterrupt} config={gs.config}/>}
        {/* ═══ FLOATING VOTE PANEL ═══ */}
        {isVoting&&gs.currentVote&&<FloatingVote vote={gs.currentVote} players={gs.players} myId={gs.myId} onVote={doVote} isSpec={isSpec} config={gs.config}/>}
      </div>);})()}

    {/* ═══ VICTORY ═══ */}
    {screen==='game'&&gs&&isFinished&&(()=>{const w=gs.players.find(p=>p.id===gs.winnerId);const wi=gs.players.findIndex(p=>p.id===gs.winnerId);const isHost=gs.players.find(p=>p.id===gs.myId)?.isHost||gs.isHost;
      const ranked=[...gs.players].sort((a,b)=>{if(a.id===gs.winnerId)return-1;if(b.id===gs.winnerId)return 1;return(a.handCount-1)-(b.handCount-1);});
      const medals=['🥇','🥈','🥉'];
      return(<div key="victory" className="screen ctr screen-enter"><div className="vcrown">♛</div><h1 className="vtit">VICTORIA</h1>
        <div className="avlg" style={{background:pc(wi).bg}}>{w?.name?.[0]}</div><div className="vname" style={{color:pc(wi).l}}>{w?.name}</div><div className="vsub">ha completado su historia</div>
        <div className="v-ranking">{ranked.map((p,i)=>{const pi=gs.players.findIndex(x=>x.id===p.id);const cc=Math.max(0,p.handCount-1);const isW=p.id===gs.winnerId;return(
          <div key={p.id} className={`v-rank-row ${isW?'v-rank-winner':''} ${p.id===gs.myId?'v-rank-me':''}`}>
            <span className="v-rank-pos">{medals[i]||`${i+1}.`}</span>
            <div className="avsm" style={{background:pc(pi).bg}}>{p.name[0]}</div>
            <span className="v-rank-name" style={{color:isW?'var(--gold)':pc(pi).l}}>{p.name}</span>
            <span className="v-rank-cards">{isW?'★ GANADOR':`${cc} carta${cc!==1?'s':''}`}</span>
          </div>);})}</div>
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

    {/* ═══ FALLBACK — prevents black screen ═══ */}
    {screen!=='home'&&screen!=='game'&&screen!=='projector'&&screen!=='lobby'&&<div className="screen ctr"><div className="stitle">ERROR</div><button className="btn-pri" style={{maxWidth:300,marginTop:16}} onClick={goHome}>◄ VOLVER AL MENÚ</button></div>}
    {screen==='projector'&&!gs&&<div className="screen ctr"><div className="stitle">ESPERANDO DATOS...</div><button className="btn-ghost" style={{marginTop:16}} onClick={goHome}>◄ VOLVER</button></div>}
  </div>);
}
