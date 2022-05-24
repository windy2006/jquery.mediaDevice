/**
 * jquery.mediaDevice.js - H5 Audio and Video device call
 *
 * Written by
 * ----------
 * Windy2000 (windy2006@gmail.com)
 *
 * Licensed under the Apache License Version 2.0
 *
 * Dependencies
 * ------------
 * jQuery (http://jquery.com)
 *
 **/

(function($){
    let constraints = {},
        default_constraints = {
            /**
             * 【音频参数调整】
             * volume            音量调整（范围 0-1.0， 0为静音，1为最大声）
             * sampleRate        采样率 （例 8000）
             * sampleSize        采样大小 （例 16位 2字节）
             * echoCancellation  回音消除 （true/false）
             * autoGainControl   自动增益 （在原有录音的基础上是否增加音量， true/false）
             * noiseSuppression  是否开启降噪功能 （true/false）
             * channelCount      声道数量 （例 1/2）
             */
            audio: {
                volume: 1,
                sampleRate: 22050,
                sampleSize: 16,
                echoCancellation: true,
                autoGainControl: false,
                noiseSuppression: true,
                channelCount: 1
            },
            /**
             * 【视频参数调整】
             * width        视频宽度
             * height       视频高度
             * aspectRatio  比例（一般可不设置，只设置宽高即可，可用来获取宽高比）
             * frameRate    帧率（可通过帧率设置码流，帧率越高，码流越大，视频越平滑）
             * facingMode   摄像头（PC会忽略，手机端可区分）
             *              user           前置摄像头
             *              environment    后置摄像头
             *              left           前置左侧摄像头
             *              right          前置右侧摄像头
             * resizeMode   采集画面是否裁剪
             *              none           不裁剪
             *              crop-and-scale 裁剪
             */
            video: {
                width: { min: 1024, ideal: 1280, max: 1920 },
                height: { min: 576, ideal: 720, max: 1080 },
                aspectRatio: 1.777777778,   //16:9
                frameRate: {min: 15, ideal: 20, max: 30 },
                facingMode: "user",
                resizeMode: "none"
            },
            /**
             * 【其他参数】
             * latency           延迟大小 （ 延迟小，网络不好的情况下，会卡顿花屏等，好处在于可实时通信，建议200ms）
             *                           （ 延迟大，网络不好的情况下，画面相对更平滑流畅，但即时性较差）
             * channelCount      单/双声道
             * deviceID          多个摄像头或音频输入输出设备时，可进行设备切换（例如切换前后置摄像头）
             * groupID           同一组设备
             */
        };

    !function(){
        if(document.location.protocol==='http:') {
            alert("媒体设备调用只能在SSL安全模式下使用，正在尝试跳转！");
            location.href = 'https://' + document.location.hostname + document.location.pathname;
        }
        window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
        window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
        // 老的浏览器可能根本没有实现 mediaDevices，所以我们可以先设置一个空的对象
        if (navigator.mediaDevices === undefined) {
            navigator.mediaDevices = {};
        }
        // 一些浏览器部分支持 mediaDevices。我们不能直接给对象设置 getUserMedia
        // 因为这样可能会覆盖已有的属性。这里我们只会在没有getUserMedia属性的时候添加它。
        if (navigator.mediaDevices.getUserMedia === undefined) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
                // 首先，如果有getUserMedia的话，就获得它
                let getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
                // 一些浏览器根本没实现它 - 那么就返回一个error到promise的reject来保持一个统一的接口
                if (!getUserMedia) {
                    return Promise.reject(new Error('当前浏览器不支持调用媒体设备！'));
                }
                // 否则，为老的navigator.getUserMedia方法包裹一个Promise
                return new Promise(function(resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            }
        }
    }();

    // Video Functions
    $.fn.camera = function(opt) {
        let videoObj = this.get(0);
        if(typeof(opt)==='object') {
            $.extend(constraints, default_constraints, opt);
            $(videoObj).data('stream', null);
            opt = 'start';
        }
        if(typeof arguments[1] === 'undefined') {
            arguments[1] = function(){return true;};
        }
        switch(opt) {
            case 'e':
            case 'enum':
                enumerate(arguments[1]);
                break;
            case 'constraints':
            case 'setting':
                return JSON.parse(JSON.stringify(default_constraints));
            case 'n':
            case 'snap':
                snap(arguments[1]);
                break;
            case 'r':
            case 'record':
                return record(arguments[1]);
            case 'c':
            case 'close':
                close(arguments[1]);
                break;
            case 's':
            case 'start':
            default:
                videoObj.volume = 0;
                if(constraints.mirror) this.css('transform', 'rotateY(180deg)');
                if(typeof constraints.audio === 'undefined') {
                    constraints = JSON.parse(JSON.stringify(default_constraints));
                }
                start(arguments[1]);
        }
        function start(func) {
            close();
            let supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
            if (!supportedConstraints.width || !supportedConstraints.height || !supportedConstraints.frameRate || !supportedConstraints.facingMode) {
                new Error('当前浏览器不支持某些摄像头属性设置！')
            }
            navigator.mediaDevices.getUserMedia(constraints)
                .then(function(stream) {
                    // 旧的浏览器可能没有srcObject
                    if ("srcObject" in videoObj) {
                        videoObj.srcObject = stream;
                        videoObj.setAttribute("playsinline", true);
                    } else {
                        // 防止在新的浏览器里使用它，应为它已经不再支持了
                        videoObj.src = window.URL.createObjectURL(stream);
                    }
                    $(videoObj).data('stream', stream);
                    stream.getVideoTracks().forEach(function(track){
                        if(track.readyState === 'live') {
                            let cap = track.getCapabilities(),
                                rate = constraints.video.rate || constraints.video.aspectRatio;
                            constraints.video.width = cap.width.max;
                            constraints.video.height = cap.height.max;
                            if(rate) {
                                let the_height = constraints.video.width / rate;
                                if(the_height > constraints.video.height) {
                                    constraints.video.width = constraints.video.height * rate;
                                } else {
                                    constraints.video.height = the_height;
                                }
                                constraints.video.resizeMode = 'crop-and-scale';
                            }
                            track.applyConstraints(constraints.video);
                            default_constraints.video.width = constraints.video.width;
                            default_constraints.video.height = constraints.video.height;
                        }
                    })
                    $(videoObj).data('recorder', null);
                    videoObj.onloadedmetadata = function(e) {
                        if(typeof func === 'function') func(e);
                        videoObj.play();
                    };
                })
                .catch(function(err) {
                    console.log(err.name + ": " + err.message);
                });
        }
        function close(func) {
            if($(videoObj).data('stream')!=null) {
                $(videoObj).data('stream').getTracks().forEach(function(track){
                    track.stop();
                });
                $(videoObj).data('stream', null);
                videoObj.pause();
                videoObj.src = '';
                videoObj.load();
            }
            if(typeof func === 'function') func();
        }
        function enumerate(func) {
            if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
                navigator.mediaDevices.enumerateDevices()
                    .then(function(devices){
                        let result = {};
                        devices.forEach(function(device) {
                            let kind = device.kind.toLowerCase();
                            if(typeof result[kind] === 'undefined') result[kind] = [];
                            result[kind].push(device);
                        });
                        func(result);
                    })
                    .catch(function(err) {
                        new Error(err.name + ": " + err.message)
                    });
            }
        }
        function record(func) {
            if("onorientationchange" in window) {
                window.onorientationchange = function(e) {
                    if(window.orientation!==0 && window.orientation!==90) {
                        alert('请反转您的移动设备，以保证所拍摄视频可以正常查看！');
                        return false;
                    }
                }
            }
            let flag = false;
            let recorder = $(videoObj).data('recorder');
            if(recorder==null) {
                recorder = new MediaRecorder($(videoObj).data('stream'));
                recorder.mimeType = 'video/mp4';
                recorder.ondataavailable = func;
                recorder.start();
                $(videoObj).data('recorder', recorder);
                $('#video').fullscreen('r');
                setTimeout(function(){
                    $(document).one('fullscreenchange', function(){
                        recorder.stop();
                        $(videoObj).data('recorder', null);
                        videoObj.play();
                    })
                    $(videoObj).one('pause', function() {
                        $('#video').fullscreen('e');
                    });
                }, 1000);
                flag = true;
            } else {
                recorder.stop();
                $(videoObj).data('recorder', null);
            }
            return flag;
        }
        function snap(func) {
            let canvas = document.createElement('canvas');
            canvas.width = $(videoObj).width();
            canvas.height = $(videoObj).height();
            let context = canvas.getContext('2d');
            context.drawImage(videoObj, 0, 0, canvas.width, canvas.height);
            func(canvas.toDataURL("image/png"));
        }
        return this;
    };

    //audio Functions
    $.fn.audio = function(opt) {
        let canvasObj, audioObj, func_show, dataArray;
        let para = {},
            mainObj = this,
            constraints = {audio:default_constraints.audio, video:false},
            effect_func = [effect_1, effect_2, effect_3];
        if(this.data('audio')===undefined) {
            canvasObj = this.get(0);
            audioObj = this.get(0);
            let tagName = canvasObj.tagName.toLowerCase();
            if(tagName === 'audio') {
                canvasObj = document.createElement('canvas');
                $(canvasObj).insertAfter(audioObj).css({width:'100%',height:100});
            } else {
                if(tagName !== 'canvas') {
                    canvasObj = document.createElement('canvas');
                    $(canvasObj).insertAfter(audioObj).css({width:'100%',height:100});
                    this.append(canvasObj)
                }
                audioObj = new Audio();
            }
            this.data('canvas', canvasObj);
            this.data('audio', audioObj);
            this.data('stop', 'n');
            init_audio();
            init_canvas();
            mainObj.data('para', para);
        } else {
            canvasObj = this.data('canvas');
            audioObj = this.data('audio');
            para = this.data('para');
        }
        // 初始化变量
        dataArray = new Uint8Array(para.audioAnalyser.frequencyBinCount);

        if(typeof arguments[1] === 'undefined') {
            arguments[1] = function(){return true;};
        }
        if(typeof(opt)==='string') {
            switch(opt) {
                case 'enum':
                    enumerate(arguments[1]);
                    break;
                case 'record':
                    return record(arguments[1], arguments[2]);
            }
        } else if(typeof(opt)==='object') {
            Object.keys(default_constraints.audio).forEach((key) => {
                if(typeof opt[key]!=='undefined')  {
                    constraints.audio[key] = opt[key];
                }
            });
            if(typeof opt.deviceId !== 'undefined') {
                constraints.audio = {deviceId: opt.deviceId};
            }
            if(typeof opt.file !== 'undefined') {
                musicWave();
            } else {
                soundWave();
            }
        }

        function init_canvas() {
            para.canvasCtx = canvasObj.getContext("2d");
            para.canvasWidth = canvasObj.offsetWidth;
            para.canvasHeight = canvasObj.offsetHeight;
            para.gradient = para.canvasCtx.createLinearGradient(0, 0, para.canvasWidth/3, para.canvasHeight);
            para.gradient.addColorStop(0, "#f500d8");
            para.gradient.addColorStop(1, "#ceaf11");
            $(window).resize(function(){
                para.gradient = para.canvasCtx.createLinearGradient(0, 0, para.canvasWidth/3, para.canvasHeight);
                para.gradient.addColorStop(0, "#f500d8");
                para.gradient.addColorStop(1, "#ceaf11");
                para.canvasWidth = canvasObj.offsetWidth;
                para.canvasHeight = canvasObj.offsetHeight;
            });
        }

        function init_audio() {
            // 创建音频对象
            para.audioContext = new (window.AudioContext || window.webkitAudioContext || window.mozAudioContext)();
            // 获取声音源
            para.audioSource = para.audioContext.createBufferSource();
            // 获取分析对象
            para.audioAnalyser = para.audioContext.createAnalyser();
            para.audioAnalyser.minDecibels = -90;
            para.audioAnalyser.maxDecibels = -10;
            para.audioAnalyser.smoothingTimeConstant = 0.85;
            para.audioAnalyser.fftSize = 1024;
            // 音频处理对象
            para.processor = para.audioContext.createScriptProcessor(1024);
            para.processor.connect(para.audioContext.destination);
            para.audioAnalyser.connect(para.processor);
            // 获取其他对象
            para.waveShaper = para.audioContext.createWaveShaper();
            para.biquadFilter = para.audioContext.createBiquadFilter();
            para.convolver = para.audioContext.createConvolver();
            para.gainNode = para.audioContext.createGain();
            //para.gainNode.gain.value = 0;
        }

        function enumerate(func) {
            if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
                navigator.mediaDevices.enumerateDevices()
                    .then(function(devices){
                        let result = {};
                        devices.forEach(function(device) {
                            if(device.kind.toLowerCase() === 'audioinput') result.push(device);
                        });
                        func(result);
                    })
                    .catch(function(err) {
                        new Error(err.name + ": " + err.message)
                    });
            }
        }

        function musicWave() {
            let sound;
            let loadAudioElement = function(url) {
                return new Promise(function(resolve, reject) {
                    audioObj.addEventListener('canplay', function() {
                        resolve(audioObj);
                    });
                    audioObj.addEventListener('play', function() {
                        mainObj.data('stop', 'y');
                        setTimeout(function(){
                            if(typeof opt.func === 'function') {
                                func_show = opt.func;
                            } else {
                                func_show = effect_func[parseInt(3 * Math.random())];
                            }
                            mainObj.data('stop', 'n');
                            show();
                        }, 100);
                    });
                    audioObj.addEventListener('error', reject);
                    audioObj.autoplay = true;
                    audioObj.controls = true;
                    audioObj.src = url;
                    audioObj.onpause = function(){
                        soundWave();
                    }

                });
            }
            loadAudioElement(opt.file).then(function(obj) {
                if(typeof para.audioContext === 'undefined') return;
                sound = sound || para.audioContext.createMediaElementSource(obj);
                obj.onended = function() {
                    sound.disconnect(para.audioAnalyser);
                    sound.disconnect(para.audioContext.destination);
                    sound = null;
                    para.processor.onaudioprocess = function() {};
                    para.processor.disconnect();
                    para.canvasCtx.clearRect(0, 0, para.canvasWidth, para.canvasHeight);
                    mainObj.data('stop', 'y');
                };
                sound.connect(para.audioAnalyser);
                sound.connect(para.audioContext.destination);
                para.processor.onaudioprocess = function(e) {
                    para.audioAnalyser.getByteTimeDomainData(dataArray);
                };
            }).catch(function(e) {
                console.log(e);
            });
        }

        function soundWave() {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(function(stream) {
                    if(typeof para.audioContext === 'undefined') return;
                    para.audioContext.resume().then(() => {
                        let source = para.audioContext.createMediaStreamSource(stream);
                        source.connect(para.waveShaper);
                        para.waveShaper.connect(para.biquadFilter);
                        para.biquadFilter.connect(para.gainNode);
                        para.convolver.connect(para.gainNode);
                        para.gainNode.connect(para.audioAnalyser);
                        para.audioAnalyser.connect(para.audioContext.destination);

                        para.waveShaper.oversample = '4x';
                        para.biquadFilter.gain.setTargetAtTime(0, para.audioContext.currentTime, 0)

                        mainObj.data('stop', 'y');
                        setTimeout(function(){
                            if(typeof opt.func === 'function') {
                                func_show = opt.func;
                            } else {
                                func_show = effect_func[parseInt(3 * Math.random())];
                            }
                            mainObj.data('stop', 'n');
                            show();
                        }, 100);
                    });
                }).catch(function(err) {
                    console.log(err.name + ": " + err.message);
                });
        }

        function show() {
            if(mainObj.data('stop')==='y') return;
            requestAnimationFrame(show);
            if(typeof para.audioAnalyser === 'undefined') return;
            para.audioAnalyser.getByteFrequencyData(dataArray);
            para.canvasCtx.clearRect(0, 0, para.canvasWidth, para.canvasHeight);
            para.canvasCtx.fillStyle = 'rgb(240,240,240)';
            para.canvasCtx.fillRect(0, 0, para.canvasWidth, para.canvasHeight);
            func_show(dataArray, para.canvasCtx, para.canvasWidth, para.canvasHeight);
        }

        function record(func, format) {
            let mediaRecorder = mainObj.data('mediaRecorder');
            if(mediaRecorder==null) {
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(function(stream) {
                        mediaRecorder = new MediaRecorder(stream);
                        mediaRecorder.mimeType = 'audio/webm';
                        mediaRecorder.ondataavailable = function (e) {
                            let chunks = e.data;
                            if(chunks.size<500) return;
                            if(format===undefined) {
                                if(typeof func === 'function') func(chunks);
                                mainObj.data('mediaRecorder', null);
                            } else {
                                const fileReader = new FileReader();
                                fileReader.onload = function(e) {
                                    para.audioContext.decodeAudioData(e.target.result, (audioBuffer) => {
                                        let blob = buffer2wav(audioBuffer, format==='mp3');
                                        if(typeof func === 'function') func(blob);
                                        mainObj.data('mediaRecorder', null);
                                    })
                                }
                                fileReader.readAsArrayBuffer(chunks);
                            }
                        }
                        mediaRecorder.start();
                        mainObj.data('mediaRecorder', mediaRecorder);
                    }).catch(function(err) {
                        console.log(err.name + ": " + err.message);
                    });
                return true;
            } else {
                mediaRecorder.stop();
                return false;
            }
        }

        function effect_1(data, canvas, width, height) {
            let length = data.length;
            let barWidth = 10;
            let barHeight;
            let x = 0;
            for(let i = 0; i < length; i++) {
                barHeight = data[i]/256 * height * 1.3;
                canvas.fillStyle = 'rgb(' + (barHeight+150) + ',50,50)';
                canvas.fillRect(x,height-barHeight,barWidth,barHeight);
                x += barWidth + 1;
            }
        }

        function effect_2(data, canvas, width, height) {
            let length = data.length;
            let step = width / length;
            let x = 0;
            canvas.beginPath();
            canvas.moveTo(0, height);
            for (let i = 0; i < length; i++) {
                canvas.lineTo(x, height - data[i]/256 * height);
                x += step;
            }
            canvas.fillStyle = para.gradient;
            canvas.fill();
            canvas.closePath();

            canvas.beginPath();
            canvas.moveTo(0, height);
            x = 0;
            for (let i = 0; i < length; i++) {
                canvas.lineTo(x, height - data[i]/256 * height - Math.random() * 30)
                x += step;
            }
            canvas.strokeStyle = para.gradient;
            canvas.stroke();
            canvas.closePath();
        }

        function effect_3(data, canvas, width, height) {
            let length = data.length;
            let barLength = 0;
            let tmp = 0;
            for(let i = 0; i < length; i++) {
                if(data[i]<tmp) break;
                tmp = data[i]
            }
            barLength = width * Math.pow((tmp / 256), 2) * 0.7;
            canvas.fillStyle = 'rgb(' + (barLength+50) + ',50,50)';
            canvas.fillRect(0,0,barLength,height);
        }

        // 将 webm 格式的浏览器音频转码为 wav
        function buffer2wav(aBuffer, mp3) {
            let numOfChan = aBuffer.numberOfChannels,
                btwLength = aBuffer.length * numOfChan * 2 + 44,
                btwArrBuff = new ArrayBuffer(btwLength),
                btwView = new DataView(btwArrBuff),
                btwChnls = [],
                btwIndex,
                btwSample,
                btwOffset = 0,
                btwPos = 0;
            setUint32(0x46464952); // "RIFF"
            setUint32(btwLength - 8); // file length - 8
            setUint32(0x45564157); // "WAVE"
            setUint32(0x20746d66); // "fmt " chunk
            setUint32(16); // length = 16
            setUint16(1); // PCM (uncompressed)
            setUint16(numOfChan);
            setUint32(aBuffer.sampleRate);
            setUint32(aBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
            setUint16(numOfChan * 2); // block-align
            setUint16(16); // 16-bit
            setUint32(0x61746164); // "data" - chunk
            setUint32(btwLength - btwPos - 4); // chunk length

            function setUint16(data) {
                btwView.setUint16(btwPos, data, true);
                btwPos += 2;
            }

            function setUint32(data) {
                btwView.setUint32(btwPos, data, true);
                btwPos += 4;
            }

            for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
                btwChnls.push(aBuffer.getChannelData(btwIndex));

            while (btwPos < btwLength) {
                for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
                    // interleave btwChnls
                    btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); // clamp
                    btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; // scale to 16-bit signed int
                    btwView.setInt16(btwPos, btwSample, true); // write 16-bit sample
                    btwPos += 2;
                }
                btwOffset++; // next source sample
            }

            let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));
            let wavSamples = new Int16Array(btwArrBuff, wavHdr.dataOffset, wavHdr.dataLen / 2);

            return mp3 ? wav2mp3(wavHdr.channels, wavHdr.sampleRate, wavSamples) : new Blob([btwArrBuff], {type: "audio/wav"});
        }

        // 将 wav 编码转换为 mp3（需要 lamejs 支持）
        function wav2mp3(channels, sampleRate, samples) {
            let buffer = [];
            let mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 128);
            let remaining = samples.length;
            let samplesPerFrame = 1152;
            for (let i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
                let mono = samples.subarray(i, i + samplesPerFrame);
                let mp3buf = mp3enc.encodeBuffer(mono);
                if (mp3buf.length > 0) {
                    buffer.push(new Int8Array(mp3buf));
                }
                remaining -= samplesPerFrame;
            }
            let d = mp3enc.flush();
            if(d.length > 0){
                buffer.push(new Int8Array(d));
            }
            return new Blob(buffer, {type: 'audio/mp3'});
        }

        return this;
    }

    // Fullscreen Functions
    $.fn.fullscreen = function(opt) {
        let isFullscreen = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled || document.mozFullScreenEnabled;
        if(!isFullscreen) return false;
        let theObj = this.get(0);
        if(typeof opt === 'function') {
            arguments[1] = opt;
            opt = undefined;
        }
        if(typeof opt === 'undefined') {
            opt = check() ? 'exit' : 'run';
        }
        if(typeof arguments[1] !== 'function') {
            arguments[1] = function(){return true;};
        }
        let func = arguments[1];
        switch(opt) {
            case 'r':
            case 'run':
                run(func);
                break;
            case 'e':
            case 'exit':
                exit(func);
                break;
            case 'c':
            case 'check':
                return check();
            default:
                return getElement();
        }

        function run(callback) {
            if(check()) exit();
            if(theObj.requestFullscreen) {
                theObj.requestFullscreen();
            } else if(theObj.mozRequestFullScreen) {
                theObj.mozRequestFullScreen();
            } else if(theObj.msRequestFullscreen) {
                theObj.msRequestFullscreen();
            } else if(theObj.oRequestFullscreen) {
                theObj.oRequestFullscreen();
            } else if(theObj.webkitRequestFullscreen) {
                theObj.webkitRequestFullScreen();
            }else{
                let css = {
                    position:'absolute',
                    top:0,
                    left:0,
                    width:'100%',
                    height:'100%',
                    overflow:'hidden'
                };
                $(document.documentElement).css(css);
                $(document.body).css(css);
                $(theObj).css(css).addClass('m-0 p-0');
                document.fullscreenElement = theObj;
                $(window).one('keydown', function(e){
                    if(e.keyCode===27) {
                        $(theObj).fullscreen('exit');
                    }
                });
            }
            $(theObj).data('fullscreen', 'y');
            if(typeof callback === 'function') callback();
        }
        function exit(callback) {
            if(!check()) return;
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if(document.oRequestFullscreen) {
                document.oCancelFullScreen();
            }else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }else{
                let  css = {
                    position:'static',
                    top:'auto',
                    left:'auto',
                    width:'auto',
                    height:'auto',
                    overflow:'auto',
                };
                $(document.documentElement).css(css);
                $(document.body).css(css);
                $(theObj).css(css).addClass('m-0 p-0');
                document.fullscreenElement = undefined;
            }
            $(theObj).data('fullscreen', null);
            if(typeof callback === 'function') callback();
        }
        function check(){
            let list = [document.isFullScreen, document.webkitIsFullScreen, document.msFullscreenEnabled, document.mozIsFullScreen, document.oIsFullScreen, window.fullScreen];
            for(let x in list) {
                if(typeof list[x] === 'boolean') return list[x];
            }
            return !!$(theObj).data('fullscreen');
        }
        function getElement(){
            return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
        }
        return this;
    }
})(jQuery);

// dataURI 转 blob
function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    let byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0) {
        byteString = atob(dataURI.split(',')[1]);
    } else {
        byteString = unescape(dataURI.split(',')[1]);
    }

    // separate out the mime component
    const mimeString = dataURI
        .split(',')[0]
        .split(':')[1]
        .split(';')[0];

    // write the bytes of the string to a typed array
    const ia = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], { type: mimeString });
}

// blob 转 dataURI
function BlobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = _e => resolve(reader.result);
        reader.onerror = _e => reject(reader.error);
        reader.onabort = _e => reject(new Error("Read aborted"));
        reader.readAsDataURL(blob);
    });
}