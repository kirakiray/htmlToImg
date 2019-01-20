# htmlToImg
A tiny library about conversion html code to img

将html代码转换为 img base64

## 使用方法

例如需要将 `#tarEle` 转化为img base64；

```javascript
 htmlToImg(document.querySelector("#tarEle")).then(imgb64 => {
    let img = document.createElement('img');
    img.src = imgb64;
    document.body.appendChild(img);
});
```

转换图片前，请确保目标元素内的图片元素(img , background-image element)的尺寸确定；

[预览地址](https://kirakiray.github.io/htmlToImg/)