const fs=require('fs');const path=require('path');
const LOGS_DIR=path.join(__dirname,'logs');
const sessions=new Map(); // roomCode → {file, startTime}

function initLogger(){
  try{fs.mkdirSync(LOGS_DIR,{recursive:true});}catch(e){}
  process.on('uncaughtException',(err)=>{
    const line=JSON.stringify({ts:new Date().toISOString(),level:'error',event:'uncaughtException',data:{message:err.message,stack:err.stack}});
    console.error('[FATAL]',line);
    try{fs.appendFileSync(path.join(LOGS_DIR,'_server.log'),line+'\n');}catch(e2){}
  });
  process.on('unhandledRejection',(err)=>{
    const msg=err instanceof Error?err.message:String(err);
    const line=JSON.stringify({ts:new Date().toISOString(),level:'error',event:'unhandledRejection',data:{message:msg}});
    console.error('[REJECT]',line);
    try{fs.appendFileSync(path.join(LOGS_DIR,'_server.log'),line+'\n');}catch(e2){}
  });
  serverLog('info','logger-init',{logsDir:LOGS_DIR});
}

function serverLog(level,event,data){
  const line=JSON.stringify({ts:new Date().toISOString(),level,event,data});
  if(level==='error')console.error(`[${event}]`,JSON.stringify(data));
  else if(level!=='debug')console.log(`[${event}]`,JSON.stringify(data));
  try{fs.appendFileSync(path.join(LOGS_DIR,'_server.log'),line+'\n');}catch(e){}
}

function createSession(roomCode){
  const ts=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const file=path.join(LOGS_DIR,`${roomCode}_${ts}.jsonl`);
  sessions.set(roomCode,{file,startTime:Date.now()});
  sessionLog(roomCode,'info','session-created',{});
}

function sessionLog(roomCode,level,event,data,sid){
  const s=sessions.get(roomCode);
  if(!s)return;
  const entry={ts:new Date().toISOString(),room:roomCode,level,event};
  if(data&&Object.keys(data).length>0)entry.data=data;
  if(sid)entry.sid=sid;
  const line=JSON.stringify(entry);
  try{fs.appendFileSync(s.file,line+'\n');}catch(e){
    console.error('[LOG_WRITE_ERR]',roomCode,e.message);
  }
}

function getLog(roomCode){
  // Find most recent log file for this room code
  try{
    const files=fs.readdirSync(LOGS_DIR).filter(f=>f.startsWith(roomCode+'_')&&f.endsWith('.jsonl')).sort().reverse();
    if(!files.length)return null;
    return fs.readFileSync(path.join(LOGS_DIR,files[0]),'utf8');
  }catch(e){return null;}
}

function listLogs(){
  try{
    const files=fs.readdirSync(LOGS_DIR).filter(f=>f.endsWith('.jsonl')&&!f.startsWith('_'));
    return files.map(f=>{
      const parts=f.replace('.jsonl','').split('_');
      const code=parts[0];
      const ts=parts.slice(1).join('_');
      let size=0;try{size=fs.statSync(path.join(LOGS_DIR,f)).size;}catch(e){}
      return{file:f,roomCode:code,timestamp:ts,sizeKB:Math.round(size/1024*10)/10};
    });
  }catch(e){return[];}
}

function closeSession(roomCode){
  sessionLog(roomCode,'info','session-closed',{duration:sessions.get(roomCode)?Date.now()-sessions.get(roomCode).startTime:0});
  sessions.delete(roomCode);
}

module.exports={initLogger,serverLog,createSession,sessionLog,getLog,listLogs,closeSession};
