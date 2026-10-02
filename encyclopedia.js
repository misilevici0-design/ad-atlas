'use strict';
const STORAGE_KEY='ad-atlas-encyclopedia-v1';
const DEFAULT_CATEGORIES=['Разбор','Ремонт I','Ремонт II','Сборка I','Сборка II','Устройства I','Устройства II'].map((name,index)=>({id:`category-${index+1}`,name}));
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone=value=>JSON.parse(JSON.stringify(value));
let state=loadState(),activeCategory='all',editingCraftId=null,draftImage='',draftIngredients=[],toastTimer;

function cleanImage(value){return typeof value==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)?value:''}
function validate(raw){
  if(!raw||!Array.isArray(raw.categories)||!Array.isArray(raw.crafts))throw new Error('Неверная структура файла');
  const categories=raw.categories.filter(item=>item&&typeof item.name==='string').slice(0,100).map(item=>({id:String(item.id||uid()),name:item.name.trim().slice(0,80)||'Без названия'}));
  const ids=new Set(categories.map(item=>item.id)),fallback=categories[0]?.id||'';
  const crafts=raw.crafts.filter(item=>item&&typeof item.name==='string').slice(0,2000).map(item=>({id:String(item.id||uid()),categoryId:ids.has(String(item.categoryId))?String(item.categoryId):fallback,name:item.name.trim().slice(0,80)||'Без названия',outputQty:Math.max(1,Math.min(9999,Number(item.outputQty)||1)),xp:String(item.xp||'').slice(0,20),time:String(item.time||'').slice(0,30),place:String(item.place||'').slice(0,100),description:String(item.description||'').slice(0,1000),image:cleanImage(item.image),ingredients:Array.isArray(item.ingredients)?item.ingredients.slice(0,50).map(ingredient=>({id:String(ingredient.id||uid()),name:String(ingredient.name||'').trim().slice(0,80),qty:Math.max(1,Math.min(9999,Number(ingredient.qty)||1)),image:cleanImage(ingredient.image)})):[]}));
  return{categories,craftsVersion:1,crafts};
}
function loadState(){try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)return validate(JSON.parse(saved))}catch{}return{categories:clone(DEFAULT_CATEGORIES),craftsVersion:1,crafts:[]}}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('saveState').textContent='Изменения сохранены';return true}catch{$('saveState').textContent='Не удалось сохранить';toast('Недостаточно места. Экспортируйте JSON и уменьшите изображения.');return false}}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function categoryName(id){return state.categories.find(item=>item.id===id)?.name||'Без категории'}
function filteredCrafts(){const query=$('craftSearch').value.trim().toLowerCase();return state.crafts.filter(craft=>(activeCategory==='all'||craft.categoryId===activeCategory)&&(!query||[craft.name,craft.place,craft.description,...craft.ingredients.map(item=>item.name)].join(' ').toLowerCase().includes(query)))}

function renderCategories(){
  const counts=new Map(state.categories.map(item=>[item.id,state.crafts.filter(craft=>craft.categoryId===item.id).length]));
  const buttons=[{id:'all',name:'Все крафты',count:state.crafts.length},...state.categories.map(item=>({...item,count:counts.get(item.id)||0}))];
  $('craftCategories').innerHTML=buttons.map(item=>`<button class="craft-category${activeCategory===item.id?' active':''}" data-category="${escapeHtml(item.id)}"><span class="category-glyph">${item.id==='all'?'◇':'⌁'}</span><span class="category-label">${escapeHtml(item.name)}</span><small>${item.count}</small></button>`).join('');
  $('craftCategories').querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{activeCategory=button.dataset.category;render()});
}
function renderCrafts(){
  const crafts=filteredCrafts(),selected=state.categories.find(item=>item.id===activeCategory);
  $('craftHeading').textContent=selected?.name||'Все крафты';$('editCurrentCategory').hidden=!selected;$('deleteCurrentCategory').hidden=!selected;
  $('craftStats').textContent=`${crafts.length} ${crafts.length===1?'крафт':crafts.length>1&&crafts.length<5?'крафта':'крафтов'}`;
  if(!crafts.length){$('craftGrid').innerHTML=`<div class="craft-empty"><div><strong>${$('craftSearch').value?'Ничего не найдено':'Здесь пока нет крафтов'}</strong><p>${$('craftSearch').value?'Попробуйте изменить запрос или выбрать другую категорию.':'Добавьте первый рецепт: укажите результат, ингредиенты, количество и место создания.'}</p><button class="primary" id="emptyCreate">＋ Добавить крафт</button></div></div>`;$('emptyCreate').onclick=()=>openCraftDialog();return}
  $('craftGrid').innerHTML=crafts.map(craft=>{
    const result=craft.image?`<img src="${craft.image}" alt="">`:'<span class="recipe-placeholder">◇</span>';
    const ingredients=craft.ingredients.length?craft.ingredients.slice(0,3).map(item=>`<span class="recipe-material" title="${escapeHtml(item.name)} × ${item.qty}">${item.image?`<img src="${item.image}" alt="">`:'<span class="recipe-placeholder">◆</span>'}<b>${item.qty}</b></span>`).join(''):'<span class="recipe-material empty-material"><span class="recipe-placeholder">＋</span></span>';
    return`<article class="craft-card" title="${escapeHtml(craft.description||craft.place||craft.name)}"><button class="recipe-edit" data-edit-craft="${escapeHtml(craft.id)}" aria-label="Редактировать">✎</button><div class="recipe-materials">${ingredients}${craft.ingredients.length>3?`<small>+${craft.ingredients.length-3}</small>`:''}</div><div class="recipe-core"><h3>${escapeHtml(craft.name)}</h3><div class="recipe-xp">+XP ${escapeHtml(craft.xp||'0')} <span>⌁ 1</span></div><div class="recipe-details"><span>◷ ${escapeHtml(craft.time||'—')}</span><span class="recipe-counter">− <b>1</b> ＋</span></div><div class="recipe-create">Создать</div></div><div class="recipe-result">${result}<b>×${craft.outputQty}</b></div></article>`
  }).join('');
  $('craftGrid').querySelectorAll('[data-edit-craft]').forEach(button=>button.onclick=()=>openCraftDialog(button.dataset.editCraft));
}
function render(){renderCategories();renderCrafts()}
function renderImagePreview(){$('craftImagePreview').innerHTML=draftImage?`<img src="${draftImage}" alt="Предпросмотр">`:'<span>Изображение результата</span>'}
function renderIngredients(){
  $('ingredientList').innerHTML=draftIngredients.length?draftIngredients.map((item,index)=>`<div class="ingredient-row"><label class="ingredient-image" title="Загрузить изображение">${item.image?`<img src="${item.image}" alt="">`:'＋'}<input type="file" accept="image/*" data-ingredient-file="${index}"></label><input type="text" maxlength="80" value="${escapeHtml(item.name)}" placeholder="Название ресурса" data-ingredient-name="${index}"><input type="number" min="1" max="9999" value="${item.qty}" aria-label="Количество" data-ingredient-qty="${index}"><div class="ingredient-row-actions"><button type="button" data-ingredient-paste="${index}" title="Вставить изображение">▣</button><button type="button" data-ingredient-remove="${index}" title="Удалить">×</button></div></div>`).join(''):'<div class="empty">Ингредиентов пока нет. Нажмите «Добавить ингредиент».</div>';
  $('ingredientList').querySelectorAll('[data-ingredient-name]').forEach(input=>input.oninput=()=>draftIngredients[Number(input.dataset.ingredientName)].name=input.value);
  $('ingredientList').querySelectorAll('[data-ingredient-qty]').forEach(input=>input.oninput=()=>draftIngredients[Number(input.dataset.ingredientQty)].qty=Math.max(1,Number(input.value)||1));
  $('ingredientList').querySelectorAll('[data-ingredient-file]').forEach(input=>input.onchange=async()=>{const file=input.files[0];if(!file)return;draftIngredients[Number(input.dataset.ingredientFile)].image=await compressImage(file);renderIngredients()});
  $('ingredientList').querySelectorAll('[data-ingredient-paste]').forEach(button=>button.onclick=async()=>{const image=await clipboardImage();if(image){draftIngredients[Number(button.dataset.ingredientPaste)].image=image;renderIngredients()}});
  $('ingredientList').querySelectorAll('[data-ingredient-remove]').forEach(button=>button.onclick=()=>{draftIngredients.splice(Number(button.dataset.ingredientRemove),1);renderIngredients()});
}
function fillCategorySelect(){$('craftCategory').innerHTML=state.categories.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}
function openCraftDialog(id=null){
  if(!state.categories.length){toast('Сначала создайте категорию');addCategory();return}
  editingCraftId=id;const craft=state.crafts.find(item=>item.id===id);$('craftDialogTitle').textContent=craft?'Редактировать крафт':'Новый крафт';fillCategorySelect();
  $('craftName').value=craft?.name||'';$('craftCategory').value=craft?.categoryId||(activeCategory!=='all'?activeCategory:state.categories[0].id);$('craftOutputQty').value=craft?.outputQty||1;$('craftXp').value=craft?.xp||'';$('craftTime').value=craft?.time||'';$('craftPlace').value=craft?.place||'';$('craftDescription').value=craft?.description||'';
  draftImage=craft?.image||'';draftIngredients=clone(craft?.ingredients||[]);$('deleteCraft').hidden=!craft;renderImagePreview();renderIngredients();$('craftDialog').showModal();setTimeout(()=>$('craftName').focus(),0)
}
function closeCraftDialog(){$('craftDialog').close()}
function addCategory(){const name=prompt('Название новой категории:','Новая категория');if(!name?.trim())return;const item={id:uid(),name:name.trim().slice(0,80)};state.categories.push(item);activeCategory=item.id;saveState();render();toast('Категория создана')}
function editCategory(){const item=state.categories.find(category=>category.id===activeCategory);if(!item)return;const name=prompt('Название категории:',item.name);if(name?.trim()){item.name=name.trim().slice(0,80);saveState();render()}else if(name==='')toast('Название не может быть пустым')}
function deleteCategory(){const item=state.categories.find(category=>category.id===activeCategory);if(!item)return;const count=state.crafts.filter(craft=>craft.categoryId===item.id).length;if(!confirm(`Удалить категорию «${item.name}»${count?` и крафты в ней (${count})`:''}?`))return;state.categories=state.categories.filter(category=>category.id!==item.id);state.crafts=state.crafts.filter(craft=>craft.categoryId!==item.id);activeCategory='all';saveState();render();toast('Категория удалена')}
async function compressImage(file){if(!file?.type?.startsWith('image/')){toast('Выберите файл изображения');return''}return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Не удалось прочитать изображение'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('Не удалось открыть изображение'));image.onload=()=>{const max=512,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/webp',.82))};image.src=reader.result};reader.readAsDataURL(file)}).catch(error=>{toast(error.message);return''})}
async function clipboardImage(){try{const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(type)return compressImage(await item.getType(type))}toast('В буфере обмена нет изображения')}catch{toast('Не удалось прочитать буфер. Разрешите доступ или выберите файл.')}return''}

$('craftForm').onsubmit=event=>{event.preventDefault();const value={id:editingCraftId||uid(),categoryId:$('craftCategory').value,name:$('craftName').value.trim(),outputQty:Math.max(1,Number($('craftOutputQty').value)||1),xp:$('craftXp').value.trim(),time:$('craftTime').value.trim(),place:$('craftPlace').value.trim(),description:$('craftDescription').value.trim(),image:draftImage,ingredients:draftIngredients.filter(item=>item.name.trim()).map(item=>({...item,name:item.name.trim(),qty:Math.max(1,Number(item.qty)||1)}))};if(!value.name)return;const index=state.crafts.findIndex(item=>item.id===editingCraftId);if(index>=0)state.crafts[index]=value;else state.crafts.unshift(value);if(saveState()){closeCraftDialog();render();toast(index>=0?'Крафт обновлён':'Крафт добавлен')}};
$('addIngredient').onclick=()=>{draftIngredients.push({id:uid(),name:'',qty:1,image:''});renderIngredients()};
$('craftImageFile').onchange=async event=>{const image=await compressImage(event.target.files[0]);if(image){draftImage=image;renderImagePreview()}event.target.value=''};
$('pasteCraftImage').onclick=async()=>{const image=await clipboardImage();if(image){draftImage=image;renderImagePreview()}};$('removeCraftImage').onclick=()=>{draftImage='';renderImagePreview()};
$('deleteCraft').onclick=()=>{const craft=state.crafts.find(item=>item.id===editingCraftId);if(craft&&confirm(`Удалить крафт «${craft.name}»?`)){state.crafts=state.crafts.filter(item=>item.id!==editingCraftId);saveState();closeCraftDialog();render();toast('Крафт удалён')}};
$('addCraftTop').onclick=()=>openCraftDialog();$('addCraftEmpty').onclick=()=>openCraftDialog();$('addCraftCategory').onclick=addCategory;$('editCurrentCategory').onclick=editCategory;$('deleteCurrentCategory').onclick=deleteCategory;$('craftSearch').oninput=renderCrafts;$('closeCraftDialog').onclick=closeCraftDialog;$('cancelCraftDialog').onclick=closeCraftDialog;
$('exportCrafts').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ad-atlas-encyclopedia-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Энциклопедия экспортирована')};
$('importCrafts').onclick=()=>$('craftImportFile').click();$('craftImportFile').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{const imported=validate(JSON.parse(await file.text()));if(!confirm(`Импортировать ${imported.crafts.length} крафтов? Текущая энциклопедия будет заменена.`))return;state=imported;activeCategory='all';saveState();render();toast('Энциклопедия импортирована')}catch(error){toast(`Ошибка импорта: ${error.message}`)}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('craftDialog').open)closeCraftDialog();if(event.key==='/'&&!$('craftDialog').open&&document.activeElement?.tagName!=='INPUT'){event.preventDefault();$('craftSearch').focus()}});
render();
if(!window.AD_ATLAS_DESKTOP?.enabled&&'serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{}));
