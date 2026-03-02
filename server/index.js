const express=require('express'),{createServer}=require('http'),{Server}=require('socket.io'),path=require('path'),{v4:uuid}=require('uuid');
const{initLogger,serverLog,createSession,sessionLog,getLog,listLogs,closeSession}=require('./logger');
initLogger();

const TL={character:'Personaje',place:'Lugar',object:'Objeto',aspect:'Aspecto',event:'Acontecimiento',ending:'Final'};
const TI={character:'👤',place:'🏰',object:'💎',aspect:'✨',event:'⚡',ending:'🏆'};
function cardLabel(c){return c?`${TI[c.type]||''} ${c.name} (${TL[c.type]||c.type})${c.isInterruption?' ↻':''}`:`?`;}

const CHARS=[{n:"Princesa",i:"003"},{n:"Príncipe",i:"006"},{n:"Mendigo",i:"009"},{n:"Anciano",i:"010"},{n:"Huérfano",i:"013"},{n:"Lobo",i:"017"},{n:"Bruja",i:"021"},{n:"Padre/Madre",i:"023"},{n:"Pastora",i:"026"},{n:"Enemigo",i:"092"},{n:"Ladrón",i:"095"},{n:"Anciana",i:"113"},{n:"Hermano(a)",i:"118"},{n:"Niño(a)",i:"121"},{n:"Gigante",i:"125"},{n:"Madrastra",i:"129"},{n:"Cocinero",i:"133"},{n:"Rey",i:"160"},{n:"Reina",i:"164"},{n:"Hada",i:"161"},{n:"Pájaro",i:"166"}];
const PLACES=[{n:"Isla",i:"004"},{n:"Palacio",i:"007"},{n:"Pueblo",i:"008"},{n:"En el mar",i:"018"},{n:"Noche",i:"020"},{n:"Ruinas",i:"097"},{n:"Cueva",i:"105"},{n:"Prisión",i:"117"},{n:"Reino",i:"120"},{n:"Torre",i:"130"},{n:"Bosque",i:"131"},{n:"Cabaña",i:"136"},{n:"Camino",i:"142"},{n:"Ciudad",i:"147"},{n:"Montaña",i:"153"},{n:"Río",i:"162"},{n:"Ventana",i:"159"}];
const OBJS=[{n:"Libro",i:"005"},{n:"Embarcación",i:"011"},{n:"Hoguera",i:"014"},{n:"Corona",i:"015"},{n:"Puerta",i:"089"},{n:"Hechizo",i:"103"},{n:"Anillo",i:"107"},{n:"Tesoro",i:"124"},{n:"Árbol",i:"127"},{n:"Comida",i:"132"},{n:"Hacha",i:"135"},{n:"Espada",i:"148"}];
const ASPS=[{n:"Asustado(a)",i:"016"},{n:"Esto puede volar",i:"019"},{n:"Secreto(a)",i:"024"},{n:"Perdido(a)",i:"100"},{n:"Afortunado(a)",i:"104"},{n:"Dormido(a)",i:"106"},{n:"Feo(a)",i:"109"},{n:"Lejano(a)",i:"110"},{n:"Disfrazado(a)",i:"114"},{n:"Maldito(a)",i:"115"},{n:"Diminuto(a)",i:"119"},{n:"Perdido(a) tiempo atrás",i:"122"},{n:"Bello(a)",i:"134"},{n:"Feliz",i:"138"},{n:"Oculto(a)",i:"145"},{n:"Envenenado(a)",i:"149"},{n:"Muy fuerte",i:"151"},{n:"Robado(a)",i:"168"},{n:"Este animal puede hablar",i:"165"}];
const EVTS=[{n:"Se rompe un objeto",i:"001"},{n:"Algo es revelado",i:"090"},{n:"Separación",i:"093"},{n:"Un viaje",i:"096"},{n:"Una persecución",i:"098"},{n:"Pasa el tiempo",i:"099"},{n:"Un combate",i:"102"},{n:"Alguien resulta herido",i:"111"},{n:"Una muerte",i:"123"},{n:"Transformación",i:"137"},{n:"Un rescate",i:"139"},{n:"Fuga",i:"141"},{n:"Dos personas se enamoran",i:"144"},{n:"Una discusión",i:"146"},{n:"Una trampa",i:"158"},{n:"Encuentro entre personas",i:"167"}];
const INTS=[{c:"Regalo",t:"object",i:"002"},{c:"Tormenta",t:"event",i:"012"},{c:"Loco",t:"aspect",i:"022"},{c:"Caballo",t:"character",i:"091"},{c:"Plan",t:"event",i:"094"},{c:"Sueño",t:"event",i:"101"},{c:"Escaleras",t:"place",i:"108"},{c:"Este objeto puede hablar",t:"aspect",i:"112"},{c:"Monstruo",t:"character",i:"116"},{c:"Malvado",t:"aspect",i:"126"},{c:"Muy sabio(a)",t:"aspect",i:"128"},{c:"Esposo(a)",t:"character",i:"140"},{c:"Contienda",t:"event",i:"143"},{c:"Ciego",t:"aspect",i:"150"},{c:"Llave",t:"object",i:"152"},{c:"Cocina",t:"place",i:"154"},{c:"Estúpido",t:"aspect",i:"155"},{c:"Capilla",t:"place",i:"156"},{c:"Hogar",t:"place",i:"157"},{c:"Rana",t:"character",i:"163"}];
const ENDS=['\"Me has liberado del maleficio, mañana nos casaremos.\"','Desde entonces tuvo en cuenta el consejo de su madre.','Recogió su arma y prosiguió su camino.','Se escaparon de sus captores y huyeron hacia casa.','Le dieron las gracias al héroe que los había salvado.','Y el reino entero se alegró del fin del mandato del tirano.','Sus penas se acabaron, y empezó la alegría para ella.','Pero aún los visita de vez en cuando.','Y con el paso del tiempo, se convirtieron en reyes.','Le sentaba perfectamente.','Todo fue restaurado, recuperando su glorioso aspecto.','De manera que prometieron no volver a luchar jamás.','De esta manera, recuperó su forma humana.','Y él se reunió de nuevo con su familia.','Se lo comieron en el festín, y resultó delicioso.','Y mientras viviera no se lo podría quitar.','El rey cumplió su parte del trato, y todos se alegraron.','Lo cuidaron hasta que ella fue lo bastante mayor.','Y de esta manera se cumplió la profecía.','Su voluntad había roto el encantamiento.','Y aún hoy, nadie sabe adónde se fue.','Y todo lo que se puede saber es que aún están bailando.','De esta manera, los malvados fueron empujados a un pozo.','Y así el acertijo quedó resuelto.','Se rompió el hechizo, y ellos quedaron libres.','Pese a que volvieron a buscarlo, nunca jamás lo encontraron.','Y los padres se reencontraron con su hijo perdido tiempo atrás.','Lo que prueba que siempre debe saberse con quién se ama.','De esta manera, el gobernante justo recuperó su trono.','Y cuando murieron, se lo dejaron a sus hijos.','Él le reveló que era el príncipe, y vivieron felices por siempre jamás.','Él la perdonó, y se casaron.','Y se lo devolvieron a su propietario original.','Cuando amaneció, pudieron ver que era perfecto.','Pero había desaparecido tan misteriosamente como apareció.','El pueblo fue próspero de nuevo.','La maldición pudo anularse gracias a que se había predicho.','Y las llamas se extendieron destruyendo el palacio del mal.','Y se volvió a reunir con su familia.','De esta manera, el rey aceptó perdonarle la vida.','Y el rey estuvo encantado de recibir tan insólito regalo.','Ella le reveló su verdadera identidad, y se casaron.','El amor verdadero rompió el maleficio.','Cambiaron de lugar, y todo volvió a la normalidad.','Siempre lo recordaba para mejor.','Y aún hoy, siguen sentados allí.','El rey se enterneció y les permitió casarse.','Se dio cuenta del error que había cometido y se arrepintió.','Tras la muerte de su enemigo, al fin pudieron casarse.','Así se dio cuenta de lo leal que había sido su hermano.','Lo que prueba que un corazón puro siempre acaba triunfando.','Y así fue bautizado el reino.','Y la reina concedió la recompensa que les había prometido.','Y nunca jamás lo volvió a perder de vista.'];

function buildDeck(cust){const cards=[];const add=(arr,type)=>arr.forEach(c=>cards.push({id:uuid(),name:c.n,type,isInterruption:false,img:c.i?`carta_${c.i}.png`:null}));const addC=(names,type)=>names.forEach(name=>cards.push({id:uuid(),name,type,isInterruption:false,img:null}));add(CHARS,'character');add(PLACES,'place');add(OBJS,'object');add(ASPS,'aspect');add(EVTS,'event');if(cust?.characters)addC(cust.characters,'character');if(cust?.places)addC(cust.places,'place');if(cust?.objects)addC(cust.objects,'object');if(cust?.aspects)addC(cust.aspects,'aspect');if(cust?.events)addC(cust.events,'event');INTS.forEach(i=>cards.push({id:uuid(),name:i.c,type:i.t,isInterruption:true,img:i.i?`carta_${i.i}.png`:null}));return cards;}
function buildEndDeck(cust){return[...ENDS,...(cust||[])].map(text=>({id:uuid(),name:text,text,type:'ending',isInterruption:false,isEnding:true}));}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function genCode(){const w=['DRAGON','BOSQUE','CORONA','TORRE','REINA','ESPADA','LOBO','MAGIA','CUEVA','FUEGO'];return w[Math.floor(Math.random()*w.length)]+Math.floor(Math.random()*900+100);}
const rooms=new Map();

function computeSealedPos(r){let pos=0;for(const ig of r.integrations)pos=Math.max(pos,ig.end);return pos;}
function effectiveFrozen(r){let pos=computeSealedPos(r);if(r.currentVote?.fragment?.end)pos=Math.max(pos,r.currentVote.fragment.end);return pos;}

function createRoom(sid,name,hostOnly){let code;do{code=genCode();}while(rooms.has(code));const pid=uuid();const room={code,phase:'lobby',_createdAt:Date.now(),players:new Map(),spectators:new Map(),turnOrder:[],narratorIndex:0,story:'',deck:[],endingsDeck:[],discardPile:[],currentVote:null,interruptWindow:null,inactTimer:null,inactSec:0,actionLog:[],projectors:new Set(),integrations:[],vetoVotes:new Map(),winnerId:null,cardPlaySec:0,cardPlayTimer:null,config:{handSize:'auto',voteTime:20,tiebreakTime:8,inactLimit:30,integrateLimit:30,interruptWindowTime:8,cardPlayLimit:120,customCards:null,customEndings:null}};if(hostOnly){room.spectators.set(pid,{id:pid,name,socketId:sid,connected:true,isHost:true});} else {room.players.set(pid,{id:pid,name,socketId:sid,hand:[],integrated:[],connected:true,isHost:true});}rooms.set(code,room);return{code,playerId:pid,isSpectator:!!hostOnly};}
function joinRoom(code,sid,name){const room=rooms.get(code);if(!room)return{error:'Sala no encontrada'};
  // Reconnect by name — works even if old socket is still "connected" (iPad sleep/wake)
  for(const[pid,p]of room.players){if(p.name.toLowerCase()===name.toLowerCase()){
    const oldSid=p.socketId;p.socketId=sid;p.connected=true;
    return{playerId:pid,reconnected:true,oldSocketId:oldSid!==sid?oldSid:null};
  }}
  if(room.phase!=='lobby'){
    const sid2=uuid();room.spectators.set(sid2,{id:sid2,name,socketId:sid,connected:true});return{playerId:sid2,isSpectator:true};
  }
  const connectedPlayers=[...room.players.values()].filter(p=>p.connected);
  if(connectedPlayers.length>=6)return{error:'Sala llena (máx.6)'};for(const p of room.players.values())if(p.name.toLowerCase()===name.toLowerCase()&&p.connected)return{error:'Nombre en uso'};for(const s of room.spectators.values())if(s.name.toLowerCase()===name.toLowerCase())return{error:'Nombre en uso'};const pid=uuid();room.players.set(pid,{id:pid,name,socketId:sid,hand:[],integrated:[],connected:true,isHost:false});return{playerId:pid};}
function resetCardPlay(r,io,rc){clearCardPlay(r);r.cardPlaySec=0;io.to(rc).emit('cardplay-tick',{seconds:0,limit:r.config.cardPlayLimit||120});if(!r.config.cardPlayLimit||r.config.cardPlayLimit<=0)return;r.cardPlayTimer=setInterval(()=>{if(r.phase!=='playing')return;if(r.currentVote)return;r.cardPlaySec++;io.to(rc).emit('cardplay-tick',{seconds:r.cardPlaySec,limit:r.config.cardPlayLimit});if(r.cardPlaySec>=r.config.cardPlayLimit){clearCardPlay(r);const old=getNarr(r);if(old){addLog(r,'pass',old.id,`⏰ ${old.name} no jugó carta a tiempo`);io.to(rc).emit('turn-lost',{playerId:old.id,playerName:old.name,reason:'no-card'});}const n=advanceNarr(r);if(n){addLog(r,'narrator',n.id,`✍️ ${n.name} narra`);io.to(rc).emit('narrator-changed',{narratorId:n.id,narratorName:n.name});}broadcastGS(io,rc);resetInact(r,io,rc);resetCardPlay(r,io,rc);}},1000);}
function clearCardPlay(r){if(r.cardPlayTimer){clearInterval(r.cardPlayTimer);r.cardPlayTimer=null;}r.cardPlaySec=0;}
function isHostSpectator(room,pid){const s=room.spectators.get(pid);return s&&s.isHost;}
function startGame(room){
  // Remove disconnected players before starting
  for(const[pid,p]of room.players){if(!p.connected)room.players.delete(pid);}
  if(room.players.size<2)return{error:'Mínimo 2 jugadores'};const deck=shuffle(buildDeck(room.config.customCards));const endDeck=shuffle(buildEndDeck(room.config.customEndings));const ids=shuffle([...room.players.keys()]);room.turnOrder=ids;room.narratorIndex=0;
  // Official hand sizes: 2→10, 3→8, 4→7, 5→6, 6+→5
  const n=room.players.size;const autoHand=n<=2?10:n===3?8:n===4?7:n===5?6:5;const hs=room.config.handSize==='auto'?autoHand:room.config.handSize||autoHand;room.config._effectiveHandSize=hs;
  ids.forEach(pid=>{const p=room.players.get(pid);p.hand=deck.splice(0,hs);const ec=endDeck.shift();if(ec)p.hand.push(ec);p.integrated=[];});room.deck=deck;room.endingsDeck=endDeck;room.discardPile=[];room.story='';room.phase='playing';room.integrations=[];room.actionLog=[];room.vetoVotes=new Map();room.winnerId=null;room.currentVote=null;room.interruptWindow=null;addLog(room,'system',null,`¡La partida ha comenzado! (${hs} cartas + 1 final)`);addLog(room,'narrator',getNarr(room).id,`✍️ ${getNarr(room).name} es el primer narrador`);return{success:true};}
function getNarr(r){return r.players.get(r.turnOrder[r.narratorIndex]);}
function getNarrId(r){return r.turnOrder[r.narratorIndex];}
function advanceNarr(r){r.turnOrder=r.turnOrder.filter(pid=>r.players.has(pid));if(r.turnOrder.length===0)return null;r.narratorIndex=(r.narratorIndex+1)%r.turnOrder.length;let t=0;while(!r.players.get(r.turnOrder[r.narratorIndex])?.connected&&t<r.turnOrder.length){r.narratorIndex=(r.narratorIndex+1)%r.turnOrder.length;t++;}clearInact(r);r.vetoVotes=new Map();return getNarr(r);}
function addLog(r,type,pid,msg){r.actionLog.push({id:uuid(),type,playerId:pid,message:msg,timestamp:Date.now()});if(r.actionLog.length>80)r.actionLog.shift();}
function resetInact(r,io,rc){clearInact(r);r.inactSec=0;r.inactTimer=setInterval(()=>{if(r.phase!=='playing')return;if(r.currentVote)return;r.inactSec++;io.to(rc).emit('inactivity-tick',{seconds:r.inactSec,limit:r.config.inactLimit});if(r.inactSec>=r.config.inactLimit){clearInact(r);const old=getNarr(r);if(old){addLog(r,'pass',old.id,`⏰ ${old.name} perdió turno por inactividad`);sessionLog(rc,'warn','inactivity-timeout',{player:old.name});io.to(rc).emit('turn-lost',{playerId:old.id,playerName:old.name,reason:'inactivity'});}const n=advanceNarr(r);if(n){addLog(r,'narrator',n.id,`✍️ ${n.name} narra`);io.to(rc).emit('narrator-changed',{narratorId:n.id,narratorName:n.name});}broadcastGS(io,rc);resetInact(r,io,rc);resetCardPlay(r,io,rc);}},1000);}
function clearInact(r){if(r.inactTimer){clearInterval(r.inactTimer);r.inactTimer=null;}r.inactSec=0;}
function checkVeto(r){return r.vetoVotes.size>=Math.ceil((r.players.size-1)/2);}

// ═══ INTERRUPT WINDOW — after narrator's card approved, others with matching interrupt cards can react ═══
function startInterruptWindow(r,io,rc,cardType,concept){
  const narrId=getNarrId(r);let hasEligible=false;
  for(const[pid,p]of r.players){if(pid!==narrId&&p.connected&&p.hand.some(c=>c.isInterruption&&c.type===cardType)){hasEligible=true;break;}}
  if(!hasEligible)return;
  const wt=r.config.interruptWindowTime||8;
  r.interruptWindow={cardType,conceptName:concept.name,timeLeft:wt,timer:setInterval(()=>{r.interruptWindow.timeLeft--;io.to(rc).emit('interrupt-window-tick',{timeLeft:r.interruptWindow.timeLeft});if(r.interruptWindow.timeLeft<=0){closeInterruptWindow(r,io,rc);}},1000)};
  addLog(r,'system',null,`⚜ Ventana de interrupción: ${TI[cardType]} ${TL[cardType]} — ${wt}s`);
  broadcastGS(io,rc);
}
function closeInterruptWindow(r,io,rc){if(!r.interruptWindow)return;clearInterval(r.interruptWindow.timer);r.interruptWindow=null;broadcastGS(io,rc);}

// ═══ VOTING ═══
function startVote(r,io,rc,type,initId,concept,fragment,justification){
  const eligible=[...r.players.keys()].filter(p=>p!==initId&&r.players.get(p).connected);const init=r.players.get(initId);
  if(type==='interrupt'){
    const prevNarrIdx=r.narratorIndex;r.narratorIndex=r.turnOrder.indexOf(initId);r.vetoVotes=new Map();
    const provIg={conceptName:concept.name,conceptType:concept.type,isInterruption:concept.isInterruption,fragment:fragment.text,start:fragment.start,end:fragment.end,playerId:initId,playerName:init.name,_provisional:true};
    r.integrations.push(provIg);addLog(r,'interrupt',initId,`⚡ ${init.name} INTERRUMPE — ${cardLabel(concept)}`);io.to(rc).emit('narrator-changed',{narratorId:initId,narratorName:init.name});
    if(eligible.length===0){provIg._provisional=false;init.hand=init.hand.filter(c=>c.id!==concept.id);init.integrated.push(concept);const oldN=r.players.get(r.turnOrder[prevNarrIdx]);if(oldN&&r.deck.length>0)oldN.hand.push(r.deck.shift());addLog(r,'interrupt',initId,'✅ Interrupción confirmada');broadcastGS(io,rc);resetInact(r,io,rc);return;}
    r.storyBeforeVote=r.story;
    const vote={id:uuid(),type,initiatorId:initId,concept,fragment,justification:justification||'',votes:new Map(),eligible,timeLeft:r.config.voteTime,round:1,timer:null,prevNarrIdx,provisionalIg:provIg};r.currentVote=vote;
    vote.timer=setInterval(()=>{vote.timeLeft--;io.to(rc).emit('vote-tick',{timeLeft:vote.timeLeft});if(vote.timeLeft<=0){clearInterval(vote.timer);resolveVote(r,io,rc);}},1000);broadcastGS(io,rc);resetInact(r,io,rc);return;
  }
  if(eligible.length===0){r.currentVote={type,initiatorId:initId,concept,fragment,justification,votes:new Map(),eligible:[],round:1,timer:null};applyResult(r,io,rc,true);return;}
  r.storyBeforeVote=r.story;
  const vote={id:uuid(),type,initiatorId:initId,concept,fragment,justification:justification||'',votes:new Map(),eligible,timeLeft:r.config.voteTime,round:1,timer:null};r.currentVote=vote;
  vote.timer=setInterval(()=>{vote.timeLeft--;io.to(rc).emit('vote-tick',{timeLeft:vote.timeLeft});if(vote.timeLeft<=0){clearInterval(vote.timer);resolveVote(r,io,rc);}},1000);
  addLog(r,'vote',initId,`⚖️ ${init.name}: ${type==='ending'?'Final':cardLabel(concept)}`);broadcastGS(io,rc);resetInact(r,io,rc);
}
function castV(r,io,rc,pid,approve){const v=r.currentVote;if(!v||!v.eligible.includes(pid)||v.votes.has(pid))return;v.votes.set(pid,approve);
  // Early resolve if majority veto reached OR all have voted
  const no=[...v.votes.values()].filter(x=>!x).length;
  if(no>v.eligible.length/2||v.votes.size>=v.eligible.length){clearInterval(v.timer);resolveVote(r,io,rc);}}
function resolveVote(r,io,rc){const v=r.currentVote;if(!v)return;const totalEligible=v.eligible.length;const no=[...v.votes.values()].filter(x=>!x).length;
  // Silence = consent: need strict majority of ALL eligible to reject
  if(no>totalEligible/2)applyResult(r,io,rc,false);
  else applyResult(r,io,rc,true);}
function applyResult(r,io,rc,approved){
  const v=r.currentVote;if(!v)return;if(v.timer)clearInterval(v.timer);r.currentVote=null;const init=r.players.get(v.initiatorId);
  // Build voter breakdown
  const voters=[];if(v.votes)for(const[pid,app]of v.votes){const pn=r.players.get(pid)?.name||'?';const reason=v.reasons?.get(pid)||'';voters.push({name:pn,approved:app,reason});}
  const vrData={type:v.type,approved,initiatorId:v.initiatorId,initiatorName:init.name,conceptName:v.concept?.name,conceptType:v.concept?.type,conceptImg:v.concept?.img,fragment:v.fragment,voters};
  if(v.type==='integrate'){
    if(approved){init.hand=init.hand.filter(c=>c.id!==v.concept.id);init.integrated.push(v.concept);r.integrations.push({conceptName:v.concept.name,conceptType:v.concept.type,isInterruption:v.concept.isInterruption,fragment:v.fragment.text,start:v.fragment.start,end:v.fragment.end,playerId:init.id,playerName:init.name});addLog(r,'integrate',init.id,`✅ ${cardLabel(v.concept)} jugada`);sessionLog(rc,'info','vote-resolved',{type:v.type,approved,initiator:init.name,card:v.concept?.name,voters:voters.map(vv=>({name:vv.name,approved:vv.approved}))});io.to(rc).emit('vote-resolved',vrData);broadcastGS(io,rc);startInterruptWindow(r,io,rc,v.concept.type,v.concept);resetInact(r,io,rc);resetCardPlay(r,io,rc);return;}
    else{const rewindTo=r.storyBeforeVote||r.story;r.story=rewindTo;io.to(rc).emit('story-rewind',{text:rewindTo});addLog(r,'integrate',init.id,`❌ ${cardLabel(v.concept)} vetada`);resetInact(r,io,rc);resetCardPlay(r,io,rc);}
  }else if(v.type==='interrupt'){
    if(approved){if(v.provisionalIg)v.provisionalIg._provisional=false;init.hand=init.hand.filter(c=>c.id!==v.concept.id);init.integrated.push(v.concept);if(v.prevNarrIdx!=null){const oldN=r.players.get(r.turnOrder[v.prevNarrIdx]);if(oldN&&r.deck.length>0)oldN.hand.push(r.deck.shift());}addLog(r,'interrupt',init.id,`✅ Interrupción confirmada — ${cardLabel(v.concept)}`);io.to(rc).emit('interrupt-alert',{playerName:init.name,conceptName:v.concept.name,conceptType:v.concept.type,isInterruption:v.concept.isInterruption});}
    else{r.narratorIndex=v.prevNarrIdx!=null?v.prevNarrIdx:r.narratorIndex;r.integrations=r.integrations.filter(ig=>ig!==v.provisionalIg);r.vetoVotes=new Map();init.hand=init.hand.filter(c=>c.id!==v.concept.id);r.discardPile.push(v.concept);if(r.deck.length>0)init.hand.push(r.deck.shift());const rewindTo=r.storyBeforeVote||r.story;r.story=rewindTo;io.to(rc).emit('story-rewind',{text:rewindTo});const nn=getNarr(r);addLog(r,'interrupt',init.id,`❌ ${init.name}: interrupción rechazada — pierde ${cardLabel(v.concept)} +1 carta`);io.to(rc).emit('narrator-changed',{narratorId:nn.id,narratorName:nn.name});}
    resetInact(r,io,rc);resetCardPlay(r,io,rc);
  }else if(v.type==='ending'){
    if(approved){r.phase='finished';r.winnerId=v.initiatorId;addLog(r,'ending',init.id,`🏆 ¡${init.name} gana!`);clearInact(r);clearCardPlay(r);}
    else{
      // Official rules: discard failed ending, draw NEW ending + 1 narrative card
      init.hand=init.hand.filter(c=>c.id!==v.concept.id);r.discardPile.push(v.concept);
      if(r.endingsDeck.length>0)init.hand.push(r.endingsDeck.shift());
      if(r.deck.length>0)init.hand.push(r.deck.shift());
      const n=advanceNarr(r);addLog(r,'ending',init.id,'❌ Final rechazado — nuevo final + 1 carta');if(n){addLog(r,'narrator',n.id,`✍️ ${n.name} narra`);io.to(rc).emit('narrator-changed',{narratorId:n.id,narratorName:n.name});}resetInact(r,io,rc);resetCardPlay(r,io,rc);}
  }
  sessionLog(rc,'info','vote-resolved',{type:v.type,approved,initiator:init.name,card:v.concept?.name,voters:voters.map(vv=>({name:vv.name,approved:vv.approved}))});
  io.to(rc).emit('vote-resolved',vrData);broadcastGS(io,rc);
}

function pubPlayers(r){return r.turnOrder.map(pid=>{const p=r.players.get(pid);return{id:p.id,name:p.name,handCount:p.hand.length,integratedCount:p.integrated.length,integrated:p.integrated.map(c=>({name:c.name,type:c.type,isInterruption:c.isInterruption,isEnding:c.isEnding,img:c.img})),connected:p.connected,isHost:p.isHost};});}
function pubState(r){const sp=computeSealedPos(r);const ef=effectiveFrozen(r);return{code:r.code,phase:r.phase,players:pubPlayers(r),spectators:[...r.spectators.values()].map(s=>({id:s.id,name:s.name})),narratorId:getNarrId(r),narratorName:getNarr(r)?.name,story:r.story,integrations:r.integrations,sealedPos:sp,frozenPos:ef,turnOrder:r.turnOrder,actionLog:r.actionLog.slice(-30),currentVote:r.currentVote?{id:r.currentVote.id,type:r.currentVote.type,initiatorId:r.currentVote.initiatorId,initiatorName:r.players.get(r.currentVote.initiatorId)?.name,concept:r.currentVote.concept?{name:r.currentVote.concept.name,type:r.currentVote.concept.type,isInterruption:r.currentVote.concept.isInterruption,isEnding:r.currentVote.concept.isEnding,img:r.currentVote.concept.img}:null,fragment:r.currentVote.fragment,justification:r.currentVote.justification||'',timeLeft:r.currentVote.timeLeft,round:r.currentVote.round,eligible:r.currentVote.eligible,votedPlayerIds:[...r.currentVote.votes.keys()],voteDetails:[...r.currentVote.votes.entries()].map(([pid,app])=>({id:pid,name:r.players.get(pid)?.name||'?',approved:app,reason:r.currentVote.reasons?.get(pid)||''}))}:null,interruptWindow:r.interruptWindow?{cardType:r.interruptWindow.cardType,conceptName:r.interruptWindow.conceptName,timeLeft:r.interruptWindow.timeLeft}:null,deckSize:r.deck.length,endingsDeckSize:r.endingsDeck.length,vetoVotes:[...r.vetoVotes.keys()],vetoThreshold:Math.ceil((r.players.size-1)/2),winnerId:r.winnerId,inactSec:r.inactSec,cardPlaySec:r.cardPlaySec||0,config:r.config};}
function privState(r,pid){const p=r.players.get(pid);return p?{hand:p.hand,integrated:p.integrated}:null;}
function broadcastGS(io,rc){const r=rooms.get(rc);if(!r)return;const pub=pubState(r);for(const[pid,p]of r.players)if(p.connected&&p.socketId)io.to(p.socketId).emit('game-state',{...pub,private:privState(r,pid),myId:pid});for(const[,s]of r.spectators)if(s.connected&&s.socketId)io.to(s.socketId).emit('game-state',{...pub,private:null,myId:s.id,isSpectator:true,isHost:!!s.isHost});for(const sid of r.projectors)io.to(sid).emit('game-state',{...pub,private:null,myId:null,isProjector:true});}
function broadcastLobby(io,rc){const r=rooms.get(rc);if(!r)return;const hostSpec=[...r.spectators.values()].filter(s=>s.isHost&&s.connected).map(s=>({id:s.id,name:s.name,isHost:true,connected:s.connected,isSpectatorHost:true}));io.to(rc).emit('lobby-update',{players:[...r.players.values()].filter(p=>p.connected).map(p=>({id:p.id,name:p.name,isHost:p.isHost,connected:p.connected})).concat(hostSpec),code:r.code,config:r.config});}

const app=express(),server=createServer(app);const io=new Server(server,{cors:{origin:'*'},pingInterval:25000,pingTimeout:20000});
// ═══ ROOM CLEANUP — purge stale/finished rooms periodically ═══
const ROOM_TTL_FINISHED=10*60*1000; // 10min after game ends
const ROOM_TTL_LOBBY=30*60*1000;    // 30min idle lobby
const ROOM_TTL_PLAYING=3*60*60*1000;// 3h max game duration
setInterval(()=>{
  const now=Date.now();
  for(const[code,r]of rooms){
    const age=now-(r._createdAt||now);
    const anyConn=[...r.players.values()].some(p=>p.connected)||[...r.spectators.values()].some(s=>s.connected)||r.projectors.size>0;
    let stale=false;
    if(r.phase==='finished'&&age>ROOM_TTL_FINISHED) stale=true;
    if(r.phase==='lobby'&&!anyConn&&age>ROOM_TTL_LOBBY) stale=true;
    if(r.phase==='playing'&&age>ROOM_TTL_PLAYING) stale=true;
    if(!anyConn&&age>5*60*1000) stale=true; // 5min with zero players
    if(stale){
      serverLog('info','room-purged',{code,phase:r.phase,age:Math.round(age/1000)+'s',connected:anyConn});
      clearInact(r);clearCardPlay(r);
      if(r.currentVote?.timer)clearInterval(r.currentVote.timer);
      if(r.interruptWindow?.timer)clearInterval(r.interruptWindow.timer);
      if(r._destroyTimer)clearTimeout(r._destroyTimer);
      closeSession(code);rooms.delete(code);
    }
  }
},60*1000); // check every minute
app.use(express.static(path.join(__dirname,'../client/dist')));
app.get('/api/logs',(req,res)=>{res.json(listLogs());});
app.get('/api/logs/:roomCode',(req,res)=>{const data=getLog(req.params.roomCode.toUpperCase());if(!data)return res.status(404).json({error:'Log no encontrado'});res.type('text/plain').send(data);});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../client/dist/index.html')));
const stp=new Map();

io.on('connection',(socket)=>{
  socket.on('list-rooms',(_,cb)=>{
    const list=[];
    for(const[code,r]of rooms){
      const connPlayers=[...r.players.values()].filter(p=>p.connected);
      const connSpecs=[...r.spectators.values()].filter(s=>s.connected);
      // Hide empty rooms and finished games from browser
      if(connPlayers.length===0&&connSpecs.length===0&&r.projectors.size===0)continue;
      if(r.phase==='finished')continue;
      const host=[...r.players.values()].find(p=>p.isHost)||[...r.spectators.values()].find(s=>s.isHost);
      list.push({code,phase:r.phase,playerCount:connPlayers.length,spectatorCount:connSpecs.filter(s=>!s.isHost).length,hostName:host?.name||'?',playerNames:connPlayers.map(p=>p.name),createdAt:r._createdAt||Date.now()});
    }
    if(typeof cb==='function')cb(list);
  });
  socket.on('create-room',({playerName,hostOnly},cb)=>{if(!playerName?.trim())return cb({error:'Nombre requerido'});const{code,playerId,isSpectator}=createRoom(socket.id,playerName.trim(),hostOnly);socket.join(code);stp.set(socket.id,{roomCode:code,playerId,isSpectator:!!isSpectator});createSession(code);sessionLog(code,'info','room-created',{player:playerName.trim(),hostOnly:!!hostOnly},socket.id);cb({code,playerId,isSpectator:!!isSpectator});broadcastLobby(io,code);});
  socket.on('join-room',({roomCode,playerName},cb)=>{if(!playerName?.trim())return cb({error:'Nombre requerido'});const code=(roomCode||'').trim().toUpperCase();const r2=joinRoom(code,socket.id,playerName.trim());if(r2.error)return cb({error:r2.error});const rm=rooms.get(code);if(rm?._destroyTimer){clearTimeout(rm._destroyTimer);rm._destroyTimer=null;}
    // Kick old socket if reconnecting (handles iPad sleep/wake, tab refresh)
    if(r2.oldSocketId){const oldSock=io.sockets.sockets.get(r2.oldSocketId);if(oldSock){oldSock.leave(code);oldSock.emit('kicked','Reconexión desde otro dispositivo');}stp.delete(r2.oldSocketId);}
    socket.join(code);stp.set(socket.id,{roomCode:code,playerId:r2.playerId,isSpectator:r2.isSpectator});sessionLog(code,'info','player-joined',{player:playerName.trim(),reconnected:!!r2.reconnected,isSpectator:!!r2.isSpectator},socket.id);cb({code,playerId:r2.playerId,isSpectator:r2.isSpectator,reconnected:r2.reconnected});if(r2.reconnected){addLog(rm,'system',r2.playerId,`🔄 ${playerName.trim()} se ha reconectado`);broadcastGS(io,code);}else if(r2.isSpectator)broadcastGS(io,code);else broadcastLobby(io,code);});
  socket.on('join-projector',({roomCode},cb)=>{const code=(roomCode||'').trim().toUpperCase();const r=rooms.get(code);if(!r)return cb({error:'No encontrada'});socket.join(code);r.projectors.add(socket.id);stp.set(socket.id,{roomCode:code,playerId:null,isProjector:true});cb({code});if(r.phase!=='lobby')broadcastGS(io,code);else broadcastLobby(io,code);});
  socket.on('update-config',({config},cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r||r.phase!=='lobby')return cb?.({error:'No'});const isPlayerHost=r.players.get(i.playerId)?.isHost;const isSpecHost=isHostSpectator(r,i.playerId);if(!isPlayerHost&&!isSpecHost)return cb?.({error:'No'});if(config.handSize!=null){if(config.handSize==='auto')r.config.handSize='auto';else r.config.handSize=Math.max(3,Math.min(10,config.handSize));}if(config.inactLimit!=null)r.config.inactLimit=Math.max(10,Math.min(120,config.inactLimit));if(config.voteTime!=null)r.config.voteTime=Math.max(10,Math.min(60,config.voteTime));if(config.interruptWindowTime!=null)r.config.interruptWindowTime=Math.max(4,Math.min(15,config.interruptWindowTime));if(config.cardPlayLimit!=null)r.config.cardPlayLimit=Math.max(30,Math.min(300,config.cardPlayLimit));cb?.({success:true});broadcastLobby(io,i.roomCode);});
  socket.on('start-game',(_,cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r)return cb?.({error:'?'});const isPlayerHost=r.players.get(i.playerId)?.isHost;const isSpecHost=isHostSpectator(r,i.playerId);if(!isPlayerHost&&!isSpecHost)return cb?.({error:'Solo host'});const res=startGame(r);if(res.error)return cb?.({error:res.error});sessionLog(i.roomCode,'info','game-started',{playerCount:r.players.size,handSize:r.config._effectiveHandSize,turnOrder:r.turnOrder.map(pid=>r.players.get(pid)?.name)});cb?.({success:true});broadcastGS(io,i.roomCode);resetInact(r,io,i.roomCode);resetCardPlay(r,io,i.roomCode);});
  socket.on('story-update',({text})=>{const i=stp.get(socket.id);if(!i)return;const r=rooms.get(i.roomCode);if(!r||r.phase!=='playing'||getNarrId(r)!==i.playerId)return;if(typeof text!=='string'||text.length>50000)return;const frozen=effectiveFrozen(r);const prefix=r.story.substring(0,frozen);if(text.length<frozen||text.substring(0,frozen)!==prefix)return;r.story=text;r.inactSec=0;sessionLog(i.roomCode,'debug','story-update',{len:text.length},socket.id);socket.to(i.roomCode).emit('story-updated',{text});});
  socket.on('integrate-concept',({conceptId,fragment,justification},cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r||r.phase!=='playing'||getNarrId(r)!==i.playerId)return cb?.({error:'No'});if(r.currentVote)return cb?.({error:'Voto en curso'});if(r.interruptWindow)return cb?.({error:'Ventana de interrupción activa'});const p=r.players.get(i.playerId);const c=p.hand.find(x=>x.id===conceptId);if(!c)return cb?.({error:'Carta no encontrada'});sessionLog(i.roomCode,'info','integrate-concept',{player:p.name,card:c.name,type:c.type,isEnding:!!c.isEnding,fragment:fragment?.text?.substring(0,60)},socket.id);clearCardPlay(r);startVote(r,io,i.roomCode,c.isEnding?'ending':'integrate',i.playerId,c,fragment,justification);cb?.({success:true});});
  socket.on('interrupt',({conceptId,fragment,justification},cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r||r.phase!=='playing'||getNarrId(r)===i.playerId)return cb?.({error:'No'});if(r.currentVote)return cb?.({error:'Voto en curso'});if(r.interruptWindow)return cb?.({error:'Ventana de interrupción activa'});const p=r.players.get(i.playerId);const c=p.hand.find(x=>x.id===conceptId);if(!c)return cb?.({error:'Carta no encontrada'});if(c.isEnding)return cb?.({error:'Final no interrumpe'});sessionLog(i.roomCode,'info','interrupt',{player:p.name,card:c.name,type:c.type,fragment:fragment?.text?.substring(0,60)},socket.id);clearCardPlay(r);startVote(r,io,i.roomCode,'interrupt',i.playerId,c,fragment,justification);cb?.({success:true});});
  // ═══ GOLDEN INTERRUPT — instant, no vote ═══
  socket.on('use-interrupt-window',({conceptId},cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r||!r.interruptWindow)return cb?.({error:'Sin ventana'});if(getNarrId(r)===i.playerId)return cb?.({error:'Eres narrador'});const p=r.players.get(i.playerId);if(!p)return cb?.({error:'?'});const c=p.hand.find(x=>x.id===conceptId);if(!c||!c.isInterruption||c.type!==r.interruptWindow.cardType)return cb?.({error:'Carta incompatible'});sessionLog(i.roomCode,'info','golden-interrupt',{player:p.name,card:c.name,type:c.type},socket.id);clearInterval(r.interruptWindow.timer);r.interruptWindow=null;const prevNarrIdx=r.narratorIndex;r.narratorIndex=r.turnOrder.indexOf(i.playerId);r.vetoVotes=new Map();const lastIg=r.integrations[r.integrations.length-1];p.hand=p.hand.filter(x=>x.id!==conceptId);p.integrated.push(c);r.integrations.push({conceptName:c.name,conceptType:c.type,isInterruption:true,fragment:lastIg?.fragment||'',start:lastIg?.start||0,end:lastIg?.end||0,playerId:p.id,playerName:p.name});const oldN=r.players.get(r.turnOrder[prevNarrIdx]);if(oldN&&r.deck.length>0)oldN.hand.push(r.deck.shift());addLog(r,'interrupt',p.id,`⚡ ${p.name} INTERRUMPE (⚜ dorada) — ${cardLabel(c)}`);io.to(i.roomCode).emit('narrator-changed',{narratorId:p.id,narratorName:p.name});io.to(i.roomCode).emit('interrupt-alert',{playerName:p.name,conceptName:c.name,conceptType:c.type,isInterruption:true});cb?.({success:true});broadcastGS(io,i.roomCode);resetInact(r,io,i.roomCode);resetCardPlay(r,io,i.roomCode);});
  socket.on('cast-vote',({approve,reason})=>{const i=stp.get(socket.id);if(!i)return;const r=rooms.get(i.roomCode);if(!r||!r.currentVote)return;
    const v=r.currentVote;if(!v.eligible.includes(i.playerId)||v.votes.has(i.playerId))return;
    v.votes.set(i.playerId,approve);sessionLog(i.roomCode,'info','cast-vote',{player:r.players.get(i.playerId)?.name,approve,reason:reason?.trim()||''},socket.id);
    if(!v.reasons)v.reasons=new Map();if(reason?.trim())v.reasons.set(i.playerId,reason.trim());
    const pName=r.players.get(i.playerId)?.name||'?';
    if(!approve)addLog(r,'veto',i.playerId,`✗ ${pName} veta${reason?.trim()?' — «'+reason.trim()+'»':''}`);
    // Early resolve if majority veto OR all voted
    const no=[...v.votes.values()].filter(x=>!x).length;
    if(no>v.eligible.length/2||v.votes.size>=v.eligible.length){clearInterval(v.timer);resolveVote(r,io,i.roomCode);}
    broadcastGS(io,i.roomCode);});
  socket.on('pass-turn',({discardConceptId},cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r||r.phase!=='playing'||getNarrId(r)!==i.playerId)return cb?.({error:'No'});if(r.interruptWindow)closeInterruptWindow(r,io,i.roomCode);const p=r.players.get(i.playerId);sessionLog(i.roomCode,'info','pass-turn',{player:p.name,discardConceptId:discardConceptId||null},socket.id);if(discardConceptId){const idx=p.hand.findIndex(c=>c.id===discardConceptId&&!c.isEnding);if(idx>=0){const d=p.hand.splice(idx,1)[0];r.discardPile.push(d);if(r.deck.length>0)p.hand.push(r.deck.shift());addLog(r,'pass',p.id,`🔄 ${p.name} descarta ${cardLabel(d)}, roba 1`);}}else{if(r.deck.length>0){p.hand.push(r.deck.shift());addLog(r,'pass',p.id,`🔄 ${p.name} no tiene cartas narrativas — roba 1`);}else addLog(r,'pass',p.id,`${p.name} pasa`);}const n=advanceNarr(r);if(n){addLog(r,'narrator',n.id,`✍️ ${n.name} narra`);io.to(i.roomCode).emit('narrator-changed',{narratorId:n.id,narratorName:n.name});}cb?.({success:true});broadcastGS(io,i.roomCode);resetInact(r,io,i.roomCode);resetCardPlay(r,io,i.roomCode);});
  socket.on('veto-narrator',({reason},cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r||r.phase!=='playing'||getNarrId(r)===i.playerId||r.currentVote)return cb?.({error:'No'});r.vetoVotes.set(i.playerId,true);const p=r.players.get(i.playerId);sessionLog(i.roomCode,'info','veto-narrator',{player:p.name,reason:reason?.trim()||'',count:r.vetoVotes.size,threshold:Math.ceil((r.players.size-1)/2)},socket.id);const reasonStr=reason?.trim()?` — «${reason.trim()}»`:'';addLog(r,'system',i.playerId,`🚫 ${p.name} veta${reasonStr} (${r.vetoVotes.size}/${Math.ceil((r.players.size-1)/2)})`);if(checkVeto(r)){if(r.interruptWindow)closeInterruptWindow(r,io,i.roomCode);const narr=getNarr(r);if(narr){if(r.deck.length>0)narr.hand.push(r.deck.shift());addLog(r,'system',null,`🚫 Veto! ${narr.name} pierde turno +1 carta`);}const n=advanceNarr(r);if(n){addLog(r,'narrator',n.id,`✍️ ${n.name} narra`);io.to(i.roomCode).emit('narrator-changed',{narratorId:n.id,narratorName:n.name});}resetInact(r,io,i.roomCode);resetCardPlay(r,io,i.roomCode);}cb?.({success:true});broadcastGS(io,i.roomCode);});
  socket.on('restart-game',(_,cb)=>{const i=stp.get(socket.id);if(!i)return cb?.({error:'?'});const r=rooms.get(i.roomCode);if(!r)return cb?.({error:'?'});const isPlayerHost=r.players.get(i.playerId)?.isHost;const isSpecHost=isHostSpectator(r,i.playerId);if(!isPlayerHost&&!isSpecHost)return cb?.({error:'No'});r.phase='lobby';clearInact(r);clearCardPlay(r);if(r.currentVote?.timer)clearInterval(r.currentVote.timer);r.currentVote=null;if(r.interruptWindow?.timer)clearInterval(r.interruptWindow.timer);r.interruptWindow=null;r.story='';r.integrations=[];r.actionLog=[];r.winnerId=null;r.vetoVotes=new Map();r.turnOrder=[];r.narratorIndex=0;r.deck=[];r.endingsDeck=[];r.discardPile=[];r.storyBeforeVote=undefined;const hostSpecs=[...r.spectators.entries()].filter(([,s])=>s.isHost);r.spectators=new Map(hostSpecs);for(const p of r.players.values()){p.hand=[];p.integrated=[];}sessionLog(i.roomCode,'info','game-restarted',{});cb?.({success:true});broadcastLobby(io,i.roomCode);});
  socket.on('leave-room',()=>{const i=stp.get(socket.id);if(!i)return;const r=rooms.get(i.roomCode);if(!r)return;
    const leaveName=r.players.get(i.playerId)?.name||r.spectators.get(i.playerId)?.name||'?';
    sessionLog(i.roomCode,'info','leave-room',{player:leaveName,wasNarrator:getNarrId(r)===i.playerId},socket.id);
    // Leave socket room FIRST so broadcasts don't reach this client
    socket.leave(i.roomCode);stp.delete(socket.id);
    if(i.isProjector){r.projectors.delete(socket.id);}
    else if(i.isSpectator){const s=r.spectators.get(i.playerId);if(s)s.connected=false;}
    else{const p=r.players.get(i.playerId);if(p){p.connected=false;
      if(r.phase==='lobby'){r.players.delete(i.playerId);if(p.isHost&&r.players.size>0)r.players.values().next().value.isHost=true;broadcastLobby(io,i.roomCode);}
      else{addLog(r,'system',i.playerId,`◄ ${p.name} ha salido`);if(getNarrId(r)===i.playerId&&r.phase==='playing'){if(r.interruptWindow)closeInterruptWindow(r,io,i.roomCode);advanceNarr(r);resetInact(r,io,i.roomCode);resetCardPlay(r,io,i.roomCode);}broadcastGS(io,i.roomCode);}}}
    // Cleanup room if everyone left
    const anyLeft=[...r.players.values()].some(p=>p.connected)||[...r.spectators.values()].some(s=>s.connected)||r.projectors.size>0;
    if(!anyLeft&&!r._destroyTimer){const grace=r.phase==='lobby'?30*1000:5*60*1000;r._destroyTimer=setTimeout(()=>{const r2=rooms.get(i.roomCode);if(!r2)return;const still=[...r2.players.values()].some(p=>p.connected)||[...r2.spectators.values()].some(s=>s.connected)||r2.projectors.size>0;if(!still){clearInact(r2);clearCardPlay(r2);if(r2.currentVote?.timer)clearInterval(r2.currentVote.timer);if(r2.interruptWindow?.timer)clearInterval(r2.interruptWindow.timer);closeSession(i.roomCode);rooms.delete(i.roomCode);}else r2._destroyTimer=null;},grace);}
    else if(anyLeft&&r._destroyTimer){clearTimeout(r._destroyTimer);r._destroyTimer=null;}});
  socket.on('reclaim-seat',({roomCode,playerId},cb)=>{const code=(roomCode||'').trim().toUpperCase();const r=rooms.get(code);if(!r)return cb?.({error:'Sala no encontrada'});const i=stp.get(socket.id);if(!i||!i.isSpectator)return cb?.({error:'No eres espectador'});const p=r.players.get(playerId);if(!p)return cb?.({error:'Jugador no encontrado'});if(p.connected)return cb?.({error:'Ese jugador está conectado'});
    // Transfer seat: read spectator name BEFORE deleting, then claim player seat
    const specName=r.spectators.get(i.playerId)?.name;r.spectators.delete(i.playerId);
    const oldSid=p.socketId;p.socketId=socket.id;p.connected=true;
    stp.set(socket.id,{roomCode:code,playerId,isSpectator:false});
    addLog(r,'system',playerId,`🔄 ${p.name} ha reclamado su puesto`);
    cb?.({success:true,playerId});broadcastGS(io,code);});
  socket.on('reconnect-player',({roomCode,playerId},cb)=>{const code=(roomCode||'').trim().toUpperCase();const r=rooms.get(code);if(!r)return cb?.({error:'No'});const p=r.players.get(playerId)||r.spectators.get(playerId);if(!p)return cb?.({error:'No'});p.socketId=socket.id;p.connected=true;socket.join(code);stp.set(socket.id,{roomCode:code,playerId,isSpectator:r.spectators.has(playerId)});if(r._destroyTimer){clearTimeout(r._destroyTimer);r._destroyTimer=null;}addLog(r,'system',playerId,`🔄 ${p.name} se ha reconectado`);cb?.({success:true});if(r.phase==='lobby')broadcastLobby(io,code);else broadcastGS(io,code);});
  socket.on('disconnect',()=>{const i=stp.get(socket.id);if(!i)return;const r=rooms.get(i.roomCode);if(!r)return;const dcName=r.players.get(i.playerId)?.name||r.spectators.get(i.playerId)?.name||'projector';sessionLog(i.roomCode,'warn','disconnect',{player:dcName,wasNarrator:getNarrId(r)===i.playerId},socket.id);if(i.isProjector)r.projectors.delete(socket.id);else if(i.isSpectator){const s=r.spectators.get(i.playerId);if(s)s.connected=false;}else{const p=r.players.get(i.playerId);if(p){p.connected=false;if(r.phase==='lobby'){
        // Don't delete player — could be a brief network blip; just mark disconnected
        broadcastLobby(io,i.roomCode);
      }else{if(getNarrId(r)===i.playerId&&r.phase==='playing'){if(r.interruptWindow)closeInterruptWindow(r,io,i.roomCode);advanceNarr(r);resetInact(r,io,i.roomCode);resetCardPlay(r,io,i.roomCode);}broadcastGS(io,i.roomCode);}}}stp.delete(socket.id);
    // Delete room if ALL players are gone — with grace period
    const anyConnected=[...r.players.values()].some(p=>p.connected)||[...r.spectators.values()].some(s=>s.connected)||r.projectors.size>0;
    if(!anyConnected&&!r._destroyTimer){
      const grace=r.phase==='lobby'?30*1000:5*60*1000;
      r._destroyTimer=setTimeout(()=>{const r2=rooms.get(i.roomCode);if(!r2)return;const still=[...r2.players.values()].some(p=>p.connected)||[...r2.spectators.values()].some(s=>s.connected)||r2.projectors.size>0;if(!still){clearInact(r2);clearCardPlay(r2);if(r2.currentVote?.timer)clearInterval(r2.currentVote.timer);if(r2.interruptWindow?.timer)clearInterval(r2.interruptWindow.timer);closeSession(i.roomCode);rooms.delete(i.roomCode);}else r2._destroyTimer=null;},grace);
    }else if(anyConnected&&r._destroyTimer){clearTimeout(r._destroyTimer);r._destroyTimer=null;}});
});

const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`⚜ Once Upon a Time — puerto ${PORT}`));
