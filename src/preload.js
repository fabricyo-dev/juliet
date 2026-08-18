'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('juliet', {
  // overlay
  onShow: (cb) => ipcRenderer.on('overlay:show', (_e, p) => cb(p)),
  onLeave: (cb) => ipcRenderer.on('overlay:leave', (_e, p) => cb(p)),
  setHit: (v) => ipcRenderer.send('overlay:hit', !!v),
  action: (id) => ipcRenderer.send('overlay:action', String(id)),
  gone: () => ipcRenderer.send('overlay:gone'),
  // settings
  getState: () => ipcRenderer.invoke('settings:get'),
  save: (patch) => ipcRenderer.invoke('settings:save', patch),
  testNudge: () => ipcRenderer.invoke('settings:testNudge'),
  testMovie: () => ipcRenderer.invoke('settings:testMovie'),
  restoreDefaults: () => ipcRenderer.invoke('settings:restoreDefaults'),
  unpickMovie: (title) => ipcRenderer.invoke('settings:unpickMovie', String(title)),
  rate: (value) => ipcRenderer.invoke('settings:rate', Number(value)),
  unfavourite: (title) => ipcRenderer.invoke('settings:unfavourite', String(title)),
  onTab: (cb) => ipcRenderer.on('settings:tab', (_e, tab) => cb(tab)),
  phoneEnable: (on) => ipcRenderer.invoke('phone:enable', !!on),
  phoneNewTopic: () => ipcRenderer.invoke('phone:newTopic'),
  phoneTest: () => ipcRenderer.invoke('phone:test'),
  phoneOpenStore: () => ipcRenderer.invoke('phone:openStore'),
});
