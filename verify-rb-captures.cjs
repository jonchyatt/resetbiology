const fs=require('fs');
const p='C:/Users/jonch/Projects/jarvis/data/reset-biology/baselines/restyle-2026-10-07-after';
const a=fs.readdirSync(p).filter(x=>x.endsWith('.png'));const b=fs.readdirSync('C:/Users/jonch/Projects/jarvis/data/reset-biology/baselines/restyle-2026-10-07-before').filter(x=>x.endsWith('.png'));
console.log(JSON.stringify({after:a.length,before:b.length,missingBefore:a.filter(x=>!b.includes(x)),missingAfter:b.filter(x=>!a.includes(x)),metrics:JSON.parse(fs.readFileSync(p+'/metrics-final.json')).map(x=>[x.name,x.w,x.status,x.finalPath,x.overflow])},null,2));
