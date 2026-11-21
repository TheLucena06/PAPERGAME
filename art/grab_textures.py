import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":1100,"height":740})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/paper-roguelike/index.html"); await pg.wait_for_timeout(1500)
        await pg.evaluate("game.scene.getScene('MainMenuScene').scene.start('GameScene',{weapons:['bow'],test:true})")
        await pg.wait_for_timeout(1500)
        data = await pg.evaluate("""(()=>{
          const S=2, out={tex:{},weapons:{},room:null,armors:Object.keys(ARMOR_TYPES).map(k=>[k,ARMOR_TYPES[k].name,ARMOR_TYPES[k].class])};
          const up=(src,w,h)=>{const c=document.createElement('canvas');c.width=w*S;c.height=h*S;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(src,0,0,w*S,h*S);return c.toDataURL('image/png');};
          for(const k of game.textures.getTextureKeys()){ if(k.indexOf('-')>=0||k.startsWith('__')) continue; const s=game.textures.get(k).getSourceImage(); out.tex[k]={w:s.width,h:s.height,url:up(s,s.width,s.height)}; }
          const sc=game.scene.getScene('GameScene');
          for(const id in WEAPON_TYPES){
            const g=sc.make.graphics({x:0,y:0},false); const w=WeaponSystem.createState(id); w.loaded=0; if(w.def.shells) w.shells=w.def.shells; if(w.def.ammo) w.ammo=w.def.ammo; w.def=Object.assign({},w.def,{maxLoaded:0,shells:0});  /* no ammo pips: those are drawn by the game */
            sc.hud.drawHeldWeapon(g,{stats:{size:26}},w,24,28,13,0,0);
            const key='wpn_'+id; g.generateTexture(key,96,56); g.destroy();
            const s=game.textures.get(key).getSourceImage(); out.weapons[id]={w:96,h:56,url:up(s,96,56),name:WEAPON_TYPES[id].name};
          }
          // room with all 4 door gaps open
          const W=960,H=640,T=64,c=document.createElement('canvas'); c.width=W*S;c.height=H*S; const x=c.getContext('2d'); x.scale(S,S);
          x.fillStyle='#f3ead8'; x.fillRect(0,0,W,H);
          x.strokeStyle='rgba(185,207,224,0.6)'; x.lineWidth=1; for(let y=40;y<H;y+=32){x.beginPath();x.moveTo(0,y+0.5);x.lineTo(W,y+0.5);x.stroke();}
          x.strokeStyle='rgba(232,163,163,0.7)'; x.lineWidth=2; x.beginPath();x.moveTo(112,0);x.lineTo(112,H);x.stroke();
          const wall=game.textures.get('wall').getSourceImage(); const rm=sc.rooms;
          for(let r=0;r<rm.rows;r++)for(let cc=0;cc<rm.cols;cc++){ if(r>0&&r<rm.rows-1&&cc>0&&cc<rm.cols-1) continue; if(rm.doorDirAt(cc,r)) continue; x.drawImage(wall,cc*T,r*T); }
          out.room={w:W,h:H,url:c.toDataURL('image/png'),cols:rm.cols,rows:rm.rows,doorTiles:rm.doorTiles};
          return out;})()""")
        json.dump(data, open('grab.json','w'))
        print(len(data['tex']), len(data['weapons']), errs)
        await b.close()
asyncio.run(main())
