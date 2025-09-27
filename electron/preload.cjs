/* electron/preload.cjs */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  clients: {
    list: () => ipcRenderer.invoke("clients.list"),
    create: (p) => ipcRenderer.invoke("clients.create", p),
    update: (p) => ipcRenderer.invoke("clients.update", p),
    delete: (id) => ipcRenderer.invoke("clients.delete", id),
  },

  cases: {
    listByClient: (id) => ipcRenderer.invoke("cases.listByClient", id),
    readFull: (id) => ipcRenderer.invoke("cases.readFull", id),
    create: (p) => ipcRenderer.invoke("cases.create", p),
    saveAnamnesis: (p) => ipcRenderer.invoke("cases.saveAnamnesis", p),
    updateMethod: (p) => ipcRenderer.invoke("cases.updateMethod", p),
    delete: (id) => ipcRenderer.invoke("cases.delete", id),
  },

  sessions: {
    listByCase: (id) => ipcRenderer.invoke("sessions.listByCase", id),
    create: (p) => ipcRenderer.invoke("sessions.create", p),
    update: (p) => ipcRenderer.invoke("sessions.update", p),
    delete: (id) => ipcRenderer.invoke("sessions.delete", id),
  },

  catalog: {
    therapyMethods: () => ipcRenderer.invoke("catalog.therapyMethods"),
    problemCategories: () => ipcRenderer.invoke("catalog.problemCategories"),
    previousTherapyTypes: () =>
      ipcRenderer.invoke("catalog.previousTherapyTypes"),
    medicationCatalog: () => ipcRenderer.invoke("catalog.medicationCatalog"),
  },

  reports: {
    /** Aggregat „Methode × Problem“, Quelle: 'personal' | 'study' */
    methodProblem: (p) => ipcRenderer.invoke("reports.methodProblem", p),
  },

  export: {
    study: {
      toCsv: () => ipcRenderer.invoke("export.study.toCsv"),
      refresh: () => ipcRenderer.invoke("export.study.refresh"), // optional
    },
  },
  maintenance: {
    recalcProblemDurations: () =>
      ipcRenderer.invoke("maintenance.recalcProblemDurations"),
    rebuildViews: () => ipcRenderer.invoke("maintenance.rebuildViews"),
  },
  auth: {
    me: () => ipcRenderer.invoke("auth.me"),
    login: (p) => ipcRenderer.invoke("auth.login", p),
    logout: () => ipcRenderer.invoke("auth.logout"),
    changePassword: (p) => ipcRenderer.invoke("auth.changePassword", p),
    users: {
      list: () => ipcRenderer.invoke("auth.users.list"),
      create: (p) => ipcRenderer.invoke("auth.users.create", p),
    },
  },
});
