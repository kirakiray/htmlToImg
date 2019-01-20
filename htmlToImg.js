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

    return (ele, options = {
        type: "jpg",
        quality: 1,
        dpr: window.devicePixelRatio || 1
    }) => new Promise((res, rej) => {
        // 获取元素的大小
        let {
            clientWidth,
            clientHeight
        } = ele;

        let {
            dpr
        } = options;

        // 克隆元素
        let cloneEle = ele.cloneNode(true);

        // 映射style
        mapEleStyle(ele, cloneEle, {
            dpr
        }).then(() => {

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
            tarImg.width = clientWidth * dpr;
            tarImg.height = clientHeight * dpr;
            tarImg.setAttribute("crossOrigin", 'Anonymous');
            tarImg.addEventListener('load', e => {
                // 生成canvas
                let canvasEle = document.createElement("canvas");
                canvasEle.width = clientWidth * dpr;
                canvasEle.height = clientHeight * dpr;
                let ctx = canvasEle.getContext("2d");

                // 坐标(0,0) 表示从此处开始绘制，相当于偏移。
                ctx.drawImage(tarImg, 0, 0);

                // 转换base64
                let base64;
                switch (options.type) {
                    case "jpg":
                    case "jpeg":
                        base64 = canvasEle.toDataURL("image/jpeg", 1);
                    default:
                        base64 = canvasEle.toDataURL(options.type);
                }
                res(base64);
            });

            // 设置图片
            tarImg.setAttribute("src", "data:image/svg+xml;charset=utf-8," + svgCode.replace(/\n/g, ""));
        });
    });
}));