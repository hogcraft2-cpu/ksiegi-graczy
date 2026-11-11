/* Bezpieczne zarządzanie kronikami — hasła pozostają wyłącznie w pamięci tej karty.
 * Publiczne pliki GitHub Pages nie weryfikują haseł: robi to Worker Cloudflare.
 */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);
 const API=String(window.KSIEGI_API_BASE||"").trim().replace(/\/+$/,"");
 const configured=/^https:\/\/[\w.-]+(?::\d+)?$/.test(API) || /^http:\/\/localhost:\d+$/.test(API);
 let ownerId="",ownerPass="",adminPass="",book=null,illustration=null;
 const editable=["character","subtitle","year","author","summary","story","paper","cover","spine","frame"];
 const photoCap=12;
 let lastError="";
 function feedback(message,error=false){
   $("feedback").textContent=message;
   $("feedback").style.color=error?"#f2a88f":"#e3c28c";
 }
 async function api(path,options={}){
   if(!configured)throw Error("Panel jest chwilowo niedostępny. Spróbuj ponownie później.");
   const response=await fetch(API+path,{
     method:options.method||"GET",
     headers:{"Content-Type":"application/json"},
     body:options.body===undefined?undefined:JSON.stringify(options.body),
     cache:"no-store"
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Błąd połączenia z serwerem (HTTP "+response.status+")");
   return data;
 }
 function show(view){
   document.querySelectorAll("[data-view]").forEach(button=>button.classList.toggle("is-active",button.dataset.view===view));
   $("owner").hidden=view!=="owner";
   $("admin").hidden=view!=="admin";
   feedback("");
 }
 function getBookFromForm(){
   if(!book)throw Error("Nie wczytano księgi.");
   const copy={...book};
   for(const key of editable)copy[key]=$("edit-"+key).value;
   if(!copy.character.trim()||!copy.story.trim())throw Error("Imię postaci i historia nie mogą być puste.");
   return copy;
 }
 function setBookOnForm(data){
   book=data;
   for(const key of editable)$("edit-"+key).value=book[key]||(key==="frame"?"plain":"");
   $("editing-title").textContent="Edycja: "+book.character;
   $("editing-id").textContent="ID księgi: "+ownerId;
   $("crest-status").textContent=book.crest?"Herb obecny w księdze":"Brak herbu";
   renderImages();
 }
 function renderImages(){
   const list=$("edit-images-list");
   list.replaceChildren();
   (book?.photos||[]).forEach((photo,index)=>{
     const card=document.createElement("div");card.className="image-card";
     const img=document.createElement("img");img.src=photo.data;img.alt="Ilustracja "+(index+1);
     const input=document.createElement("input");input.type="text";input.maxLength=160;input.value=photo.caption||"";input.setAttribute("aria-label","Podpis ilustracji "+(index+1));
     input.addEventListener("input",()=>{book.photos[index].caption=input.value});
     const btn=document.createElement("button");btn.className="button button--danger";btn.type="button";btn.textContent="Usuń ilustrację";
     btn.addEventListener("click",()=>{book.photos.splice(index,1);renderImages();feedback("Obraz usunięto z projektu. Zapisz zmiany, aby zatwierdzić nową wersję.")});
     card.append(img,input,btn);list.append(card);
   });
 }
 function clearLogin(){
   ownerId="";ownerPass="";book=null;illustration=null;
   $("owner-login").hidden=false;$("owner-editor").hidden=true;
   $("owner-password").value="";$("generated-preview").hidden=true;
 }
 async function searchBooks(){
   const query=$("book-search").value.trim().toLocaleLowerCase("pl");
   const target=$("found-books");target.replaceChildren();
   const info=document.createElement("p");
   info.textContent="Szukam opublikowanych ksiąg…";target.append(info);
   try{
     const response=await api("/api/books");
     const books=(Array.isArray(response.books)?response.books:[])
       .filter(item=>typeof item.id==="string"&&/^[a-f0-9-]{36}$/i.test(item.id))
       .filter(item=>(String(item.title||"")+" "+String(item.subtitle||"")).toLocaleLowerCase("pl").includes(query))
       .slice(0,35);
     target.replaceChildren();
     if(!books.length){
       info.textContent="Nie znaleziono księgi o podanej nazwie.";
       target.append(info);return;
     }
     for(const item of books){
       const button=document.createElement("button");
       button.type="button";button.className="book-finder__item";
       const title=document.createElement("strong");
       title.textContent=item.title||"Kronika bez tytułu";
       const subtitle=document.createElement("span");
       subtitle.textContent=item.subtitle||"";
       const ident=document.createElement("code");
       ident.textContent=item.id;
       button.append(title,subtitle,ident);
       button.addEventListener("click",()=>{
         $("owner-id").value=item.id;
         target.replaceChildren();
         info.textContent="Wybrano księgę: "+(item.title||"Kronika")+". Teraz wpisz jej hasło.";
         target.append(info);
         $("owner-password").focus();
       });
       target.append(button);
     }
   }catch(error){
     info.textContent="Nie udało się pobrać listy ksiąg: "+error.message;
     target.replaceChildren();target.append(info);
   }
 }
 async function ownerOpen(event){
   event.preventDefault();
   try{
     const id=$("owner-id").value.trim(),password=$("owner-password").value;
     if(!/^[\da-f-]{36}$/i.test(id))throw Error("Wpisz prawidłowy identyfikator księgi.");
     if(!password)throw Error("Wpisz hasło księgi.");
     feedback("Otwieram księgę…");
     const out=await api("/api/books/"+encodeURIComponent(id)+"/access",{method:"POST",body:{password}});
     if(out?.data?.format!=="ksiegi-graczy/book"||!out.data.book)throw Error("Nieprawidłowy format księgi.");
     ownerId=id;ownerPass=password;
     $("owner-password").value="";
     setBookOnForm(out.data.book);
     $("owner-login").hidden=true;$("owner-editor").hidden=false;
     feedback("Księga została odblokowana. Możesz zmieniać jej treść i obrazy.");
   }catch(err){feedback(err.message,true)}
 }
 async function saveEdits(){
   try{
     if(!ownerId||!ownerPass)throw Error("Najpierw odblokuj księgę.");
     const updated=getBookFromForm();
     const size=new TextEncoder().encode(JSON.stringify({format:"ksiegi-graczy/book",version:1,book:updated})).length;
     if(size>850_000)throw Error("Księga jest zbyt duża do zapisania. Usuń lub zmniejsz część ilustracji.");
     feedback("Zapisuję kronikę na serwerze…");
     await api("/api/books/"+encodeURIComponent(ownerId),{method:"PUT",body:{password:ownerPass,book:updated}});
     book=updated;
     $("editing-title").textContent="Edycja: "+book.character;
     feedback("Zapisano. Zmiany są już dostępne w bibliotece.");
   }catch(err){feedback(err.message,true)}
 }
 async function deleteOwner(){
   if(!ownerId)return;
   const title=book?.character||"księgę";
   const typed=prompt("Aby nieodwracalnie usunąć księgę, wpisz jej imię postaci dokładnie:\n"+title);
   if(typed!==title){if(typed!==null)feedback("Usuwanie anulowano — nazwa nie pasuje.",true);return}
   try{
     await api("/api/books/"+encodeURIComponent(ownerId),{method:"DELETE",body:{password:ownerPass}});
     clearLogin();feedback("Księga została usunięta z publicznej biblioteki.");
   }catch(err){feedback(err.message,true)}
 }
 async function changePassword(){
   const fresh=$("new-password").value;
   if(!fresh){feedback("Wpisz nowe hasło.",true);return}
   if(new TextEncoder().encode(fresh).byteLength>4096){feedback("Hasło przekracza techniczny limit 4096 bajtów.",true);return}
   if(!confirm("Zmienić hasło do tej księgi? Poprzednie hasło przestanie działać."))return;
   try{
     await api("/api/books/"+encodeURIComponent(ownerId)+"/password",{method:"POST",body:{password:ownerPass,newPassword:fresh}});
     ownerPass=fresh;$("new-password").value="";
     feedback("Hasło zmieniono. Zapisz je w bezpiecznym miejscu.");
   }catch(err){feedback(err.message,true)}
 }
 async function compressImage(img,max=960,target=160_000){
   const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
   let data="";
   for(const q of [.74,.60,.46,.32,.22]){
     data=canvas.toDataURL("image/webp",q);
     if(data.length<=target)return data;
   }
   for(let n=0;n<7;n++){
     const small=document.createElement("canvas");
     small.width=Math.max(1,Math.round(canvas.width*.82));
     small.height=Math.max(1,Math.round(canvas.height*.82));
     small.getContext("2d").drawImage(canvas,0,0,small.width,small.height);
     canvas.width=small.width;canvas.height=small.height;
     canvas.getContext("2d").drawImage(small,0,0);
     data=canvas.toDataURL("image/webp",.42);
     if(data.length<=target)return data;
   }
   throw Error("Obraz jest za duży — użyj mniejszego pliku.");
 }
 async function shrink(file,max=960){
   if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Dozwolone są obrazy JPG, PNG i WebP.");
   if(file.size>15_000_000)throw Error("Obraz jest zbyt duży (maks. 15 MB).");
   const url=URL.createObjectURL(file);
   try{
     const image=new Image();image.src=url;
     await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error("Nie udało się odczytać obrazu."))});
     return await compressImage(image,max,max<=500?105_000:160_000);
   }finally{URL.revokeObjectURL(url)}
 }
 async function shrinkGenerated(dataURL){
   if(typeof dataURL!=="string"||!/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataURL))throw Error("Niepoprawny obraz AI.");
   const image=new Image();image.src=dataURL;
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error("Nie udało się wczytać wygenerowanego obrazu."))});
   return compressImage(image,960,160_000);
 }
 async function imagesInput(event){
   const files=Array.from(event.target.files||[]);event.target.value="";
   for(const file of files){
     if(book.photos.length>=photoCap){feedback("Osiągnięto limit 12 ilustracji.",true);break}
     try{
       const data=await shrink(file);
       book.photos.push({id:crypto.randomUUID(),data,caption:file.name.replace(/\.[^.]+$/,"").slice(0,160)});
     }catch(err){feedback(err.message,true)}
   }
   renderImages();feedback("Obrazy zostały dodane. Zapisz zmiany, aby zaktualizować księgę.");
 }
 async function crestInput(event){
   const file=event.target.files?.[0];event.target.value="";
   if(!file)return;
   try{
     book.crest=await shrink(file,500);
     $("crest-status").textContent="Nowy herb wybrany";
     feedback("Herb został dodany. Zapisz zmiany, aby go zachować.");
   }catch(err){feedback(err.message,true)}
 }
 function suggestScene(){
   const text=$("edit-story").value.trim();
   if(!text){feedback("Najpierw dodaj tekst kroniki.",true);return}
   const raw=text.replace(/^Rozdzia[łl][^\n]*\n/i,"").trim();
   const first=raw.split(/\n\s*\n/).filter(x=>x.length>50)[0]||raw;
   $("scene-prompt").value=first.replace(/\s+/g," ").slice(0,530);
   feedback("Wybrano fragment opowieści. Możesz doprecyzować opis sceny.");
 }
 async function generateImage(){
   const scene=$("scene-prompt").value.trim();
   if(scene.length<10){feedback("Najpierw opisz scenę, którą chcesz przedstawić.",true);return}
   const button=$("generate-image");button.disabled=true;
   try{
     feedback("Generowanie iluminacji roku 1400…");
     const data=await api("/api/books/"+encodeURIComponent(ownerId)+"/illustrate",{method:"POST",body:{password:ownerPass,scene}});
     illustration=data.image;
     $("generated-image").src=illustration;
     $("generated-preview").hidden=false;
     feedback("Gotowe! Pozostało "+data.remaining+" generowań na dziś. Dodaj obraz do księgi.");
   }catch(err){feedback(err.message,true)}
   finally{button.disabled=false}
 }
 async function attachImage(){
   if(!illustration)return;
   if(book.photos.length>=photoCap){feedback("Księga ma już 12 ilustracji.",true);return}
   try{
     const compressed=await shrinkGenerated(illustration);
     book.photos.push({id:crypto.randomUUID(),data:compressed,caption:$("scene-prompt").value.trim().slice(0,160)});
     renderImages();$("generated-preview").hidden=true;illustration=null;
     feedback("Dodano rycinę. Zapisz zmiany, aby udostępnić ją w bibliotece.");
   }catch(err){feedback(err.message,true)}
 }
 function adminEntry(item){
   const row=document.createElement("article");row.className="admin-entry";
   const details=document.createElement("div");
   const title=document.createElement("h4");title.textContent=item.title;
   const subtitle=document.createElement("p");subtitle.textContent=item.subtitle+" · Rok "+item.year;
   const id=document.createElement("code");id.textContent=item.id;
   const status=document.createElement("div");status.className="admin-entry__status"+(item.published?"":" off");
   status.textContent=item.static?"Księga archiwalna":item.published?"Widoczna w bibliotece":"Ukryta";
   details.append(title,subtitle,id,status);
   const actions=document.createElement("div");actions.className="admin-entry__actions";
   const toggle=document.createElement("button");toggle.className="button";toggle.type="button";
   toggle.textContent=item.static?"Pozycja statyczna":item.published?"Ukryj":"Opublikuj";
   toggle.disabled=!!item.static;
   toggle.title=item.static?"Starsze księgi można usunąć, ale nie można ich ukryć bez ponownego dodania do katalogu.":"Zmień widoczność księgi";
   toggle.addEventListener("click",async()=>{
     try{
       await api("/api/admin/publish",{method:"POST",body:{adminPassword:adminPass,id:item.id,published:!item.published}});
       feedback("Zmieniono widoczność księgi "+item.title+".");await loadAdminList();
     }catch(err){feedback(err.message,true)}
   });
   const del=document.createElement("button");del.type="button";del.className="button button--danger";del.textContent="Usuń";
   del.addEventListener("click",async()=>{
     const typed=prompt("Usunąć księgę na stałe, bez hasła autora?\nWpisz dokładnie: "+item.title);
     if(typed!==item.title)return;
     try{
       await api("/api/admin/delete",{method:"POST",body:{adminPassword:adminPass,id:item.id}});
       feedback("Administrator usunął księgę "+item.title+".");await loadAdminList();
     }catch(err){feedback(err.message,true)}
   });
   actions.append(toggle,del);row.append(details,actions);
   return row;
 }
 async function loadAdminList(){
   const data=await api("/api/admin/list",{method:"POST",body:{adminPassword:adminPass}});
   const list=$("admin-list");list.replaceChildren();
   if(!data.books?.length){const empty=document.createElement("p");empty.textContent="Nie ma jeszcze żadnej księgi online.";list.append(empty)}
   else data.books.forEach(b=>list.append(adminEntry(b)));
 }
 async function adminLogin(event){
   event.preventDefault();
   const pass=$("admin-password").value;
   if(!pass){feedback("Wpisz hasło administratora.",true);return}
   try{
     adminPass=pass;await loadAdminList();
     $("admin-password").value="";
     feedback("Lista ksiąg została pobrana. Możesz ukrywać i usuwać pozycje.");
   }catch(err){adminPass="";feedback(err.message,true)}
 }
 function init(){
   document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>show(btn.dataset.view)));
   $("owner-form").addEventListener("submit",ownerOpen);
   $("search-books").addEventListener("click",searchBooks);
   $("book-search").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchBooks()}});
   const requested=new URLSearchParams(location.search).get("book");
   if(requested&&/^[a-f0-9-]{36}$/i.test(requested)){
     $("owner-id").value=requested;
     const hint=document.createElement("p");
     hint.textContent="Identyfikator został wypełniony automatycznie. Wpisz hasło właściciela.";
     $("found-books").append(hint);
   }
   $("admin-form").addEventListener("submit",adminLogin);
   $("save-edits").addEventListener("click",saveEdits);
   $("leave-editor").addEventListener("click",()=>{clearLogin();feedback("Zamknięto edytor.")});
   $("delete-owner").addEventListener("click",deleteOwner);
   $("change-password").addEventListener("click",changePassword);
   $("edit-images").addEventListener("change",imagesInput);
   $("edit-crest").addEventListener("change",crestInput);
   $("clear-crest").addEventListener("click",()=>{if(!book)return;book.crest=null;$("crest-status").textContent="Herb usunięty lokalnie";feedback("Zapisz zmiany, aby usunąć herb z księgi.")});
   $("suggest-scene").addEventListener("click",suggestScene);
   $("generate-image").addEventListener("click",generateImage);
   $("attach-image").addEventListener("click",attachImage);

 }
 init();
})();
