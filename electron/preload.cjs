const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  clients: {
    list:   ()   => ipcRenderer.invoke('clients.list'),
    create: (p)  => ipcRenderer.invoke('clients.create', p),
    update: (p)  => ipcRenderer.invoke('clients.update', p),
    delete: (id) => ipcRenderer.invoke('clients.delete', id),
  },
  cases: {
    listByClient: (id) => ipcRenderer.invoke('cases.listByClient', id),
    readFull:     (id) => ipcRenderer.invoke('cases.readFull', id),
    create:       (p)  => ipcRenderer.invoke('cases.create', p),
    update:       (p)  => ipcRenderer.invoke('cases.update', p),
    saveAnamnesis:(p)  => ipcRenderer.invoke('cases.saveAnamnesis', p),
    delete:       (id) => ipcRenderer.invoke('cases.delete', id),
  },
  sessions: {
    listByCase: (id) => ipcRenderer.invoke('sessions.listByCase', id),
    create:     (p)  => ipcRenderer.invoke('sessions.create', p),
    update:     (p)  => ipcRenderer.invoke('sessions.update', p),
    delete:     (id) => ipcRenderer.invoke('sessions.delete', id),
  },
  catalog: {
    therapyMethods:       () => ipcRenderer.invoke('catalog.therapyMethods'),
    problemCategories:    () => ipcRenderer.invoke('catalog.problemCategories'),
    previousTherapyTypes: () => ipcRenderer.invoke('catalog.previousTherapyTypes'),
    medicationCatalog:    () => ipcRenderer.invoke('catalog.medicationCatalog'),
  }
});
