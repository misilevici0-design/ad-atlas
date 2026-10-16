'use strict';
const MUTANT_RATES = [
  {id:'hide',name:'Шкура',batch:10,helix:5},
  {id:'flesh',name:'Плоть',batch:10,helix:5},
  {id:'bones',name:'Кости',batch:10,helix:5},
  {id:'skull',name:'Череп',batch:2,helix:2},
  {id:'liver',name:'Печень',batch:5,helix:7},
  {id:'lungs',name:'Лёгкие',batch:5,helix:7},
  {id:'heart',name:'Сердце',batch:5,helix:7},
  {id:'hand',name:'Рука',batch:5,helix:10}
];
function calculateMutantPart(quantity,rate,proportional=false){
  const qty=Number.isFinite(Number(quantity))?Math.max(0,Math.min(999999999,Math.floor(Number(quantity)))):0;
  const batches=Math.floor(qty/rate.batch);
  return {qty,batches,remainder:qty%rate.batch,helix:proportional?qty*rate.helix/rate.batch:batches*rate.helix};
}
if(typeof document!=='undefined'){
  const format=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
  const rows=document.getElementById('partRows');
  rows.innerHTML=MUTANT_RATES.map(rate=>`<div class="part-row"><div><label for="qty-${rate.id}">${rate.name}</label><span class="rate">${rate.batch} шт. → ${rate.helix} хеликсов</span></div><input id="qty-${rate.id}" type="number" inputmode="numeric" min="0" max="999999999" step="1" value="0" aria-label="${rate.name}: количество"><div class="part-value"><output id="value-${rate.id}">0</output><small id="rest-${rate.id}">Остаток: 0 шт.</small></div></div>`).join('');
  function update(){
    let total=0,quantity=0,remainder=0;
    const proportional=document.getElementById('proportional').checked;
    for(const rate of MUTANT_RATES){
      const input=document.getElementById(`qty-${rate.id}`);
      const result=calculateMutantPart(input.value,rate,proportional);
      input.setCustomValidity(input.value!==''&&Number(input.value)!==result.qty?'Введите целое количество от 0 до 999999999':'');
      document.getElementById(`value-${rate.id}`).textContent=format.format(result.helix);
      document.getElementById(`rest-${rate.id}`).textContent=proportional?'Пропорциональный расчёт':`Остаток: ${format.format(result.remainder)} шт.`;
      total+=result.helix;quantity+=result.qty;remainder+=result.remainder;
    }
    document.getElementById('totalHelix').textContent=format.format(total);
    document.getElementById('totalParts').textContent=format.format(quantity);
    document.getElementById('totalRest').textContent=proportional?'Без округления до наборов':`Останется после обмена: ${format.format(remainder)} шт.`;
  }
  document.getElementById('calculatorForm').addEventListener('submit',event=>event.preventDefault());
  document.getElementById('calculatorForm').addEventListener('input',update);
  document.getElementById('resetCalculator').addEventListener('click',()=>{for(const rate of MUTANT_RATES)document.getElementById(`qty-${rate.id}`).value='0';update()});
  update();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{}));
}
