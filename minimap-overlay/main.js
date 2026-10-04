'use strict';
const {app,BrowserWindow,clipboard,desktopCapturer,globalShortcut,ipcMain,screen,session}=require('electron');
const path=require('path');
let win,locked=false,lastClipboard='';

function createWindow(){
  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:420,height:320,x:24,y:Math.max(20,area.height-344),transparent:true,frame:false,resizable:true,alwaysOnTop:true,skipTaskbar:false,hasShadow:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.setAlwaysOnTop(true,'screen-saver');
  win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  win.setContentProtection(true);
  win.loadFile('index.html');
}
function setLocked(value){locked=value;if(win&&!win.isDestroyed()){win.setIgnoreMouseEvents(locked,{forward:true});win.webContents.send('lock-state',locked)}}
function parseCoordinates(text){const values=String(text).match(/-?\d+(?:[.,]\d+)?/g);if(!values||values.length<3)return null;const numbers=values.slice(0,3).map(value=>Number(value.replace(',','.')));if(numbers.some(value=>!Number.isFinite(value)))return null;return{x:numbers[0],y:numbers[1],z:numbers[2]}}

app.whenReady().then(()=>{
  session.defaultSession.setDisplayMediaRequestHandler(async(_request,callback)=>{const sources=await desktopCapturer.getSources({types:['window','screen']});const source=sources.find(item=>/FiveM|GTA|Grand Theft Auto/i.test(item.name))||sources.find(item=>item.name==='Entire Screen')||sources[0];callback(source?{video:source}:{});});
  createWindow();
  globalShortcut.register('F8',()=>{if(!win)return;win.isVisible()?win.hide():win.showInactive()});
  globalShortcut.register('F9',()=>setLocked(!locked));
  globalShortcut.register('F10',()=>win?.webContents.send('toggle-panel'));
  setInterval(()=>{const text=clipboard.readText();if(!text||text===lastClipboard)return;lastClipboard=text;const coords=parseCoordinates(text);if(coords&&win&&!win.isDestroyed())win.webContents.send('coordinates',coords)},250);
});
ipcMain.handle('set-lock',(_event,value)=>setLocked(Boolean(value)));
ipcMain.handle('close-app',()=>app.quit());
ipcMain.handle('minimize',()=>win?.minimize());
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>app.quit());
