// Interactive offline fixtures only; external requests are blocked.
// Real Cash Book components and styles with offline-only financial fixtures; no database access.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import WebSocket from 'ws'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baseline = process.argv.includes('--baseline')
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
assert.ok(browserPath, 'Chrome/Edge is required for this offline check.')
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {CashBookPage} from '/src/features/cashbook/CashBookPage.tsx';import {MainLayout} from '/src/layouts/MainLayout.tsx';import {acceptSession} from '/src/features/auth/auth.store.ts';import {getPakistanBusinessDate} from '/src/business/utils/date.ts';
import '/src/style.css';import '/src/audit.css';import '/src/theme.css';
window.__audits=[];window.__commands={};window.__today=getPakistanBusinessDate();window.__records=[];window.__writes=[];window.__reads=[];window.__mode='ok';window.__ready=true;
const operator={_id:'507f1f77bcf86cd799439002',name:'Offline Owner'};
window.fetch=async(url,init={})=>{
 const u=new URL(String(url),location.origin),path=u.pathname.replace('/api/v1/cashbook','');
 const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 if(u.pathname.includes('/notifications'))return reply(u.pathname.endsWith('unread-count')?{count:0}:{data:[],pagination:{page:1,totalPages:1,total:0}});
 if(!u.pathname.startsWith('/api/v1/cashbook'))throw new Error('External API blocked: '+u.pathname);
 if(init.method && init.method!=='GET'){
  const body=JSON.parse(init.body);window.__writes.push({path,body,method:init.method});
  if(window.__mode==='offline')throw new TypeError('Fixture offline');
  if(window.__mode==='validation')return reply({message:'Check the entered cash amount.'},400);
  if(window.__mode==='server')return reply({message:'Fixture unavailable'},500);
  if(!window.__ready)return reply({message:'Setup required',code:'MANUAL_CASH_SETUP_REQUIRED'},503);
  if(window.__mode==='conflict')return reply({message:'This day was corrected by another operator. Reload before correcting it.'},409);
  if(window.__commands[body.key])return reply({...window.__commands[body.key],record:window.__records[0],replayed:true});
  const previous=window.__records[0],isVoid=path.endsWith('/void'),isReplace=path.endsWith('/replace');
  if(previous && body.expectedRevision!==previous.revision)return reply({message:'Revision conflict'},409);
  const record={...previous,_id:'507f1f77bcf86cd799439001',businessDate:body.businessDate||previous?.businessDate||window.__today,shopCashAmount:isVoid?previous.shopCashAmount:body.shopCashAmount,bossAddedAmount:isVoid?previous.bossAddedAmount:body.bossAddedAmount,totalCollected:isVoid?previous.totalCollected:body.shopCashAmount+body.bossAddedAmount,notes:isVoid?previous.notes:body.notes,enteredBy:operator,lastUpdatedBy:operator,revision:previous?previous.revision+1:0,status:isVoid?'voided':'active',voidedBy:isVoid?operator:null,voidedAt:isVoid?new Date().toISOString():null,voidReason:isVoid?body.reason:'',createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  window.__audits.unshift({_id:String(window.__audits.length+1).padStart(24,'0'),action:isVoid?'void':isReplace?'replace':previous?'correct':'create',revision:record.revision,previous:previous||null,next:record,reason:body.reason||'Manual daily record finalized',modifiedBy:operator,createdAt:new Date().toISOString()});
  const result={record,replayed:false,postedRevision:record.revision};window.__records=[record];window.__commands[body.key]=result;
  if(window.__mode==='commit-offline')throw new TypeError('Fixture lost response after commit');
  return reply(result);
 }
 window.__reads.push(path+u.search);
 if(path==='/status')return reply({ready:window.__ready,mode:'manual_daily',today:window.__today});
 if(path.startsWith('/records/by-date/')){const date=path.split('/').at(-1);const record=window.__records.find(r=>r.businessDate===date)||null;return reply(record?.status==='voided'?{date,record:null,voidedRecord:record}:{date,record})}
 if(path==='/records'){
  const from=u.searchParams.get('from'),to=u.searchParams.get('to'),rows=window.__records.filter(r=>r.status!=='voided'&&r.businessDate>=from&&r.businessDate<=to);
  const summary={shopCashAmount:0,bossAddedAmount:0,totalCollected:0,recordedDays:rows.length,averageDailyCollection:rows.length?rows.reduce((n,r)=>n+r.totalCollected,0)/rows.length:null};
  for(const row of rows)for(const key of ['shopCashAmount','bossAddedAmount','totalCollected'])summary[key]+=row[key];
  return reply({rows,summary,from,to,total:rows.length,page:1,limit:20});
 }
 if(path.startsWith('/records/'))return reply({record:window.__records[0],audit:window.__audits,page:1,limit:20,total:window.__audits.length});
 throw new Error('Unexpected fixture request '+path);
};
acceptSession({user:{id:operator._id,name:operator.name,email:'test@example.invalid',role:'owner',shopId:'507f1f77bcf86cd799439009',shopName:'Offline'},csrfToken:'offline',expiresAt:'2099-01-01T00:00:00Z'});
const e=React.createElement;createRoot(document.getElementById('app')).render(e(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},e(BrowserRouter,null,e(Routes,null,e(Route,{element:e(MainLayout)},e(Route,{path:'*',element:e(CashBookPage)}))))));
</script></body></html>`
const profile = await mkdtemp(join(tmpdir(), 'cashbook-flow-'))
let browser, server, socket, sequence = 0, dialogs = 0, acceptDialog = false
const pending = new Map(), results = [], errors = []
const delay = ms => new Promise(done => setTimeout(done, ms))
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {pending.delete(id);reject(new Error('CDP timeout: '+method))}, 20000)
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}})
    socket.send(JSON.stringify({id,method,params}))
  })
}
async function evaluate(expression) {
  const value = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
  if(value.exceptionDetails)throw new Error(JSON.stringify(value.exceptionDetails))
  return value.result.value
}
async function until(check,label) {
  const deadline=Date.now()+20000
  while(Date.now()<deadline){if(await check())return;await delay(100)}
  throw new Error(label+': '+errors.join('\n'))
}
try {
  server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'offline-customer-layout',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    if(!req.url.startsWith('/__customer-layout.html'))return next()
    res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__customer-layout.html',html))
  })}}]})
  await server.listen()
  const origin='http://127.0.0.1:'+server.httpServer.address().port
  browser=spawn(browserPath,['--headless=new','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true})
  browser.stderr.on('data',()=>{})
  let devtools
  await until(async()=>{try{devtools=await readFile(join(profile,'DevToolsActivePort'),'utf8');return true}catch{return false}},'Browser did not start')
  const targets=await fetch('http://127.0.0.1:'+devtools.split('\n')[0]+'/json/list').then(response=>response.json())
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl)
  socket.on('message',async raw=>{
    const message=JSON.parse(raw),handler=pending.get(message.id)
    if(message.method==='Page.javascriptDialogOpening'){dialogs++;const accept=acceptDialog;acceptDialog=false;await send('Page.handleJavaScriptDialog',{accept})}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)
    if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params,local=request.url.startsWith(origin+'/')
      await send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'})
    }
    if(handler){pending.delete(message.id);message.error?handler.reject(new Error(message.error.message)):handler.resolve(message.result)}
  })
  await new Promise((done,reject)=>{socket.once('open',done);socket.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  await send('Page.bringToFront');
  async function input(selector,value){await evaluate('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(n,'+JSON.stringify(value)+');n.dispatchEvent(new Event("input",{bubbles:true}));n.dispatchEvent(new Event("change",{bubbles:true}))})()');await delay(80)}
  async function textarea(selector,value){await evaluate('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(n,'+JSON.stringify(value)+');n.dispatchEvent(new Event("input",{bubbles:true}))})()');await delay(80)}
  async function modalGeometry(width) {
    for(const theme of ['light','dark']) {
      await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
      const metrics=await evaluate("(()=>{const dialog=document.querySelector('[role=dialog]'),r=dialog.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,contained:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,scrollable:getComputedStyle(dialog.querySelector('.cash-dialog-body')).overflowY==='auto'}})()");
      assert.ok(!metrics.overflow&&metrics.contained&&metrics.scrollable,'Dialog layout at '+width+' '+theme+': '+JSON.stringify(metrics));
      if ((width === 375 || width === 1366) && theme === 'dark') {
        const capture=await send('Page.captureScreenshot',{format:'png'});
        await writeFile(resolve(root,'../.tmp/cashbook-layout/history-actions-'+width+'.png'),Buffer.from(capture.data,'base64'));
      }
    }
  }
  for(const width of [320,375,390,430,768,1024,1366]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await send('Page.navigate',{url:origin+'/__customer-layout.html'});
    await until(()=>evaluate("Boolean(document.querySelector('.manual-entry-form'))"),'Form did not load');
    await until(()=>evaluate("document.querySelector('.cash-empty')?.textContent.includes('No cash entry')"),'Missing no-entry state');
    for(const theme of ['light','dark']){
      await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));
      await input('.manual-fields input[type=number]', '20000');await input('.manual-fields label:nth-child(2) input','4000');
      assert.equal(await evaluate("document.querySelector('.manual-fields input[readonly]').value"),'PKR 24,000');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Overflow at '+width+' '+theme);
    }
    await evaluate("window.__mode='offline';document.querySelector('.manual-entry-form button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('.cash-error[role=alert]')?.textContent.includes('outcome may be unknown')"),'Missing uncertain outcome');
    assert.equal(await evaluate("Boolean(document.querySelector('.operation-success-toast'))"),false,'An uncertain save must not show success');
    assert.equal(await evaluate("document.querySelector('.manual-fields input[type=number]').value"),'20000');
    await evaluate("window.__mode='ok';document.querySelector('.manual-entry-form button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('.manual-success')?.textContent.includes('saved') && document.querySelectorAll('.manual-history tbody tr').length===1"),'Save did not refresh history');
    assert.ok(await evaluate("document.querySelector('.operation-success-toast')?.textContent.includes('Daily cash record saved.')"),'Confirmed save must show the shared success toast');
    assert.equal(await evaluate('window.__writes[0].body.key===window.__writes[1].body.key'),true);
    assert.equal(await evaluate("'takenHomeAmount' in window.__writes[0].body || 'totalCollected' in window.__writes[0].body"),false);
    assert.equal(await evaluate('window.__records[0].totalCollected'),24000);
    assert.equal(await evaluate("document.querySelector('.cash-kpis>div:last-child dd')?.textContent"),'PKR 24,000');
    if(width===375 || width===1366){const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/cashbook-layout/interactive-'+width+'.png'),Buffer.from(capture.data,'base64'))}
    assert.equal(await evaluate("document.querySelector('.manual-entry-form').textContent.includes('Remaining Cash')"),false);
    await evaluate("[...document.querySelectorAll('.manual-entry-form button')].find(n=>n.textContent==='Correct Record').click()");
    await input('.manual-fields input[type=number]', '8000');
    if(width===375){
      await evaluate("(()=>{const n=document.querySelector('.cash-filters select');n.value='yesterday';n.dispatchEvent(new Event('change',{bubbles:true}))})()");
      await until(()=>evaluate("document.querySelector('.manual-history').textContent.includes('No cash records found for this period')"),'Yesterday empty state missing');
      assert.equal(await evaluate("(()=>{const d=new Date(window.__today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);const yesterday=d.toISOString().slice(0,10);return window.__reads.some(path=>path.includes('from='+yesterday+'&to='+yesterday))})()"),true);
    }
    const before=dialogs;
    await evaluate("[...document.querySelectorAll('.cash-header-actions button')].find(n=>n.textContent.includes('Refresh')).click()");
    assert.equal(dialogs,before+1);assert.equal(await evaluate("document.querySelector('.manual-fields input[type=number]').value"),'8000');
    acceptDialog=true;
    await evaluate("[...document.querySelectorAll('.manual-entry-form button')].find(n=>n.textContent==='Cancel Correction').click()");
    await evaluate("(()=>{const n=document.querySelector('.cash-filters select');n.value='month';n.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await until(()=>evaluate("document.querySelectorAll('.cash-history-actions button').length===3"),'Three action icons missing');
    const sizes=await evaluate("[...document.querySelectorAll('.cash-history-actions button')].map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,label:n.getAttribute('aria-label')}))");
    assert.ok(sizes.every(n=>n.w>=(width<=700?44:34)&&n.h>=(width<=700?44:34)&&n.label.includes('cash record for')));
    const writesBeforeView=await evaluate('window.__writes.length');
    await evaluate("document.querySelector('.cash-history-actions button').click()");
    await until(()=>evaluate("document.querySelector('[role=dialog]')?.textContent.includes('Last Modified At')"),'View did not load saved record');
    await modalGeometry(width);
    await evaluate("[...document.querySelectorAll('[role=dialog] button')].at(-1).focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.ok(await evaluate("document.activeElement.getAttribute('aria-label')?.startsWith('Close Daily Cash Details')"),'Dialog focus did not wrap');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await until(()=>evaluate("!document.querySelector('[role=dialog]')"),'View did not close');
    assert.equal(await evaluate('window.__writes.length'),writesBeforeView);
    await evaluate("document.querySelector('.cash-history-actions button:nth-child(2)').click()");
    await until(()=>evaluate("document.querySelector('[role=dialog] .manual-fields input[type=number]')?.value==='20000'"),'Edit did not prefill saved values');
    await modalGeometry(width);
    await input('[role=dialog] .manual-fields input[type=number]','21000');
    await textarea('[role=dialog] .manual-fields label:last-child textarea','Verified manual recount');
    await evaluate("window.__mode='validation';document.querySelector('[role=dialog] button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('Check the entered')"),'Validation failure missing');
    assert.equal(await evaluate("document.querySelector('[role=dialog] input[type=number]').value"),'21000');
    await evaluate("window.__mode='conflict';document.querySelector('[role=dialog] button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('another operator')"),'Revision conflict missing');
    await evaluate("window.__mode='ok';document.querySelector('[role=dialog] button[type=submit]').click()");
    await until(()=>evaluate("!document.querySelector('[role=dialog]')&&document.querySelector('.cash-kpis>div:last-child dd')?.textContent==='PKR 25,000'"),'Confirmed edit did not refresh cards');
    await evaluate("document.querySelector('.cash-history-actions button:nth-child(3)').click()");
    await until(()=>evaluate("document.querySelector('[role=dialog] h2')?.textContent==='Delete Daily Cash Record?'"),'Delete confirmation missing');
    await modalGeometry(width);
    const beforeCancel=await evaluate('window.__writes.length');
    await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(n=>n.textContent==='Cancel').click()");
    await until(()=>evaluate("!document.querySelector('[role=dialog]')"),'Cancel did not close delete');
    assert.equal(await evaluate('window.__writes.length'),beforeCancel);
    await evaluate("document.querySelector('.cash-history-actions button:nth-child(3)').click()");
    await until(()=>evaluate("Boolean(document.querySelector('.manual-void-form textarea'))"),'Delete form missing');
    await textarea('.manual-void-form textarea','Incorrect day manual count');
    await evaluate("window.__mode='commit-offline';document.querySelector('.manual-void-form button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('.manual-void-form [role=alert]')?.textContent.includes('outcome may be unknown')"),'Unknown void outcome not retained');
    const originalVoidKey=await evaluate('window.__writes.at(-1).body.key');
    assert.equal(await evaluate("document.querySelector('.cash-kpis>div:last-child dd').textContent"),'PKR 25,000');
    await evaluate("window.__mode='ok';document.querySelector('.manual-void-form button[type=submit]').click()");
    await until(()=>evaluate("!document.querySelector('[role=dialog]')&&document.querySelectorAll('.manual-history tbody tr').length===0&&Boolean(document.querySelector('.cash-voided-notice'))"),'Acknowledged void did not clear active history/cards');
    assert.equal(await evaluate('window.__writes.at(-1).body.key'),originalVoidKey);
    assert.equal(await evaluate('window.__audits.length'),3);
    await evaluate("[...document.querySelectorAll('.cash-voided-notice button')].find(n=>n.textContent==='View Voided Record').click()");
    await until(()=>evaluate("document.querySelector('[role=dialog]')?.textContent.includes('Record voided')"),'Voided audit missing');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await until(()=>evaluate("!document.querySelector('[role=dialog]')"),'Audit did not close');
    await evaluate("[...document.querySelectorAll('.cash-voided-notice button')].find(n=>n.textContent==='Replace Voided Record').click()");
    await until(()=>evaluate("Boolean(document.querySelector('[role=dialog] .manual-entry-form'))"),'Replacement missing');
    await input('[role=dialog] .manual-fields input[type=number]','25000');
    await textarea('[role=dialog] .manual-fields label:last-child textarea','Authorized replacement after recount');
    await evaluate("document.querySelector('[role=dialog] button[type=submit]').click()");
    await until(()=>evaluate("!document.querySelector('[role=dialog]')&&document.querySelector('.cash-kpis>div:last-child dd')?.textContent==='PKR 29,000'"),'Replacement did not refresh');
    assert.equal(await evaluate('window.__records.length'),1);assert.equal(await evaluate('window.__audits.length'),4);
    await evaluate("window.__ready=false;document.querySelector('.cash-header-actions button').click()");
    await until(()=>evaluate("Boolean(document.querySelector('.cash-setup-status'))"),'Setup status missing');
    assert.equal(await evaluate("document.querySelector('.manual-entry-form button').disabled"),true);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Setup overflow at '+width);
    assert.equal(await evaluate("document.body.textContent.includes('Manual cash history setup required')"),false);
    console.log('Cash Book flow passed at',width,'light/dark');
  }
  assert.equal(errors.length,0,errors.join('\n'));

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


