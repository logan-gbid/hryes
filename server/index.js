import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';
import { existsSync, readFileSync } from 'fs';

const loadEnvFile = () => {
  if (!existsSync('.env')) return;

  const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile();

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  throw new Error('Missing DEEPSEEK_API_KEY. Copy .env.example to .env and set your API key.');
}

const app = express();
app.use(cors({
  origin: /^chrome-extension:\/\/[\w-]+$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

const openai = new OpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  apiKey
});

app.post('/analyze-resume', express.json({
  limit: '10mb',
  strict: false
}), async (req, res) => {
  console.log(req.body)
  let resumeText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const stream = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一位资深人力资源专家，请按以下结构分析简历：

1. 匹配度评估（首要展示）：
- 综合评分：1-10分
- 初步结论：{{根据评分自动生成以下标签之一}}
  * "⭐ 强烈推荐" (8-10分)
  * "✅ 建议继续沟通" (5-7分) 
  * "⚠️ 需谨慎考虑" (3-4分)
  * "❌ 不合适" (0-2分)
- 关键匹配点：列出3个最匹配岗位要求的方面

2. 核心分析：
- 优势亮点：3个最突出优势
- 潜在风险：2-3个需关注的问题点
- 发展潜力评估

3. 专业建议：
- 面试重点考察方向
- 可能的薪资区间建议
- 入职后培养建议`
      },
      { role: 'user', content: resumeText }
    ],
    stream: true
  });

  res.setHeader('Content-Type', 'text/plain');

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    // console.log('Received chunk:', content);
    res.write(content);
  }

  res.end();
});

const PORT = Number(process.env.PORT || 3000);
app.post('/generate-followup', express.json({
  limit: '10mb',
  strict: false
}), async (req, res) => {
  console.log(req.body);
  let analysisReport = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const stream = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `根据以下简历分析报告，生成3-5条专业追问话术：
        
要求：
1. 每条直接以正文内容开头，不要有任何符号数字
2. 问题具体明确
3. 格式：
【追问开始】
1. 关于[XX方面]，请问...
2. 您在[XX项目]中具体负责...
3. 能否详细说明...
【追问结束】`
      },
      { role: 'user', content: analysisReport }
    ],
    stream: true
  });

  res.setHeader('Content-Type', 'text/plain');

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    res.write(content);
  }

  res.end();
});

app.post('/ai-greeting', express.json(), async (req, res) => {
  const { need, ratings, info } = req.body;

  console.log(need, ratings, info)

  // 构建分析prompt
  const prompt = `你是一位资深招聘专家，请根据以下标准评估候选人并判断是否应该打招呼：
【岗位需求】${need}

【评分标准】
1. 岗位匹配度（权重40%）：评估技能、经验与岗位要求的匹配程度
2. 专业能力（权重30%）：评估专业技能的深度和广度
3. 发展潜力（权重20%）：评估未来成长空间
4. 其他因素（权重10%）：如稳定性、文化匹配度等

【评分等级】
⭐ 强烈推荐 (8-10分) → strong
✅ 建议继续沟通 (5-7分) → recommend
⚠️ 需谨慎考虑 (3-4分) → caution
❌ 不合适 (0-2分) → reject

【输入信息】
可接受候选人等级：${ratings.join(', ')}
岗位需求：${need}
简历信息：${info}

【评估要求】
1. 根据上述评分标准给出0-10分的综合评分
2. 检查评分对应的等级是否在${ratings}允许范围内
3. 给出明确的打招呼建议

【严格按照输出格式】
【评分】X/10分 (示例：7/10分)
【等级】strong/recommend/caution/reject
【结论】true/false
【详细理由】
1. 匹配度分析：...
2. 优势亮点：...
3. 潜在风险：...
4. 其他说明：...`;


  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "deepseek-chat",
  });

  res.setHeader('Content-Type', 'text/plain');
  res.send(completion.choices[0].message.content);
});

app.listen(PORT, () => {
  console.log(`简历分析服务运行在 http://localhost:${PORT}`);
});
