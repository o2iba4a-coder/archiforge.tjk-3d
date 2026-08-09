const translations={
ru:{select:"Выбор",wall:"Стена",room:"Комната",measure:"Размер",pan:"Панорама",delete:"Удалить",properties:"Свойства",nothing:"Ничего не выбрано",choose:"Выберите объект в сцене.",thickness:"Толщина",length:"Длина",material:"Материал",deleteObject:"Удалить объект",confirmNew:"Создать новый проект? Несохранённые изменения будут потеряны."},
tg:{select:"Интихоб",wall:"Девор",room:"Ҳуҷра",measure:"Андоза",pan:"Ҷойивазкунӣ",delete:"Нест кардан",properties:"Хусусиятҳо",nothing:"Ҳеҷ чиз интихоб нашудааст",choose:"Объектро дар саҳна интихоб кунед.",thickness:"Ғафсӣ",length:"Дарозӣ",material:"Мавод",deleteObject:"Нест кардани объект",confirmNew:"Лоиҳаи нав эҷод шавад? Тағйироти захиранашуда гум мешаванд."}
};
window.t=(key)=>translations[localStorage.getItem("archiforge-lang")||"ru"][key]||key;
window.applyLanguage=()=>{
 const lang=localStorage.getItem("archiforge-lang")||"ru";
 document.documentElement.lang=lang==="tg"?"tg":"ru";
 document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent=translations[lang][el.dataset.i18n]||el.textContent);
 const sel=document.getElementById("language");if(sel)sel.value=lang;
};
const lang=document.getElementById("language");
if(lang)lang.addEventListener("change",()=>{localStorage.setItem("archiforge-lang",lang.value);applyLanguage()});
applyLanguage();