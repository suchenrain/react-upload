# 前端大文件上传

-   React + Ant Design UI 界面
-   利用[`File`](https://developer.mozilla.org/zh-CN/docs/Web/API/File)从`Blob`继承的[`slice`](https://developer.mozilla.org/zh-CN/docs/Web/API/Blob/slice)方法对文件切片
-   通过`web worker`利用`FileReader`+[`spark-md5`](https://github.com/satazor/js-spark-md5)生成文件 `hash` 值
-   `xhr`通过`formData`上传文件
-   `nodejs` + `http` 模块
-   `fse` 处理文件
-   `multiparty` 处理`formData`

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
