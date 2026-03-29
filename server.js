const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname);
const soundsDir = path.join(__dirname, 'assets', 'sound');
const textsDir = path.join(__dirname, 'assets', 'txt');

app.use(express.static(publicDir));

function listFiles(dir, ext){
  try{
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(ext)).sort();
    return files;
  }catch(e){
    return [];
  }
}

app.get('/api/sounds', (req,res)=>{
  const list = listFiles(soundsDir, '.mp3');
  // update manifest file for compatibility
  try{ fs.writeFileSync(path.join(soundsDir, 'list.json'), JSON.stringify(list,null,2)); }catch(e){}
  res.json(list);
});

app.get('/api/texts', (req,res)=>{
  const list = listFiles(textsDir, '.html');
  try{ fs.writeFileSync(path.join(textsDir, 'list.json'), JSON.stringify(list,null,2)); }catch(e){}
  res.json(list);
});

app.listen(PORT, ()=> console.log(`Dev server listening on http://localhost:${PORT}`));
