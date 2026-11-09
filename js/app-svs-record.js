// ================= SVS RECORD =================
// President-managed SvS match history, stored independently from SvS Enemies.
(function () {
  'use strict';
  const TABLE = 'svs_records';
  const $ = (id) => document.getElementById(id);
  let rows = [];
  let channel = null;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (v) => Number(v || 0).toLocaleString();
  const signed = (v) => Number(v || 0) > 0 ? '+' + fmt(v) : Number(v || 0) < 0 ? '−' + fmt(Math.abs(v)) : '0';
  const colors = {Conquered:'conquered',Defended:'defended',Repelled:'repelled','Castle lost':'lost'};
  function client(){ return typeof getSupabase === 'function' ? getSupabase() : null; }
  function dateLabel(v){ if(!v) return '—'; return new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function showSvSRecordMenu(){
    ['main-menu-view','minister-reservation-view','svs-enemies-view'].forEach(id=>$(id)?.classList.add('hidden'));
    $('svs-record-view')?.classList.remove('hidden');
    load();
  }
  function render(){
    const timeline=$('svs-record-timeline'), list=$('svs-record-list'), empty=$('svs-record-empty');
    if(!timeline||!list) return;
    timeline.innerHTML=rows.length ? rows.slice(0,24).map(r=>'<span class="svsr-segment '+(colors[r.result]||'lost')+'" title="'+esc(r.server_id+' · '+r.result+' · '+dateLabel(r.played_at))+'"></span>').join('') : '';
    empty?.classList.toggle('hidden', rows.length>0);
    list.innerHTML=rows.map(r=>{
      const side=(r.side||'ATK').toUpperCase();
      return '<article class="svsr-card '+(colors[r.result]||'lost')+'">'+
        '<div class="svsr-main"><div class="svsr-meta"><span class="svsr-side '+(side==='DEF'?'def':'atk')+'">'+esc(side)+'</span><strong class="svsr-server">S'+esc(r.server_id)+'</strong><span class="svsr-result">'+(r.result==='Conquered'?'👑 ':'')+esc(r.result)+'</span><span class="svsr-opponent">'+esc(r.opponent||'')+'</span></div>'+
        '<div class="svsr-scores"><div><small>PREP</small><b>'+fmt(r.prep_score)+'</b><em class="'+(Number(r.prep_delta)>=0?'positive':'negative')+'">'+signed(r.prep_delta)+'</em></div><div><small>BATTLE</small><b>'+fmt(r.battle_score)+'</b><em class="'+(Number(r.battle_delta)>=0?'positive':'negative')+'">'+signed(r.battle_delta)+'</em></div></div></div>'+
        '<time class="svsr-date">'+dateLabel(r.played_at)+'</time>'+
        (window.isAdmin?'<button class="svsr-edit" type="button" onclick="editSvSRecord(\''+r.id+'\')" aria-label="Edit record">✎</button>':'')+
        '</article>';
    }).join('');
  }
  async function load(){
    const c=client(); if(!c) return;
    const list=$('svs-record-list'); if(list&&!rows.length) list.innerHTML='<p class="svsr-loading">Loading SvS records…</p>';
    const {data,error}=await c.from(TABLE).select('*').order('played_at',{ascending:false}).order('created_at',{ascending:false});
    if(error){console.error('SvS records load:',error); if(list) list.innerHTML='<p class="svsr-error">Could not load records. Run the SvS Record SQL migration in Supabase first.</p>';return;}
    rows=data||[]; render();
  }
  function openForm(row){
    if(!window.isAdmin){return;}
    $('svsr-form-title').textContent=row?'Edit SvS Record':'Add SvS Record';
    $('svsr-id').value=row?.id||'';
    $('svsr-server').value=row?.server_id||'';
    $('svsr-side').value=row?.side||'ATK';
    $('svsr-result').value=row?.result||'Conquered';
    $('svsr-opponent').value=row?.opponent||'';
    $('svsr-prep').value=row?.prep_score??'';
    $('svsr-prep-delta').value=row?.prep_delta??'';
    $('svsr-battle').value=row?.battle_score??'';
    $('svsr-battle-delta').value=row?.battle_delta??'';
    $('svsr-date').value=row?.played_at||new Date().toISOString().slice(0,10);
    $('svsr-delete-btn').classList.toggle('hidden',!row);
    $('svs-record-form-modal').classList.remove('hidden');
  }
  async function save(){
    if(!window.isAdmin) return;
    const c=client(); if(!c) return;
    const id=$('svsr-id').value;
    const payload={server_id:$('svsr-server').value.trim().replace(/^S/i,''),side:$('svsr-side').value,result:$('svsr-result').value,opponent:$('svsr-opponent').value.trim(),prep_score:Number($('svsr-prep').value||0),prep_delta:Number($('svsr-prep-delta').value||0),battle_score:Number($('svsr-battle').value||0),battle_delta:Number($('svsr-battle-delta').value||0),played_at:$('svsr-date').value};
    if(!payload.server_id||!payload.played_at){showToast('Server and date are required','warning');return;}
    const btn=$('svsr-save-btn'); if(typeof setButtonBusy==='function') setButtonBusy(btn,true,'Saving…');
    const q=id?c.from(TABLE).update(payload).eq('id',id):c.from(TABLE).insert(payload);
    const {error}=await q;
    if(typeof setButtonBusy==='function') setButtonBusy(btn,false);
    if(error){console.error(error);showToast('Could not save SvS record. Check Supabase migration and permissions.','error');return;}
    closeForm(); showToast('SvS record saved','success'); await load();
  }
  async function remove(){
    if(!window.isAdmin) return;
    const id=$('svsr-id').value; if(!id||!confirm('Delete this SvS record?')) return;
    const {error}=await client().from(TABLE).delete().eq('id',id);
    if(error){showToast('Could not delete record','error');return;}
    closeForm();showToast('SvS record deleted','success');await load();
  }
  function closeForm(){ $('svs-record-form-modal')?.classList.add('hidden'); }
  window.showSvSRecordMenu=showSvSRecordMenu;
  window.openSvSRecordForm=()=>openForm(null);
  window.editSvSRecord=(id)=>{const row=rows.find(x=>x.id===id);if(row)openForm(row);};
  window.closeSvSRecordForm=closeForm;
  window.saveSvSRecord=save;
  window.deleteSvSRecord=remove;
  window.presidentPanelOpenSvSRecords=()=>{if(!window.isAdmin)return;document.getElementById('president-panel-modal')?.classList.add('hidden');showSvSRecordMenu();};
  function init(){
    $('svs-record-refresh')?.addEventListener('click',load);
    const c=client(); if(c&&!channel){channel=c.channel('svs_records_changes').on('postgres_changes',{event:'*',schema:'public',table:TABLE},load).subscribe();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();