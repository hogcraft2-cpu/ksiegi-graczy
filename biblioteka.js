/* Publiczna biblioteka Skryptorium. Bez routera i bez zmiany adresu URL.
   books/catalog.json = spis opublikowanych tomów; books/*.json = projekty z kreatora. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const SAFE_BOOK=/^books\/[a-z0-9][a-z0-9-]*\.json$/;
  const SAFE_ASSET=/^(?:\.\/)?assets\/[a-z0-9\/_-]+\.(?:svg|png|jpe?g|webp)$/i;
  const SAFE_IMAGE=/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
  const COVERS=["burgundy","forest","midnight","chestnut"];
  const PAPERS=["classic","royal","battle","monastery","nocturne"];
  const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const safeImage=value=>typeof value==="string"&&value.length<8_000_000&&(SAFE_IMAGE.test(value)||SAFE_ASSET.test(value))?value:null;
  const cleaned=(value,max=300)=>typeof value==="string"?value.slice(0,max):"";
  const isMobile=()=>window.matchMedia("(max-width: 600px)").matches;
  const reduceMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let library=[],filtered=[],bookData=null,pages=[],pageIndex=0,activeButton=null;
  let opening=false,turning=false,resizeTimer,requestSerial=0;

  function status(message){$("announcement").textContent=message}
  function normalizeCatalog(data){
    if(!data||data.version!==1||!Array.isArray(data.books))throw new Error("Nieprawidłowy katalog ksiąg");
    const seen=new Set();
    return data.books.filter(item=>{
      if(!item||typeof item!=="object"||typeof item.id!=="string"||seen.has(item.id))return false;
      if(!SAFE_BOOK.test(item.file||""))return false;
      seen.add(item.id);return true;
    }).map(item=>({
      id:item.id,
      file:item.file,
      title:cleaned(item.title,85)||"Kronika bez tytułu",
      subtitle:cleaned(item.subtitle,110)||"Dzieje bohatera",
      year:cleaned(item.year,30),
      cover:COVERS.includes(item.cover)?item.cover:"burgundy",
      paper:PAPERS.includes(item.paper)?item.paper:"classic"
    }));
  }
  async function loadCatalog(){
    try{
      const response=await fetch("./books/catalog.json",{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const data=await response.json();
      library=normalizeCatalog(data);
      filterBooks();
    }catch(error){
      console.error("Błąd katalogu:",error);
      $("shelves").replaceChildren();
      showEmpty("Nie udało się wczytać katalogu. Sprawdź publikację pliku books/catalog.json.");
      $("book-count").textContent="Brak połączenia z katalogiem";
    }
  }
  function showEmpty(message){
    $("catalog-empty").hidden=false;
    $("catalog-empty-text").textContent=message;
  }
  function makeSpine(item,index){
    const button=document.createElement("button");
    button.className="book-spine";
    button.type="button";
    button.dataset.cover=item.cover;
    button.style.setProperty("--book-height",String(188+(index*17)%44)+"px");
    button.style.setProperty("--book-width",String(78+(index*11)%16)+"px");
    button.style.setProperty("--tilt",((index%5)-2)*.65+"deg");
    button.title=item.title+" — "+item.subtitle;
    button.setAttribute("aria-label","Otwórz księgę "+item.title+". "+item.subtitle);
    const seal=document.createElement("span");seal.className="book-spine__seal";seal.textContent="✥";
    const text=document.createElement("span");text.className="book-spine__text";
    const title=document.createElement("span");title.className="book-spine__title";title.textContent=item.title;
    const subtitle=document.createElement("span");subtitle.className="book-spine__subtitle";subtitle.textContent=item.subtitle;
    text.append(title,subtitle);
    const year=document.createElement("span");year.className="book-spine__year";year.textContent=item.year||"❧";
    button.append(seal,text,year);
    button.addEventListener("click",()=>pullBook(item,button));
    return button;
  }
  function makeShelf(items,shelfIndex){
    const shelf=document.createElement("div");shelf.className="shelf";
    const row=document.createElement("div");row.className="shelf__books";
    row.setAttribute("role","group");row.setAttribute("aria-label","Półka "+(shelfIndex+1));
    if(items.length){
      items.forEach((item,i)=>row.append(makeSpine(item,shelfIndex*9+i)));
    }else{
      const empty=document.createElement("p");empty.className="shelf__empty";
      empty.textContent="Miejsce na kolejne kroniki";row.append(empty);
    }
    const ledge=document.createElement("div");ledge.className="shelf__ledge";ledge.setAttribute("aria-hidden","true");
    shelf.append(row,ledge);return shelf;
  }
  function renderShelves(){
    const shelves=$("shelves");shelves.replaceChildren();
    if(!filtered.length){
      showEmpty(library.length?"Żadna księga nie odpowiada wyszukiwaniu.":"Nie opublikowano jeszcze żadnej księgi.");
    }else $("catalog-empty").hidden=true;
    const rows=Math.max(2,Math.ceil(filtered.length/9));
    for(let i=0;i<rows;i++)shelves.append(makeShelf(filtered.slice(i*9,(i+1)*9),i));
    $("book-count").textContent=library.length===1?"1 księga w zbiorach":library.length+" ksiąg w zbiorach";
  }
  function filterBooks(){
    const q=$("search-books").value.trim().toLocaleLowerCase("pl");
    filtered=library.filter(item=>(item.title+" "+item.subtitle+" "+item.year).toLocaleLowerCase("pl").includes(q));
    renderShelves();
  }
  async function fetchBook(item){
    const response=await fetch("./"+item.file,{cache:"no-store"});
    if(!response.ok)throw new Error("Nie udało się pobrać księgi (HTTP "+response.status+")");
    const data=await response.json();
    if(!data||data.format!=="ksiegi-graczy/book"||data.version!==1||!data.book)throw new Error("Nieobsługiwany plik księgi");
    const raw=data.book;
    return {
      character:cleaned(raw.character,85)||item.title,
      subtitle:cleaned(raw.subtitle,110)||item.subtitle,
      year:cleaned(raw.year,30)||item.year,
      author:cleaned(raw.author,100),
      summary:cleaned(raw.summary,6000),
      story:cleaned(raw.story,180000),
      crest:safeImage(raw.crest),
      paper:PAPERS.includes(raw.paper)?raw.paper:item.paper,
      cover:COVERS.includes(raw.cover)?raw.cover:item.cover,
      photos:Array.isArray(raw.photos)?raw.photos.slice(0,12).map(p=>({
        data:safeImage(p?.data),
        caption:cleaned(p?.caption,160)
      })).filter(p=>p.data):[]
    };
  }
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  async function pullBook(item,button){
    if(opening||!$("reader").hidden)return;
    opening=true;
    activeButton=button;
    const ticket=++requestSerial;
    let bookResult;
    const fetchJob=fetchBook(item).then(data=>{bookResult=data}).catch(error=>{bookResult={error}});
    const runner=$("pull-animation");
    let flight=Promise.resolve();
    if(!reduceMotion()){
      const rect=button.getBoundingClientRect();
      runner.replaceChildren();
      runner.style.left=rect.left+"px";
      runner.style.top=rect.top+"px";
      runner.style.width=rect.width+"px";
      runner.style.height=rect.height+"px";
      const clone=button.cloneNode(true);clone.disabled=true;clone.removeAttribute("aria-label");clone.classList.remove("is-selected");runner.append(clone);
      runner.hidden=false;
      button.classList.add("is-selected");
      const targetX=window.innerWidth/2-(rect.left+rect.width/2);
      const targetY=window.innerHeight/2-(rect.top+rect.height/2);
      const scale=Math.min(2.05,Math.max(1.42,window.innerHeight/Math.max(400,rect.height)));
      try{
        const animation=runner.animate([
          {transform:"translate3d(0,0,0) rotateY(0deg) scale(1)",opacity:1,offset:0},
          {transform:"translate3d(0,-43px,80px) rotateY(-12deg) scale(1.15)",opacity:1,offset:.28},
          {transform:`translate3d(${targetX}px,${targetY}px,180px) rotateY(-68deg) scale(${scale})`,opacity:.96,offset:.83},
          {transform:`translate3d(${targetX}px,${targetY}px,200px) rotateY(-89deg) scale(${scale*1.08})`,opacity:0,offset:1}
        ],{duration:900,easing:"cubic-bezier(.22,.65,.18,1)",fill:"forwards"});
        flight=animation.finished.catch(()=>{});
      }catch(_){flight=delay(900)}
    }
    try{
      await Promise.all([fetchJob,flight]);
      if(ticket!==requestSerial)return;
      if(bookResult?.error)throw bookResult.error;
      openReader(bookResult);
    }catch(error){
      console.error("Nie udało się otworzyć księgi:",error);
      status("Nie udało się wczytać księgi "+item.title+".");
      alert("Nie udało się otworzyć księgi: "+error.message);
    }finally{
      runner.hidden=true;runner.replaceChildren();
      button.classList.remove("is-selected");
      opening=false;
    }
  }
  function wordsToChunks(text,limit){
    const words=text.replace(/\s+/g," ").trim().split(" ").filter(Boolean);
    const chunks=[];let fragment="";
    for(let word of words){
      while(word.length>limit){
        if(fragment){chunks.push(fragment);fragment=""}
        chunks.push(word.slice(0,limit));word=word.slice(limit);
      }
      if(!word)continue;
      if(fragment.length+word.length+1>limit){chunks.push(fragment);fragment=word}
      else fragment+=(fragment?" ":"")+word;
    }
    if(fragment)chunks.push(fragment);
    return chunks;
  }
  function maxCharacters(){
    const page=$("page-left");
    const width=Math.max(235,page.clientWidth||380);
    const height=Math.max(250,page.clientHeight||520);
    const chars=Math.round(width*height/810);
    return Math.min(540,Math.max(155,chars));
  }
  function paginateText(raw,initialTitle){
    const cap=maxCharacters();
    const paragraphs=String(raw||"").replace(/\r\n?/g,"\n").trim().split(/\n\s*\n/).map(s=>s.replace(/\n/g," ").trim()).filter(Boolean);
    const result=[];
    let currentTitle=initialTitle,bucket=[],count=0;
    const flush=()=>{if(bucket.length){result.push({kind:"text",title:currentTitle,paragraphs:bucket});bucket=[];count=0}};
    for(const paragraph of paragraphs){
      const isChapter=paragraph.length<155 && /^(?:Rozdzia[łl](?:\b|\s)|Prolog\b|Epilog\b|#\s+)/i.test(paragraph);
      if(isChapter){flush();currentTitle=paragraph.replace(/^#\s*/,"");continue}
      for(const chunk of wordsToChunks(paragraph,Math.max(80,cap-35))){
        if(bucket.length&&count+chunk.length+20>cap)flush();
        bucket.push(chunk);count+=chunk.length+20;
      }
    }
    flush();
    return result;
  }
  function compilePages(book){
    const out=[{kind:"title",title:book.character,subtitle:book.subtitle,year:book.year,author:book.author,crest:book.crest}];
    out.push(...paginateText(book.summary||"Dzieje zapisane w księdze.", "Przedmowa"));
    out.push(...paginateText(book.story||"Kolejne karty tej kroniki czekają na zapisanie.", "Kronika"));
    book.photos.forEach((photo,index)=>out.push({kind:"image",title:"Rycina "+(index+1),data:photo.data,caption:photo.caption}));
    out.push({kind:"end",title:"Koniec zapisanych dziejów"});
    if(out.length%2)out.push({kind:"blank"});
    return out;
  }
  function drawPage(el,page,pageNo,book){
    el.dataset.paper=book.paper;
    const top='<div class="page-kicker">❧ &nbsp; LIBER CHRONICARUM &nbsp; ❧</div>';
    let body="";
    if(page.kind==="title"){
      body=`${top}<h3 class="page-title">${escapeHTML(page.title)}</h3><div class="page-rule"></div>
      ${page.crest?`<img class="page-crest" src="${page.crest}" alt="Herb postaci">`:'<div class="page-crest-fallback">⚜</div>'}
      <p class="page-subtitle">${escapeHTML(page.subtitle)}</p><p class="page-year">ANNO DOMINI ${escapeHTML(page.year||"")}</p>
      <p class="page-subtitle">${escapeHTML(page.author?"Spisał: "+page.author:"")}</p>`;
    }else if(page.kind==="text"){
      body=`${top}<h3 class="page-title">${escapeHTML(page.title||"Dzieje")}</h3><div class="page-rule"></div>
      <div class="page-body" lang="pl">${page.paragraphs.map(p=>`<p>${escapeHTML(p)}</p>`).join("")}</div>`;
    }else if(page.kind==="image"){
      body=`${top}<h3 class="page-title">${escapeHTML(page.title)}</h3>
      <img class="page-image" src="${page.data}" alt="${escapeHTML(page.caption||"Ilustracja kroniki")}">
      <p class="page-caption">${escapeHTML(page.caption||"Obraz z kroniki")}</p>`;
    }else if(page.kind==="end"){
      body=`${top}<div class="page-crest-fallback">❧</div><h3 class="page-title">${escapeHTML(page.title)}</h3><p class="page-placeholder">Dalsze losy pozostają jeszcze nieopisane.</p>`;
    }else{
      body=`${top}<div class="page-crest-fallback">✥</div><p class="page-placeholder">Karta przeznaczona na dalsze dzieje.</p>`;
    }
    el.innerHTML=`<div class="page-content">${body}<div class="page-index">✥ &nbsp; ${pageNo+1} &nbsp; ✥</div></div>`;
  }
  function paint(){
    if(!bookData)return;
    const per=isMobile()?1:2;
    pageIndex=Math.max(0,Math.min(pageIndex,pages.length-per));
    if(per===2)pageIndex-=pageIndex%2;
    drawPage($("page-left"),pages[pageIndex],pageIndex,bookData);
    drawPage($("page-right"),pages[Math.min(pages.length-1,pageIndex+1)],Math.min(pages.length-1,pageIndex+1),bookData);
    $("reader-prev").disabled=pageIndex===0;
    $("reader-next").disabled=pageIndex+per>=pages.length;
    $("reader-counter").textContent=per===1
      ?`Karta ${pageIndex+1} z ${pages.length}`
      :`Karty ${pageIndex+1}–${Math.min(pages.length,pageIndex+2)} z ${pages.length}`;
  }
  function openReader(book){
    bookData=book;pageIndex=0;
    $("reader-title").textContent=book.character;
    $("reader-subtitle").textContent=book.subtitle;
    $("reader-eyebrow").textContent=book.year?"KSIĘGA Z BIBLIOTEKI · ROK "+book.year:"KSIĘGA Z BIBLIOTEKI";
    $("reader").hidden=false;
    document.body.classList.add("is-reading");
    pages=compilePages(book);paint();
    $("close-reader").focus();
    status("Otwarto kronikę: "+book.character);
  }
  function closeReader(){
    if($("reader").hidden||turning)return;
    $("reader").hidden=true;
    document.body.classList.remove("is-reading");
    bookData=null;pages=[];pageIndex=0;
    if(activeButton?.isConnected)activeButton.focus();
    status("Wrócono do biblioteki.");
  }
  function turnPage(direction){
    if(turning||!bookData)return;
    const step=isMobile()?1:2;
    const next=pageIndex+direction*step;
    if(next<0||next>=pages.length)return;
    if(reduceMotion()){pageIndex=next;paint();return}
    turning=true;
    const leaf=$("reader-flip");
    leaf.className="reader__flip "+(direction<0?"is-back ":"")+"is-flipping";
    const finish=()=>{
      pageIndex=next;paint();
      leaf.className="reader__flip";
      turning=false;
    };
    let done=false;
    const once=()=>{if(done)return;done=true;finish()};
    leaf.addEventListener("animationend",once,{once:true});
    setTimeout(once,540);
  }
  function handleKeys(event){
    if($("reader").hidden)return;
    if(event.key==="Escape"){event.preventDefault();closeReader();return}
    if(event.key==="ArrowLeft"){event.preventDefault();turnPage(-1)}
    if(event.key==="ArrowRight"){event.preventDefault();turnPage(1)}
    if(event.key==="Tab"){
      const controls=[$("close-reader"),$("reader-prev"),$("reader-next")].filter(el=>!el.disabled);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  }
  $("search-books").addEventListener("input",filterBooks);
  $("close-reader").addEventListener("click",closeReader);
  $("reader").querySelector("[data-dismiss]").addEventListener("click",closeReader);
  $("reader-prev").addEventListener("click",()=>turnPage(-1));
  $("reader-next").addEventListener("click",()=>turnPage(1));
  document.addEventListener("keydown",handleKeys);
  window.addEventListener("resize",()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      if(!bookData||turning)return;
      const progress=pages.length?pageIndex/pages.length:0;
      pages=compilePages(bookData);
      const step=isMobile()?1:2;
      pageIndex=Math.min(Math.floor(progress*pages.length/step)*step,pages.length-step);
      paint();
    },180);
  });
  loadCatalog();
})();
