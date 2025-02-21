# 内链跳转

[内链通](https://mi-d.cn/10963)的开源版本

## 功能介绍

内链跳转是一个基于 Cloudflare Workers 的服务，提供用户数据管理和动态重定向功能。用户可以通过 API 接口创建和更新用户信息，并根据存储的用户信息进行重定向。

## 部署
1.创建KV命名空间

2.创建Workers，复制worker.js代码

3.在创建的worker设置中，绑定第一步创建的KV命名空间到USER_DATA

## 接口文档

### 创建用户

#### 注册页面

**URL:** `/register`

**方法:** `GET`

**描述:** 提供一个用户友好的 Web 界面，用于注册新用户。包含以下字段：
- 用户名
- 密码
- IP地址
- 端口
- HTTPS开关

访问该页面可以直接通过浏览器进行用户注册，无需手动调用 API。
以下用户名为系统保留，不可用于注册：
- api
- admin
- register
- login
- static
  
**响应:**

 - 201 Created - 用户创建成功
 - 400 Bad Request - 请求参数不完整或无效
 - 409 Conflict - 用户已存在
  

### 更新用户

**URL:** `/api/update`

**方法:** `POST`

**请求体:**

```json
{
  "userId": "用户标识",
  "password": "鉴权密码",
  "https": false,
  "ip": "目标IP地址",
  "port": "目标端口",
  "accessKey": "访问密码，可为空"
}
```

**响应:**

 - 200 OK - 用户更新成功
 - 400 Bad Request - 请求参数不完整或无效
 - 401 Unauthorized - 鉴权失败
 - 404 Not Found - 用户不存在
  
### 动态重定向
**URL:**` /{userId}/{path}`

**方法**: `GET` 或 `POST`

**描述**: 根据存储的用户信息进行重定向。{userId} 是用户标识，{path} 是可选的路径和查询参数。

#### 示例:

**请求**: GET /a/1?query=example

假设用户 a 的配置信息如下：
```json
{
  "password": "password123",
  "https": false,
  "ip": "192.168.1.1",
  "port": "8080"
}
```
重定向到: http://192.168.1.1:8080/1?query=example
**响应:**

 - 302 Found - 重定向到目标地址
 - 404 Not Found - 用户不存在