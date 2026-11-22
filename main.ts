// tiny stack ISA v1 interpreter: one run answers the whole set
import{readdirSync as D,readFileSync as F,mkdirSync as K,writeFileSync as W}from'node:fs'
const A=process.env.MAKEFUN_INPUT_DIR||'/input',B=process.env.MAKEFUN_OUTPUT_DIR||'/output'
const V=[0,1,2,3,4,5,6,7,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,32,33,34,48,49,50,51,52,64,65,80,81,82,83]
const S='000101401010012022023033021021021021021021021011021021021011021021021021021021200210210200000011020010010001010'
const T=new Int32Array(256).fill(-1),STEP=1e6
for(let i=0;i<V.length;i++){const q=S.substr(i*3,3)
T[V[i]]=+q[0]*256+ +q[1]*16+ +q[2]}
function run(P,I){
const n=P.length
const s=new Int32Array(256),k=new Int32Array(64),m=new Int32Array(256),o=new Uint8Array(65536)
let sp=0,cp=0,ol=0,ip=0,pc=0,st=0,e=255
try{for(;;){
if(st===STEP)throw 10
if(pc<0||pc>=n)throw 9
const c=P[pc],t=T[c]
if(t<0)throw 5
const im=t>>8&15,x=pc+1+im,po=t>>4&15,pu=t&15
if(pc+im>=n)throw 9
st++
if(sp<po)throw 2
if(sp-po+pu>256)throw 3
pc=x
switch(c){
case 0:throw 0
case 1:s[sp++]=(P[x-1]<<24)>>24;break
case 2:s[sp++]=P[x-4]|P[x-3]<<8|P[x-2]<<16|P[x-1]<<24;break
case 3:sp--;break
case 4:s[sp]=s[sp-1];sp++;break
case 5:{const a=s[sp-1];s[sp-1]=s[sp-2];s[sp-2]=a;break}
case 6:s[sp]=s[sp-2];sp++;break
case 7:{const a=s[sp-3];s[sp-3]=s[sp-2];s[sp-2]=s[sp-1];s[sp-1]=a;break}
case 48:{const r=(P[x-2]|P[x-1]<<8)<<16>>16;pc=x+r;break}
case 49:case 50:{const r=(P[x-2]|P[x-1]<<8)<<16>>16,v=s[--sp];if(c==49?v===0:v!==0)pc=x+r;break}
case 51:if(cp==64)throw 7;k[cp++]=x;pc=P[x-2]|P[x-1]<<8;break
case 52:if(!cp)throw 8;pc=k[--cp];break
case 23:s[sp-1]=-s[sp-1]|0;break
case 27:s[sp-1]=~s[sp-1];break
case 64:{const a=s[sp-1];if(a<0||a>255)throw 6;s[sp-1]=m[a];break}
case 65:{const a=s[sp-1],v=s[sp-2];if(a<0||a>255)throw 6;m[a]=v;sp-=2;break}
case 80:{const q=''+s[sp-1];if(ol+q.length>65536)throw 11;sp--;for(let i=0;i<q.length;i++)o[ol++]=q.charCodeAt(i);break}
case 81:if(ol==65536)throw 11;o[ol++]=s[--sp]&255;break
case 82:s[sp++]=ip<I.length?I[ip++]:-1;break
case 83:throw s[--sp]&255
default:{const b=s[sp-1],a=s[sp-2];let r
if(c==16)r=a+b|0
else if(c==17)r=a-b|0
else if(c==18)r=Math.imul(a,b)
else if(c==19){if(!b)throw 4;r=a==-2147483648&&b==-1?a:a/b|0}
else if(c==20){if(!b)throw 4;r=b==-1?0:a%b|0}
else if(c==21){if(!b)throw 4;r=Math.floor((a>>>0)/(b>>>0))|0}
else if(c==22){if(!b)throw 4;r=(a>>>0)%(b>>>0)|0}
else if(c==23)r=-a|0
else if(c==24)r=a&b
else if(c==25)r=a|b
else if(c==26)r=a^b
else if(c==27)r=~a
else if(c==28)r=a<<(b&31)
else if(c==29)r=a>>(b&31)
else if(c==30)r=a>>>(b&31)|0
else if(c==32)r=a===b?1:0
else if(c==33)r=a<b?1:0
else r=(a>>>0)<(b>>>0)?1:0
sp-=2;s[sp++]=r;break}
}}}catch(q){e=q}
return[o.slice(0,ol),e]
}
for(const id of D(A).sort()){const d=A+'/'+id;let P,I
try{P=F(d+'/program.bin');I=F(d+'/input.bin')}catch{continue}
const[r,e]=run(P,I);K(B+'/'+id,{recursive:true});W(B+'/'+id+'/stdout.bin',r);W(B+'/'+id+'/exit.txt',e+'\n')}
