'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('atlas',{onCoordinates:callback=>ipcRenderer.on('coordinates',(_event,value)=>callback(value)),onLockState:callback=>ipcRenderer.on('lock-state',(_event,value)=>callback(value)),onTogglePanel:callback=>ipcRenderer.on('toggle-panel',()=>callback()),setLock:value=>ipcRenderer.invoke('set-lock',value),close:()=>ipcRenderer.invoke('close-app'),minimize:()=>ipcRenderer.invoke('minimize')});
