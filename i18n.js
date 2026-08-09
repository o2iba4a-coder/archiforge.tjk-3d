const translations = {
  ru:{
    untitled:"Без названия",new:"＋ Новый",save:"Сохранить",export:"Экспорт PNG",
    create:"СОЗДАНИЕ",select:"Выбор",wall:"Стена",room:"Комната",door:"Дверь",window:"Окно",
    view:"ВИД",top:"Сверху",home:"Главный",perspective:"3D ПЕРСПЕКТИВА",
    controls:"ЛКМ — вращение · ПКМ — перемещение · Колесо — масштаб",
    properties:"СВОЙСТВА",noSelected:"Объект не выбран",selectHint:"Выберите объект на сцене, чтобы посмотреть его свойства.",
    position:"Положение",dimensions:"Размеры",material:"Материал",delete:"Удалить объект",
    grid:"Сетка",units:"Единицы",metric:"Метрические",concrete:"Бетон",brick:"Кирпич",glass:"Стекло",wood:"Дерево",steel:"Сталь",
    objects:"объектов",confirmNew:"Создать новый проект? Текущая демонстрационная сцена будет сброшена."
  },
  tj:{
    untitled:"Бе ном",new:"＋ Нав",save:"Захира кардан",export:"Экспорти PNG",
    create:"ЭҶОД",select:"Интихоб",wall:"Девор",room:"Ҳуҷра",door:"Дар",window:"Тиреза",
    view:"НАМОИШ",top:"Аз боло",home:"Асосӣ",perspective:"3D ПЕРСПЕКТИВА",
    controls:"Тугмаи чап — гардиш · Тугмаи рост — ҳаракат · Чарх — масштаб",
    properties:"ХУСУСИЯТҲО",noSelected:"Объект интихоб нашудааст",selectHint:"Барои дидани хусусиятҳо объектро дар саҳна интихоб кунед.",
    position:"Мавқеъ",dimensions:"Андозаҳо",material:"Мавод",delete:"Нест кардани объект",
    grid:"Шабака",units:"Воҳидҳо",metric:"Метрӣ",concrete:"Бетон",brick:"Хишт",glass:"Шиша",wood:"Чӯб",steel:"Пӯлод",
    objects:"объект",confirmNew:"Лоиҳаи нав эҷод шавад? Саҳнаи намоишии ҷорӣ аз нав оғоз мешавад."
  }
};

function t(key){return translations[window.currentLanguage || "ru"][key] || key;}
function applyLanguage(lang){
  window.currentLanguage=lang;
  localStorage.setItem("archiforge-language",lang);
  document.documentElement.lang=lang==="tj"?"tg":"ru";
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n);});
  const material=document.getElementById("material");
  if(material) material.value=material.value;
  if(window.updateObjectCount) window.updateObjectCount();
}
window.t=t;
window.applyLanguage=applyLanguage;
window.translations=translations;
document.addEventListener("DOMContentLoaded",()=>{
  const saved=localStorage.getItem("archiforge-language") || "ru";
  const selector=document.getElementById("language");
  selector.value=saved;
  selector.addEventListener("change",()=>applyLanguage(selector.value));
  applyLanguage(saved);
});
