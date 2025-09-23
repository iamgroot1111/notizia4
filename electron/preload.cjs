const { contextBridge, ipcRenderer } = require('electron');

// ... oben
contextBridge.exposeInMainWorld('api', {
  clients: {
    list: () => ipcRenderer.invoke('clients.list'),
    create: (data) => ipcRenderer.invoke('clients.create', data)
  },
  cases: {
    listByClient: (clientId) => ipcRenderer.invoke('cases.listByClient', clientId), // bereits vorhanden
    create: (data) => ipcRenderer.invoke('cases.create', data),                    // bereits vorhanden
    readFull: (caseId) => ipcRenderer.invoke('cases.readFull', caseId),
    saveAnamnesis: (data) => ipcRenderer.invoke('cases.saveAnamnesis', data),
    updateMethod: (data) => ipcRenderer.invoke('cases.updateMethod', data)
  },
  sessions: {
    listByCase: (caseId) => ipcRenderer.invoke('sessions.listByCase', caseId),
    create: (data) => ipcRenderer.invoke('sessions.create', data)
  },
  ping: () => 'pong'
});
