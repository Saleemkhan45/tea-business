import { installAccessFixtures } from './access-control.fixture.mjs'
import {installPerformanceFixtures} from './performance-api.fixture.mjs'
// Interactive offline fixtures only; external requests are blocked.
// Production Dashboard with isolated fixtures; CSP blocks external resources and connections.
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
const dist = resolve(root,baseline ? '../.tmp/performance-baseline-dist' : 'dist')
const html = (await readFile(join(dist,'index.html'),'utf8')).replace('<head>', '<head><script>('+installPerformanceFixtures.toString()+')();('+installAccessFixtures.toString()+')()<'+ '/script>')
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
  throw new Error(label+': '+errors.join('\n')+' '+JSON.stringify(await evaluate("({path:location.pathname,text:document.body.textContent.slice(-1200)})")))
}
try {
  server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'offline-production-perf',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path.startsWith('/assets/')){
      const name=path.slice('/assets/'.length);assert.match(name,/^[a-zA-Z0-9._-]+$/);
      try{res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'application/javascript');res.end(await readFile(join(dist,'assets',name)))}catch{res.statusCode=404;res.end('Missing fixture asset')}
      return;
    }
    if(path==='/favicon.svg'||path==='/manifest.webmanifest'){res.statusCode=204;res.end();return}
    if(path==='/dashboard'||path==='/cash-book'||path==='/login'){
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:");
      res.setHeader('Content-Type','text/html');res.end(html);return
    }
    next()
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
    if(message.method==='Runtime.consoleAPICalled' && message.params.type==='error') errors.push(message.params.args.map(value=>value.description??value.value??'').join(' '))
    if(handler){pending.delete(message.id);message.error?handler.reject(new Error(message.error.message)):handler.resolve(message.result)}
  })
  await new Promise((done,reject)=>{socket.once('open',done);socket.once('error',reject)})
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.bringToFront');

  const checks=[];
  async function input(selector,value){await evaluate('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(n,'+JSON.stringify(value)+');n.dispatchEvent(new Event("input",{bubbles:true}))})()');await delay(30)}
  for(const width of [375,768,1366]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await send('Page.navigate',{url:origin+'/dashboard'});
    await until(()=>evaluate("Boolean(document.querySelector('.ranked-product-copy'))"),'No Dashboard');
    await evaluate("document.querySelector('a[href=\"/cash-book\"]').click()");
    await until(()=>evaluate("Boolean(document.querySelector('.manual-entry-form button[type=submit]'))"),'No Cash Book');
    await input('.manual-fields input[type=number]','7000');await input('.manual-fields label:nth-child(2) input','3000');
    await evaluate("document.querySelector('.manual-entry-form button[type=submit]').click()");
    await until(()=>evaluate("Boolean(document.querySelector('.authorization-dialog'))"),'No authorization dialog');
    assert.equal(await evaluate('window.__mutationRequests'),0);
    assert.equal(await evaluate("document.querySelector('.authorization-dialog').contains(document.activeElement)"),true);
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}))");
    assert.equal(await evaluate("document.activeElement.textContent"),'Confirm');
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}))");
    assert.equal(await evaluate("document.activeElement.type"),'password');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Dialog overflow');
    if(width===375){const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'../.tmp/access-authorization-375.png'),Buffer.from(capture.data,'base64'))}
    await evaluate("[...document.querySelectorAll('.authorization-dialog button')].find(n=>n.textContent==='Cancel').click()");
    await until(()=>evaluate("!document.querySelector('.authorization-dialog')&&!document.querySelector('.manual-entry-form button[type=submit]').disabled"),'Cancel did not restore form');
    assert.equal(await evaluate('window.__mutationRequests'),0);
    assert.equal(await evaluate("document.querySelector('.manual-fields input[type=number]').value"),'7000');
    await evaluate("document.querySelector('.manual-entry-form button[type=submit]').click()");
    await until(()=>evaluate("Boolean(document.querySelector('.authorization-dialog'))"),'No repeated prompt');
    await input('.authorization-dialog input[type=password]','wrong fixture password');
    await evaluate("document.querySelector('.authorization-dialog button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('.authorization-dialog [role=alert]')?.textContent.includes('failed')"),'Wrong password missing');
    assert.equal(await evaluate('window.__mutationRequests'),0);
    await input('.authorization-dialog input[type=password]','offline fixture passphrase');
    await evaluate("document.querySelector('.authorization-dialog button[type=submit]').click()");
    await until(()=>evaluate("document.querySelector('.manual-success')?.textContent.includes('saved')"),'Authorized save missing');
    assert.equal(await evaluate('window.__mutationRequests'),1);
    assert.equal(await evaluate("Boolean(document.querySelector('.authorization-dialog'))"),false);
    await until(()=>evaluate("document.querySelector('.manual-entry-form')?.getAttribute('aria-busy')==='false'"),'Save is still pending');
    await delay(150);
    await evaluate("document.querySelector('.sidebar a[href=\"/settings\"]').click()");
    await until(()=>evaluate("Boolean(document.querySelector('.security-password-form'))"),'No password settings');
    await input('.security-password-form input[autocomplete=current-password]','offline fixture passphrase');
    await input('.security-password-form label:nth-child(2) input','new offline strong passphrase');
    await input('.security-password-form label:nth-child(3) input','new offline strong passphrase');
    await evaluate("document.querySelector('.security-password-form button[type=submit]').click()");
    await until(()=>evaluate("location.pathname==='/login'&&document.body.textContent.includes('Password changed successfully')"),'Password success did not require sign in');
    checks.push({width,cancelPreservesDraft:true,wrongPasswordBlocksWrite:true,authorizedSave:true,ownerPasswordChange:true,overflow:false});
    console.log('Access-control browser checks passed at',width);
  }
  await send('Page.navigate',{url:origin+'/dashboard?staff=1'});
  await until(()=>evaluate("Boolean(document.querySelector('.trusted-view-banner'))"),'Trusted viewer bootstrap failed');
  await evaluate("document.querySelector('.sidebar a[href=\"/settings\"]').click()");
  await until(()=>evaluate("Boolean(document.querySelector('#security'))"),'No viewer settings');
  assert.equal(await evaluate("Boolean(document.querySelector('.security-password-form'))"),false);
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(resolve(root,'../.tmp/access-control-browser.json'),JSON.stringify({offline:true,checks,trustedViewerBootstrap:true,viewerCannotChangeOwnerPassword:true},null,2));

}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser?.kill()
  if(server)await Promise.race([server.close(),delay(5000)])
  const target=resolve(profile);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&dirname(target)===resolve(tmpdir()),'Unsafe temporary directory')
  await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200})
}


