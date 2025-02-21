addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

function validateParams(params) {
    const required = ['userId', 'password', 'ip', 'port']
    const missing = required.filter(field => !params[field])
    
    if (missing.length > 0) {
        return {
            valid: false,
            message: `缺失必要参数: ${missing.join(', ')}`
        }
    }
    
    if (typeof params.https !== 'boolean') {
        params.https = false
    }
    
    return { valid: true }
}

async function handleRequest(request) {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/').filter(part => part)
    //主页面
    if ( url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(getIndex(), {
            headers: { 'Content-Type': 'text/html;charset=utf-8' }
        })
    }

    // 注册页面路由
    if (url.pathname === '/register' ) {
        return new Response(getRegisterHtml(), {
            headers: { 'Content-Type': 'text/html;charset=utf-8' }
        })
    }

    // API路由处理
    if (request.method === 'POST') {
        switch (url.pathname) {
            case '/api/update': return handleUpdate(request)
            case '/api/create': return handleCreate(request)
        }
    }

    // 重定向处理
    if (pathParts.length >= 1) {
        const userId = pathParts[0]
        return handleRedirect(request, userId, pathParts)
    }

    return new Response('404 Not Found', { status: 404 })
}

async function handleRedirect(request, userId, pathParts) {
    const data = await USER_DATA.get(userId, { type: 'json' })
    if (!data) return new Response('用户不存在', { status: 404 })

    const url = new URL(request.url)
    const protocol = data.https ? 'https' : 'http'
    
    // 移除用户名，保留剩余路径
    pathParts.shift()
    const remainingPath = pathParts.length > 0 ? '/' + pathParts.join('/') : ''
    
    const targetUrl = `${protocol}://${data.ip}:${data.port}${remainingPath}${url.search}`
    return Response.redirect(targetUrl, 302)
}

async function handleUpdate(request) {
    let params
    try {
        params = await request.json()
    } catch (e) {
        return new Response('参数不合法', { status: 400 })
    }

    const validation = validateParams(params)
    if (!validation.valid) {
        return new Response(validation.message, { status: 400 })
    }

    const { userId, password, https, ip, port } = params
    const data = await USER_DATA.get(userId, { type: 'json' })

    if (!data) return new Response('用户不存在', { status: 404 })
    if (data.password !== password) return new Response('未认证', { status: 401 })

    await USER_DATA.put(userId, JSON.stringify({ password, https, ip, port }))
    return new Response('更新成功', { status: 200 })
}

async function handleCreate(request) {
    let params
    try {
        params = await request.json()
    } catch (e) {
        return new Response('参数不合法', { status: 400 })
    }

    const validation = validateParams(params)
    if (!validation.valid) {
        return new Response(validation.message, { status: 400 })
    }

    const { userId, password, https, ip, port } = params

    // 检查保留字
    if (isReserveduserId(userId)) {
        return new Response('用户名不可用', { status: 400 })
    }
    
    const exists = await USER_DATA.get(userId)

    if (exists) return new Response('用户已存在', { status: 409 })

    await USER_DATA.put(userId, JSON.stringify({ password, https, ip, port }))
    return new Response('注册成功', { status: 201 })
}

function isReserveduserId(userId) {
    const reserved = ['api', 'admin', 'register', 'login', 'static']
    return reserved.includes(userId.toLowerCase())
}
function getIndex(){
    return `
<html lang="zh-CN"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>内链跳转穿透工具</title>
    <style>
        /* 全局样式 */
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start; /* 内容靠上 */
            height: 100vh;
            background-image: url('https://mi-d.cn/nlt/download.webp'); /* 设置背景图片 */
            background-size: cover; /* 背景图片覆盖整个页面 */
            background-position: center; /* 背景图片居中 */
            padding-top: 10vh; /* 内容整体偏上 */
        }

        /* 容器样式 */
        .container {
            text-align: center;
            max-width: 600px;
            width: 100%;
            padding: 20px; /* 增加内边距 */
        }

        /* Logo 样式 */
        .logo {
            width: 50%; /* Logo 宽度为文本框加按钮宽度的 80% */
            max-width: 400px; /* 最大宽度限制 */
            height: auto; /* 高度自适应 */
            margin-bottom: 20px; /* 与下方内容的间距 */
        }

        /* 标题样式 */
        h1 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #000;
        }

        /* 输入框和按钮容器 */
        .input-group {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        /* 输入框样式 */
        input[type="text"] {
            width: 300px;
            padding: 10px;
            font-size: 14px;
            border: 1px solid #ddd;
            border-radius: 8px;
            outline: none;
            transition: border-color 0.3s ease;
        }

        input[type="text"]:focus {
            border-color: #007bff;
        }

        /* 按钮样式 */
        button {
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            color: #fff;
            background-color: #007bff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        button:hover {
            background-color: #0056b3;
        }

        /* 提示文字样式 */
        .tip {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
        }

        .tip a {
            color: #007bff;
            text-decoration: none;
        }

        .tip a:hover {
            text-decoration: underline;
        }

        /* 核心优势样式 */
        .advantages {
            margin-top: 20px; /* 减少上边距 */
            text-align: left;
            background-color: rgba(255, 255, 255, 0.8); /* 半透明背景 */
            padding: 15px; /* 减少内边距 */
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            width: 90%; /* 缩小宽度 */
            max-width: 400px; /* 最大宽度限制 */
            margin-left: auto;
            margin-right: auto; /* 水平居中 */
        }

        .advantages h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px; /* 减少下边距 */
            color: #000;
        }

        .advantages ul {
            list-style-type: none;
            padding: 0;
            margin: 0;
        }

        .advantages ul li {
            font-size: 14px;
            color: #333;
            margin-bottom: 8px; /* 减少下边距 */
            padding-left: 20px;
            position: relative;
        }

        .advantages ul li::before {
            content: "✔";
            position: absolute;
            left: 0;
            color: #007bff;
        }

        /* 响应式设计 */
        @media (max-width: 480px) {
            body {
                padding-top: 5vh; /* 移动端内容更靠上 */
            }

            .container {
                padding: 15px; /* 移动端增加内边距 */
            }

            h1 {
                font-size: 20px;
            }

            .input-group {
                flex-direction: column;
                gap: 10px;
            }

            input[type="text"] {
                width: 100%; /* 输入框宽度占满容器 */
                max-width: 300px; /* 最大宽度限制 */
            }

            button {
                width: 100%; /* 按钮宽度占满容器 */
                max-width: 300px; /* 最大宽度限制 */
            }

            .logo {
                width: 72%; /* 移动端 Logo 更宽 */
            }

            .advantages {
                padding: 10px; /* 移动端减少内边距 */
                width: 100%; /* 移动端占满宽度 */
                max-width: none; /* 取消最大宽度限制 */
            }

            .advantages h2 {
                font-size: 18px;
            }

            .advantages ul li {
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>操作简单，点对点高速直联，高效稳定</h1>
        <div class="input-group">
            <input type="text" id="inputText" placeholder="请输入内链通ID">
            <button onclick="redirect()">穿透内网</button>
        </div>
        <div class="tip"><a href="/register" target="_blank">注册</a>
        </div>

        <!-- 核心优势 -->
        <div class="advantages">
            <h2>产品核心优势</h2>
            <ul>
                <li><strong>永久免费：</strong>还有什么东西能比免费更好。</li>
                
                <li><strong>配置简单：</strong>设备要求低，配置简单。</li>
                <li><strong>无需工具：</strong>WEB应用直接浏览器访问，客户端无需工具。</li>
                <li><strong>高速直联：</strong>STUN内网穿透，免服务器中转点对点更高效。</li>
                <li><strong>固定地址：</strong>穿透地址永不过期，也不需要频繁验证。</li>
                
                <li><strong>携带后缀：</strong>支持携带后缀跳转，无公网IP也能分享文件。</li>
            </ul>
        </div>
    </div>

    <script>
        // 跳转函数
        function redirect() {
            const inputText = document.getElementById('inputText').value.trim();
            if (inputText) {
                window.location.href = '/${encodeURIComponent(inputText)}';
            } else {
                alert('请输入内链通ID');
            }
        }

        // 监听输入框的回车键事件
        document.getElementById('inputText').addEventListener('keydown', function (event) {
            if (event.key === 'Enter') { // 如果按下的是回车键
                redirect(); // 调用跳转函数
            }
        });
    </script>
</body>
</html>
    `
}
function getRegisterHtml() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>内链跳转 - 注册</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input[type="text"], input[type="password"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px; }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; display: none; padding: 10px; background: #f8d7da; border-radius: 4px; margin-bottom: 15px; }
        .cookie-warning { background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin-bottom: 15px; display: none; }
        .help { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; }
        .help a { color: #007bff; text-decoration: none; }
        .help a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>内链跳转注册</h1>
    <div class="help">
        <p>📖<a href="https://github.com/iLay1678/lanjmp" target="_blank">使用说明</a></p>
    </div>
    <div id="cookie-warning" class="cookie-warning">请启用浏览器 Cookie 功能以确保正常使用</div>
    <div id="error" class="error"></div>
    <div class="form-group">
        <label>用户名</label>
        <input type="text" id="userId" placeholder="输入用户名">
    </div>
    <div class="form-group">
        <label>密码</label>
        <input type="password" id="password" placeholder="输入密码">
    </div>
    <div class="form-group">
        <label>IP地址</label>
        <input type="text" id="ip" value="127.0.0.1" placeholder="输入IP地址">
    </div>
    <div class="form-group">
        <label>端口</label>
        <input type="text" id="port" value="5666" placeholder="输入端口">
    </div>
    <div class="form-group">
        <label>
            <input type="checkbox" id="https"> 启用HTTPS
        </label>
    </div>
    <button onclick="register()">注册</button>

    <script>
    function checkCookies() {
        try {
            document.cookie = "cookietest=1";
            var ret = document.cookie.indexOf("cookietest=") != -1;
            document.cookie = "cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT";
            if (!ret) {
                document.getElementById('cookie-warning').style.display = 'block';
            }
            return ret;
        } catch (e) {
            document.getElementById('cookie-warning').style.display = 'block';
            return false;
        }
    }

    window.onload = checkCookies;

    async function register() {
        if (!checkCookies()) {
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = '请启用浏览器 Cookie 功能后重试';
            return;
        }

        const data = {
            userId: document.getElementById('userId').value.trim(),
            password: document.getElementById('password').value,
            ip: document.getElementById('ip').value.trim(),
            port: document.getElementById('port').value.trim(),
            https: document.getElementById('https').checked
        }

        try {
            const response = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (response.status === 201) {
                alert('注册成功！')
                location.reload()
            } else {
                const error = await response.text()
                document.getElementById('error').style.display = 'block'
                document.getElementById('error').textContent = error
            }
        } catch (e) {
            document.getElementById('error').style.display = 'block'
            document.getElementById('error').textContent = '注册失败，请稍后重试'
        }
    }
    </script>
</body>
</html>`
}
