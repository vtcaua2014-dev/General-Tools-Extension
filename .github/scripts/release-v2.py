from pathlib import Path
import json,zipfile,tempfile,subprocess
repo=Path.cwd();package=repo/'private_packages/general-tools.zip'
assert package.is_file()
with tempfile.TemporaryDirectory() as temp:
    tmp=Path(temp)
    with zipfile.ZipFile(package) as z:
        assert z.testzip() is None
        z.extractall(tmp)
    ext=tmp/'General-Tools'
    def patch(name,old,new):
        f=ext/name;s=f.read_text();assert old in s,(name,old[:50]);f.write_text(s.replace(old,new,1))
    mfile=ext/'manifest.json';m=json.loads(mfile.read_text());m['version']='2.0.0'
    m['description']='General Tools 2.0: compact FPS, LiveSplit Lite and keystrokes HUD with private browser utilities.'
    m['optional_permissions']=sorted(set(m.get('optional_permissions',[])+['browsingData']))
    mfile.write_text(json.dumps(m,indent=2)+'\n')
    patch('stopwatch-engine.js','size: 34, font:','size: 26, font:')
    hud="""
.box{padding:5px 7px;border:1px solid #ffffff28;border-radius:6px;background:rgba(10,11,13,.75)!important;box-shadow:0 3px 14px #0005;opacity:.86;backdrop-filter:blur(5px)}
.box:hover,.box:focus-within{opacity:1}.handle{position:absolute;top:-5px;right:-5px;width:14px;height:14px;margin:0;background:#171717;border:1px solid #ffffff35;border-radius:50%;font-size:0;color:transparent!important;opacity:0}
.box:hover .handle,.handle:focus-visible{opacity:.8}
.clock{min-width:0!important;max-width:210px!important;width:auto!important}.clock-meta,.clock-laps{display:none!important}
.clock[data-mode='lite']{padding:5px 7px!important}.clock[data-mode='lite'] .clock-time{font-size:clamp(16px,calc(var(--clock-size)*.85),28px)!important}
.clock-actions{display:flex;gap:3px;margin:2px 0 0;max-height:0;opacity:0;overflow:hidden;transition:max-height .14s,opacity .14s}
.clock:hover .clock-actions,.clock:focus-within .clock-actions{max-height:32px;opacity:1}
.clock-actions button{font-size:9px;padding:3px 6px;background:#242424;border-radius:3px}
.key-cluster{grid-template-columns:repeat(3,25px);grid-template-rows:repeat(2,25px);gap:2px}.key{height:25px;min-width:25px;padding:1px 2px;font:750 9px system-ui;background:#ffffff0b;border-radius:4px}
.keys-area{gap:6px}.key-extras{gap:2px;margin:0;max-width:164px}.key-extras .key{padding-inline:5px}
.keys-legend{display:none!important}#keys{padding:4px 5px}#fps{padding:3px 6px;border-radius:5px}.fps-value{font:700 11px ui-monospace,monospace}
@media(prefers-reduced-motion:reduce){.clock-actions{transition:none}}
"""
    needle=' .fps-value{font:800 14px ui-monospace,monospace}\n '+chr(96)+';'
    patch('content.js',needle,' .fps-value{font:800 14px ui-monospace,monospace}\n'+hud+'\n '+chr(96)+';')
    patch('content.js',"box.style.width=Math.max(188,Math.round(s.size*7.4))+'px';","box.style.width=Math.max(108,Math.min(210,Math.round(s.size*5.7)))+'px';")
    patch('content.js','b.append(meta,d,buttons,list);updateTimer();','b.append(d,buttons,list);updateTimer();')
    patch('content.js',"clockButton(buttons,'Split (E)','lap');clockButton(buttons,'Reset','reset');","clockButton(buttons,'Split (E)','lap');")
    for a,b in [("panel('timer','UNIFIED STOPWATCH',20,20)","panel('timer','MOVE',12,12)"),("panel('keys','KEYSTROKES',20,185)","panel('keys','MOVE',12,105)"),("panel('fps','BROWSER FPS',20,330)","panel('fps','MOVE',12,72)")]:patch('content.js',a,b)
    patch('content.js'," b.style.background=settings.panelColor||'#121212';"," /* Neutral compact overlay. */")
    patch('content.js',"box.style.backgroundColor=(s.mode==='livesplit'||s.mode==='floating'||s.mode==='lite')?s.panelColor:'';","/* Compact background controlled by CSS. */")
    panel=ext/'index.html';html=panel.read_text().replace('v1.1.1','v2.0.0').replace('v1.1.0','v2.0.0').replace('One panel.<br>Many tools.','Less clutter.<br>More control.')
    browser="""
<section id="browser" class="view" hidden>
<article><h3>Browser & creation</h3><p>Independent utilities and official external links.</p><div class="grid"><button id="gtImage">Open Image Lab</button><button id="gtTranslate">Translate page</button><button id="gtCanva">Open Canva</button><button id="gtShazam">Open Shazam</button></div></article>
<article><h3>Privacy cleanup</h3><p>Select the data to delete. Permission and confirmation are required.</p><label>Range<select id="gtPeriod"><option value="hour">Last hour</option><option value="day">Last day</option><option value="all">All time</option></select></label><div class="grid"><label><input id="gtCache" type="checkbox" checked>Cache</label><label><input id="gtCookies" type="checkbox">Cookies</label><label><input id="gtHistory" type="checkbox">History</label></div><button id="gtClean">Review deletion</button></article>
</section>
"""
    assert '<section id="media" class="view" hidden>' in html
    panel.write_text(html.replace('<section id="media" class="view" hidden>',browser+'<section id="media" class="view" hidden>',1))
    css=ext/'style.css';css.write_text(css.read_text()+"""
/* General Tools v2.0 monochrome */
body{font-family:Inter,system-ui,sans-serif;background:#f3f3f1}aside{background:linear-gradient(140deg,#1e2022,#090909)}aside img{height:56px;width:56px;background:#fff;object-fit:contain;box-shadow:0 9px 25px #0005}
main{background:radial-gradient(ellipse at 70% -20%,#fff,transparent 50%),#f3f3f1}
.hero{position:relative;overflow:hidden;background:linear-gradient(130deg,#111317,#27292b);box-shadow:0 15px 30px #0002}
.hero:after{content:'GT';position:absolute;right:-20px;top:-65px;font:900 190px system-ui;color:#ffffff0c;transform:rotate(-15deg);pointer-events:none}
.hero>*{position:relative;z-index:1}article{border-radius:15px;box-shadow:0 6px 20px #0000000a}article:hover{box-shadow:0 14px 30px #00000012;transform:translateY(-2px)}
#swDisplay{font-size:26px!important}
@media(prefers-reduced-motion:reduce){article{transition:none;transform:none!important}}
""")
    app=ext/'app.js';app.write_text(app.read_text()+"""
/* v2 browser tools. Proprietary vendor code is NOT bundled. */
pages.browser='Browser tools';const gtNav=btn('Browser tools',()=>go('browser'));gtNav.dataset.id='browser';
$('#nav').insertBefore(gtNav,$('#nav button[data-id="about"]'));
$('#gtImage').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('image-editor.html')});
$('#gtCanva').onclick=()=>chrome.tabs.create({url:'https://www.canva.com/'});
$('#gtShazam').onclick=()=>chrome.tabs.create({url:'https://www.shazam.com/'});
$('#gtTranslate').onclick=guard(async()=>{const t=await current();chrome.tabs.create({url:'https://translate.google.com/translate?sl=auto&tl=en&u='+encodeURIComponent(t.url)});});
$('#gtClean').onclick=guard(async()=>{const data={cache:$('#gtCache').checked,cookies:$('#gtCookies').checked,history:$('#gtHistory').checked};
if(!Object.values(data).some(Boolean))throw Error('Select at least one data category.');
if(!await chrome.permissions.request({permissions:['browsingData']}))throw Error('Permission declined.');
const range=$('#gtPeriod').value,since=range==='hour'?Date.now()-3600000:range==='day'?Date.now()-86400000:0;
if(!confirm('Permanently delete selected browser data for '+range+'?'))return;
await chrome.browsingData.remove({since},data);notify('Selected data removed.');});
""")
    (ext/'image-editor.html').write_text("""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>General Tools Image Lab</title><style>body{font:14px system-ui;background:#f5f5f3;color:#111;margin:0;padding:25px}main{max-width:1050px;margin:auto;padding:22px;background:white;display:grid;grid-template-columns:2fr 1fr;gap:20px}canvas{width:100%;background:#eee}label{display:block;margin:15px 0}input[type=range]{width:100%}button{padding:11px}button:disabled{opacity:.4}@media(max-width:700px){main{grid-template-columns:1fr}}</style></head><body><h1>GT / Image Lab — local image filters</h1><main><section><canvas id="c" width="960" height="540"></canvas><input id="file" type="file" accept="image/png,image/jpeg,image/webp"></section><section><h2>Adjust</h2><label>Brightness<input id="brightness" type="range" min="20" max="200" value="100"></label><label>Contrast<input id="contrast" type="range" min="20" max="200" value="100"></label><label>Saturation<input id="saturation" type="range" min="0" max="220" value="100"></label><label>Grayscale<input id="grayscale" type="range" min="0" max="100" value="0"></label><button id="save" disabled>Save PNG</button><p id="status">No image loaded.</p></section></main><script src="image-editor.js"></script></body></html>""")
    (ext/'image-editor.js').write_text("""(()=>{'use strict';const $=s=>document.querySelector(s),c=$('#c'),x=c.getContext('2d');let img;function draw(){if(!img)return;const v=k=>Number($('#'+k).value);x.clearRect(0,0,c.width,c.height);x.filter='brightness('+v('brightness')+'%) contrast('+v('contrast')+'%) saturate('+v('saturation')+'%) grayscale('+v('grayscale')+'%)';x.drawImage(img,0,0,c.width,c.height);x.filter='none'}for(const k of ['brightness','contrast','saturation','grayscale'])$('#'+k).oninput=draw;$('#file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>20000000){$('#status').textContent='Invalid file';return}try{const b=await createImageBitmap(f);if(img)img.close();img=b;const scale=Math.min(1,2400/b.width,2400/b.height);c.width=Math.round(b.width*scale);c.height=Math.round(b.height*scale);draw();$('#save').disabled=false;$('#status').textContent='Edited locally'}catch{$('#status').textContent='Unable to load image'}};$('#save').onclick=()=>{if(!img)return;c.toBlob(b=>{if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='general-tools-edited.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)},'image/png')}})();""")
    (ext/'CHANGELOG.txt').write_text('General Tools v2.0.0\nMinimal FPS, LiveSplit Lite, keystrokes. Optional privacy cleaning and local image editor. External service shortcuts do not embed third-party code.\n')
    for name in ['app.js','content.js','image-editor.js']:subprocess.run(['node','--check',str(ext/name)],check=True)
    with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
        for f in sorted(ext.rglob('*')):
            if f.is_file():z.write(f,f.relative_to(tmp).as_posix())
    with zipfile.ZipFile(package) as z:
        assert z.testzip() is None
        assert json.loads(z.read('General-Tools/manifest.json'))['version']=='2.0.0'
catfile=repo/'catalog.json';data=json.loads(catfile.read_text());data[0]['version']='2.0.0';data[0]['description']='General Tools 2.0: compact LiveSplit Lite, FPS and keystrokes with image editing and browser utilities.';catfile.write_text(json.dumps(data,indent=2)+'\n')
htmlfile=repo/'public/index.html';html=htmlfile.read_text();assert '<style id="gt-critical-styles">' in html
html=html.replace('v1.1.1','v2.0.0').replace('v1.1.0','v2.0.0')
css3d="""
.hero{background:radial-gradient(ellipse at 76% 34%,#e9ebe9,#fafaf8 74%)}.hero-art{perspective:1200px;transform-style:preserve-3d}
.hero-brand-card{transform:perspective(1100px) rotateX(5deg) rotateY(-8deg) translateZ(30px);box-shadow:27px 40px 75px #00000025;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.hero-art:hover .hero-brand-card{transform:perspective(1100px) rotateX(-2deg) rotateY(4deg) translateZ(45px)}
.benefit-card,.roadmap-card{transition:transform .4s,box-shadow .4s}
.benefit-card:hover,.roadmap-card:hover{transform:perspective(900px) rotateX(2deg) rotateY(-2deg) translateY(-8px);box-shadow:0 25px 55px #00000018}
@media(hover:none),(prefers-reduced-motion:reduce){.hero-brand-card,.hero-art:hover .hero-brand-card,.benefit-card:hover,.roadmap-card:hover{transform:none!important}}
"""
htmlfile.write_text(html.replace('</style>',css3d+'</style>',1))
stylefile=repo/'public/styles.css';stylefile.write_text(stylefile.read_text()+'\n'+css3d)
(repo/'BUNDLED_RELEASE.txt').write_text('General Tools v2.0.0: independent browser utilities, polished Store, compact overlays.\n')
subprocess.run(['node','--check',str(repo/'server.js')],check=True)
print('Release 2.0 verified')
