/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 */
// ================= SVS RECORD =================
// President-managed SvS match history, stored independently from SvS Enemies.
(function () {
  'use strict';
  const TABLE = 'svs_records';
  const $ = (id) => document.getElementById(id);
  let rows = [];
  let state3475History = [];
  let historyLoading = false;
  let channel = null;
  const tr = (key) => typeof t === 'function' ? t(key) : key;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (v) => Number(v || 0).toLocaleString();
  const signed = (v) => Number(v || 0) > 0 ? '+' + fmt(v) : Number(v || 0) < 0 ? '−' + fmt(Math.abs(v)) : '0';
  const colors = {Conquered:'conquered',Defended:'defended',Repelled:'repelled','Castle lost':'lost'};
  const resultLabel = (value) => tr(({Conquered:'svsr_conquered',Defended:'svsr_defended',Repelled:'svsr_repelled','Castle lost':'svsr_castle_lost'})[value] || 'svsr_conquered');
  function client(){ return typeof getSupabase === 'function' ? getSupabase() : null; }
  function dateLabel(v){ if(!v) return '—'; return new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function showSvSRecordMenu(){
    ['main-menu-view','minister-reservation-view','svs-enemies-view'].forEach(id=>$(id)?.classList.add('hidden'));
    $('svs-record-view')?.classList.remove('hidden');
    load();
    loadState3475History();
  }
  function render(){
    const timeline=$('svs-record-timeline'), list=$('svs-record-list'), empty=$('svs-record-empty'), add=$('svs-record-add');
    if(add) add.classList.toggle('hidden', !(typeof isAdmin !== 'undefined' && isAdmin));
    if(!timeline||!list) return;
    timeline.innerHTML=rows.length ? rows.slice(0,24).map(r=>'<span class="svsr-segment '+(colors[r.result]||'lost')+'" title="'+esc(r.server_id+' · '+r.result+' · '+dateLabel(r.played_at))+'"></span>').join('') : '';
    empty?.classList.toggle('hidden', rows.length>0);
    list.innerHTML=rows.map(r=>{
      const side=(r.side||'ATK').toUpperCase();
      return '<article class="svsr-card '+(colors[r.result]||'lost')+'">'+
        '<div class="svsr-main"><div class="svsr-meta"><span class="svsr-side '+(side==='DEF'?'def':'atk')+'">'+esc(side)+'</span><strong class="svsr-server">S'+esc(r.server_id)+'</strong><span class="svsr-result">'+(r.result==='Conquered'?'👑 ':'')+esc(resultLabel(r.result))+'</span><span class="svsr-opponent">'+esc(r.opponent||'')+'</span></div>'+
        '<div class="svsr-scores"><div><small>'+esc(tr('svsr_prep'))+'</small><b>'+fmt(r.prep_score)+'</b><em class="'+(Number(r.prep_delta)>=0?'positive':'negative')+'">'+signed(r.prep_delta)+'</em></div><div><small>'+esc(tr('svsr_battle'))+'</small><b>'+fmt(r.battle_score)+'</b><em class="'+(Number(r.battle_delta)>=0?'positive':'negative')+'">'+signed(r.battle_delta)+'</em></div></div></div>'+
        '<time class="svsr-date">'+dateLabel(r.played_at)+'</time>'+
        ((typeof isAdmin !== 'undefined' && isAdmin)?'<button class="svsr-edit" type="button" onclick="editSvSRecord(\''+r.id+'\')" aria-label="'+esc(tr('svsr_edit'))+'">✎</button>':'')+
        '</article>';
    }).join('');
  }
  // Official historical SvS results for State 3475 only (same dataset used in SvS Enemies).
  const HISTORY_URL = 'https://data.wosnerds.com/data/svs-history/svs-history-3001-3500.json';
  async function loadState3475History(){
    const host=$('svs-record-state-history'); if(!host || historyLoading) return;
    historyLoading=true; host.innerHTML='<p class="svs-en-status">'+esc(tr('svsr_state_loading'))+'</p>';
    try{
      const response=await fetch(HISTORY_URL,{headers:{accept:'application/json, text/plain, */*'},credentials:'omit',mode:'cors'});
      if(!response.ok) throw new Error('HTTP '+response.status);
      const json=await response.json(), dataset=(json && json['svs-data-per-state']) || json || {}, own=dataset['3475'] || dataset[3475] || {};
      state3475History=Object.keys(own).map(date=>{const m=own[date]||{};return {date,opponent:Number(m['opposition-state'])||null,hadMatch:m['had-svs-match']!==false,wonPrep:!!m['won-prep'],wonCastle:!!m['won-castle']};}).filter(r=>r.hadMatch).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
      renderState3475History();
    }catch(error){console.error('State 3475 SvS history:',error);host.innerHTML='<p class="svs-en-status svs-en-error">'+esc(tr('svsr_state_load_failed'))+'</p><button type="button" class="svs-en-retry" onclick="refreshState3475SvSHistory()">'+esc(tr('svsr_retry'))+'</button>';}
    finally{historyLoading=false;}
  }
  function renderState3475History(){
    const host=$('svs-record-state-history');if(!host)return;
    if(!state3475History.length){host.innerHTML='<p class="svs-en-status">'+esc(tr('svsr_state_empty'))+'</p>';return;}
    const pw=state3475History.filter(r=>r.wonPrep).length,pl=state3475History.length-pw,cw=state3475History.filter(r=>r.wonCastle).length,cl=state3475History.length-cw;
    const body=state3475History.map(r=>'<tr><td>'+esc(dateLabel(r.date))+'</td><td class="st-num">'+(r.opponent?'S'+esc(r.opponent):'—')+'</td><td><span class="svs-en-result '+(r.wonPrep?'is-win':'is-loss')+'">'+(r.wonPrep?tr('svsr_win'):tr('svsr_loss'))+'</span></td><td><span class="svs-en-result '+(r.wonCastle?'is-win':'is-loss')+'">'+(r.wonCastle?tr('svsr_win'):tr('svsr_loss'))+'</span></td></tr>').join('');
    host.innerHTML='<div class="svs-en-record-summary"><span>'+esc(tr('svsr_prep'))+': <strong class="svs-en-win-text">'+pw+'</strong>–<strong class="svs-en-loss-text">'+pl+'</strong></span><span>'+esc(tr('svsr_battle'))+': <strong class="svs-en-win-text">'+cw+'</strong>–<strong class="svs-en-loss-text">'+cl+'</strong></span><span>'+esc(tr('svsr_matches'))+': <strong>'+state3475History.length+'</strong></span></div><div class="svs-en-table-wrap"><table class="svs-en-table"><thead><tr><th>'+esc(tr('svsr_date'))+'</th><th class="st-num">'+esc(tr('svsr_opponent'))+'</th><th>'+esc(tr('svsr_prep'))+'</th><th>'+esc(tr('svsr_battle'))+'</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  window.refreshState3475SvSHistory=()=>{state3475History=[];loadState3475History();};

  async function load(){
    const c=client(); if(!c) return;
    const list=$('svs-record-list'); if(list&&!rows.length) list.innerHTML='<p class="svsr-loading">'+esc(tr('svsr_loading'))+'</p>';
    const {data,error}=await c.from(TABLE).select('*').order('played_at',{ascending:false}).order('created_at',{ascending:false});
    if(error){console.error('SvS records load:',error); if(list) list.innerHTML='<p class="svsr-error">'+esc(tr('svsr_load_failed'))+'</p>';return;}
    rows=data||[]; render();
  }
  function openForm(row){
    if(typeof isAdmin === 'undefined' || !isAdmin){return;}
    $('svsr-form-title').textContent=row?tr('svsr_edit_title'):tr('svsr_add_title');
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
    if(typeof isAdmin === 'undefined' || !isAdmin) return;
    const c=client(); if(!c) return;
    const id=$('svsr-id').value;
    const payload={server_id:$('svsr-server').value.trim().replace(/^S/i,''),side:$('svsr-side').value,result:$('svsr-result').value,opponent:$('svsr-opponent').value.trim(),prep_score:Number($('svsr-prep').value||0),prep_delta:Number($('svsr-prep-delta').value||0),battle_score:Number($('svsr-battle').value||0),battle_delta:Number($('svsr-battle-delta').value||0),played_at:$('svsr-date').value};
    if(!payload.server_id||!payload.played_at){showToast(tr('svsr_required'),'warning');return;}
    const btn=$('svsr-save-btn'); if(typeof setButtonBusy==='function') setButtonBusy(btn,true,tr('svsr_saving'));
    const q=id?c.from(TABLE).update(payload).eq('id',id):c.from(TABLE).insert(payload);
    const {error}=await q;
    if(typeof setButtonBusy==='function') setButtonBusy(btn,false);
    if(error){console.error(error);showToast(tr('svsr_save_failed'),'error');return;}
    closeForm(); showToast(tr('svsr_saved'),'success'); await load();
  }
  async function remove(){
    if(typeof isAdmin === 'undefined' || !isAdmin) return;
    const id=$('svsr-id').value; if(!id||!confirm(tr('svsr_delete_confirm'))) return;
    const {error}=await client().from(TABLE).delete().eq('id',id);
    if(error){showToast(tr('svsr_delete_failed'),'error');return;}
    closeForm();showToast(tr('svsr_deleted'),'success');await load();
  }
  function closeForm(){ $('svs-record-form-modal')?.classList.add('hidden'); }
  window.showSvSRecordMenu=showSvSRecordMenu;
  window.openSvSRecordForm=()=>openForm(null);
  window.editSvSRecord=(id)=>{const row=rows.find(x=>x.id===id);if(row)openForm(row);};
  window.closeSvSRecordForm=closeForm;
  window.saveSvSRecord=save;
  window.deleteSvSRecord=remove;
  window.presidentPanelOpenSvSRecords=()=>{if(typeof isAdmin === 'undefined' || !isAdmin)return;document.getElementById('president-panel-modal')?.classList.add('hidden');showSvSRecordMenu();};
  function init(){
    $('svs-record-refresh')?.addEventListener('click',()=>{load();window.refreshState3475SvSHistory();});
    const c=client(); if(c&&!channel){channel=c.channel('svs_records_changes').on('postgres_changes',{event:'*',schema:'public',table:TABLE},load).subscribe();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();