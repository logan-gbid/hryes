
// 使用暴露的 API
document.querySelector('.titlebar .controls .toggle-child').addEventListener('click', () => {
    window.message.invoke('infoWin:toggle')
});

document.querySelector('.titlebar .controls .min').addEventListener('click', () => {
    window.message.invoke('window:minimize')
});

document.querySelector('.titlebar .controls .max').addEventListener('click', () => {
    window.message.invoke('window:maximize')
});

document.querySelector('.titlebar .controls .close').addEventListener('click', () => {
    window.message.invoke('window:close')
});

