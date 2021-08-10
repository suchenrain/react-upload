# 前端大文件上传

-   React + Ant Design UI 界面
-   利用[`File`](https://developer.mozilla.org/zh-CN/docs/Web/API/File)从`Blob`继承的[`slice`](https://developer.mozilla.org/zh-CN/docs/Web/API/Blob/slice)方法对文件切片
-   通过`web worker`利用`FileReader`+[`spark-md5`](https://github.com/satazor/js-spark-md5)生成文件 `hash` 值
-   `xhr`通过`formData`上传文件
-   `nodejs` + `http` 模块
-   `fse` 处理文件
-   `multiparty` 处理`formData`

功能:

-   大文件切片
-   暂停/恢复上传
-   断点续传，记忆已上传部分
-   文件秒传

## 开始

```sh
# npm
npm install
npm start

# yarn
yarn start

```

```sh
# 启动node server
node server/server.js
```

## 演示

### 暂停/恢复/重复上传


![upload_pause gif](https://user-images.githubusercontent.com/7972688/128820298-db9a37e3-9be5-41f6-b558-92d0dc115566.gif)

### 上传中途失败，下次断点续传


![upload_continue gif](https://user-images.githubusercontent.com/7972688/128820450-4dbea09b-65e2-44af-ae5c-816d394675f7.gif)
