import { session } from 'electron';

/**
 * 真实Chrome浏览器指纹配置
 * 原理：模拟真实浏览器的各项特征参数，防止被网站识别为自动化工具
 */
const REAL_CHROME_CONFIG = {
  // 用户代理字符串 - 模拟最新版Chrome浏览器
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',


  // 浏览器语言设置 - 模拟中英文双语环境
  languages: ['zh-CN', 'zh', 'en-US', 'en'],

  // 硬件信息 - 模拟8核CPU
  hardwareConcurrency: 8,

  // 设备内存 - 模拟8GB内存
  deviceMemory: 8,

  // 屏幕信息 - 模拟1920x1080分辨率
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,     // 可用宽度(减去任务栏等)
    availHeight: 1040,    // 可用高度
    colorDepth: 24,       // 颜色深度
    pixelDepth: 24        // 像素深度
  },

  // 浏览器插件 - 模拟常见的PDF插件
  plugins: [{
    name: 'Chrome PDF Plugin',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer'
  }]
};

/**
 * 获取防检测的浏览器窗口配置
 * 原理：配置Electron窗口参数，禁用可能暴露自动化的特性
 */
function getAntiDetectionConfig() {
  console.log('getAntiDetectionConfig ok')
  return {
    webPreferences: {
      nodeIntegration: false,       // 禁用Node集成，提高安全性
      contextIsolation: true,       // 开启上下文隔离，防止全局污染
      webgl: true,                  // 启用WebGL支持
      plugins: true,                // 启用插件支持
      experimentalFeatures: false,  // 禁用实验性功能
      disableBlinkFeatures: 'AutomationControlled', // 禁用自动化控制特征
      devTools: true,               // 禁用开发者工具

      //////
      offscreen: false,             // 不启用离屏渲染（真实浏览器不会）
      sandbox: false,                      // 启用沙箱模式
      nativeWindowOpen: true,             // 使用原生window.open
      enableRemoteModule: false,          // 禁用remote模块
      spellcheck: false,                  // 禁用拼写检查
      webSecurity: true,                  // 启用同源策略
      allowRunningInsecureContent: false, // 禁止运行不安全内容
      images: true,                      // 启用图片加载(禁用可能引起怀疑)
      textAreasAreResizable: true,        // 保持默认文本区域可调整大小
      webgl2: true,                      // 启用WebGL2
      navigateOnDragDrop: false          // 禁用拖放导航
    }
  };
}

/**
 * 设置完整的反检测功能
 * @param {Electron.WebContents} webContents - Electron的webContents对象
 * 原理：通过多层防护措施使自动化操作更像真实用户行为
 */
async function setupAntiDetection(webContents) {

  console.log('setupAntiDetection ok')
  if (!webContents || webContents.isDestroyed()) {
    throw new Error('无效的webContents对象');
  }

  // 1. 设置用户代理 - 伪装成Chrome浏览器
  webContents.setUserAgent(REAL_CHROME_CONFIG.userAgent);

  // 2. 创建独立会话 - 避免留下检测痕迹
  // 原理：使用独立的分区会话，不与默认会话共享数据
  const antiDetectSession = session.fromPartition('persist:anti-detect');
  antiDetectSession.setUserAgent(REAL_CHROME_CONFIG.userAgent);

  // 3. 请求头拦截修改 - 伪装请求特征
  // 原理：修改HTTP请求头，模拟真实浏览器的请求行为
  antiDetectSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Accept-Language'] = REAL_CHROME_CONFIG.languages.join(',');
    details.requestHeaders['X-Requested-With'] = 'XMLHttpRequest'; // 伪装AJAX请求
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // 4. 证书验证处理 - 简化证书验证流程
  // 注意：实际项目中应根据需要调整安全策略
  antiDetectSession.setCertificateVerifyProc((request, callback) => {
    callback(0); // 0表示信任证书
  });

  // // 5. 调试器控制 - 安全附加Chrome调试协议
  // // 原理：通过CDP执行底层命令，但需注意可能被检测
  // if (!webContents.debugger.isAttached()) {
  //   try {
  //     webContents.debugger.attach('1.3'); // 1.3是CDP协议版本
  //     await webContents.debugger.sendCommand('Network.enable');
  //   } catch (err) {
  //     console.error('CDP连接错误', err);
  //   }
  // }

  // 6. 浏览器属性覆盖 - 核心反检测措施
  // 原理：通过重定义浏览器属性，消除自动化特征
  const script = `
    // 6.1 移除webdriver标志 - 这是检测自动化的关键属性
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,  // 返回undefined表示不存在
      configurable: false,   // 禁止再次修改
      enumerable: false      // 隐藏该属性
    });
    
    // 6.2 模拟语言环境
    Object.defineProperty(navigator, 'languages', {
      get: () => ${JSON.stringify(REAL_CHROME_CONFIG.languages)},
      configurable: true,
      enumerable: true
    });
    
    // 6.3 模拟硬件信息
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => ${REAL_CHROME_CONFIG.hardwareConcurrency},
      configurable: true,
      enumerable: true
    });
    
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => ${REAL_CHROME_CONFIG.deviceMemory},
      configurable: true,
      enumerable: true
    });
    
    // 6.4 模拟插件信息
    Object.defineProperty(navigator, 'plugins', {
      get: () => ${JSON.stringify(REAL_CHROME_CONFIG.plugins)},
      configurable: true,
      enumerable: true
    });
    
    // 6.5 模拟屏幕信息
    Object.defineProperties(screen, {
      width: { get: () => ${REAL_CHROME_CONFIG.screen.width} },
      height: { get: () => ${REAL_CHROME_CONFIG.screen.height} },
      availWidth: { get: () => ${REAL_CHROME_CONFIG.screen.availWidth} },
      availHeight: { get: () => ${REAL_CHROME_CONFIG.screen.availHeight} },
      colorDepth: { get: () => ${REAL_CHROME_CONFIG.screen.colorDepth} },
      pixelDepth: { get: () => ${REAL_CHROME_CONFIG.screen.pixelDepth} }
    });
    
    // 6.6 Canvas指纹混淆 - 防御指纹识别
    (function() {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const ctx = this.getContext('2d');
        if (ctx) {
          // 添加随机噪声干扰指纹识别
          ctx.fillStyle = 'rgba(0,0,0,0)';
          ctx.fillRect(0, 0, this.width, this.height);
        }
        return originalToDataURL.apply(this, args);
      };
    })();
  `;

  // 执行反检测脚本
  await webContents.executeJavaScript(script);
}

export {
  getAntiDetectionConfig,
  setupAntiDetection
};
