# Movie Catalog Demo

一个带登录、权限控制和用户管理的电影目录小应用。后端是 Express + SQLite（`better-sqlite3`），前端是零构建的纯静态 HTML + 原生 JS。

## 功能

- 电影列表查看 / 添加（字段：`title` 片名、`year` 年份、`genre` 类型）
- 登录 / 退出，基于 session 的身份认证
- 权限体系：
  - **管理员（admin）**：拥有全部权限，可以管理用户
  - **普通用户（user）**：按需被授予"查看电影"和/或"添加电影"两项权限
- 用户管理（仅管理员可见）：创建用户、删除用户、授予/收回权限、禁用/启用账号
- 每个用户可自行修改自己的密码
- 登录失败保护：连续 4 次输错密码后，该账号锁定 2 小时（管理员账号不受此限制，避免唯一管理员被误锁死）
- 账号被禁用后，登录时会给出明确提示，且已登录的会话会被立即清除

## 环境要求

- Node.js 18+（`better-sqlite3` 需要能编译/加载原生模块的 Node 版本）
- npm

## 快速开始

```bash
npm install
npm start
```

服务默认监听 `http://localhost:3000`，可用 `PORT` 环境变量修改端口。

首次启动时会自动创建 SQLite 数据库文件 `movies.db`，并播种一个默认超级管理员账号：

- 用户名：`admin`
- 密码：`admin`

用浏览器打开 `http://localhost:3000/` 会自动跳转到登录页 `login.html`。**生产环境务必在首次登录后立刻修改 admin 密码。**

## 页面说明

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 登录 | `/login.html` | 未登录访问任何页面都会跳转到这里 |
| 电影列表 | `/index.html`（也是首页 `/`） | 需要"查看电影"权限 |
| 添加电影 | `/add-movie.html` | 需要"添加电影"权限 |
| 修改密码 | `/change-password.html` | 所有登录用户可用，需输入当前密码 |
| 用户管理 | `/admin-users.html` | 仅管理员可见，可创建/删除用户、调整权限、禁用/启用账号 |

页面权限完全由后端 API 校验，前端只是根据 `/api/me` 返回的信息决定显示/隐藏对应入口。

## 权限模型

用户表包含 `role`（`admin` / `user`）、`can_view`、`can_add`、`disabled` 等字段：

- `role = admin` 的账号自动拥有全部权限（查看、添加、用户管理），且不受登录失败锁定影响
- `role = user` 的账号权限完全由 `can_view` / `can_add` 两个布尔位决定，创建后 `role` 不可再修改（只能调整权限位或禁用/删除账号）
- 系统始终保证至少存在一个可用的管理员：无法删除或禁用最后一个管理员，也无法删除/禁用自己的账号

## API 一览

所有电影相关接口需要登录 + 相应权限；`/api/users*` 需要管理员权限。

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/login` | `{ username, password }`，成功后写入 session |
| POST | `/api/logout` | 清除当前 session |
| GET | `/api/me` | 返回当前登录用户信息（含实际生效的权限），未登录返回 401 |
| POST | `/api/change-password` | `{ currentPassword, newPassword }`，修改自己的密码 |

### 电影

| 方法 | 路径 | 权限要求 | 说明 |
| --- | --- | --- | --- |
| GET | `/movies` | can_view | 获取电影列表 |
| GET | `/movies/:id` | can_view | 获取单个电影 |
| POST | `/movies` | can_add | `{ title, year, genre }`，创建电影 |

### 用户管理（仅管理员）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/users` | 获取用户列表 |
| POST | `/api/users` | `{ username, password, role, can_view, can_add }`，创建用户 |
| PATCH | `/api/users/:id` | `{ can_view, can_add, disabled }`，调整权限或禁用/启用账号 |
| DELETE | `/api/users/:id` | 删除用户 |

## 项目结构

```
server.js              # Express 入口，挂载 session、静态文件与各路由
db.js                   # SQLite 连接与表结构（含迁移）
auth.js                 # 密码哈希 / 校验（基于 Node 内置 crypto）
seed.js                 # 首次启动播种默认管理员
middleware/auth.js       # session 用户加载、登录/权限校验中间件
routes/auth.js           # 登录、退出、当前用户、改密码
routes/users.js          # 用户管理接口
public/                  # 前端静态页面（纯 HTML + 原生 JS，无构建步骤）
```

## 数据存储

数据保存在项目根目录的 `movies.db`（SQLite 文件，已加入 `.gitignore`，不会被提交）。删除该文件后重启服务会得到一个全新的空数据库，并重新播种默认管理员账号。

## 安全说明

这是一个演示项目，会话使用 Express 内存 session store，重启服务会导致所有人被登出；密码使用 `scrypt` 加盐哈希存储。生产环境使用前，建议至少：启用 HTTPS、更换持久化 session store、设置强 `SESSION_SECRET` 环境变量。
