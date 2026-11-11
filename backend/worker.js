/* Skryptorium API • Cloudflare Workers + D1 + R2 + Workers AI
 * Zero credentials in the public GitHub Pages files.
 * Requires D1 binding DB, R2 binding BOOKS and Cloudflare secret ADMIN_SECRET.
 */
const encoder=new TextEncoder();
const decodeHex=x=>Uint8Array.from(x.match(/.{1,2}/g)||[],c=>parseInt(c,16));
const toHex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
const PASSWORD_ITERATIONS=160000;
const PUBLIC_LIMIT=3_000_000;
const IMAGE_LIMIT=2_500_000;
const SPINES=["illuminated","ironbound","monastic","merchant"];
const PAPERS=["classic","royal","battle","monastery","nocturne"];
const COVERS=["burgundy","forest","midnight","chestnut"];
const DATA_IMAGE=/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i;
const ID_RE=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/;
const today=()=>new Date().toISOString().slice(0,10);
const timestamp=()=>new Date().toISOString();
const clean=(value,max)=>typeof value==="string"?value.slice(0,max):"";
const origins=env=>(env.ALLOWED_ORIGINS||"https://hogcraft2-cpu.github.io").split(",").map(s=>s.trim()).filter(Boolean);
function cors(request,env){
 const origin=request.headers.get("Origin")||"";
 const head={"Vary":"Origin","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 if(origins(env).includes(origin)){
   head["Access-Control-Allow-Origin"]=origin;
   head["Access-Control-Allow-Methods"]="GET,POST,PUT,DELETE,OPTIONS";
   head["Access-Control-Allow-Headers"]="Content-Type";
   head["Access-Control-Max-Age"]="600";
 }
 return head;
}
function result(request,env,data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json;charset=utf-8",...cors(request,env)}});
}
class ApiError extends Error{
 constructor(status,message){super(message);this.status=status}
}
async function bodyJSON(request){
 if(Number(request.headers.get("Content-Length")||0)>PUBLIC_LIMIT)throw new ApiError(413,"Zbyt duży plik księgi (maks. 3 MB).");
 if(!/application\/json/i.test(request.headers.get("Content-Type")||""))throw new ApiError(415,"Oczekiwano danych JSON.");
 const text=await request.text();
 if(text.length>PUBLIC_LIMIT)throw new ApiError(413,"Zbyt duży plik księgi.");
 try{return JSON.parse(text)}catch(_){throw new ApiError(400,"Niepoprawny JSON.")}
}
async function hashPassword(password,salt){
 const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:decodeHex(salt),iterations:PASSWORD_ITERATIONS,hash:"SHA-256"},key,256);
 return toHex(bits);
}
function sameHex(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
 let different=0;
 for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);
 return different===0;
}
async function sha256(str){return toHex(await crypto.subtle.digest("SHA-256",encoder.encode(str)))}
async function ipKey(request,env,scope){
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const key=env.RATE_SALT||env.ADMIN_SECRET||"skryptorium-public";
 return scope+":"+(await sha256(key+":"+ip)).slice(0,32);
}
async function throttle(env,key,max,windowSeconds,consume=false){
 const now=Math.floor(Date.now()/1000);
 const row=await env.DB.prepare("SELECT hits, expires FROM quotas WHERE key = ?").bind(key).first();
 if(row&&Number(row.expires)>now&&Number(row.hits)>=max)throw new ApiError(429,"Zbyt wiele prób. Spróbuj później.");
 if(consume){
   const hits=row&&Number(row.expires)>now?Number(row.hits)+1:1;
   const expires=row&&Number(row.expires)>now?Number(row.expires):now+windowSeconds;
   await env.DB.prepare("INSERT INTO quotas(key,hits,expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET hits=excluded.hits,expires=excluded.expires")
    .bind(key,hits,expires).run();
 }
}
function validateBook(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new ApiError(400,"Nieprawidłowe dane księgi.");
 const book={
   character:clean(raw.character,85).trim(),subtitle:clean(raw.subtitle,110),
   year:clean(raw.year,30),author:clean(raw.author,100),
   summary:clean(raw.summary,700),story:clean(raw.story,100000),
   cover:COVERS.includes(raw.cover)?raw.cover:"burgundy",
   paper:PAPERS.includes(raw.paper)?raw.paper:"classic",
   spine:SPINES.includes(raw.spine)?raw.spine:"illuminated",
   crest:null,photos:[]
 };
 if(!book.character||!book.story.trim())throw new ApiError(422,"Podaj imię postaci i jej historię.");
 if(typeof raw.crest==="string"&&raw.crest){
   if(raw.crest.length>IMAGE_LIMIT||!DATA_IMAGE.test(raw.crest))throw new ApiError(422,"Herb ma niepoprawny format lub jest za duży.");
   book.crest=raw.crest;
 }
 if(raw.photos!==undefined&&!Array.isArray(raw.photos))throw new ApiError(422,"Nieprawidłowe ilustracje.");
 for(const photo of (raw.photos||[]).slice(0,12)){
   if(!photo||typeof photo!=="object"||typeof photo.data!=="string"||photo.data.length>IMAGE_LIMIT||!DATA_IMAGE.test(photo.data))throw new ApiError(422,"Jeden z obrazów jest zbyt duży lub ma niepoprawny format.");
   book.photos.push({id:clean(photo.id,50)||crypto.randomUUID(),data:photo.data,caption:clean(photo.caption,160)});
 }
 if(JSON.stringify(book).length>PUBLIC_LIMIT)throw new ApiError(413,"Cała księga przekracza 3 MB. Zmniejsz ilustracje.");
 return book;
}
function publicRow(row){
 return {id:row.id,file:null,title:row.title,subtitle:row.subtitle,year:row.year,cover:row.cover,paper:row.paper,spine:row.spine,updatedAt:row.updated_at};
}
async function getRow(env,id){
 return await env.DB.prepare("SELECT * FROM books WHERE id=?").bind(id).first();
}
async function objectBook(env,id){
 const object=await env.BOOKS.get("books/"+id+".json");
 if(!object)throw new ApiError(404,"Nie znaleziono pliku księgi.");
 try{return await object.json()}catch(_){throw new ApiError(500,"Plik księgi jest uszkodzony.")}
}
async function checkOwner(request,env,id,password){
 const row=await getRow(env,id);
 if(!row)throw new ApiError(404,"Księga nie istnieje.");
 const key=await ipKey(request,env,"owner:"+id);
 await throttle(env,key,6,15*60);
 if(typeof password!=="string"||password.length>160||password.length<1){
   await throttle(env,key,6,15*60,true);
   throw new ApiError(401,"Niepoprawne hasło.");
 }
 const hash=await hashPassword(password,row.salt);
 if(!sameHex(row.hash,hash)){
   await throttle(env,key,6,15*60,true);
   throw new ApiError(401,"Niepoprawne hasło.");
 }
 await env.DB.prepare("DELETE FROM quotas WHERE key=?").bind(key).run();
 return row;
}
async function checkAdmin(request,env,password){
 if(!env.ADMIN_SECRET||env.ADMIN_SECRET.length<16)throw new ApiError(503,"Hasło administratora nie zostało skonfigurowane.");
 const key=await ipKey(request,env,"admin");
 await throttle(env,key,6,15*60);
 const valid=typeof password==="string" && password.length>=16&&password.length<=160 &&
   sameHex(await sha256(password),await sha256(env.ADMIN_SECRET));
 if(!valid){
   await throttle(env,key,6,15*60,true);
   throw new ApiError(401,"Niepoprawne hasło administratora.");
 }
 await env.DB.prepare("DELETE FROM quotas WHERE key=?").bind(key).run();
}
async function deleteBook(env,id){
 await env.BOOKS.delete("books/"+id+".json");
 await env.DB.prepare("DELETE FROM books WHERE id=?").bind(id).run();
}
async function handle(request,env){
 const url=new URL(request.url);
 const path=url.pathname.replace(/\/$/,"")||"/";
 if(path==="/api/health"&&request.method==="GET"){
   return result(request,env,{ok:true,storage:!!env.DB&&!!env.BOOKS,imageAI:!!env.AI});
 }
 if(!env.DB||!env.BOOKS)throw new ApiError(503,"Serwer nie ma podłączonych usług D1 i R2.");
 if(path==="/api/books"&&request.method==="GET"){
   const rows=await env.DB.prepare("SELECT id,title,subtitle,year,cover,paper,spine,updated_at FROM books WHERE published=1 ORDER BY created_at DESC LIMIT 250").all();
   return result(request,env,{version:1,books:(rows.results||[]).map(publicRow)});
 }
 if(path==="/api/books"&&request.method==="POST"){
   const data=await bodyJSON(request);
   const password=data.password;
   if(typeof password!=="string"||password.length<12||password.length>128)throw new ApiError(422,"Hasło musi mieć od 12 do 128 znaków.");
   const quotaKey=await ipKey(request,env,"create:"+today());
   await throttle(env,quotaKey,3,86400);
   const book=validateBook(data.book);
   const id=crypto.randomUUID();
   const salt=toHex(crypto.getRandomValues(new Uint8Array(16)));
   const hash=await hashPassword(password,salt);
   const now=timestamp();
   const file={format:"ksiegi-graczy/book",version:1,book};
   await env.BOOKS.put("books/"+id+".json",JSON.stringify(file),{httpMetadata:{contentType:"application/json"}});
   try{
     await env.DB.prepare("INSERT INTO books(id,title,subtitle,year,cover,paper,spine,created_at,updated_at,published,salt,hash,ai_uses,ai_day) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
       .bind(id,book.character,book.subtitle,book.year,book.cover,book.paper,book.spine,now,now,1,salt,hash,0,today()).run();
   }catch(error){await env.BOOKS.delete("books/"+id+".json");throw error}
   await throttle(env,quotaKey,3,86400,true);
   return result(request,env,{id,published:true,message:"Księga została opublikowana.",adminNote:"Zachowaj hasło i identyfikator księgi. Hasło nie jest odzyskiwalne."},201);
 }
 const single=path.match(/^\/api\/books\/([a-f\d-]{36})$/);
 if(single){
   const id=single[1];
   if(request.method==="GET"){
     const row=await getRow(env,id);
     if(!row||!row.published)throw new ApiError(404,"Księgi nie znaleziono.");
     return result(request,env,await objectBook(env,id));
   }
   if(request.method==="PUT"){
     const data=await bodyJSON(request);
     const old=await checkOwner(request,env,id,data.password);
     const book=validateBook(data.book);
     await env.BOOKS.put("books/"+id+".json",JSON.stringify({format:"ksiegi-graczy/book",version:1,book}),{httpMetadata:{contentType:"application/json"}});
     await env.DB.prepare("UPDATE books SET title=?,subtitle=?,year=?,paper=?,cover=?,spine=?,updated_at=? WHERE id=?")
       .bind(book.character,book.subtitle,book.year,book.paper,book.cover,book.spine,timestamp(),id).run();
     return result(request,env,{ok:true,id,published:!!old.published});
   }
   if(request.method==="DELETE"){
     const data=await bodyJSON(request);
     await checkOwner(request,env,id,data.password);
     await deleteBook(env,id);
     return result(request,env,{ok:true,deleted:id});
   }
 }
 const access=path.match(/^\/api\/books\/([a-f\d-]{36})\/access$/);
 if(access&&request.method==="POST"){
   const data=await bodyJSON(request);
   await checkOwner(request,env,access[1],data.password);
   return result(request,env,{id:access[1],data:await objectBook(env,access[1])});
 }
 const change=path.match(/^\/api\/books\/([a-f\d-]{36})\/password$/);
 if(change&&request.method==="POST"){
   const data=await bodyJSON(request);
   await checkOwner(request,env,change[1],data.password);
   if(typeof data.newPassword!=="string"||data.newPassword.length<12||data.newPassword.length>128)throw new ApiError(422,"Nowe hasło musi mieć od 12 do 128 znaków.");
   const salt=toHex(crypto.getRandomValues(new Uint8Array(16)));
   const hash=await hashPassword(data.newPassword,salt);
   await env.DB.prepare("UPDATE books SET salt=?,hash=? WHERE id=?").bind(salt,hash,change[1]).run();
   return result(request,env,{ok:true,message:"Hasło zostało zmienione."});
 }
 const ai=path.match(/^\/api\/books\/([a-f\d-]{36})\/illustrate$/);
 if(ai&&request.method==="POST"){
   const data=await bodyJSON(request);
   const row=await checkOwner(request,env,ai[1],data.password);
   if(!env.AI)throw new ApiError(503,"Generator ilustracji nie jest jeszcze włączony w Cloudflare.");
   const scene=clean(data.scene,650).trim();
   if(scene.length<10)throw new ApiError(422,"Opisz scenę w co najmniej 10 znakach.");
   const day=today();
   if(row.ai_day===day&&Number(row.ai_uses)>=3)throw new ApiError(429,"Limit 3 ilustracji dziennie dla tej księgi został wykorzystany.");
   const update=await env.DB.prepare("UPDATE books SET ai_uses=CASE WHEN ai_day=? THEN ai_uses+1 ELSE 1 END,ai_day=? WHERE id=? AND (ai_day<>? OR ai_uses<3)")
     .bind(day,day,ai[1],day).run();
   if(!update.meta?.changes)throw new ApiError(429,"Dzienny limit ilustracji został osiągnięty.");
   const prompt="An original hand-painted historical illuminated manuscript illustration depicting the following scene: "+
     scene+". Bohemia around the year 1400, authentic early fifteenth-century Central European medieval architecture, wool and linen period clothing, believable tools, candlelight or natural daylight, tempera and ink on aged parchment, subtle gold leaf accents, beautiful medieval book illumination, historically plausible. No modern objects, no contemporary fashions, no text, no letters, no lettering, no logos. Detailed composition.";
   const output=await env.AI.run("@cf/black-forest-labs/flux-1-schnell",{prompt:prompt.slice(0,2000),steps:4});
   if(!output?.image)throw new ApiError(502,"Model nie zwrócił obrazu.");
   return result(request,env,{image:"data:image/jpeg;base64,"+output.image,remaining:Math.max(0,3-(row.ai_day===day?Number(row.ai_uses)+1:1))});
 }
 if(path==="/api/admin/list"&&request.method==="POST"){
   const data=await bodyJSON(request);await checkAdmin(request,env,data.adminPassword);
   const rows=await env.DB.prepare("SELECT id,title,subtitle,year,cover,paper,spine,published,created_at,updated_at FROM books ORDER BY created_at DESC LIMIT 500").all();
   return result(request,env,{books:(rows.results||[]).map(row=>({...publicRow(row),published:!!row.published,createdAt:row.created_at}))});
 }
 if(path==="/api/admin/delete"&&request.method==="POST"){
   const data=await bodyJSON(request);await checkAdmin(request,env,data.adminPassword);
   const id=clean(data.id,64);
   if(!ID_RE.test(id))throw new ApiError(400,"Niepoprawny identyfikator księgi.");
   if(!await getRow(env,id))throw new ApiError(404,"Księga nie istnieje.");
   await deleteBook(env,id);
   return result(request,env,{ok:true,deleted:id,by:"admin"});
 }
 if(path==="/api/admin/publish"&&request.method==="POST"){
   const data=await bodyJSON(request);await checkAdmin(request,env,data.adminPassword);
   const id=clean(data.id,64);
   if(!ID_RE.test(id)||typeof data.published!=="boolean")throw new ApiError(400,"Niepoprawne dane.");
   const updated=await env.DB.prepare("UPDATE books SET published=?,updated_at=? WHERE id=?")
     .bind(data.published?1:0,timestamp(),id).run();
   if(!updated.meta?.changes)throw new ApiError(404,"Księga nie istnieje.");
   return result(request,env,{ok:true,id,published:data.published});
 }
 throw new ApiError(404,"Nie znaleziono adresu API.");
}
export default {
 async fetch(request,env){
   const origin=request.headers.get("Origin");
   if(origin&&!origins(env).includes(origin))return result(request,env,{error:"Nieautoryzowane pochodzenie zapytania."},403);
   if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request,env)});
   try{return await handle(request,env)}
   catch(error){
     if(!(error instanceof ApiError))console.error("Błąd zaplecza:",error?.message);
     return result(request,env,{error:error instanceof ApiError?error.message:"Wystąpił problem na serwerze."},error instanceof ApiError?error.status:500);
   }
 }
};
