const { contextBridge, ipcRenderer } = require('electron');
delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('message', {
    // 调用主进程方法并等待响应
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },

    // 接收来自主进程的消息
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, data) => callback(data));
    },
});
