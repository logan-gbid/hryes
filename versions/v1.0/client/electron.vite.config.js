import { defineConfig } from 'electron-vite';
import path from 'path';
import { obfuscator } from 'rollup-obfuscator';

export default defineConfig({
  // 主进程配置(使用混淆代替字节码加密)
  main: {
    plugins: [obfuscator({
      exclude: [
        'node_modules/**',
        '**/electron/**',
        '**/WebContentsView**'
      ],
      options: {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayThreshold: 0.75,
        transformObjectKeys: false,
        unicodeEscapeSequence: false
      }
    })],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'main.js'),           // 明确路径
          antiDetection: path.resolve(__dirname, 'antiDetection.js') // 明确路径
        }
      }
    }
  },

  // 预加载脚本配置(混淆)
  preload: {
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'preload.js'),
      }
    }
  },

  // 渲染进程配置(混淆)
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
          info: path.resolve(__dirname, 'info.html')
        }
      }
    }
  }
});
