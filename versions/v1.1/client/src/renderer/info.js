


// Electron消息监听，检测url改变对应显示页面
window.message.on('zpView-url-changed', (data) => {
    console.log('info:', data)
    if (data == 'https://www.zhipin.com/web/chat/index') {
        document.querySelector('.content-loading').style.display = 'none';
        document.querySelector('.content-candidateInfo').style.display = 'block';
        document.querySelector('.content-greeting').style.display = 'none';
    }
    else if (data.startsWith('https://www.zhipin.com/web/chat/recommend')) {
        document.querySelector('.content-loading').style.display = 'none';
        document.querySelector('.content-candidateInfo').style.display = 'none';
        document.querySelector('.content-greeting').style.display = 'block';
    }
    else {
        console.log('yes')
        document.querySelector('.content-loading').style.display = 'block';
        document.querySelector('.content-candidateInfo').style.display = 'none';
        document.querySelector('.content-greeting').style.display = 'none';
    }
});



// 请求zpView:chatGetCandidateInfo，获取求职者信息
// 用户触发了点击求职者信息，进行更新
window.message.on('zpView:click-event-chat-.user-container', (info) => {
    console.log('info is :', info)
    if (!info) return;
    updateCandidateInfo(info);
    document.getElementById('aiAnalyzeBtn').innerHTML = `
        <span class="emoji">🚀</span>
        <span class="text">AI分析简历</span>
      `
    document.getElementById('analysisResults').textContent = '';

})

// 更新求职者信息显示
function updateCandidateInfo(data) {
    document.getElementById('candidateName').textContent = data.name || '-';
    document.getElementById('candidateGender').textContent = data.gender || '-';
    document.getElementById('candidateAge').textContent = data.age || '-';
    document.getElementById('candidateExperience').textContent = data.experience || '-';
    document.getElementById('candidateEducation').textContent = data.education || '-';
    document.getElementById('candidateSalary').textContent = data.expectedSalary || '-';
    document.getElementById('candidatePosition').textContent = data.expectedPosition || '-';
}

let crlStatus = {
    analyzeStatus: 'wait'
};

document.addEventListener('DOMContentLoaded', function () {
    const analyzeBtn = document.getElementById('aiAnalyzeBtn');
    const resultsElement = document.getElementById('analysisResults');

    // 点击AI分析按钮
    analyzeBtn.addEventListener('click', async function () {
        if (crlStatus.analyzeStatus === 'ing') {
            crlStatus.analyzeStatus = 'wait';
            analyzeBtn.innerHTML = `
                <span class="emoji">ℹ️</span>
                <span class="text">已停止</span>
              `;
            return;
        }

        try {
            // 开始分析
            crlStatus.analyzeStatus = 'ing';
            analyzeBtn.classList.add('loading');
            analyzeBtn.innerHTML = `
              <span class="emoji">⌛️</span>
              <span class="text">分析中...</span>
              `;
            resultsElement.textContent = '';

            window.message.invoke('zpView:chatGetResumeInfo')

            // 监听zpView:resumeInfo获取简历数据，之后再执行调用api
            // 监听简历信息事件
            let resumeData = ''
            window.message.on('zpView:resumeInfo', async (resumeInfo) => {
                resumeData = resumeInfo;
                console.log('收到简历信息:', resumeInfo);


                // 调用流式API
                // const response = await fetch('http://localhost:3000/analyze-resume', {
                const response = await fetch('http://hryes.voidseed.xyz:3000/analyze-resume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(resumeInfo)
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                let markdownContent = '';

                while (crlStatus.analyzeStatus === 'ing') {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    markdownContent += chunk;

                    requestAnimationFrame(() => {
                        resultsElement.innerHTML = marked.parse(markdownContent);
                        resultsElement.scrollTo({
                            top: resultsElement.scrollHeight,
                            behavior: 'smooth'
                        });
                    });
                }

                // 分析完成
                analyzeBtn.classList.remove('loading');
                analyzeBtn.innerHTML = `
                <span class="emoji">✅</span>
                <span class="text">完成</span>
              `;
                resultsElement.innerHTML = marked.parse(markdownContent);
                crlStatus.analyzeStatus = 'wait';

            });
        } catch (error) {
            console.error('分析出错:', error);
            resultsElement.textContent = '分析失败: ' + error.message;
            analyzeBtn.innerHTML = `
                <span class="emoji">❌</span>
                <span class="text">错误</span>
              `;
            crlStatus.analyzeStatus = 'wait';
        }
    });

    // 折叠功能
    const toggleBtn = document.getElementById('toggleInfoBtn');
    const infoSection = document.getElementById('candidateInfoSection');

    if (toggleBtn && infoSection) {
        toggleBtn.addEventListener('click', () => {
            infoSection.classList.toggle('collapsed');
            const isCollapsed = infoSection.classList.contains('collapsed');
            toggleBtn.querySelector('.emoji').textContent = isCollapsed ? '📂' : '📦';
            toggleBtn.querySelector('.text').textContent = isCollapsed ? '展开' : '收起';
        });
    }
});

// 发送打招呼按钮状态管理
let greetingStatus = 'ready'; // ready | sending | stopping

// 发送打招呼按钮点击事件
document.getElementById('sendGreetingBtn').addEventListener('click', () => {
    const btn = document.getElementById('sendGreetingBtn');
    const text = document.getElementById('greetingText').value.trim();
    const ratings = Array.from(document.querySelectorAll('input[name="rating"]:checked'))
        .map(el => el.value);

    if (greetingStatus === 'sending') {
        // 如果正在发送，点击则停止
        greetingStatus = 'stopping';
        btn.innerHTML = `
          <span class="emoji">🛑</span>
          <span class="text">正在停止...</span>
        `;
        window.message.invoke('zpView:sendGreeting-stop');

        // 5秒后恢复为可发送状态
        setTimeout(() => {
            greetingStatus = 'ready';
            btn.innerHTML = `
            <span class="emoji">📤</span>
            <span class="text">发送打招呼</span>
          `;
        }, 10000);
        return;
    }

    // 开始发送
    greetingStatus = 'sending';
    btn.innerHTML = `
        <span class="emoji">⏳</span>
        <span class="text">执行中...</span>
      `;

    // 向main.js发送请求
    window.message.invoke('zpView:sendGreeting', {
        text,
        ratings
    });
});


