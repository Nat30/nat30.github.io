# 如何将代码推送到 GitHub

代码已提交到本地 git 仓库，现在需要推送到远程 GitHub 仓库。

## 方法一：使用 SSH 密钥（推荐）

### 1. 生成 SSH 密钥（如尚未生成）
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# 按 Enter 接受默认设置
```

### 2. 将 SSH 密钥添加到 GitHub
```bash
cat ~/.ssh/id_ed25519.pub
# 复制输出的内容
```

然后到 GitHub：
1. 点击右上角头像 → Settings → SSH and GPG keys
2. 点击 "New SSH key"
3. 粘贴复制的密钥

### 3. 更改远程仓库为 SSH 地址
```bash
git remote remove origin
git remote add origin git@github.com:Nat30/nat30.github.io.git
```

### 4. 推送代码
```bash
git push -u origin main
```

## 方法二：使用 HTTPS 和个人访问令牌

### 1. 创建个人访问令牌
1. 登录 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token"
3. 选择 "repo" 权限
4. 生成并复制令牌（保存好，只会显示一次）

### 2. 推送代码（使用令牌作为密码）
```bash
git push https://github.com/Nat30/nat30.github.io.git main
# 用户名：输入你的 GitHub 用户名
# 密码：粘贴刚才复制的个人访问令牌
```

或者使用令牌直接嵌入 URL：
```bash
git push https://YOUR_TOKEN@github.com/Nat30/nat30.github.io.git main
# 将 YOUR_TOKEN 替换为你的实际令牌
```

## 方法三：使用 GitHub CLI（如已安装）

```bash
gh auth login  # 如未登录
git push origin main
```

## 验证推送成功

访问 https://nat30.github.io 查看部署的文档扫描应用。

## 当前仓库状态
- 本地分支：main
- 远程仓库：https://github.com/Nat30/nat30.github.io.git
- 已修复问题：OpenCV.js 加载、Blob URL 跨域错误、GitHub Pages 兼容性

## 部署说明
1. 代码推送到 GitHub 后，GitHub Pages 会自动部署（约 1-2 分钟）
2. 访问你的 GitHub Pages URL 测试应用
3. 如遇问题，按 F12 打开开发者工具查看 Console 错误信息