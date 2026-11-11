/* Jednolity układ kart kroniki w kreatorze i publicznym czytniku.
 * Wybrane ilustracje trafiają na wskazany numer karty; nie są dodawane automatycznie na koniec.
 * Silnik tekstowy korzysta z ostrożnego limitu, aby cała karta mieściła się bez przewijania.
 */
(function(global){
  "use strict";
  const POSITIONS=["top","middle","bottom","full"];
  const SIZES=["small","medium","large"];
  const MAX_PAGES=500;
  const TITLE_CAP=340;
  const text=value=>typeof value==="string"?value.replace(/\r\n?/g,"\n").trim():"";
  function validPosition(value){return POSITIONS.includes(value)?value:"middle"}
  function validSize(value){return SIZES.includes(value)?value:"medium"}
  function normalizePhoto(input){
    if(!input||typeof input!=="object")return null;
    const requested=Number(input.page);
    const page=Number.isInteger(requested)&&requested>=1&&requested<=MAX_PAGES?requested:null;
    return {
      id:String(input.id||"").slice(0,50),
      data:String(input.data||""),
      caption:String(input.caption||"").slice(0,160),
      page,
      position:validPosition(input.position),
      size:validSize(input.size)
    };
  }
  function photoForPage(p){
    return {data:p.data,caption:p.caption,position:p.position,size:p.size,id:p.id};
  }
  function compile(raw){
    const book=raw||{};
    const out=[];
    const placed=new Map(),legacy=[];
    for(const input of (Array.isArray(book.photos)?book.photos:[]).slice(0,12)){
      const photo=normalizePhoto(input);
      if(!photo||!photo.data)continue;
      if(photo.page&&!placed.has(photo.page))placed.set(photo.page,photo);
      else legacy.push(photo);
    }

    function nextContentNumber(){
      let number=out.length+1;
      while(number<=MAX_PAGES&&placed.get(number)?.position==="full")number++;
      return number;
    }
    function limit(){
      const page=nextContentNumber();
      const photo=placed.get(page);
      if(!photo)return TITLE_CAP;
      if(photo.size==="small")return 225;
      if(photo.size==="large")return 90;
      return 155;
    }
    function addPage(page){
      while(out.length<MAX_PAGES){
        const position=out.length+1;
        const photo=placed.get(position);
        if(photo?.position==="full"){
          out.push({kind:"image",title:"Rycina z kroniki",data:photo.data,caption:photo.caption,position:"full",size:photo.size});
          placed.delete(position);
          continue;
        }
        if(photo){page.illustration=photoForPage(photo);placed.delete(position)}
        out.push(page);
        return;
      }
    }
    addPage({kind:"title",title:text(book.character)||"Kronika postaci",
      subtitle:text(book.subtitle),author:text(book.author),year:text(book.year),crest:book.crest||null});

    function paginate(source,heading){
      const paragraphs=text(source).split(/\n\s*\n/).map(p=>p.replace(/\s*\n\s*/g," ").trim()).filter(Boolean);
      let headingText=heading,content=[],used=0;
      const flush=()=>{
        if(content.length){
          addPage({kind:"text",title:headingText,paragraphs:content});
          content=[];used=0;
        }
      };
      for(const paragraph of paragraphs){
        if(paragraph.length<155&&/^(?:Rozdzia[łl](?:\s|$)|Prolog\b|Epilog\b|#\s+)/i.test(paragraph)){
          flush();headingText=paragraph.replace(/^#\s*/,"");continue;
        }
        const words=paragraph.split(/\s+/).filter(Boolean);
        let chunk="";
        for(let word of words){
          // Długie pojedyncze wyrazy dzielimy na kawałki bez utraty liter.
          const segments=[];
          while(word.length>72){segments.push(word.slice(0,72));word=word.slice(72)}
          if(word)segments.push(word);
          for(const part of segments){
            const addition=(chunk?" ":"")+part;
            const max=limit();
            if(used+chunk.length+addition.length+14>max&&(used>0||chunk)){
              if(chunk){content.push(chunk);used+=chunk.length+14;chunk=""}
              flush();
            }
            chunk+=(chunk?" ":"")+part;
          }
        }
        if(chunk){
          if(used+chunk.length+14>limit()&&content.length)flush();
          content.push(chunk);used+=chunk.length+14;
        }
      }
      flush();
    }

    if(text(book.summary))paginate(book.summary,"Przedmowa");
    else addPage({kind:"blank",title:"O dziejach postaci",message:"Tu rozpoczyna się kronika."});
    if(text(book.story))paginate(book.story,"Początki opowieści");
    else addPage({kind:"blank",title:"Karta kronikarza",message:"Ta karta czeka na opowieść."});

    // Rezerwacje dalszych kart tworzą brakujące strony, nie zmieniając wybranego numeru.
    if(placed.size){
      const last=Math.max(...placed.keys());
      while(placed.size&&out.length<Math.min(MAX_PAGES,last+1)){
        addPage({kind:"blank",title:"Karta kroniki",message:""});
      }
    }
    for(const p of legacy){
      addPage({kind:"image",title:"Ilustracja kroniki",data:p.data,caption:p.caption,
        position:"full",size:p.size});
    }
    addPage({kind:"end",title:"Koniec zapisanych dziejów"});
    if(out.length%2)out.push({kind:"blank",title:"",message:""});
    return out;
  }
  global.KSIEGI_LAYOUT={compile,normalizePhoto,validPosition,validSize};
})(window);
