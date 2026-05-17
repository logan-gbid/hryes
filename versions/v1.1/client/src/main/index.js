import { app, shell, BrowserWindow, ipcMain, WebContentsView } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getAntiDetectionConfig, setupAntiDetection } from './antiDetection'
import axios from 'axios'

// ════════════════════════════════════════════════════════════
//                          var                        
//                      core Module                        
// ════════════════════════════════════════════════════════════
// boss打招呼模块
let sendGreetingData = {
  need: '',
  ratings: '',
  info: ''
}
let sendGreetingStatus = {
  exec: 'ing', // stop or ing
  // hasContent: false, // true or false
}



// ════════════════════════════════════════════════════════════
//                   executeJavaScript                        
//                      Script Module                        
// ════════════════════════════════════════════════════════════
// 提取候选人基础信息脚本
const extractCandidateInfoScript = `
    (function() {

      let info = {
        name: '',
        gender: '',
        age: '',
        experience: '',
        education: '',
        expectedSalary: '',
        expectedPosition: ''
      };

      const index = document.querySelector('.conversation-main .base-info-single-detial .active-time') ? 1 : 0;

      info.name = document.querySelector('.conversation-main .base-name .name-box')?.textContent.trim();
      info.gender = document.querySelector('.conversation-main .base-name svg use')?.getAttribute('xlink:href') === '#icon-icon-women' ? '女' : '男';
      info.age = document.querySelectorAll('.conversation-main .base-info-single-detial div')[index + 1]?.textContent.trim();
      info.experience = document.querySelectorAll('.conversation-main .base-info-single-detial div')[index + 2]?.textContent.trim();
      info.education = document.querySelectorAll('.conversation-main .base-info-single-detial div')[index + 3]?.textContent.trim();
      info.expectedSalary = document.querySelector('.conversation-main .base-info-single-main .expect .value i')?.textContent.trim();
      info.expectedPosition = document.querySelector('.conversation-main .base-info-single-main .expect .value')?.childNodes[0].textContent.trim();

      return info;
    })()
  `;
// 提取Chat页面简历详细信息脚本
const extractChatResumeInfoScript = `
    (function() {
      // 获取元素位置并模拟真实点击
      const btn = document.querySelector('.resume-btn, .name-box');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const clickEvent = {
          type: 'mouseDown',
          x: rect.left + rect.width/2,
          y: rect.top + rect.height/2,
          button: 'left',
          clickCount: 1
        };
        window.message.invoke('simulateClick', clickEvent);
      }

      // 延迟1秒后执行提取
      setTimeout(() => {
        const resume = document.querySelector('.resume-detail');
        if (resume) {
          const resumeInfo = extractResumeInfo();
          window.message.invoke('zpView:resumeInfo', resumeInfo);
        }
      }, 1000);

      // 提取简历详细信息
  function extractResumeInfo() {

    const resume = document.querySelector('.resume-detail');
    if (!resume) return;

    // 提取基础信息
    const name = resume.querySelector('.geek-name')?.textContent.trim() || '未填写';
    const age = resume.querySelector('.info-labels .label-text:nth-child(1) span')?.textContent.trim() || '未填写';
    const workYears = resume.querySelector('.info-labels .label-text:nth-child(3)')?.textContent.trim() || '未填写';
    const education = resume.querySelector('.info-labels .label-text:nth-child(5)')?.textContent.trim() || '未填写';
    const jobStatus = resume.querySelector('.info-labels .label-text:nth-child(7)')?.textContent.trim() || '未填写';
    const selfDescription = resume.querySelector('.selfDescription')?.textContent.trim().replace(/\\n/g, ' ') || '未填写';
    const expectedJob = Array.from(resume.querySelectorAll('.join-text-wrap .join-text'))
      .map(span => span.textContent.trim())
      .join(' | ') || '未填写';

    // 提取工作经历
    const workSections = resume.querySelectorAll('.resume-item');
    let workExperiences = [];
    for (let section of workSections) {
      const title = section.querySelector('h3')?.textContent.trim();
      if (title === '工作经历') {
        const workItems = section.querySelectorAll('.history-item');
        workExperiences = Array.from(workItems).map(item => {
          const company = item.querySelector('.name a, .name span')?.textContent.trim() || '未填写';
          const position = item.querySelector('.name span:last-child')?.textContent.trim() || '未填写';
          const period = item.querySelector('.period')?.textContent.trim() || '未填写';
          const description = item.querySelector('.text')?.textContent.replace(/<[^>]+>/g, '').trim() || '未填写';
          return \`【\${company}】 \${position} | \${period}\\n\${description}\\n\`;
        });
        break;
      }
    }

    // 提取教育经历
    let educationExperiences = [];
    for (let section of workSections) {
      const title = section.querySelector('h3')?.textContent.trim();
      if (title === '教育经历') {
        const eduItems = section.querySelectorAll('.history-item');
        educationExperiences = Array.from(eduItems).map(item => {
          const school = item.querySelector('.school-info .name b')?.textContent.trim() || '未填写';
          const major = item.querySelector('.major')?.textContent.trim() || '未填写';
          const period = item.querySelector('.period')?.textContent.trim() || '未填写';
          return \`【\${school}】 \${major} | \${period}\\n\`;
        });
        break;
      }
    }

    // 提取关键词
    const keywords = Array.from(resume.querySelectorAll('.keywords'))
      .map(span => span.textContent.trim())
      .join(' | ') || '未填写';

    // 合并所有内容
    const result = [
      \`📌 基本信息\`,
      \`姓名：\${name}\`,
      \`年龄：\${age} | 工作年限：\${workYears} | 学历：\${education}\`,
      \`求职状态：\${jobStatus}\`,
      \`\\n📝 自我评价\`,
      selfDescription,
      \`\\n🎯 期望职位\`,
      expectedJob,
      \`\\n🔍 关键词\`,
      keywords,
      \`\\n💼 工作经历\`,
      ...workExperiences,
      \`\\n🎓 教育经历\`,
      ...educationExperiences
    ].join('\\n');

    return result;
  };
    })()
  `;
// 提取Recommend页面简历详细信息脚本
const extractRecommendResumeInfoScript = `
    (function(){
    
    // // 先测试获取iframe内容
    // const iframe = document.querySelector('iframe');
    // if (iframe) {
    //   const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
    //   // 测试获取基础信息元素
    //   const testElement = iframeDoc.querySelector('.geek-desc');
    // }

    setTimeout(() => {
      const resumeInfo = extractResumeInfo();
      window.message.invoke('zpView:resumeInfo-b', resumeInfo);
    }, 1000);
    
    // 提取简历详细信息
  // 提取简历详细信息
function extractResumeInfo() {
  // 1. 自我评价：位于 .geek-base-info-wrap 内的 .geek-desc
  let selfDescription = '未填写';
  const iframe = document.querySelector('iframe');
  const baseSection = iframe?.contentDocument?.querySelector('.geek-base-info-wrap .geek-desc');
  if (baseSection) {
    selfDescription = baseSection.textContent.trim().replace(/\\n/g, ' ');
  }

  // 2. 期望职位：在 .geek-expect-wrap 内的 .join-text-wrap 下的所有 span 拼接
  let expectedJob = '未填写';
  const expectContainer = iframe?.contentDocument?.querySelector('.geek-expect-wrap');
  if (expectContainer) {
    const spanElems = expectContainer.querySelectorAll('.join-text-wrap span');
    const positions = Array.from(spanElems)
      .map(el => el.textContent.trim())
      .filter(text => text.length > 0);
    if (positions.length > 0) {
      expectedJob = positions.join(' | ');
    }
  }

  // 3. 工作经历：遍历 .geek-work-experience-wrap 下所有的 .work-wrap 项目
  let workExperiences = [];
  const workItems = iframe?.contentDocument?.querySelectorAll('.geek-work-experience-wrap .work-wrap');
  workExperiences = Array.from(workItems).map(item => {
    // 公司名称：优先获取 .company-name-wrap 内的 .name，如无则取 .company-name-wrap 文本
    let companyElem = item.querySelector('.company-name-wrap .name');
    if (!companyElem) {
      companyElem = item.querySelector('.company-name-wrap');
    }
    const company = companyElem ? companyElem.textContent.trim() : '未填写';

    // 职位：通常在 .company-name-wrap 内的 .position 中第一个 span
    const positionElem = item.querySelector('.company-name-wrap .position span');
    const position = positionElem ? positionElem.textContent.trim() : '未填写';

    // 时间区间：从 .period 中获取
    const periodElem = item.querySelector('.period');
    const period = periodElem ? periodElem.textContent.trim() : '未填写';

    // 工作描述：先尝试 .item-wrap 内的 .item-content，若无则取 .item-wrap 的文本
    let descriptionElem = item.querySelector('.item-wrap .item-content');
    if (!descriptionElem) {
      descriptionElem = item.querySelector('.item-wrap');
    }
    const description = descriptionElem ? descriptionElem.textContent.replace(/<[^>]+>/g, '').trim() : '未填写';

    return \`【\${company}】 \${position} | \${period}\\n\${description}\\n\`;
  });

  // 4. 教育经历：遍历 .geek-education-experience-wrap 下所有的 .edu-wrap 项目
  let educationExperiences = [];
  const eduItems = iframe?.contentDocument?.querySelectorAll('.geek-education-experience-wrap .edu-wrap');
  educationExperiences = Array.from(eduItems).map(item => {
    // 学校名称：优先获取 .school-info-wrap 内的 .school-name，如无则尝试 .school-name-wrap
    let schoolElem = item.querySelector('.school-info-wrap .school-name');
    if (!schoolElem) {
      schoolElem = item.querySelector('.school-info-wrap .school-name-wrap');
    }
    const school = schoolElem ? schoolElem.textContent.trim() : '未填写';

    // 专业：查找 .school-info-wrap 内标记为 .ui-tooltip.major 的元素
    const majorElem = item.querySelector('.school-info-wrap .ui-tooltip.major');
    const major = majorElem ? majorElem.textContent.trim() : '未填写';

    // 时间：从 .school-info-wrap 内的 .period 获取
    const periodElem = item.querySelector('.school-info-wrap .period');
    const period = periodElem ? periodElem.textContent.trim() : '未填写';

    return \`【\${school}】 \${major} | \${period}\\n\`;
  });

  // 合并所有提取的信息为最终输出
  const result = [
    '📝 自我评价',
    selfDescription,
    '🎯 期望职位',
    expectedJob,
    '💼 工作经历',
    ...workExperiences,
    '🎓 教育经历',
    ...educationExperiences
  ].join('\\n');

  return result;
};
    })()
  `;
// 监听ZPVIEW点击触发变化脚本
const listenerUrlChange = `(
function (){

document.addEventListener('click', (event) => {
  ///////
  //  window.message.invoke('zpView:click-event', document.querySelector('.conversation-main .action-time'));
  ///////
   if (event.target.closest('.user-container')) {
    setTimeout(() => {
      const candidateInfo = ${extractCandidateInfoScript};
      window.message.invoke('zpView:click-event-chat-.user-container', candidateInfo);
    }, 1000);
   }
});


}
)()
  `
// 

const clickRecommendSendScript = `
  (function () {
    const iframe = document.querySelector('iframe');
    const btn = iframe?.contentDocument?.querySelector('.boss-popup__wrapper.boss-dialog.boss-dialog__wrapper.dialog-lib-resume.recommend > div.boss-popup__content > div > div > div.resume-layout-wrap > div > div.resume-right-side > div > div > div.communication.icon-coop-forward.shareReport > div > div > div.button-list-wrap > div > span > div > button');

    if (btn) {
      const rect = btn.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();

      const x = iframeRect.left + rect.left + rect.width / 2;
      const y = iframeRect.top + rect.top + rect.height / 2;

      const clickEvent = {
        type: 'mouseDown',
        x: x,
        y: y,
        button: 'left',
        clickCount: 1
      };
      window.message.invoke('simulateClick', clickEvent);

      // 添加mouseUp事件完成点击
      setTimeout(() => {
        window.message.invoke('simulateClick', {
          type: 'mouseUp',
          x: x,
          y: y,
          button: 'left',
          clickCount: 1
        });
      }, 100);
    }
})()
`;

const clickRecommendNextScript = `
  (function () {

    const iframe = document.querySelector('iframe');
    const nextBtn = iframe?.contentDocument?.querySelector('.boss-popup__wrapper.boss-dialog.boss-dialog__wrapper.dialog-lib-resume.recommend > div.boss-popup__content > div > div > div.turn-btn.next');
    if (nextBtn) {
      const rect = nextBtn.getBoundingClientRect();
      
      const iframeRect = iframe.getBoundingClientRect();
      const x = iframeRect.left + rect.left + rect.width / 2;
      const y = iframeRect.top + rect.top + rect.height / 2;

      window.message.invoke('simulateClick', {
        type: 'mouseDown',
        // x: rect.left + rect.width/2,
        // y: rect.top + rect.height/2,

        x: x,
        y: y,
        button: 'left',
        clickCount: 1
      });


      setTimeout(() => {
        window.message.invoke('simulateClick', {
          type: 'mouseUp',
          // x: rect.left + rect.width/2,
          // y: rect.top + rect.height/2,

          x: x,
          y: y,
          button: 'left',
          clickCount: 1
        });
      }, 100);

      window.message.invoke('zpView:sendGreeting');
    }
      

  })()
`;




let mainWindow = null;
let zpView = null;
let infoWin = null;

function createWindow() {

  // ════════════════════════════════════════════════════════════
  //                      mainWindow                        
  //                      窗口 Module                        
  // ════════════════════════════════════════════════════════════
  // Create the browser window.
  mainWindow = new BrowserWindow({
    icon: icon, // 使用 Vite 打包后的图标路径
    width: 900,
    height: 670,
    minWidth: 900,
    minHeight: 670,
    show: true,
    frame: false, // 禁用默认窗口边框
    titleBarStyle: 'hidden', // 隐藏标题栏
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      nodeIntegration: false, // 禁用Node.js集成以提高安全性
      contextIsolation: true, // 启用上下文隔离防止原型污染
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }


  // ════════════════════════════════════════════════════════════
  //                        ZPVIEW                        
  //                      Core Module                        
  // ════════════════════════════════════════════════════════════

  zpView = new WebContentsView({
    webPreferences: {
      ...getAntiDetectionConfig().webPreferences,
      preload: join(__dirname, '../preload/index.js'),
    }
  });
  mainWindow.contentView.addChildView(zpView);
  setupAntiDetection(zpView.webContents);

  // 禁止打开新窗口
  zpView.webContents.setWindowOpenHandler(({ url }) => { action: 'deny' });

  // 窗口自适应
  const resizeZpView = () => zpView.setBounds({
    x: 0, y: 50,
    width: mainWindow.getSize()[0],
    height: mainWindow.getSize()[1] - 50
  });
  mainWindow.on('resize', resizeZpView);
  resizeZpView();

  zpView.webContents.loadURL('https://www.adspower.net/fingerprint-checker');
  // zpView.webContents.loadURL('https://zhipin.com');

  // navigate 状态
  zpView.webContents.on('did-navigate', (event, url) => {
    if (url === 'https://www.zhipin.com/web/chat/index' || url === 'https://www.zhipin.com/web/chat/recommend') {
      infoWin.webContents.send('zpView-url-changed', url);
    } else {
      infoWin.webContents.send('zpView-url-changed', 'null');
    }
  });

  zpView.webContents.on('did-navigate-in-page', (event, url) => {
    if (url === 'https://www.zhipin.com/web/chat/index' || url === 'https://www.zhipin.com/web/chat/recommend') {
      infoWin.webContents.send('zpView-url-changed', url);
    } else {
      infoWin.webContents.send('zpView-url-changed', 'null');
    }
  });

  zpView.webContents.on('did-finish-load', () => {
    zpView.webContents.executeJavaScript(listenerUrlChange);
  });




  // ════════════════════════════════════════════════════════════
  //                        infoWin                        
  //                      Core Module                        
  // ════════════════════════════════════════════════════════════

  // 创建子窗口
  infoWin = new BrowserWindow({
    width: 350,
    height: 500,
    parent: mainWindow,
    modal: false,
    frame: false,
    resizable: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    webPreferences: {
      sandbox: false, // ✅ 显式禁用
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
    }
  });

  // 加载子窗口内容
  // infoWin.loadFile(join(__dirname, '../renderer/info.html'));
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // console.log(join(__dirname, '../../src/renderer/info.html'))
    infoWin.loadURL(join(__dirname, '../../src/renderer/info.html'))
  } else {
    infoWin.loadFile(join(__dirname, '../renderer/info.html'))
  }


  // 实时限制子窗口位置和大小(预留顶部50px空间)
  const constraininfoWindow = (e, newBounds) => {
    const bounds = mainWindow.getBounds();

    // 计算最大允许位置和尺寸
    const maxX = bounds.x + bounds.width - newBounds.width;
    const maxY = bounds.y + bounds.height - newBounds.height;

    // 实时调整位置和尺寸
    newBounds.x = Math.max(bounds.x, Math.min(maxX, newBounds.x));
    newBounds.y = Math.max(bounds.y + 50, Math.min(maxY, newBounds.y)); // 确保不低于顶部50px
    newBounds.width = Math.min(newBounds.width, bounds.width);
    newBounds.height = Math.min(newBounds.height, bounds.height - 50); // 高度不超过总高度减50px

    return newBounds;
  };

  // 设置子窗口初始位置(考虑顶部50px空间)
  const updateinfoWinPosition = () => {
    const bounds = mainWindow.getBounds();
    infoWin.setBounds({
      x: bounds.x + bounds.width - 400,
      y: Math.max(bounds.y + 50, bounds.y + 50), // 确保不低于顶部50px
      width: 350,
      height: Math.min(750, bounds.height - 50) // 高度不超过总高度减50px
    });
  };
  updateinfoWinPosition();
  infoWin.show();

  // 监听窗口事件
  infoWin.on('will-move', (e, newBounds) => {
    e.preventDefault();
    infoWin.setBounds(constraininfoWindow(e, newBounds));
  });

  infoWin.on('will-resize', (e, newBounds) => {
    e.preventDefault();
    infoWin.setBounds(constraininfoWindow(e, newBounds));
  });

  mainWindow.on('move', updateinfoWinPosition);
  mainWindow.on('resize', updateinfoWinPosition);
}


// ════════════════════════════════════════════════════════════
//                    ipcMain.handle                        
//                      Core Module                        
// ════════════════════════════════════════════════════════════


ipcMain.handle('zpView:click-event-chat-.user-container', (event, info) => {
  console.log('hello', info)
  infoWin.send('zpView:click-event-chat-.user-container', info)
  return true;
});
ipcMain.handle('zpView:resumeInfo', (event, info) => {
  infoWin.send('zpView:resumeInfo', info)
  return true;
});

// 当收到获取简历详细信息请求时执行
ipcMain.handle('zpView:chatGetResumeInfo', () => {
  zpView.webContents.executeJavaScript(extractChatResumeInfoScript);
});

// 暂停打招呼事件
ipcMain.handle('zpView:sendGreeting-stop', () => {
  sendGreetingStatus.exec = 'stop'
})

// 调用打招呼事件
ipcMain.handle('zpView:sendGreeting', (event, data) => {
  console.log('okokokokok', data)
  if (!data && sendGreetingStatus.exec === 'stop') {
    return
  }
  if (data) {
    sendGreetingStatus.exec = 'ing'
    sendGreetingData.need = data.text;
    sendGreetingData.ratings = data.ratings;
  }

  zpView.webContents.executeJavaScript(extractRecommendResumeInfoScript)
})

// 
// 将data和提取的详细简历信息发送到服务器获取分析结果
ipcMain.handle('zpView:resumeInfo-b', async (event, info) => {
  if (sendGreetingStatus.exec === 'stop') return
  sendGreetingData.info = info

  // const response = await axios.post('http://localhost:3000/ai-greeting', sendGreetingData);
  const response = await axios.post('http://hryes.voidseed.xyz:3000/ai-greeting', sendGreetingData);

  // 解析AI返回的结果
  const resultText = response.data;
  const conclusionMatch = resultText.match(/【结论】(true|false)/);
  const shouldGreet = conclusionMatch ? conclusionMatch[1] === 'true' : false;

  if (shouldGreet) {
    await zpView.webContents.executeJavaScript(clickRecommendSendScript)
    setTimeout(() => {
      zpView.webContents.executeJavaScript(clickRecommendNextScript)
    }, 1000);
  } else {
    await zpView.webContents.executeJavaScript(clickRecommendNextScript)
  }

})

// 模拟真实点击事件
ipcMain.handle('simulateClick', (event, clickData) => {
  zpView.webContents.sendInputEvent({
    type: 'mouseDown',
    x: clickData.x,
    y: clickData.y,
    button: 'left',
    clickCount: 1
  });
  // 添加mouseUp事件完成点击
  zpView.webContents.sendInputEvent({
    type: 'mouseUp',
    x: clickData.x,
    y: clickData.y,
    button: 'left',
    clickCount: 1
  });
  return true;
});

// 接收其他进程发送的数据  // 窗口控制IPC事件处理
ipcMain.handle('window:minimize', () => mainWindow.minimize())
ipcMain.handle('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.handle('window:close', () => mainWindow.close())
ipcMain.handle('infoWin:toggle', () => {
  if (infoWin.isVisible()) {
    infoWin.hide();
  } else {
    infoWin.show();
  }
})


// ════════════════════════════════════════════════════════════
//                      APP 就绪操作                        
//                      Core Module                        
// ════════════════════════════════════════════════════════════
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  // ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed,
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
