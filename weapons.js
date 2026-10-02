'use strict';
(() => {
const SOURCE_W=2048,SOURCE_H=860,KEY='ad-atlas-weapon-names-v1';
const cards=[
  [41,33,611,172],[681,34,610,171],[1324,34,611,171],
  [42,234,610,171],[681,234,610,172],[1324,234,611,172],
  [41,435,611,170],[681,435,610,170],[1324,435,611,170],
  [41,635,612,171],[681,635,610,171],[1324,634,611,226]
];
let names=[];try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(saved))names=saved.slice(0,cards.length).map(value=>String(value||'').slice(0,80))}catch{}
while(names.length<cards.length)names.push('');
const grid=document.getElementById('weaponsGrid'),saveState=document.getElementById('saveState'),toast=document.getElementById('toast');let toastTimer;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(names));saveState.textContent='Названия сохранены'}catch{saveState.textContent='Не удалось сохранить'}}
grid.innerHTML=cards.map((crop,index)=>{const[x,y,w,h]=crop,sx=SOURCE_W/w*100,sy=SOURCE_H/h*100,px=x/(SOURCE_W-w)*100,py=y/(SOURCE_H-h)*100;return`<article class="weapon-card"><div class="weapon-reference" role="img" aria-label="Карточка оружия ${index+1}" style="aspect-ratio:${w}/${h};background-size:${sx}% ${sy}%;background-position:${px}% ${py}%"></div><label class="weapon-name-wrap"><span>✎</span><input class="weapon-name" data-index="${index}" maxlength="80" value="${names[index].replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}" placeholder="Введите своё название"></label></article>`}).join('');
grid.querySelectorAll('.weapon-name').forEach(input=>input.addEventListener('change',()=>{names[Number(input.dataset.index)]=input.value.trim();save()}));
document.getElementById('resetWeaponNames').onclick=()=>{if(!confirm('Очистить все введённые названия оружия?'))return;names=names.map(()=>'');grid.querySelectorAll('.weapon-name').forEach(input=>input.value='');save();notify('Названия очищены')};
})();
