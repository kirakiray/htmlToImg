(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.htmlToImg = factory();
    }
}(this, function () {
    // 根据图片b64数据
    const getb64ByUrl = async (imgUrl) => {
        // 请求图片
        let tarP = await fetch(imgUrl, {
            mode: 'cors'
        });

        // 转化blob
        let blob = await tarP.blob();

        // 转换b64
        return await new Promise(res => {
            let fd = new FileReader();

            fd.onload = (e) => {
                res(fd.result)
            }
            fd.readAsDataURL(blob);
        });
    }

    // 画图
    const imgToB64 = ({
        img,
        clientWidth,
        clientHeight,
        dpr,
        type
    }) => {
        // 生成canvas
        let canvasEle = document.createElement("canvas");

        // test
        // document.body.appendChild(canvasEle);

        let imgWidth = clientWidth * dpr;
        let imgHeight = clientHeight * dpr;

        canvasEle.width = imgWidth;
        canvasEle.height = imgHeight;
        let ctx = canvasEle.getContext("2d");

        // 坐标(0,0) 表示从此处开始绘制，相当于偏移。
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        // 转换base64
        let base64;
        switch (type) {
            case "jpg":
            case "jpeg":
                base64 = canvasEle.toDataURL("image/jpeg", 1);
            default:
                base64 = canvasEle.toDataURL(type);
        }

        return base64;
    }

    // 将主元素的元素style映射到克隆元素的style上
    const mapEleStyle = async (oriEle, cloneEle, options) => {
        let {
            dpr
        } = options;

        let comStyle = getComputedStyle(oriEle);

        let isimg;
        if (oriEle.tagName.toLowerCase() == "img") {
            let imgUrl = oriEle.src;
            let b64 = await getb64ByUrl(imgUrl);
            let fakeImg = document.createElement('div');
            fakeImg.innerHTML = `<div style="width:100%;height:100%;background-image:url(${b64});background-size:100% 100%;"></div>`;
            cloneEle.parentNode.insertBefore(fakeImg, cloneEle);
            cloneEle.parentNode.removeChild(cloneEle);
            cloneEle = fakeImg;

            isimg = 1;
        }

        // 存放 img promise 的数组
        let imgArrs = [];
        Array.from(comStyle).forEach(k => {
            let val = comStyle[k];

            if (k == "background-image" && val !== "none") {
                imgArrs.push((async () => {
                    let imgArr = val.match(/^url\((.+)\)$/);

                    // 转换图片地址
                    let imgUrl = imgArr[1].replace(/"/g, "");

                    // 获取b64数据
                    let b64 = await getb64ByUrl(imgUrl);

                    cloneEle.style[k] = `url(${b64})`;
                })());
            } else {
                // 当遇到px结尾的数据，添加dpr倍率
                if (dpr !== 1 && /px/.test(val)) {
                    val = val.replace(/([\d\.]+)?px/g, (a, b) => {
                        return b * dpr + "px";
                    });
                }

                cloneEle.style[k] = val;
            }
        });

        // 是图片的话修正display
        if (isimg) {
            cloneEle.style.display = "inline-block";
        }

        // 等待bgimg的队列
        if (imgArrs.length) {
            await Promise.all(imgArrs);
        }

        // 判断是否有子元素
        let oriChilds = Array.from(oriEle.children);
        let cloneChilds = Array.from(cloneEle.children);
        let parr = [];
        oriChilds.forEach((e, k) => {
            parr.push(mapEleStyle(e, cloneChilds[k], options));
        });

        if (parr.length) {
            await Promise.all(parr);
        }
    }

    return (ele, options) => new Promise((res, rej) => {
        let defaults = {
            type: "jpg",
            quality: 1,
            outType: "base64",
            // maxWidth: ""
        };

        Object.assign(defaults, options);

        // 获取元素的大小
        let {
            clientWidth,
            clientHeight
        } = ele;

        let dpr = window.devicePixelRatio || 1;

        // 克隆元素
        let cloneEle = ele.cloneNode(true);

        // 映射style
        mapEleStyle(ele, cloneEle, {
            dpr
        }).then(() => {
            // test
            // document.body.appendChild(cloneEle);

            // 创建svg file
            let svgCode = `
        <svg xmlns="http://www.w3.org/2000/svg">
            <foreignObject width="${clientWidth * dpr}" height="${clientHeight * dpr}">
                <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;">
                    ${cloneEle.outerHTML}
                </body>
            </foreignObject>
        </svg>`;

            let tarImg = new Image();

            // firefox特殊处理
            if (navigator.userAgent.includes("Firefox") && dpr > 1) {
                tarImg.width = clientWidth;
                tarImg.height = clientHeight;
            } else {
                tarImg.width = clientWidth * dpr;
                tarImg.height = clientHeight * dpr;
            }
            tarImg.setAttribute("crossOrigin", 'Anonymous');

            if (defaults.outType == "img") {
                tarImg.setAttribute("src", "data:image/svg+xml;charset=utf-8," + svgCode.replace(/\n/g, "").replace(/ +/g, " "));
                res(tarImg);
                return;
            }

            tarImg.addEventListener('load', e => {
                // 先转换成b64
                let base64 = imgToB64({
                    img: tarImg,
                    clientWidth,
                    clientHeight,
                    dpr,
                    type: defaults.type
                });

                // 判断是否超出规范大小
                if (defaults.maxWidth || defaults.maxHeight) {
                    // 计算新大小
                    let newHeight = clientHeight;
                    let newWidth = clientWidth;

                    if (clientWidth > defaults.maxWidth) {
                        newHeight = clientHeight / clientWidth * defaults.maxWidth;
                        newWidth = defaults.maxWidth;
                    }

                    if (newHeight > defaults.maxHeight) {
                        newWidth = defaults.maxHeight * newWidth / newHeight;
                        newHeight = defaults.maxHeight;
                    }

                    // 重新生成图片
                    let img = new Image();
                    img.width = newWidth;
                    img.height = newHeight;

                    img.onload = () => {
                        base64 = imgToB64({
                            img,
                            clientWidth: newWidth,
                            clientHeight: newHeight,
                            dpr,
                            type: defaults.type
                        });
                        res(base64);
                    }
                    img.src = base64;
                    return;
                }

                res(base64);
            });

            // 设置图片
            tarImg.setAttribute("src", "data:image/svg+xml;charset=utf-8," + svgCode.replace(/\n/g, "").replace(/ +/g, " "));

            // test
            // document.body.appendChild(tarImg);
        });
    });
}));