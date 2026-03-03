// ═══ LLM PROVIDER ABSTRACTION — streaming commentary ═══
// Supports: Groq, Mistral, OpenAI, Gemini (all via native fetch)

const PROVIDERS={
  groq:{name:'Groq',baseUrl:'https://api.groq.com/openai/v1/chat/completions',models:['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768'],keyUrl:'https://console.groq.com/keys',format:'openai'},
  mistral:{name:'Mistral',baseUrl:'https://api.mistral.ai/v1/chat/completions',models:['mistral-small-latest','mistral-large-latest'],keyUrl:'https://console.mistral.ai/api-keys',format:'openai'},
  openai:{name:'OpenAI',baseUrl:'https://api.openai.com/v1/chat/completions',models:['gpt-4o-mini','gpt-4o'],keyUrl:'https://platform.openai.com/api-keys',format:'openai'},
  gemini:{name:'Gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta',models:['gemini-2.0-flash','gemini-1.5-pro'],keyUrl:'https://aistudio.google.com/apikey',format:'gemini'},
};

const SYSTEM_PROMPT=`Eres "El Gato Crítico", un ensayista y analista narrativo que comenta historias colaborativas en tiempo real. Tu BASE es el ANÁLISIS SESUDO: interpretas el sentido profundo y subtextual de cada elección narrativa. Hablas en español.

Tu método (por orden de prioridad):
1. ANÁLISIS PROFUNDO — Tu núcleo. Buscas siempre el SUBTEXTO, el sentido oculto, la lectura simbólica. "Al introducir el castillo, el narrador ha desplazado el locus de poder hacia un espacio cerrado... la historia pide a gritos un conflicto de autoridad". "Ese río no es solo un río: es la frontera entre lo conocido y el abismo narrativo que se abre". Interpretas las ELECCIONES de los jugadores como decisiones con peso narratológico real.
2. CELEBRAR LA ORIGINALIDAD — Cuando un jugador hace algo inesperado, fresco o arriesgado, lo celebras con entusiasmo genuino: "¡Magnífico! Nadie esperaba que el panadero fuera el verdadero antagonista... una subversión del arquetipo que habría hecho sonreír a Propp"
3. CONDENAR LOS CLICHÉS — Cuando detectas un tópico manido, lo señalas con sarcasmo elegante: "Ah, el héroe elegido por una profecía... porque el libre albedrío está sobrevalorado desde la Grecia clásica". No seas cruel, pero sé firme e incisivo.

Tu estilo:
- Jerga narratológica real: "diegético", "analepsis", "focalización interna", "arco del héroe", "in medias res", "Chekhov's gun"
- Mezclas alta cultura con cultura pop: Dostoievski Y Dragon Ball, Barthes Y Shyamalan, Borges Y Dark
- Referencias a cultura popular con naturalidad: "Más giros que Shyamalan", "Plot twist digno de Dark", "Momento Gandalf: NO PASARÁS"
- NUNCA inventes citas falsas de escritores reales
- Exclamaciones deportivas cuando la historia lo merece: "¡GOLAZO NARRATIVO!"
- Notas incoherencias con humor: "Espera... ¿no estábamos en un bosque? Me he perdido el teletransporte"
- Máximo 2-3 frases. Sé DENSO en significado pero conciso en palabras.
- NUNCA uses emojis ni markdown. Solo texto plano con signos de exclamación y puntos suspensivos.`;

function buildMessages(event,context){
  const msgs=[{role:'system',content:SYSTEM_PROMPT}];
  let userMsg='';
  switch(event.type){
    case'integrate':
      userMsg=`JUGADA: ${event.playerName} ha integrado la carta "${event.cardName}" (${event.cardType}) en la historia.\nFRAGMENTO VINCULADO: "${event.fragment}"\nHISTORIA RECIENTE (últimas líneas): "${context.recentStory}"`;
      break;
    case'interrupt':
      userMsg=`INTERRUPCIÓN: ${event.playerName} ha interrumpido al narrador ${event.prevNarrator} con la carta "${event.cardName}" (${event.cardType}).\nFRAGMENTO: "${event.fragment}"\nHISTORIA RECIENTE: "${context.recentStory}"`;
      break;
    case'interrupt-rejected':
      userMsg=`INTERRUPCIÓN RECHAZADA: ${event.playerName} intentó interrumpir con "${event.cardName}" pero fue vetado por los demás jugadores.\nHISTORIA RECIENTE: "${context.recentStory}"`;
      break;
    case'veto':
      userMsg=`VETO AL NARRADOR: Los jugadores han vetado al narrador ${event.narratorName}. El turno pasa al siguiente.\nMOTIVO: ${event.reason||'sin motivo declarado'}\nHISTORIA RECIENTE: "${context.recentStory}"`;
      break;
    case'narrating':
      userMsg=`NARRACIÓN EN CURSO: ${event.playerName} está escribiendo. Comenta el desarrollo narrativo, la dirección de la historia, la calidad literaria o cualquier cosa que te llame la atención como crítico.\nHISTORIA RECIENTE: "${context.recentStory}"`;
      break;
    case'pass':
      userMsg=`PASE DE TURNO: ${event.playerName} ha pasado turno y descartado una carta. No pudo o no quiso seguir narrando.\nHISTORIA RECIENTE: "${context.recentStory}"`;
      break;
    case'ending-attempt':
      userMsg=`INTENTO DE FINAL: ${event.playerName} intenta terminar la historia con: "${event.endingText}"\nHISTORIA COMPLETA: "${context.recentStory}"`;
      break;
    case'victory':
      userMsg=`VICTORIA: ${event.playerName} ha ganado la partida. Su final fue aprobado.\nFINAL: "${event.endingText}"\nHISTORIA COMPLETA: "${context.fullStory}"\nRESUMEN: La historia fue narrada por ${context.playerCount} jugadores en ${context.totalCards} jugadas.`;
      break;
    default:
      userMsg=`EVENTO: ${event.description||'Algo ha ocurrido en la partida.'}\nHISTORIA RECIENTE: "${context.recentStory}"`;
  }
  msgs.push({role:'user',content:userMsg});
  return msgs;
}

// ═══ STREAMING — OpenAI-compatible format ═══
async function streamOpenAI(url,apiKey,model,messages,onChunk,onDone,onError){
  try{
    const res=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model,messages,stream:true,max_tokens:150,temperature:0.9})
    });
    if(!res.ok){const err=await res.text().catch(()=>'');onError(`API ${res.status}: ${err.substring(0,200)}`);return;}
    const reader=res.body.getReader();const decoder=new TextDecoder();let buf='';let full='';
    while(true){
      const{done,value}=await reader.read();
      if(done)break;
      buf+=decoder.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop()||'';
      for(const line of lines){
        const trimmed=line.trim();
        if(!trimmed||trimmed==='data: [DONE]')continue;
        if(!trimmed.startsWith('data: '))continue;
        try{
          const json=JSON.parse(trimmed.slice(6));
          const delta=json.choices?.[0]?.delta?.content;
          if(delta){full+=delta;onChunk(delta,full);}
        }catch(e){}
      }
    }
    onDone(full);
  }catch(e){onError(e.message||'Error de conexión');}
}

// ═══ STREAMING — Gemini format ═══
async function streamGemini(baseUrl,apiKey,model,messages,onChunk,onDone,onError){
  try{
    // Convert messages to Gemini format
    const systemMsg=messages.find(m=>m.role==='system');
    const userMsgs=messages.filter(m=>m.role!=='system');
    const contents=userMsgs.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    const url=`${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    const body={contents,systemInstruction:systemMsg?{parts:[{text:systemMsg.content}]}:undefined,generationConfig:{maxOutputTokens:150,temperature:0.9}};
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok){const err=await res.text().catch(()=>'');onError(`Gemini ${res.status}: ${err.substring(0,200)}`);return;}
    const reader=res.body.getReader();const decoder=new TextDecoder();let buf='';let full='';
    while(true){
      const{done,value}=await reader.read();
      if(done)break;
      buf+=decoder.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop()||'';
      for(const line of lines){
        const trimmed=line.trim();
        if(!trimmed.startsWith('data: '))continue;
        try{
          const json=JSON.parse(trimmed.slice(6));
          const text=json.candidates?.[0]?.content?.parts?.[0]?.text;
          if(text){full+=text;onChunk(text,full);}
        }catch(e){}
      }
    }
    onDone(full);
  }catch(e){onError(e.message||'Error de conexión');}
}

// ═══ MAIN ENTRY — generate commentary ═══
async function generateComment(provider,apiKey,model,event,context,onChunk,onDone,onError){
  const prov=PROVIDERS[provider];
  if(!prov){onError('Proveedor no soportado');return;}
  const messages=buildMessages(event,context);
  if(prov.format==='openai'){
    await streamOpenAI(prov.baseUrl,apiKey,model,messages,onChunk,onDone,onError);
  }else if(prov.format==='gemini'){
    await streamGemini(prov.baseUrl,apiKey,model,messages,onChunk,onDone,onError);
  }
}

module.exports={PROVIDERS,generateComment};
