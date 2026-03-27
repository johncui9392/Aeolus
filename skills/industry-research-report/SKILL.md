---
name: industry_research_report
description: >
  生成行业深度研究报告。当用户的请求中包含行业关键词、行业名称，并且意图是了解某个行业、生成行业研究报告、行业分析时，触发此 Skill。
  典型触发场景包括但不限于：用户提到"XX行业研究"、"XX行业报告"、"帮我分析XX行业"、"XX产业深度研究"、"XX领域市场分析"等。
  即使用户没有明确说"报告"二字，只要意图是围绕某个行业主体进行深度研究或分析，都应触发此 Skill。
  请在收到用户请求后，第一时间阅读此 SKILL.md 并严格按照流程执行。
metadata:
  {
    "openclaw": {
      "requires": {
        "env": ["EM_API_KEY"],
        "bins": ["python3", "pip3"]
      },
      "install": [
        {
          "id": "pip-deps",
          "kind": "python",
          "package": "httpx",
          "label": "Install Python dependencies"
        }
      ]
    }
  }
---

# 行业研究报告生成 Skill

## 概述

本 Skill 用于根据用户的自由输入，使用模型提取行业关键词，调用行业研究脚本生成研究报告，最终输出包含最终返回标题、正文、PDF/DOC附件地址。

## 执行流程

### Step 1：提取行业关键词 `{{topic}}`

用户的输入形式较为自由，可能是一句话、一个短语或一段描述，但一定包含"行业主体"这一关键信息。

**你需要做的：**
- 从用户问句中精准提取行业关键词，记为 `{{topic}}`。
- 提取时只保留核心行业主体名称，去除多余的修饰词（如"帮我看看"、"分析一下"等）。
- 如果用户问句中包含多个行业，优先提取最核心的那个（也可以在必要时合并，如"新能源汽车"）。

**示例：**

| 用户输入 | 提取的 `{{topic}}` |
|---|---|
| "帮我生成一份半导体行业的研究报告" | 半导体 |
| "我想了解一下新能源汽车产业的发展趋势" | 新能源汽车 |
| "AI芯片行业深度分析" | AI芯片 |
| "请分析消费电子与智能家居两个领域的交叉趋势" | 消费电子与智能家居 |

### Step 2：调用行业研究报告写作脚本

以 `{{topic}}` 为入参，调用`scripts/get_data.py` 行业研究脚本：

```bash
python3 {baseDir}/scripts/get_data.py --query "{{topic}}"
```

脚本功能：生成相应的行业研究报告并将其分别用pdf和docx的格式保存。

脚本返回字段说明：

```
{
    "title": "生成的报告标题",
    "truncated_text": "研究报告的部分正文内容",
    "pdf_output_path": "完整报告的pdf文件保存地址",
    "docx_output_path": "完整报告的docx文件保存地址",
    "share_url": "完整报告的分享链接"
}
```

注意：**禁止调用 任何「后台执行、稍后汇报」的方式跑本脚本**，只能在当前会话中同步等待到命令完成，拿到 stdout 的结果后再继续。否则 Step 3 无法执行，从而导致本 Skill 失败。

### Step 3：最终输出结果

Step 2 成功后，将返回的 title、truncated_text、pdf_output_dir、docx_output_dir 等结果填入下方模板，生成最终回复。

```
《[title]》

已经生成行业研究报告。此处仅展示部分正文内容，请下载附件查看报告详情和参考信息。（不要删减这段话）

[truncated_text]...

**附件：**
- 📄 [title].pdf 已保存到 [pdf_output_path]
- 📄 [title].docx 已保存到 [docx_output_path]

**分享链接：**
[share_url]
```

注意：若Step 2中的脚本返回的[truncated_text]部分为空，则读取接口返回的docx附件内容，总结相关报告信息返回，以确保最终输出的[truncated_text]内容非空。

## 错误处理

| 错误码 | 含义 | 用户侧话术 |
|---|---|---|
| `ERROR_TOPIC_TOO_LONG` | topic 超出 500 字限制 | "字数超出限制，请尝试其它主体。" |
| 其他异常 | 接口调用失败等 | "报告生成服务暂时不可用，请稍后重试。" |