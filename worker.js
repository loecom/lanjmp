addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

function validateParams(params) {
    const required = ['userId', 'password', 'ip', 'port']
    const missing = required.filter(field => !params[field])
    
    if (missing.length > 0) {
        return {
            valid: false,
            message: `Missing required fields: ${missing.join(', ')}`
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

    // 注册页面路由
    if (url.pathname === '/register' || url.pathname === '/' || url.pathname === '/index.html') {
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

    return new Response('Not Found', { status: 404 })
}

async function handleRedirect(request, userId, pathParts) {
    const data = await USER_DATA.get(userId, { type: 'json' })
    if (!data) return new Response('User not found', { status: 404 })

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
        return new Response('Invalid JSON', { status: 400 })
    }

    const validation = validateParams(params)
    if (!validation.valid) {
        return new Response(validation.message, { status: 400 })
    }

    const { userId, password, https, ip, port } = params
    const data = await USER_DATA.get(userId, { type: 'json' })

    if (!data) return new Response('User not found', { status: 404 })
    if (data.password !== password) return new Response('Unauthorized', { status: 401 })

    await USER_DATA.put(userId, JSON.stringify({ password, https, ip, port }))
    return new Response('Updated', { status: 200 })
}

async function handleCreate(request) {
    let params
    try {
        params = await request.json()
    } catch (e) {
        return new Response('Invalid JSON', { status: 400 })
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

    if (exists) return new Response('User exists', { status: 409 })

    await USER_DATA.put(userId, JSON.stringify({ password, https, ip, port }))
    return new Response('Created', { status: 201 })
}

function isReserveduserId(userId) {
    const reserved = ['api', 'admin', 'register', 'login', 'static']
    return reserved.includes(userId.toLowerCase())
}

function getRegisterHtml() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>内链通 - 注册</title>
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
    <h1>内链通注册</h1>
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
    
    <div class="help">
        <p>📖 查看 <a href="https://github.com/iLay1678/lanjmp" target="_blank">使用说明文档</a></p>
    </div>

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