const http = require('http');
const fs = require('fs');
const bodyParser = require('body-parser');

// 模拟从json文件读取数据
function getJsonData(channel_id) {
    try {
        // 读取json文件
        const rawData = fs.readFileSync('lanjmp.json', 'utf8');
        const data = JSON.parse(rawData);
        return data[channel_id];
    } catch (error) {
        console.error('读取json文件失败:', error);
        return null;
    }
}

// 模拟向json文件写入数据
function setJsonData(channel_id, userData) {
    try {
        // 读取现有的json文件
        let data = {};
        try {
            const rawData = fs.readFileSync('lanjmp.json', 'utf8');
            data = JSON.parse(rawData);
        } catch (error) {
            // 如果文件不存在或者解析失败，初始化为空对象
            console.warn('json文件不存在或解析失败，初始化为空对象');
        }

        // 更新用户数据
        data[channel_id] = userData;

        // 写回json文件
        fs.writeFileSync('lanjmp.json', JSON.stringify(data, null, 2), 'utf8');
        console.log('用户数据已更新');
        return true;
    } catch (error) {
        console.error('写入json文件失败:', error);
        return false;
    }
}

function validateParams(params) {
    const required = ['channel_id', 'password', 'host', 'port'];
    const missing = required.filter(field => !params[field]);

    if (missing.length > 0) {
        return {
            valid: false,
            message: `缺失必要参数: ${missing.join(', ')}` 
        };
    }

    if (typeof params.https !== 'boolean') {
        params.https = false;
    }

    if (typeof params.accessKey !== 'string') {
        params.accessKey = '';
    }

    return { valid: true };
}

function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookies[decodeURIComponent(name)] = decodeURIComponent(value);
            }
        });
    }
    return cookies;
}

function handleJsonRedirect(req, channel_id, pathParts, res) {
    const data = getJsonData(channel_id);
    if (!data) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('用户不存在');
        return;
    }

    // 检查是否需要密码验证
    if (data.accessKey && data.accessKey !== '') {
        const cookies = parseCookies(req.headers.cookie || '');
        const accessToken = cookies[`access_${channel_id}`];

        if (accessToken !== data.accessKey) {
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(getPasswordHtml(channel_id));
            return;
        }
    }

    const url = new URL(req.url, 'http://localhost');
    const protocol = data.https ? 'https' : 'http';

    // 获取请求的路径（不包括用户ID部分）
    const requestedPath = url.pathname.replace(`/${channel_id}`, '');
    const remainingPath = requestedPath === '/' ? '' : requestedPath;

    // 获取查询参数
    const queryParams = url.search;

    const targetUrl = `${protocol}://${data.host}:${data.port}${remainingPath}${queryParams}`;
    res.writeHead(302, { 'Location': targetUrl });
    res.end();
}

function handleJsonVerify(req, res) {
    let params;
    try {
        params = req.body;
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('参数不合法');
        return;
    }

    const { channel_id, accessKey } = params;
    if (!channel_id || !accessKey) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('参数不完整');
        return;
    }

    const data = getJsonData(channel_id);
    if (!data) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('用户不存在');
        return;
    }

    if (data.accessKey !== accessKey) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('访问密码错误');
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `access_${channel_id}=${accessKey}; path=/; max-age=2592000`
    });
    res.end('验证成功');
}

function handleJsonUpdate(req, res) {
    let params;
    try {
        params = req.body;
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('参数不合法');
        return;
    }

    const validation = validateParams(params);
    if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(validation.message);
        return;
    }

    const { channel_id, password, https, host, port, accessKey } = params;
    const data = getJsonData(channel_id);

    if (!data) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('用户不存在');
        return;
    }
    if (data.password !== password) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('未认证');
        return;
    }

    try {
        setJsonData(channel_id, { password, https, host, port, accessKey });
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('更新成功');
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('更新失败，请重试');
    }
}

function handleJsonCreate(req, res) {
    let params;
    try {
        params = req.body;
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('参数不合法');
        return;
    }

    const validation = validateParams(params);
    if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(validation.message);
        return;
    }

    const { channel_id, password, https, host, port, accessKey } = params;

    if (isReservedchannel_id(channel_id)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('用户名不可用');
        return;
    }

    const exists = getJsonData(channel_id);

    if (exists) {
        res.writeHead(409, { 'Content-Type': 'text/plain' });
        res.end('用户已存在');
        return;
    }

    // 如果密码为空，生成随机密码
    const finalPassword = password || generateRandomPassword();

    setJsonData(channel_id, { password: finalPassword, https, host, port, accessKey });
    res.writeHead(201, { 'Content-Type': 'text/plain' });
    res.end(`注册成功，密码为: ${finalPassword}`);
}

function isReservedchannel_id(channel_id) {
    const reserved = ['api', 'admin', 'register', 'login', 'static'];
    return reserved.includes(channel_id.toLowerCase());
}

function generateRandomPassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function getIndex() {
    return `
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>内网跳转穿透工具</title>
    <style>
        /* 全局样式 */
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start; 
            height: 100vh;
            background-image: url('https://mi-d.cn/nlt/download.webp'); 
            background-size: cover; 
            background-position: center; 
            padding-top: 10vh; 
        }

        /* 容器样式 */
        .container {
            text-align: center;
            max-width: 600px;
            width: 100%;
            padding: 20px; 
        }

        /* Logo 样式 */
        .logo {
            width: 50%; 
            max-width: 400px; 
            height: auto; 
            margin-bottom: 20px; 
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
            margin-top: 20px; 
            text-align: left;
            background-color: rgba(255, 255, 255, 0.8); 
            padding: 15px; 
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            width: 90%; 
            max-width: 400px; 
            margin-left: auto;
            margin-right: auto; 
        }

        .advantages h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px; 
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
            margin-bottom: 8px; 
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
                padding-top: 5vh; 
            }

            .container {
                padding: 15px; 
            }

            h1 {
                font-size: 20px;
            }

            .input-group {
                flex-direction: column;
                gap: 10px;
            }

            input[type="text"] {
                width: 100%; 
                max-width: 300px; 
            }

            button {
                width: 100%; 
                max-width: 300px; 
            }

            .logo {
                width: 72%; 
            }

            .advantages {
                padding: 10px; 
                width: 100%; 
                max-width: none; 
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
            <input type="text" id="inputText" placeholder="请输入内网通ID">
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
                <li><strong>跳转加密：</strong>可加入验证密码，提升部分应用安全性。</li>
                <li><strong>携带后缀：</strong>支持携带后缀跳转，无公网IP也能分享文件。</li>
            </ul>
        </div>
    </div>

    <script>
        // 跳转函数
        function redirect() {
            const inputText = document.getElementById('inputText').value.trim();
            if (inputText) {
                window.location.href = '/' + encodeURIComponent(inputText);
            } else {
                alert('请输入内网通ID');
            }
        }

        // 监听输入框的回车键事件
        document.getElementById('inputText').addEventListener('keydown', function (event) {
            if (event.key === 'Enter') { 
                redirect(); 
            }
        });
    </script>
</body>
</html>
    `;
}

function getPasswordHtml(channel_id) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>访问验证</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input[type="password"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px; }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; display: none; padding: 10px; background: #f8d7da; border-radius: 4px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <h2>访问验证</h2>
    <div id="error" class="error"></div>
    <div class="form-group">
        <label>请输入访问密码</label>
        <input type="password" id="accessKey" placeholder="输入访问密码">
    </div>
    <button onclick="verify()">验证</button>

    <script>
    async function verify() {
        const accessKey = document.getElementById('accessKey').value.trim()
        if (!accessKey) {
            document.getElementById('error').style.display = 'block'
            document.getElementById('error').textContent = '请输入访问密码'
            return
        }

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel_id: '${channel_id}',
                    accessKey: accessKey
                })
            })

            if (response.status === 200) {
                window.location.reload()
            } else {
                const error = await response.text()
                document.getElementById('error').style.display = 'block'
                document.getElementById('error').textContent = error
            }
        } catch (e) {
            document.getElementById('error').style.display = 'block'
            document.getElementById('error').textContent = '验证失败，请稍后重试'
        }
    }

    document.getElementById('accessKey').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            verify()
        }
    })
    </script>
</body>
</html>`;
}

function getRegisterHtml() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>内网跳转 - 注册</title>
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
    <h1>内网跳转注册</h1>
    <div class="help">
        <p>📖<a href="https://github.com/loecom/lanjmp" target="_blank">使用说明</a></p>
    </div>
    <div id="cookie-warning" class="cookie-warning">请启用浏览器 Cookie 功能以确保正常使用</div>
    <div id="error" class="error"></div>
    <div class="form-group">
        <label>通道ID</label>
        <input type="text" id="channel_id" placeholder="输入通道ID">
    </div>
    <div class="form-group">
        <label>鉴权密码</label>
        <input type="password" id="password" placeholder="输入鉴权密码">
    </div>
    <div class="form-group">
        <label>HOST地址</label>
        <input type="text" id="host" value="127.0.0.1" placeholder="输入HOST地址">
    </div>
    <div class="form-group">
        <label>端口</label>
        <input type="text" id="port" value="5666" placeholder="输入端口">
    </div>
    <div class="form-group">
        <label>访问密码（可选）</label>
        <input type="password" id="accessKey" placeholder="设置访问密码，留空则无需密码">
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
            channel_id: document.getElementById('channel_id').value.trim(),
            password: document.getElementById('password').value,
            host: document.getElementById('host').value.trim(),
            port: document.getElementById('port').value.trim(),
            https: document.getElementById('https').checked,
            accessKey: document.getElementById('accessKey').value.trim()
        };

        try {
            const response = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.status === 201) {
                alert('注册成功！');
                location.reload();
            } else {
                const error = await response.text();
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = error;
            }
        } catch (e) {
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = '注册失败，请稍后重试';
        }
    }
    </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathParts = url.pathname.split('/').filter(part => part);

    // 主页面
    if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getIndex());
        return;
    }

    // 注册页面路由
    if (url.pathname === '/register') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(getRegisterHtml());
        return;
    }

    // API路由处理
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                req.body = JSON.parse(body);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('参数不合法');
                return;
            }

            switch (url.pathname) {
                case '/api/update': 
                    handleJsonUpdate(req, res);
                    break;
                case '/api/create': 
                    handleJsonCreate(req, res);
                    break;
                case '/api/verify': 
                    handleJsonVerify(req, res);
                    break;
                default:
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
            }
        });
        return;
    }

    // 重定向处理
    if (pathParts.length >= 1) {
        const channel_id = pathParts[0];
        handleJsonRedirect(req, channel_id, pathParts, res);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});