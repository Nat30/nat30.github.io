# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[DocScanner 项目结构]
- Date: 2026-04-30
- Context: Agent 在执行代码审查任务时发现
- Category: 代码结构
- Instructions:
  - 项目为纯前端静态 Web 应用，无构建工具和包管理器
  - 依赖通过 CDN 加载：Lucide Icons、Fabric.js 5.3.0、jsPDF 2.5.1
  - OpenCV.js 为本地文件 lib/opencv.js
  - JS 模块采用 IIFE 模式：CVEngine、FabricHandler、PDFExporter、App
  - 脚本加载顺序：opencv.js -> cv-engine.js -> fabric-handler.js -> pdf-exporter.js -> app.js
  - 无测试框架，无 lint 配置
