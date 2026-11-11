/* Skryptorium — kreator ksiąg postaci, działa w całości w przeglądarce.
   Dane projektu są lokalne; eksport JSON to podstawa przyszłej biblioteki. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = "ksiegi-graczy-skryptorium-v1";
  const PAPERS = [
    {id:"classic",name:"Pergamin klasyczny",description:"Stary, ciepły pergamin"},
    {id:"royal",name:"Królewski iluminowany",description:"Złoto i rubinowe ramy"},
    {id:"battle",name:"Kronika bitewna",description:"Surowe karty kronikarza"},
    {id:"monastery",name:"Skryptorium zakonne",description:"Jasny manuskrypt"},
    {id:"nocturne",name:"Nocna kronika",description:"Atrament i półmrok"}
  ];
  const COVERS = [
    {id:"burgundy",name:"Bordo"},
    {id:"forest",name:"Zieleń"},
    {id:"midnight",name:"Granat"},
    {id:"chestnut",name:"Brąz"}
  ];
  const FIELDS = ["character","subtitle","year","author","summary","story"];
  const DEFAULT = () => ({
    character:"", subtitle:"", year:"1403", author:"", summary:"", story:"",
    paper:"classic", cover:"burgundy", crest:null, photos:[]
  });
  const SAFE_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
  const MAX_IMAGES = 12;
  let state = DEFAULT();
  let pages = [];
  let open = false, busy = false, currentPage = 0;
  let refreshTimer, saveTimer, toastTimer, resizeTimer;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const plainText = value => String(value ?? "").replace(/\r\n?/g,"\n").trim();
  const smallScreen = () => matchMedia("(max-width: 570px)").matches;
  const isImage = value => typeof value === "string" && value.length <= 6_000_000 && SAFE_IMAGE.test(value);
  const safeStyle = name => PAPERS.some(x => x.id===name) ? name : "classic";
  const safeCover = name => COVERS.some(x => x.id===name) ? name : "burgundy";
  const selectedFileName = name => (name||"ksiega-postaci").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55) || "ksiega-postaci";

  function notify(message){
    const el=$("toast");
    clearTimeout(toastTimer);
    el.textContent=message;
    el.classList.add("visible");
    toastTimer=setTimeout(()=>el.classList.remove("visible"),3400);
  }
  function normalize(input){
    const raw=input && typeof input==="object" && !Array.isArray(input) ? input : {};
    const out=DEFAULT();
    for(const field of FIELDS)if(typeof raw[field]==="string")out[field]=raw[field].slice(0,field==="story"?100000:field==="summary"?700:115);
    out.paper=safeStyle(raw.paper);
    out.cover=safeCover(raw.cover);
    if(isImage(raw.crest))out.crest=raw.crest;
    if(Array.isArray(raw.photos))out.photos=raw.photos.slice(0,MAX_IMAGES).filter(x=>x&&isImage(x.data)).map((photo,i)=>({
      id:String(photo.id||("zdjecie-"+i)).slice(0,50),
      data:photo.data,
      caption:String(photo.caption||"").slice(0,160)
    }));
    return out;
  }
  function loadDraft(){
    try{
      const raw=localStorage.getItem(KEY);
      if(raw)state=normalize(JSON.parse(raw));
    }catch(e){console.warn("Nie udało się wczytać lokalnego projektu.",e)}
  }
  function saveDraft(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      try{
        const data=JSON.stringify(state);
        if(data.length>4_000_000)throw Error("Zbyt wiele danych na zapis w przeglądarce");
        localStorage.setItem(KEY,data);
        $("save-status").textContent="Rękopis zapisany lokalnie";
      }catch(e){
        $("save-status").textContent="Brak miejsca na zapis — pobierz JSON";
        console.warn("Nie udało się zapisać roboczej kopii.",e);
      }
    },480);
  }
  function paperMarkup(){
    $("paper-options").innerHTML=PAPERS.map(item=>`
      <button type="button" class="paper-option ${state.paper===item.id?"is-selected":""}" data-paper="${item.id}" aria-pressed="${state.paper===item.id}">
        <span class="paper-option__sample" data-paper="${item.id}">✥<br>Kronika</span>
        <span class="paper-option__name">${escapeHtml(item.name)} ${state.paper===item.id?'<span class="paper-option__check">✓</span>':""}</span>
      </button>`).join("");
    $("paper-options").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      state.paper=btn.dataset.paper;
      paperMarkup();updatePreview();saveDraft();
    }));
    $("cover-options").innerHTML=COVERS.map(item=>`
      <button type="button" class="cover-option ${state.cover===item.id?"is-selected":""}" data-cover="${item.id}" aria-pressed="${state.cover===item.id}">
        <span class="cover-option__swatch cover-${item.id}"></span>${escapeHtml(item.name)}
      </button>`).join("");
    $("cover-options").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      state.cover=btn.dataset.cover;
      paperMarkup();updatePreview();saveDraft();
    }));
  }
  function renderCrest(){
    const icon=state.crest ? `<img src="${state.crest}" alt="Herb postaci">` : "⚜";
    $("crest-mini").innerHTML=icon;
    $("cover-crest").innerHTML=icon;
  }
  function photoMarkup(){
    const list=$("photo-list");
    $("photo-count").textContent=`${state.photos.length} / ${MAX_IMAGES} obrazów`;
    if(!state.photos.length){list.innerHTML='<p class="photo-empty">Nie dodano jeszcze ilustracji.</p>';return}
    list.innerHTML=state.photos.map((photo,i)=>`
      <div class="photo-item">
        <img src="${photo.data}" alt="Podgląd ilustracji nr ${i+1}">
        <div><label for="caption-${i}">Podpis pod ilustracją ${i+1}</label>
          <input id="caption-${i}" type="text" maxlength="160" data-caption="${i}" placeholder="Np. Zamek w Suchodole" value="${escapeHtml(photo.caption)}">
          <small>Obraz ${i+1} • karta ilustracyjna</small></div>
        <button type="button" class="photo-item__remove" data-remove="${i}" aria-label="Usuń obraz ${i+1}">×</button>
      </div>`).join("");
    list.querySelectorAll("[data-remove]").forEach(btn=>btn.addEventListener("click",()=>{
      state.photos.splice(Number(btn.dataset.remove),1);
      photoMarkup();updatePreview();saveDraft();
    }));
    list.querySelectorAll("[data-caption]").forEach(input=>input.addEventListener("input",()=>{
      state.photos[Number(input.dataset.caption)].caption=input.value;
      schedulePreview();saveDraft();
    }));
  }
  function showTab(name){
    document.querySelectorAll(".tab").forEach(button=>{
      const selected=button.dataset.tab===name;
      button.classList.toggle("is-current",selected);
      if(selected)button.setAttribute("aria-current","step");
      else button.removeAttribute("aria-current");
    });
    document.querySelectorAll(".edit-panel").forEach(panel=>panel.hidden=panel.dataset.panel!==name);
    const area=document.querySelector(".editor-scroll");
    if(area)area.scrollTop=0;
  }
  function fillFields(){
    FIELDS.forEach(key=>$(key).value=state[key]||"");
    renderCrest();paperMarkup();photoMarkup();updatePreview();
  }
  async function resizeImage(file,maxSide,quality){
    if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Dozwolone są tylko obrazy JPG, PNG i WebP.");
    if(file.size>15_000_000)throw Error("Obraz nie może przekraczać 15 MB.");
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      img.src=url;
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Nie udało się odczytać obrazu."))});
      if(!img.naturalWidth||!img.naturalHeight)throw Error("Nieprawidłowy obraz");
      const factor=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
      const ctx=canvas.getContext("2d");
      if(!ctx)throw Error("Nie można przygotować obrazu");
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL("image/webp",quality);
      if(!isImage(data))throw Error("Plik jest zbyt duży.");
      return data;
    }finally{URL.revokeObjectURL(url)}
  }
  function maxChars(){
    if(smallScreen())return 355;
    if(matchMedia("(max-width: 1120px)").matches)return 340;
    return 510;
  }
  function chunkParagraph(paragraph,cap){
    // Nie gubimy słów ani długich fragmentów tekstu.
    const words=paragraph.replace(/\s+/g," ").trim().split(" ").filter(Boolean);
    const chunks=[];let buf="";
    for(let word of words){
      while(word.length>cap){if(buf){chunks.push(buf);buf=""};chunks.push(word.slice(0,cap));word=word.slice(cap)}
      if(!word)continue;
      if(buf && (buf.length+word.length+1>cap)){chunks.push(buf);buf=word}
      else buf+=(buf?" ":"")+word;
    }
    if(buf)chunks.push(buf);
    return chunks;
  }
  function textPages(text,startingTitle){
    const cap=maxChars(), result=[];
    const raw=plainText(text);
    if(!raw)return result;
    const paras=raw.split(/\n\s*\n/).map(x=>x.replace(/\n/g," ").trim()).filter(Boolean);
    let title=startingTitle, pack=[],count=0;
    function flush(){
      if(!pack.length)return;
      result.push({kind:"text",title,paragraphs:pack});
      pack=[];count=0;
    }
    for(const paragraph of paras){
      const header=paragraph.match(/^(?:Rozdzia[łl]\b|Prolog\b|Epilog\b|#\s+)/i) && paragraph.length<160;
      if(header){flush();title=paragraph.replace(/^#\s*/,"");continue}
      for(const slice of chunkParagraph(paragraph,cap-22)){
        if(pack.length && count+slice.length+20>cap)flush();
        pack.push(slice);count+=slice.length+20;
      }
    }
    flush();
    return result;
  }
  function buildPages(){
    const bookTitle=plainText(state.character)||"Kronika postaci";
    const output=[{kind:"title",title:bookTitle,subtitle:state.subtitle,author:state.author,year:state.year,crest:state.crest}];
    if(plainText(state.summary))output.push(...textPages(state.summary,"Przedmowa"));
    else output.push({kind:"blank",title:"O dziejach postaci",message:"Tutaj znajdzie się wprowadzenie do kroniki."});
    const storyPages=textPages(state.story,"Początki opowieści");
    output.push(...(storyPages.length?storyPages:[{kind:"blank",title:"Karta kronikarza",message:"Wpisz historię postaci po lewej stronie, aby zapełnić kolejne karty."}]));
    state.photos.forEach((p,i)=>output.push({kind:"image",title:`Ilustracja ${i+1}`,data:p.data,caption:p.caption}));
    output.push({kind:"end",title:"Koniec dotychczas zapisanych dziejów"});
    if(output.length%2)output.push({kind:"blank",title:"",message:""});
    return output;
  }
  function renderFolio(folio,page,index){
    folio.dataset.paper=state.paper;
    const head=`<div class="folio-kicker">✥ &nbsp; LIBER CHRONICARUM &nbsp; ✥</div>`;
    let inner="";
    if(page.kind==="title"){
      inner=`${head}<h2 class="folio-title">${escapeHtml(page.title)}</h2><div class="folio-rule"></div>
        ${page.crest?`<img class="folio-crest" src="${page.crest}" alt="Herb postaci">`:'<div class="folio-sigil">⚜</div>'}
        <p class="folio-subtitle">${escapeHtml(page.subtitle||"Kronika losów i czynów")}</p>
        <p class="folio-end">${escapeHtml(page.year?"ANNO DOMINI · "+page.year:"")}</p>
        <p class="folio-subtitle">${escapeHtml(page.author?"Spisane przez "+page.author:"")}</p>`;
    }else if(page.kind==="text"){
      inner=`${head}<h2 class="folio-title">${escapeHtml(page.title||"Kronika")}</h2><div class="folio-rule"></div>
        <div class="folio-text">${page.paragraphs.map(p=>`<p>${escapeHtml(p)}</p>`).join("")}</div>`;
    }else if(page.kind==="image"){
      inner=`${head}<h2 class="folio-title">${escapeHtml(page.title)}</h2>
      <img class="folio-photo" src="${page.data}" alt="${escapeHtml(page.caption||"Ilustracja kroniki")}">
      <p class="folio-caption">${escapeHtml(page.caption||"Obraz z dziejów postaci")}</p>`;
    }else if(page.kind==="end"){
      inner=`${head}<div class="folio-sigil">❧</div><h2 class="folio-title">${escapeHtml(page.title)}</h2>
      <p class="folio-placeholder">Dalsze losy zostaną zapisane na kolejnych kartach.</p>`;
    }else{
      inner=`${head}<h2 class="folio-title">${escapeHtml(page.title||"")}</h2><div class="folio-sigil">✣</div>
      <p class="folio-placeholder">${escapeHtml(page.message||"")}</p>`;
    }
    folio.innerHTML=`<article class="folio-content">${inner}<div class="folio-footer">✥ &nbsp; ${index+1} &nbsp; ✥</div></article>`;
  }
  function updateControls(){
    const prev=$("prev-page"),next=$("next-page");
    prev.disabled=!open || currentPage===0;
    next.disabled=open && currentPage+(smallScreen()?1:2)>=pages.length;
    next.textContent=open?"Dalej →":"Otwórz →";
    $("page-indicator").textContent=open
      ? smallScreen()?`Karta ${Math.min(pages.length,currentPage+1)} z ${pages.length}`
        :`Karty ${currentPage+1}–${Math.min(currentPage+2,pages.length)} z ${pages.length}`
      :"Okładka";
  }
  function renderSpread(){
    pages=buildPages();
    currentPage=Math.min(currentPage,Math.max(0,pages.length-(smallScreen()?1:2)));
    if(!smallScreen())currentPage-=currentPage%2;
    renderFolio($("left-folio"),pages[currentPage],currentPage);
    renderFolio($("right-folio"),pages[Math.min(currentPage+1,pages.length-1)],Math.min(currentPage+1,pages.length-1));
    updateControls();
  }
  function updatePreview(){
    $("cover-title").textContent=plainText(state.character)||"Kronika postaci";
    $("cover-subtitle").textContent=plainText(state.subtitle)||"Dzieje, które czekają na zapisanie";
    $("cover-year").textContent="ANNO DOMINI · "+(plainText(state.year)||"—");
    $("book-cover").className="book-cover cover-"+safeCover(state.cover)+(busy?" is-opening":"");
    $("theme-label").textContent=PAPERS.find(x=>x.id===state.paper)?.name||"Pergamin";
    renderCrest();renderSpread();
  }
  function schedulePreview(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(updatePreview,140);
  }
  function openBook(){
    if(busy||open)return;
    busy=true;currentPage=0;
    const cover=$("book-cover");
    cover.classList.add("is-opening");
    setTimeout(()=>{
      cover.hidden=true;
      cover.classList.remove("is-opening");
      $("book-spread").hidden=false;
      $("desk-hint").textContent="✦ Przewracaj strony przyciskami poniżej ✦";
      open=true;busy=false;renderSpread();
    },390);
  }
  function closeBook(){
    busy=false;open=false;currentPage=0;
    $("book-spread").hidden=true;
    $("book-cover").hidden=false;
    $("book-cover").classList.remove("is-opening");
    $("desk-hint").textContent="✦ Kliknij okładkę, aby rozpocząć czytanie ✦";
    updateControls();
  }
  function turn(direction){
    if(busy)return;
    if(!open){if(direction>0)openBook();return}
    const step=smallScreen()?1:2;
    const next=currentPage+step*direction;
    if(next<0 || next>=pages.length)return;
    busy=true;
    const leaf=$("turn-leaf");
    leaf.classList.toggle("backwards",direction<0);
    leaf.classList.add("turning");
    setTimeout(()=>{
      currentPage=next;
      leaf.classList.remove("turning","backwards");
      busy=false;renderSpread();
    },460);
  }
  function exportBook(){
    const pack={
      format:"ksiegi-graczy/book",
      version:1,
      savedAt:new Date().toISOString(),
      book:{
        character:state.character,
        subtitle:state.subtitle,
        year:state.year,
        author:state.author,
        summary:state.summary,
        story:state.story,
        paper:state.paper,
        cover:state.cover,
        crest:state.crest,
        photos:state.photos.map(p=>({...p}))
      }
    };
    const blob=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=selectedFileName(state.character)+".ksiega.json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
    notify("Zapisano plik księgi. Będzie można go wykorzystać w przyszłej bibliotece.");
  }
  async function importBook(file){
    if(!file)return;
    if(file.size>15_000_000){notify("Plik księgi jest zbyt duży (limit 15 MB).");return}
    try{
      const parsed=JSON.parse(await file.text());
      if(parsed?.format!=="ksiegi-graczy/book" || parsed?.version!==1 || !parsed.book || typeof parsed.book!=="object")throw Error("Nieobsługiwany format księgi");
      const result=normalize(parsed.book);
      if(!confirm("Wczytać księgę? Zastąpi ona aktualny projekt w przeglądarce."))return;
      state=result;
      closeBook();fillFields();saveDraft();showTab("story");
      notify("Księga została wczytana.");
    }catch(e){notify("Nie udało się wczytać pliku: "+e.message)}
  }
  function wire(){
    document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.tab)));
    FIELDS.forEach(field=>$(field).addEventListener("input",event=>{
      state[field]=event.target.value; $("save-status").textContent="Trwa zapis…";
      schedulePreview();saveDraft();
    }));
    $("crest-upload").addEventListener("change",async event=>{
      const file=event.target.files?.[0];event.target.value="";
      if(!file)return;
      try{
        state.crest=await resizeImage(file,520,.82);
        renderCrest();saveDraft();updatePreview();notify("Herb umieszczono na okładce.");
      }catch(e){notify(e.message)}
    });
    $("remove-crest").addEventListener("click",()=>{state.crest=null;renderCrest();updatePreview();saveDraft()});
    $("photos-upload").addEventListener("change",async event=>{
      const files=Array.from(event.target.files||[]);event.target.value="";
      for(const file of files){
        if(state.photos.length>=MAX_IMAGES){notify("Możesz dodać najwyżej 12 ilustracji.");break}
        try{
          const data=await resizeImage(file,1050,.74);
          state.photos.push({id:"ilustracja-"+Date.now()+"-"+state.photos.length,data,caption:file.name.replace(/\.[^.]+$/,"").slice(0,160)});
        }catch(e){notify(file.name+": "+e.message)}
      }
      photoMarkup();updatePreview();saveDraft();
    });
    $("book-cover").addEventListener("click",openBook);
    $("next-page").addEventListener("click",()=>turn(1));
    $("prev-page").addEventListener("click",()=>turn(-1));
    $("reset-preview").addEventListener("click",closeBook);
    $("save-json").addEventListener("click",exportBook);
    $("load-json").addEventListener("change",event=>{
      const file=event.target.files?.[0];event.target.value="";
      importBook(file);
    });
    $("clear-project").addEventListener("click",()=>{
      if(!confirm("Wyczyścić całą historię, herb i ilustracje? Najpierw pobierz JSON, jeśli chcesz zachować projekt."))return;
      clearTimeout(saveTimer);state=DEFAULT();
      try{localStorage.removeItem(KEY)}catch(_){}
      closeBook();fillFields();showTab("story");notify("Rozpoczęto nowy rękopis.");
    });
    document.addEventListener("keydown",event=>{
      if(!open || ["INPUT","TEXTAREA"].includes(document.activeElement?.tagName) || busy)return;
      if(event.key==="ArrowRight"){event.preventDefault();turn(1)}
      if(event.key==="ArrowLeft"){event.preventDefault();turn(-1)}
      if(event.key==="Escape")closeBook();
    });
    addEventListener("resize",()=>{
      clearTimeout(resizeTimer);
      resizeTimer=setTimeout(()=>{if(!busy)renderSpread()},180);
    });
  }
  loadDraft();wire();fillFields();showTab("story");updateControls();
})();
