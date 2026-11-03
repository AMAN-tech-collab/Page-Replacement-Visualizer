const $ = id => document.getElementById(id);
let history = [], visibleStep = 0, playback = null;
const descriptions = {
 FIFO:"FIFO replaces the page that has been in memory the longest. It is simple, but can show Belady’s anomaly.",
 LRU:"LRU replaces the page that has not been used for the longest time in the past.",
 OPT:"Optimal replaces the page whose next use is farthest in the future. It is a theoretical benchmark.",
 LFU:"LFU replaces the least frequently used page. Ties are resolved by oldest load time.",
 MFU:"MFU replaces the most frequently used page. Ties are resolved by oldest load time.",
 CLOCK:"Clock uses a circular pointer and reference bits to give pages a second chance."
};
function readInput(){
 const refs=$("reference").value.trim().split(/[\s,]+/).filter(Boolean).map(Number);
 const count=Number($("frameCount").value);
 if(!refs.length||refs.length>100||refs.some(x=>!Number.isInteger(x)||x<0))throw Error("Use 1–100 non-negative integer page numbers.");
 if(!Number.isInteger(count)||count<1||count>8)throw Error("Frame count must be from 1 to 8.");
 return {refs,count};
}
function simulate(refs,count,algorithm){
 let frames=Array(count).fill(null),loaded=Array(count).fill(0),freq=Array(count).fill(0),last=Array(count).fill(-1),bits=Array(count).fill(0),pointer=0,queue=[],result=[];
 refs.forEach((page,index)=>{
  let slot=frames.indexOf(page),fault=slot===-1,victim=null;
  if(!fault){freq[slot]++;last[slot]=index;bits[slot]=1;}
  else{
   const empty=frames.indexOf(null);
   if(empty!==-1)slot=empty;
   else if(algorithm==="FIFO")slot=queue.shift();
   else if(algorithm==="LRU")slot=last.indexOf(Math.min(...last));
   else if(algorithm==="OPT"){
    let farthest=-1;slot=0;
    frames.forEach((p,j)=>{const next=refs.slice(index+1).indexOf(p);const distance=next===-1?Infinity:next;if(distance>farthest){farthest=distance;slot=j;}});
   }else if(algorithm==="LFU"||algorithm==="MFU"){
    const target=algorithm==="LFU"?Math.min(...freq):Math.max(...freq);
    slot=freq.map((v,j)=>({v,j,t:loaded[j]})).filter(x=>x.v===target).sort((a,b)=>a.t-b.t)[0].j;
   }else{
    let scans=0;
    while(scans<count*2){if(bits[pointer]===0){slot=pointer;pointer=(pointer+1)%count;break;}bits[pointer]=0;pointer=(pointer+1)%count;scans++;}
   }
   victim=frames[slot];frames[slot]=page;loaded[slot]=index;freq[slot]=1;last[slot]=index;bits[slot]=1;
   if(algorithm==="FIFO")queue.push(slot);
  }
  result.push({step:index+1,page,frames:[...frames],fault,victim});
 });
 return result;
}
function stopPlayback(){if(playback){clearInterval(playback);playback=null;}$("play").textContent="▶ Play";}
function render(){
 const visible=history.slice(0,visibleStep),faults=visible.filter(s=>s.fault).length,hits=visible.length-faults;
 $("faults").textContent=visible.length?faults:"—";$("hits").textContent=visible.length?hits:"—";
 $("hitRatio").textContent=visible.length?(hits/visible.length*100).toFixed(1)+"%":"—";
 $("faultRatio").textContent=visible.length?(faults/visible.length*100).toFixed(1)+"%":"—";
 $("progress").textContent=`Step ${visibleStep} / ${history.length}`;$("rowCount").textContent=`${visible.length} rows`;
 $("timeline").innerHTML=history.map((s,i)=>`<div class="frame-card"><div class="frame-title">Step ${s.step}<br>Page ${s.page}</div>${s.frames.map(v=>`<div class="frame-cell ${v===null?"empty":s.fault?"fault":"hit"} ${i===visibleStep-1?"current":""}">${v===null?"—":v}</div>`).join("")}</div>`).join("");
 const current=visible.at(-1);
 $("currentInfo").textContent=current?`Step ${current.step}: page ${current.page} ${current.fault?"caused a page fault":"was a page hit"}.`:"Run a simulation to see frame activity.";
 $("victim").textContent="Victim: "+(current&&current.victim!==null?current.victim:"—");
 $("trace").innerHTML=visible.map(s=>`<tr><td>${s.step}</td><td><b>${s.page}</b></td><td>${s.frames.map(v=>v===null?"—":v).join(" | ")}</td><td><span class="result ${s.fault?"fault":"hit"}">${s.fault?"FAULT":"HIT"}</span></td><td>${s.victim===null?"—":s.victim}</td></tr>`).join("");
 $("previous").disabled=visibleStep===0;$("next").disabled=visibleStep>=history.length;$("showAll").disabled=visibleStep>=history.length;
}
function runSimulation(){
 stopPlayback();
 try{const {refs,count}=readInput();history=simulate(refs,count,$("algorithm").value);visibleStep=history.length?1:0;
 $("notes").textContent=descriptions[$("algorithm").value];$("message").textContent=`Ready: ${refs.length} references · ${count} frames`;render();}
 catch(error){$("message").textContent=error.message;}
}
$("run").addEventListener("click",runSimulation);
$("reset").addEventListener("click",()=>{stopPlayback();history=[];visibleStep=0;render();$("message").textContent="Simulation reset."});
$("next").addEventListener("click",()=>{stopPlayback();visibleStep=Math.min(history.length,visibleStep+1);render()});
$("previous").addEventListener("click",()=>{stopPlayback();visibleStep=Math.max(0,visibleStep-1);render()});
$("showAll").addEventListener("click",()=>{stopPlayback();visibleStep=history.length;render()});
$("play").addEventListener("click",()=>{
 if(!history.length)runSimulation();if(!history.length)return;
 if(playback){stopPlayback();return;}if(visibleStep>=history.length)visibleStep=0;
 $("play").textContent="⏸ Pause";
 playback=setInterval(()=>{visibleStep++;render();if(visibleStep>=history.length)stopPlayback();},Number($("speed").value));
});
$("random").addEventListener("click",()=>{$("reference").value=Array.from({length:15},()=>Math.floor(Math.random()*8)).join(", ");runSimulation()});
$("algorithm").addEventListener("change",()=>{$("notes").textContent=descriptions[$("algorithm").value];if(history.length)runSimulation()});
$("compare").addEventListener("click",()=>{
 try{const {refs,count}=readInput();const names=["FIFO","LRU","OPT","LFU","MFU","CLOCK"];
 $("comparison").innerHTML=names.map(name=>{const rows=simulate(refs,count,name),faults=rows.filter(s=>s.fault).length,hits=refs.length-faults,ratio=hits/refs.length*100;
 return `<article class="algo-card"><strong>${name}</strong><small>${faults} faults · ${hits} hits · ${ratio.toFixed(1)}% hit ratio</small><div class="bar"><span style="width:${ratio}%"></span></div></article>`;}).join("");
 }catch(error){$("message").textContent=error.message;}
});
$("export").addEventListener("click",()=>{
 if(!history.length){$("message").textContent="Run a simulation first.";return;}
 const rows=[["Step","Page","Frames","Result","Replaced"],...history.map(s=>[s.step,s.page,s.frames.join("|"),s.fault?"FAULT":"HIT",s.victim??""])];
 const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");
 const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));link.download="page-replacement-trace.csv";link.click();URL.revokeObjectURL(link.href);
});
$("notes").textContent=descriptions.FIFO;render();
