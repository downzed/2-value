// Preload scripts for IPC bridge
const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  openImage: () => ipcRenderer.invoke("open-image"),
  saveImage: (dataUrl: string) => ipcRenderer.invoke("save-image", { dataUrl }),
});
