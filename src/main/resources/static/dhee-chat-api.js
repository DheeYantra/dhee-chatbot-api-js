window.DheeChatApiBuilder = {};
window.DheeChatApiBuilder.create = (function ($) {
    const SAMPLE_RATE = 16000;
    const SAMPLE_SIZE = 16;

    /*window.JSJAC_ERR_COUNT = 5;*/

    DheeChatApi = {
        init: function (config) {

            (function helperDrawingFunctions() {
                CanvasRenderingContext2D.prototype.line = function (x1, y1, x2, y2) {
                    this.lineCap = 'round';
                    this.beginPath();
                    this.moveTo(x1, y1);
                    this.lineTo(x2, y2);
                    this.closePath();
                    this.stroke();
                }
                CanvasRenderingContext2D.prototype.circle = function (x, y, r, fill_opt) {
                    this.beginPath();
                    this.arc(x, y, r, 0, Math.PI * 2, true);
                    this.closePath();
                    if (fill_opt) {
                        this.fillStyle = 'rgba(0,0,0,1)';
                        this.fill();
                        this.stroke();
                    } else {
                        this.stroke();
                    }
                }
                CanvasRenderingContext2D.prototype.rectangle = function (x, y, w, h, fill_opt) {
                    this.beginPath();
                    this.rect(x, y, w, h);
                    this.closePath();
                    if (fill_opt) {
                        this.fillStyle = 'rgba(0,0,0,1)';
                        this.fill();
                    } else {
                        this.stroke();
                    }
                }
                CanvasRenderingContext2D.prototype.triangle = function (p1, p2, p3, fill_opt) {
                    // Stroked triangle.
                    this.beginPath();
                    this.moveTo(p1.x, p1.y);
                    this.lineTo(p2.x, p2.y);
                    this.lineTo(p3.x, p3.y);
                    this.closePath();
                    if (fill_opt) {
                        this.fillStyle = 'rgba(0,0,0,1)';
                        this.fill();
                    } else {
                        this.stroke();
                    }
                }
                CanvasRenderingContext2D.prototype.clear = function () {
                    this.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
                }
            })();

            this.myServerAddress = "https://runtime.dhee.ai";
            this.instanceId = config.instanceId;
            this.startMuted = config.startMuted ? config.startMuted : false;
            this.useGenericSpeechRecognition = false;
            this.autoSend = config.autoSend ? config.autoSend : false;
            this.language = config.language ? config.language : 'ENGLISH';
            this.isRecording = false;
            this.speak = false;
            this.speechSignalsCanvas = config.speechSignalsCanvas;
            this.inputBoxId = config.inputMessageBoxId ? config.inputMessageBoxId : false;
            this.developerId = config.developerId ? config.developerId : false;
            this.onDheeSpeechStart = config.onDheeSpeechStart ? config.onDheeSpeechStart : false;
            this.onDheeSpeechFinished = config.onDheeSpeechFinished ? config.onDheeSpeechFinished : false;
            this.onChatEnded = config.onChatEnded ? config.onChatEnded : false;
            this.useDheeTTS = config.useDheeTTS ? config.useDheeTTS : false;
            this.onDemandTTS = config.onDemandTTS ? config.onDemandTTS : false;
            this.onEscalationNotice = function() {
                console.log("Escalation Notification.");
            }
            if (config.onEscalationNotice) {
                this.onEscalationNotice = config.onEscalationNotice;
            }

            if (!config.onIncomingMessage) {
                throw new Error("Incoming message handler not set !");
            }
            this.onIncomingMessage = config.onIncomingMessage;

            if (!config.onAllBotsBusy) {
                throw new Error("Bots busy handler not set !");
            }
            this.handleNoChatSignal = config.onAllBotsBusy;

            this.onError = config.onError ? config.onError : function(e) {
                if (e) {
                    console.error(e);
                } else {
                    console.error("Unknown error");
                }
            }


            if (this.inputBoxId) {
                this.inputBox = document.getElementById(this.inputBoxId);
            } else {
                this.inputBox = false;
            }

            this.speechFinishCallbacks = [];

            this.enableSpeechSynthesis = function () {
                this.speak = true;
            }

            this.disableSpeechSynthesis = function () {
                speechSynthesis.cancel();
                if (DheeChatApi.audioTracks.length > 0) {
                    DheeChatApi.audioTracks.length = 0;
                    var ap = document.getElementById("dhee_tts_output_player");
                    if (!ap.paused) {
                        DheeChatApi.onAudioCancel();
                        ap.pause();
                        
                    }
                }
                DheeChatApi.speak = false;
            }

            this.changeLanguage = function (lang) {
                DheeChatApi.sendSwitchLanguageSignal(lang);
                //DheeChatApi.languagePack(lang);
            }


            if (!this.audioTracks) {

                var audioTracks = this.audioTracks = [];
                var ap = document.getElementById("dhee_tts_output_player");
                if (!ap) {
                    ap = document.createElement("audio");
                    ap.setAttribute("id", "dhee_tts_output_player");
                    ap.setAttribute("style", "diplay:none");
                    ap.setAttribute("type", 'audio/mpeg; codecs="mp3"');
                    ap.setAttribute("muted", "true");
                    document.body.appendChild(ap);
                }
                ap.addEventListener("ended", function (event) {
                    audioTracks.shift();
                    if (audioTracks.length > 0) {
                        var nextAudioUrl = audioTracks[0];
                        ap.src = nextAudioUrl;
                        ap.play();
                    } else {
                        if (DheeChatApi.onDheeSpeechFinished) {
                            DheeChatApi.onDheeSpeechFinished();
                        }
                        if (DheeChatApi.speechFinishCallbacks.length > 0) {
                            var callback = DheeChatApi.speechFinishCallbacks.shift();
                            callback.call(window);
                        }
                    }
                });
                ap.addEventListener("play", function (event) {
                    if (DheeChatApi.onDheeSpeechStart) {
                        DheeChatApi.onDheeSpeechStart();
                    }
                });

                this.audioPlayer = ap;

                this.onAudioCancel = function (event) {
                    console.log("pause event on audio player");
                    if (this.speechFinishCallbacks.length > 0) {
                        /*console.log("current audio url :[ "+this.src+" ]");
                        var otherCallbacks = this.speechFinishCallbacks.filter(function(cb) {
                            console.info("callback url :[", cb.forUrl+"]");

                            return cb.forUrl != DheeChatApi.audioPlayer.src 
                            });
                        if (otherCallbacks.length < this.speechFinishCallbacks.length) {
                            console.info("Removed the callback for current audio");
                        }
                        this.speechFinishCallbacks = otherCallbacks;*/
                        this.speechFinishCallbacks = [];
                    }
                };
                
                
            }

            this.isRecording = false;
            this.initiatePaymentFramework();

        },

        launchDheeChat: function (userName, phoneNo, language, initIntent, initParams) {

            var postParams = {
                instanceId: DheeChatApi.instanceId,
                userName: userName,
                contactNumber: phoneNo,
                language: language,
                deviceType: DheeChatApi.deviceType,
                deviceSubType: DheeChatApi.deviceSubTypeType,
                uxSubType: DheeChatApi.clientType,
                lattitude: DheeChatApi.lattitude,
                longitude: DheeChatApi.longitude,
                locale: DheeChatApi.locale,
                timeZone: DheeChatApi.timeZone,
                pageURL: DheeChatApi.pageURL,
                deviceModel: DheeChatApi.deviceModel

            };
            if (this.developerId) {
                postParams.developerId = this.developerId;
            }

            if (initIntent) {
                postParams.initIntent = initIntent;
            }

            if (initParams) {
                postParams.initParams = initParams;
            }


            $.post(this.myServerAddress + '/web/start-chat', postParams).done(function (starterInfo) {

                if (starterInfo.projectId == null) {
                    DheeChatApi.handleNoChatSignal(starterInfo);
                } else {
                    DheeChatApi.userFullName = userName;
                    DheeChatApi.contactNumber = phoneNo;
                    DheeChatApi.language = language;
                    try {
                        DheeChatApi.start(starterInfo);
                    } catch (e) {
                        console.error("Error while starting!", e);
                        DheeChatApi.onError("Error while starting!" + e.message);
                    }
                }
            }).fail(function() {
                console.error("Error while connection to Dhee to get the Starter params !");
                DheeChatApi.onError("Connection could not be made.");
            });
        },

        start: function (info) {
            console.log('starting ChatWidget');

            var dheeChatApi = DheeChatApi;

            this.launchedOnce = true;

            this.info = info;
            this.myServerAddress = "https://runtime.dhee.ai";
            this.inputLanguage = this.language;

            var audioAnalyticsDisplay = document.getElementById(this.speechSignalsCanvas);
            this.audioAnalyticsDisplay = audioAnalyticsDisplay;

            window.dhee_user_provided_value = "";
            console.log('Connecting to backend');
            var stub = 'runtime';
            if (this.instanceId.startsWith('dheepareeksharitham')) {
                stub = 'sandbox';
            }
            var chatServer = DheeChatApi.myServerAddress;
            chatServer = chatServer.replace("http:", "ws:").replace("https:", "wss:");
            var chatContextPath = '/live-chat/ws'

            var connectionConfig = {
                userName: info.handlerJid,
                password: info.handlerKey,
                domain: 'dheeyantra.com',
                httpBase: chatServer + '/' + stub + '/' + info.userId + chatContextPath,
                userFulName: DheeChatApi.userFullName
            };
            DheeChatApi.connectionConfig = connectionConfig;
            DheeChatApi.connectChat(connectionConfig);

            console.log('initialzing speech recognition');
            this.initializeSpeechRecognition();
            this.speak = false;

            if (!this.startMuted) {
                this.enableSpeechSynthesis();
            }
        },

        endChat: function () {

            if (this.isConnected()) {
                this.speech = false;
                this.toClose = true;
                this.sendCloseIntent();
                setTimeout(function () {
                    DheeChatApi.sendCloseIntent();
                }, 100);

            } else {
                DheeChatApi.quit();
            }
        },

        sendMessage: function (message) {
            if (!message) {
                if (this.inputBox) {
                    message = this.inputBox.value;
                }
            }
            var oDate = new Date();
            var sValue = message;
            if (!sValue || sValue.trim().length == 0) {
                return;
            }
            this.sendXmppMsg(sValue);
            window.dhee_user_provided_value = "";
            window.interim_transcript = "";

            if (window.speechSynthesis) {
                speechSynthesis.cancel();
                if (DheeChatApi.audioTracks.length > 0) {
                    DheeChatApi.audioTracks.length = 0;
                    var ap = document.getElementById("dhee_tts_output_player");
                    if (!ap.paused) {
                        DheeChatApi.onAudioCancel();
                        ap.pause();
                        
                    }
                    
                }
            }
        },
        pauseMic: function (temp) {
            if (this.isRecording) {
                console.log("pausing mic");
                if (window.recognition) {
                    window.recognition.stop();
                }
                if (this.audioContext) {
                    this.audioContext.suspend();
                }
                if (temp) {
                    //this.recordButton.dispatchEvent(new Event('tempPause'));
                    //this.tempResetMicButton();
                } else {
                    this.recordButton.dispatchEvent(new Event('pause'));
                    console.log("ASR ended.");
                }
            } else {
                console.log("No need to pause mic. Not recording");
            }
        },
        resumeMic: function () {
            if (this.isRecording) {
                console.log("resuming mic");
                this.startSTT();
                this.isRecording = true;
                if (this.useGenericSpeechRecognition === true) {
                    //TODO
                }
            } else {
                console.log("Mic resume cancelled as recording not in progress.");
            }
        },
        restartMic: function () {
            if (this.isRecording) {
                console.log("restarting mic");
                if (window.recognition) {
                    window.recognition.stop();
                }
                if (this.audioContext) {
                    this.audioContext.suspend();
                }
                var widget = this;
                setTimeout(function () {
                    widget.startSTT();
                }, 100)

            } else {
                console.log("No need to restart mic. Not recording");
            }
        },
        sendThisMessage: function (mesg) {
            if (!mesg || mesg.trim() == "") {
                return;
            }
            var sValue = mesg;
            this.sendXmppMsg(sValue);
        },
        sendXmppMsg: function (messageText) {
            if (messageText == '') {
                return false;
            }
            var allText = messageText;
            if (this.language === "ENGLISH") {
                allText = messageText.trim();
            }
            var node = '';
            var firstSpaceIndex = -1;
            var messageText = "";
            if (allText.startsWith('@')) {
                firstSpaceIndex = allText.indexOf(' ');
                node = allText.substring(1, firstSpaceIndex);
            }

            if (node == '') {
                node = 'dhee';
            }
            var addressee = node + '@dheeyantra.com';
            messageText = allText.substring(firstSpaceIndex, allText.length);

            try {

                var utterance = new Object();
                utterance.text = messageText;
                utterance.conversationId = this.info.conversationId;
                utterance.projectId = this.info.projectId;
                utterance.userId = this.info.userId;
                utterance.incoming = true;
                if (messageText === "$dhee_init$") {
                    utterance.commandMessage = "OPEN";
                    utterance.text = "[CMD]";
                } else if (messageText === "$dhee_close$") {
                    utterance.commandMessage = "CLOSE";
                    utterance.text = "[CMD]";
                }
                var oMsg = new JSJaCMessage();
                //oForm.sendTo.value
                oMsg.setTo(new JSJaCJID(addressee));
                oMsg.setBody(JSON.stringify(utterance));
                oMsg.setSubject(this.info.conversationId);
                dhee_bosh_connection.send(oMsg);
                return false;

            } catch (e) {
                console.log(e.message);
                return false;
            }
        },

        sendCommandMessage: function (command, contextParams) {
            try {

                var utterance = new Object();
                utterance.commandMessage = command;
                utterance.text = "[CMD]";
                utterance.conversationId = this.info.conversationId;
                utterance.projectId = this.info.projectId;
                utterance.userId = this.info.userId;
                utterance.incoming = true;
                if (contextParams) {
                    utterance.currentContext = { params: contextParams };
                }
                var oMsg = new JSJaCMessage();
                //oForm.sendTo.value
                oMsg.setTo(new JSJaCJID('dhee@dheeyantra.com'));
                oMsg.setBody(JSON.stringify(utterance));
                oMsg.setSubject(this.info.conversationId);
                dhee_bosh_connection.send(oMsg);
                return true;

            } catch (e) {
                console.log(e.message);
                return false;
            }

        },

        sendCustomCommandMessage: function (customCommand, contextParams) {
            try {

                var utterance = new Object();
                utterance.commandMessage = 'CUSTOM';
                utterance.customCommand = customCommand;
                utterance.text = "[CMD]";
                utterance.conversationId = this.info.conversationId;
                utterance.projectId = this.info.projectId;
                utterance.userId = this.info.userId;
                utterance.incoming = true;
                if (contextParams) {
                    utterance.currentContext = { params: contextParams };
                }
                var oMsg = new JSJaCMessage();
                //oForm.sendTo.value
                oMsg.setTo(new JSJaCJID('dhee@dheeyantra.com'));
                oMsg.setBody(JSON.stringify(utterance));
                oMsg.setSubject(this.info.conversationId);
                dhee_bosh_connection.send(oMsg);
                return true;

            } catch (e) {
                console.log(e.message);
                return false;
            }

        },

        fileUploadComplete: function (chatUserFileInfo) {
            var context = this.dheeUtterance.currentContext;
            var params = context.params;

            var newParams = {
                chatUserFileInfo: chatUserFileInfo,
                intentProgressId: params['intentProgressId']
            };

            this.sendCustomCommandMessage('FileUploadComplete', newParams);
        },

        getSpeakableText: function (inputText) {

            var messages = inputText.split("\n");
            var message;
            var wholeMessage = '';
            for (var i = 0; i < messages.length; i++) {
                message = messages[i];
                if (message == '') {
                    continue;
                }
                message = this.htmlEncode(message);
                if (wholeMessage.length > 0) {
                    wholeMessage += "<br/>"
                }
                wholeMessage += message;

            }

            var res = wholeMessage.replace(/ *\[\[[^\]]*\]\] */g, "");
            res = res.replace(/<a\b[^>]*>(.*?)<\/a>/i, "");
            res = res.replace("<br/>", "\n");
            if (this.inputLanguage == 'ENGLISH') {
                res = res.replace(/(\d\d)-(\d\d)-(\d\d\d\d)/g, "$2-$1-$3");
            }

            return res;
        },

        handleIQ: function (oIQ) {
            dhee_bosh_connection.send(oIQ.errorReply(ERR_FEATURE_NOT_IMPLEMENTED));
        },

        handleMessage: function (oJSJaCPacket) {
            var html = '';
            var sender = oJSJaCPacket.getFromJID().getNode();
            var message = oJSJaCPacket.getBody();
            var utterance;
            var quitChat = false;
            DheeChatApi.dheeUtterance = this.dheeUtterance = utterance = JSON.parse(message);

            if (utterance.conversationId != DheeChatApi.info.conversationId) {
                console.log("NMC");
                return;
            }

            if (utterance.commandMessage) {
                if (utterance.commandMessage == "CLOSE_NOW") {
                    quitChat = true;
                }

                if (utterance.commandMessage == "TAKE_PAYMENT") {
                    DheeChatApi.initiatePayment(utterance);
                    return;
                }

                if (utterance.commandMessage == 'CUSTOM' && utterance.customCommand.startsWith("LANGUAGE=")) {
                    var language = utterance.customCommand.split('=')[1].trim();
                    DheeChatApi.switchRecognitionLanguage(language);
                    return;
                }
            }

            function print(text, commandMessage, customCommand, currentContext) {
                var messages = text.split("\n");
                var message;
                var wholeMessage = '';
                for (var i = 0; i < messages.length; i++) {
                    message = messages[i];
                    if (message == '') {
                        continue;
                    }
                    message = DheeChatApi.htmlEncode(message);
                    if (wholeMessage.length > 0) {
                        wholeMessage += "<br/>"
                    }
                    wholeMessage += message;

                }

                DheeChatApi.onIncomingMessage(wholeMessage, DheeChatApi.formatIfNeeded(wholeMessage), commandMessage,
                 customCommand, currentContext);

                if (quitChat == true) {
                    setTimeout(function () {
                        DheeChatApi.quit();
                    }, 108);
                }

                if (DheeChatApi.dheeUtterance.commandMessage == "ESCLN_NOTICE") {
                    DheeChatApi.onEscalationNotice();

                }
            }
            if (utterance.text && utterance.text.trim().length > 0) {
                if (!DheeChatApi.onDemandTTS) {
                    DheeChatApi.speakAloud(DheeChatApi.getSpeakableText(utterance.text), utterance.id);
                }
                
            }
            setTimeout(function () {
                print(utterance.text, utterance.commandMessage, utterance.customCommand, utterance.currentContext);
            }, 500);
        },

        handlePresence: function (oJSJaCPacket) {
            var html = '<div class="msg">';
            if (!oJSJaCPacket.getType() && !oJSJaCPacket.getShow())
                html += '<b>' + oJSJaCPacket.getFromJID() + ' has become available.</b>';
            else {
                html += '<b>' + oJSJaCPacket.getFromJID() + ' has set his presence to ';
                if (oJSJaCPacket.getType())
                    html += oJSJaCPacket.getType() + '.</b>';
                else
                    html += oJSJaCPacket.getShow() + '.</b>';
                if (oJSJaCPacket.getStatus())
                    html += ' (' + oJSJaCPacket.getStatus().htmlEnc() + ')';
            }
            html += '</div>';
        },

        handleError: function (e) {
            if (!e) {
                e = "unknown";
            }
            console.error("Error : " + e);
            var errorMessage = "Network error. connection broken! ";
            console.error(errorMessage);
            DheeChatApi.onError(e);
            DheeChatApi.quit();
        },

        reconnectToServer: function () {
            this.hideTyping();
            var errorMessage = "Network connection broken! Reconnecting...";
            console.info(errorMessage);
            this.errorCorrectionInProgress = true;
            this.connectChat(this.connectionConfig);
        },

        handleStatusChanged: function (status) {
            console.log("status changed: " + status);
        },

        handleConnected: function () {

            if (!DheeChatApi.errorCorrectionInProgress) {
                DheeChatApi.sendXmppMsg("$dhee_init$");
                DheeChatApi.toClose = false;
            } else {
                clearInterval(DheeChatApi.reconnectingThread);
                log.info('ReConnected! (You may have to re-enter your last message though.)');
                DheeChatApi.errorCorrectionInProgress = false;
            }
            dhee_bosh_connection.send(new JSJaCPresence());
            DheeChatApi.heartBeatThread = setInterval(function() {
                DheeChatApi.sendXmppMsg("[[HEARTBEAT]]");
            }, 10000)
        },

        handleDisconnected: function () {
            console.info('Disconnected.');
            clearInterval(DheeChatApi.heartBeatThread);
        },

        handleIqVersion: function (iq) {
            dhee_bosh_connection.send(iq.reply([iq.buildNode('name', 'jsjac simpleclient'), iq.buildNode('version', JSJaC.Version), iq.buildNode('os', navigator.userAgent)]));
            return true;
        },

        handleIqTime: function (iq) {
            var now = new Date();
            dhee_bosh_connection.send(iq.reply([iq.buildNode('display', now.toLocaleString()), iq.buildNode('utc', now.jabberDate()), iq.buildNode('tz', now.toLocaleString().substring(now.toLocaleString().lastIndexOf(' ') + 1))]));
            return true;
        },
        connectChat: function (data) {
            this.connectionData = data;
            try {
                if (data.httpBase.substr(0, 5) === 'ws://' || data.httpBase.substr(0, 6) === 'wss://') {
                    dhee_bosh_connection = new JSJaCWebSocketConnection({
                        httpbase: data.httpBase,
                        console: console
                    });
                } else {
                    dhee_bosh_connection = new JSJaCHttpBindingConnection({
                        httpbase: data.httpBase,
                        console: console
                    });
                }

                this.setupCon(dhee_bosh_connection);

                // setup args for connect method
                oArgs = new Object();
                oArgs.domain = data.domain;
                oArgs.username = data.userName;
                if (this.errorCorrectionInProgress) {
                    oArgs.resource = this.connectionData.prevResource;
                } else {
                    oArgs.resource = 'dhee_widget';
                }
                this.connectionData.prevResource = oArgs.resource;
                oArgs.pass = data.password;//$.cookie("login_p");
                oArgs.register = false;
                this.userFullName = data.userFullName;
                dhee_bosh_connection.connect(oArgs);
            } catch (e) {
                console.log("Error while connecting :" + e.toString());
                this.onError(e.toString());

            } finally {
                return false;
            }

        },
        setupCon: function (oCon) {
            oCon.registerHandler('message', this.handleMessage);
            oCon.registerHandler('presence', this.handlePresence);
            oCon.registerHandler('iq', this.handleIQ);
            oCon.registerHandler('onconnect', this.handleConnected);
            oCon.registerHandler('onerror', this.handleError);
            oCon.registerHandler('status_changed', this.handleStatusChanged);
            oCon.registerHandler('ondisconnect', this.handleDisconnected);

            oCon.registerIQGet('query', NS_VERSION, this.handleIqVersion);
            oCon.registerIQGet('query', NS_TIME, this.handleIqTime);
        },
        capitalizeFirstLetter: function (string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        },
        htmlEncode: function (value) {
            var div = document.createElement("div");
            div[("textContent" in div) ? "textContent" : "innerText"] = value;
            return div.innerHTML;
        },
        escapeJs: function (str) {

            str = str.replace(/'/g, "\\'");
            return str;
        },
        speakAloud: function (message, utteranceId, onSpeechFinish) {
            
            if (message.trim().length == 0) {
                return;
            }

            if (!window.speechSynthesis) {
                return;
            }

            var dheeChatWidget = this;
            if (!this.speak) {
                return;
            }
            

            if (this.useDheeTTS) {
                console.log("DHEESPEECHAPI speech with lang : " + this.ttsLang);
                var ap = document.getElementById("dhee_tts_output_player");
                var audioUrl = this.myServerAddress + "/audio/" + this.info.voiceAssistanceKey + "/get-voice?utteranceId=" + utteranceId;
                if (!utteranceId) {
                    audioUrl = this.myServerAddress + "/audio/" + this.info.voiceAssistanceKey + "/get-voice-from-text?utterance=" +
                    encodeURIComponent(message) + "&language=" + dheeChatWidget.inputLanguage;
                }
                this.audioTracks.push(audioUrl);
                if (this.audioTracks.length == 1) {
                    ap.src = audioUrl;
                    ap.muted = false;
                    try {
                        ap.play();
                    } catch (e) {
                        console.log(' audio player error ' + e);
                    }

                }
                if (onSpeechFinish && typeof onSpeechFinish === 'function') {
                    onSpeechFinish.forUrl = audioUrl;
                    this.speechFinishCallbacks.push(onSpeechFinish);
                } else {
                    console.log("WARNING Speech finish call back is " + typeof onSpeechFinish);
                }
                return;
            }


            var recLang = dheeChatWidget.langCodes[dheeChatWidget.inputLanguage];
            this.ttsLang = recLang;
            this.tts = window.speechSynthesis;
            var hasVoice = false;
            var msg = new SpeechSynthesisUtterance();
            var voices = window.speechSynthesis.getVoices();
            var numVoices = 0;
            var lastFoundVoice;
            for (var v in voices) {
                if (voices[v].lang === this.ttsLang) {
                    if (dheeChatWidget.isFemaleVoice(voices[v].name)) {
                        msg.voice = voices[v];
                        hasVoice = true;
                        break;
                    }
                    numVoices++;
                    lastFoundVoice = voices[v];
                }
            }
            if (!hasVoice && recLang === 'en-IN') {
                this.ttsLang = recLang = 'en-US';
                for (var v in voices) {
                    if (voices[v].lang === this.ttsLang) {
                        if (dheeChatWidget.isFemaleVoice(voices[v].name)) {
                            msg.voice = voices[v];
                            hasVoice = true;
                            break;
                        }
                        numVoices++;
                        lastFoundVoice = voices[v];
                    }
                }
            }
            if (!hasVoice) {
                if (lastFoundVoice) {
                    msg.voice = lastFoundVoice;
                    hasVoice = true;
                }
            }
            if (!hasVoice) {
                console.log("Fallback to DHEESPEECHAPI speech with lang : " + this.ttsLang);
                var ap = document.getElementById("dhee_tts_output_player");
                var audioUrl = this.myServerAddress + "/audio/" + this.info.voiceAssistanceKey + "/get-voice?utteranceId=" + utteranceId;
                this.audioTracks.push(audioUrl);
                if (this.audioTracks.length == 1) {
                    ap.src = audioUrl;
                    ap.muted = false;
                    try {
                        ap.play();
                    } catch (e) {
                        console.log(' audio player error ' + e);
                    }

                }
                return;
            }
            msg.voiceURI = 'native';
            msg.volume = 1; // 0 to 1
            //msg.rate = 1; // 0.1 to 10
            //msg.pitch = 2; //0 to 2
            msg.text = message;
            msg.lang = this.ttsLang;
            msg.onstart = function (event) {
                dheeChatWidget.startSynthesisResumeCycles();
                dheeChatWidget.micPaused = true;
                dheeChatWidget.pauseMic(true);
                if (dheeChatWidget.onDheeSpeechStart) {
                    dheeChatWidget.onDheeSpeechStart();
                }
            };

            msg.onend = function (event) {
                dheeChatWidget.stopSynthesisResumeCycles();
                dheeChatWidget.micPaused = false;
                dheeChatWidget.resumeMic();
                if (dheeChatWidget.onDheeSpeechFinished) {
                    dheeChatWidget.onDheeSpeechFinished();
                }
            };
            console.log("WSAPI speech with lang : " + this.ttsLang);
            this.tts.speak(msg);
        },


        startSynthesisResumeCycles: function () {
            if (!window.speechSynthesis) {
                return;
            }
            window.speechSynthesisResumeInterval = setInterval(function () {
                speechSynthesis.pause();
                speechSynthesis.resume();
            }, 10000);
        },

        stopSynthesisResumeCycles: function () {
            if (!window.speechSynthesis) {
                return;
            }
            clearInterval(window.speechSynthesisResumeInterval);
        },

        initializeSpeechRecognition: function () {
            window.speechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition;

            if (this.useGenericSpeechRecognition || !window.speechRecognitionClass) {
                console.log("Using generic ASR.");
                this.initializeDheeSpeechRecognition(this.info.voiceAssistanceKey);
                return;
            }

            var dheeChatWidget = this;
            window.interim_transcript = '';
            window.recognizing = false;
            window.ignore_onend = false;
            window.dhee_record_start_time = Math.floor(Date.now());



            if (!('speechRecognitionClass' in window)) {
                console.warn("SpeechRecognitionClass not available in your browser. SpeechToText won't work.");
            } else {



                var recognition = window.recognition = new speechRecognitionClass();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.onstart = function () {
                    recognizing = true;
                };

                recognition.onerror = function (event) {
                    if (event.error === 'no-speech') {
                        console.log("No speech.. stopping recording..");
                        ignore_onend = true;
                        console.log("ASR ended.");

                    }
                    if (event.error === 'audio-capture') {
                        iziToast.show({
                            title: "Speechless !",
                            message: "No Microphone detected !"
                        });
                        ignore_onend = true;
                        console.log("ASR ended.");
                    }
                    if (event.error === 'not-allowed') {
                        if (event.timeStamp - dhee_record_start_time < 100) {
                            iziToast.show({
                                title: "Speechless !",
                                message: "Recording blocked !"
                            });
                        } else {
                            iziToast.show({
                                title: "Speechless !",
                                message: "Recording denied !"
                            });
                        }
                        ignore_onend = true;
                        console.log("ASR ended.");
                    }

                };

                recognition.onend = function () {

                    if (ignore_onend) {
                        return;
                    }
                    if (dheeChatWidget.micPaused) {
                        //chatController.tempResetMicButton();
                    } else {
                        recognizing = false;
                        console.log("ASR ended.");
                    }

                };

                recognition.onresult = function (event) {
                    window.interim_transcript = '';
                    if (typeof (event.results) == 'undefined') {
                        recognition.onend = null;
                        recognition.stop();
                        console.warn("Error fetching results of SpeechRecognition in your browser. SpeechToText won't work.");
                        return;
                    }
                    var isFinal = false;
                    for (var i = event.resultIndex; i < event.results.length; ++i) {
                        window.interim_transcript += event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            isFinal = true;
                        }
                    }
                    var transcript = window.dhee_user_provided_value;
                    if (window.interim_transcript !== '') {
                        if (dheeChatWidget.isRecording) {
                            transcript = window.dhee_user_provided_value + window.interim_transcript;
                        }
                    }
                    if (isFinal) {
                        if (dheeChatWidget.autoSend === true) {
                            dheeChatWidget.sendMessage(transcript);
                            if (DheeChatApi.onUserInputSent) {
                                DheeChatApi.onUserInputSent();
                            }
                            window.dhee_user_provided_value = "";
                            dheeChatWidget.inputBox.value = "";
                            return;
                        }
                    }

                    dheeChatWidget.inputBox.value = transcript;
                };

                dheeChatWidget.startListening = function () {
                    if (dheeChatWidget.toClose) {
                        return;
                    }
                    var audioCtx = dheeChatWidget.audioContext;
                    if (!dheeChatWidget.isRecording) {
                        dheeChatWidget.startSTT();
                        dheeChatWidget.isRecording = true;
                        if (window.speechSynthesis) {
                            speechSynthesis.cancel();
                            if (DheeChatApi.audioTracks.length > 0) {
                                DheeChatApi.audioTracks.length = 0;
                                var ap = document.getElementById("dhee_tts_output_player");

                                if (!ap.paused) {
                                    DheeChatApi.onAudioCancel();
                                    ap.pause();
                                    
                                }

                            }
                        }
                    }
                };

                dheeChatWidget.stopListening = function () {
                    var audioCtx = dheeChatWidget.audioContext;
                    if (dheeChatWidget.isRecording) {
                        dheeChatWidget.isRecording = false;
                        recognition.stop();
                        if (audioCtx) {
                            audioCtx.suspend();
                        }
                    }
                };
            }
        },

        isFemaleVoice: function (voiceName) {
            for (var i in this.femaleVoiceNames) {
                if (voiceName.toLowerCase().indexOf(this.femaleVoiceNames[i]) > 0) {
                    return true;
                }
            }
            return false;
        },

        startSTT: function () {
            if (!window.recognition) {
                //We might be under generic recogntion; hence nothing to do here.
                return;
            }
            var dheeChatWidget = this;
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            var audioCtx = this.audioContext;
            var analyser = this.analyser;
            var canvas = document.getElementById(this.speechSignalsCanvas);
            if (canvas) {

                var canvasContext = canvas.getContext('2d');

                const CANVAS_HEIGHT = canvas.height;
                const CANVAS_WIDTH = canvas.width;

                function rafCallback(time) {
                    if (dheeChatWidget.isRecording) {
                        window.requestAnimationFrame(rafCallback, canvas);
                    }
                    dheeChatWidget.paintAudioVisualizerFrame(analyser, CANVAS_WIDTH, CANVAS_HEIGHT, canvasContext);
                }
            }

            var recLang = this.langCodes[this.inputLanguage];
            if (!recLang) {
                console.error("Speech recognition is not supported for the language " + this.inputLanguage);
                return;
            }
            console.log("Recog Lang : " + recLang);
            recognition.lang = recLang;
            recognition.start();
            ignore_onend = false;
            window.dhee_user_provided_value = DheeChatApi.inputBox ? DheeChatApi.inputBox.value : "";
            dhee_record_start_time = Math.floor(Date.now());

            if (canvas) {
                if (!this.audioVisualization) {
                    const SAMPLE_RATE = 16000;
                    const SAMPLE_SIZE = 16;
                    var audioPromise = navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            channelCount: 1,
                            sampleRate: {
                                ideal: SAMPLE_RATE
                            },
                            sampleSize: SAMPLE_SIZE
                        }
                    });

                    audioPromise.then(function (micStream) {
                        var microphone = audioCtx.createMediaStreamSource(micStream);
                        analyser = audioCtx.createAnalyser();
                        dheeChatWidget.analyser = analyser;
                        microphone.connect(analyser);
                    }).catch(console.log.bind(console));

                    this.audioVisualization = true;
                } else {
                    audioCtx.resume();
                }
                rafCallback();
            }

        },

        switchRecognitionLanguage: function (language) {
            console.log("Changing language to " + language);
            this.inputLanguage = language;
            this.restartMic();
        },

        sendSwitchLanguageSignal: function (language) {
            console.log("Sending change language signal to " + language);
            this.sendCommandMessage("CUSTOM", { language: language, command: 'SET_LANGUAGE' });
        },


        initializeDheeSpeechRecognition: function (callId) {
            var dheeChatWidget = DheeWidgetChat = this;
            var audioContext;
            var microphoneStreamSource;

            dheeChatWidget.startListening = function () {
                if (!dheeChatWidget.isRecording) {
                    dheeChatWidget.isRecording = true;
                }
            }

            dheeChatWidget.stopListening = function () {
                if (dheeChatWidget.isRecording) {
                    dheeChatWidget.isRecording = false;
                }
            }


            function newWebsocket(callId) {
                if (DheeWidgetChat.lastWebSocket) {
                    var lastWebSocket = DheeWidgetChat.lastWebSocket;
                    if (lastWebSocket.readyState === lastWebSocket.CONNECTING || lastWebSocket.readyState === lastWebSocket.OPEN) {
                        return;
                    }
                }

                var audioPromise = navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        channelCount: 1,
                        sampleRate: {
                            ideal: SAMPLE_RATE
                        },
                        sampleSize: SAMPLE_SIZE
                    }
                });

                var websocketPromise = new Promise(function (resolve, reject) {

                    var chatServer = dheeChatWidget.myServerAddress.replace("http:", "ws:").replace("https:", "wss:");

                    var callConnectionUrl = chatServer + "/asr/";

                    socket = new WebSocket(callConnectionUrl + callId);
                    socket.binaryType = "arraybuffer";
                    socket.addEventListener('open', resolve);
                    socket.addEventListener('error', reject);
                    return socket;

                });

                Promise.all([audioPromise, websocketPromise]).then(function (values) {

                    var micStream = values[0];
                    var socket = values[1].target;

                    audioContext = new (window.AudioContext || window.webkitAudioContext)(/*{ sampleRate: 16000 }*/);

                    var websocketProcessorScriptNode = audioContext.createScriptProcessor(8192, 1, 1);

                    const MAX_INT = Math.pow(2, 16 - 1) - 1;

                    function downsample(buffer, fromSampleRate, toSampleRate) {
                        // buffer is a Float32Array
                        var sampleRateRatio = Math.round(fromSampleRate / toSampleRate);
                        var newLength = Math.round(buffer.length / sampleRateRatio);

                        var result = new Float32Array(newLength);
                        var offsetResult = 0;
                        var offsetBuffer = 0;
                        while (offsetResult < result.length) {
                            var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
                            var accum = 0, count = 0;
                            for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                                accum += buffer[i];
                                count++;
                            }
                            result[offsetResult] = accum / count;
                            offsetResult++;
                            offsetBuffer = nextOffsetBuffer;
                        }
                        return result;
                    }

                    websocketProcessorScriptNode.addEventListener('audioprocess', function (e) {

                        if (!DheeWidgetChat.isRecording) {
                            return;
                        }
                        var floatSamples = e.inputBuffer.getChannelData(0);
                        var fromSampleRate = audioContext.sampleRate;
                        var toSampleRate = 16000;
                        if (fromSampleRate != toSampleRate) {
                            console.log("micSamplingRate:" + fromSampleRate + "; Resampling to 16K");
                            floatSamples = downsample(floatSamples, fromSampleRate, toSampleRate);
                        }

                        socket.send(Int16Array.from(floatSamples.map(function (n) {
                            return n * MAX_INT;
                        })));
                    });

                    DheeWidgetChat.websocketProcessorScriptNode = websocketProcessorScriptNode;


                    socket.addEventListener('close', function (e) {
                        console.log("Dhee ASR websocket closed");
                    });
                    socket.addEventListener('error', function (e) {
                        console.log('Error from Dhee ASR websocket', e);
                    });
                    socket.addEventListener('message', onTranscription);

                    function sendInitParams() {
                        var config = {
                            callKey: DheeWidgetChat.info.voiceAssistanceKey
                        }
                        socket.send(JSON.stringify(config));
                    }

                    function startByteStream(e) {
                        microphoneStreamSource = audioContext.createMediaStreamSource(micStream);
                        microphoneStreamSource.connect(websocketProcessorScriptNode);
                        websocketProcessorScriptNode.connect(audioContext.destination);
                    }

                    function onTranscription(message) {

                        if (typeof message.data === "string") {

                            /*console.log("Got Text: " + message.data);*/
                            if (message.data == "startStreaming") {
                                console.log("Starting to stream audio");
                                dheeChatWidget.dheeAsrInUse = true;
                                startByteStream();
                            } else {
                                var packet = JSON.parse(message.data);
                                if (packet.status == 0) {
                                    if (dheeChatWidget.isRecording) {
                                        if (dheeChatWidget.inputBox) {
                                            dheeChatWidget.inputBox.value = packet.transcript;
                                        }
                                        
                                    }
                                }

                                if (packet.status == 1) {

                                    var transcript = packet.transcript;
                                    if (dheeChatWidget.autoSend === true) {
                                        console.log("Sending transcription: "+ transcript);
                                        dheeChatWidget.sendMessage(transcript);
                                        if (DheeChatApi.onUserInputSent) {
                                            DheeChatApi.onUserInputSent();
                                        }
                                        window.dhee_user_provided_value = "";
                                        dheeChatWidget.inputBox.value = "";
                                        return;
                                    }

                                }
                            }
                            return;
                        }
                    }

                    sendInitParams();


                }).catch(console.log.bind(console));
            }

            function closeWebsocket() {
                try {
                    if (socket && socket.readyState === socket.OPEN) {
                        socket.close();
                    }
                } catch (error) {
                    console.error(error);
                }
            }

            function cleanUp() {
                try {
                    console.log("cleaning up connections");
                    if (DheeWidgetChat.websocketProcessorScriptNode) {
                        DheeWidgetChat.websocketProcessorScriptNode.disconnect();
                    }
                    if (microphoneStreamSource) {
                        microphoneStreamSource.disconnect();
                    }
                    if (audioContext && audioContext.state != 'closed') {
                        audioContext.close();
                        delete audioContext;
                    }

                } catch (error) {
                    console.error(error);
                }
            }

            function toggleWebsocket(e) {
                var context = e.target;
                if (context.state === 'running') {
                    newWebsocket();
                } else if (context.state === 'suspended') {
                    setTimeout(function () {
                        closeWebsocket();
                    }, 1500);
                }
            }

            dheeChatWidget.newWebsocket = newWebsocket;
            dheeChatWidget.stopDheeAsr = function () {
                cleanUp();
                closeWebsocket();
            };
            dheeChatWidget.setupComplete = true;
            newWebsocket(callId);
        },




        reset: function () {
            this.started = false;
            speechSynthesis.cancel();
            this.stopListening();
        },


        restart: function () {
            this.reset();
            this.start(this.info);
        },

        quit: function () {

            this.toClose = true;
            if (window.speechSynthesis) {
                speechSynthesis.cancel();
            }

            if (window.dhee_bosh_connection && dhee_bosh_connection.connected()) {
                var p = new JSJaCPresence();
                p.setType("unavailable");
                dhee_bosh_connection.send(p);
                this.toClose = true;
                
                setTimeout(function () {
                    dhee_bosh_connection.disconnect();
                }, 500)
            }

            if (this.audioContext) {
                this.audioContext.close();
                delete this.audioContext;
            }
            this.audioVisualization = false;
            if (this.onChatEnded) {
                this.onChatEnded();
            }
            clearInterval(this.heartBeatThread);

        },
        isConnected: function () {
            if (!window.dhee_bosh_connection) {
                return false;
            }
            return dhee_bosh_connection.connected();
        },
        sendCloseIntent: function () {
            this.sendXmppMsg("$dhee_close$");
        },

        paintAudioVisualizerFrame: function (analyser, CANVAS_WIDTH, CANVAS_HEIGHT, canvasContext) {

            if (!analyser) {
                return;
            }
            var freqByteData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freqByteData); //analyser.getByteTimeDomainData(freqByteData);

            var SPACER_WIDTH = 2;
            var BAR_WIDTH = 1;
            var OFFSET = 100;
            var numBars = Math.round(CANVAS_WIDTH / SPACER_WIDTH);

            canvasContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            canvasContext.fillStyle = this.themeColor;
            canvasContext.lineCap = 'round';

            // Draw rectangle for each frequency bin.
            for (var i = 0; i < numBars; ++i) {
                var magnitude = (freqByteData[i + OFFSET] / 255) * CANVAS_HEIGHT;
                canvasContext.fillRect(i * SPACER_WIDTH, CANVAS_HEIGHT, BAR_WIDTH, -magnitude);
            }
        },
        createLinksWhereApplicable: function (inputText) {

            var replacedText, replacePattern1, replacePattern2, replacePattern3;

            //URLs starting with http://, https://, or ftp://
            replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
            replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

            //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
            replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
            replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

            //Change email addresses to mailto:: links.
            replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
            replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

            replacedText = this.formatIfNeeded(replacedText, true);

            return replacedText;
        },
        getLigherShade: function (p, c0, c1) {
            var n = p < 0 ? p * -1 : p, u = Math.round, w = parseInt;
            if (c0.length > 7) {
                var f = c0.split(","), t = (c1 ? c1 : p < 0 ? "rgb(0,0,0)" : "rgb(255,255,255)").split(","), R = w(f[0].slice(4)), G = w(f[1]), B = w(f[2]);
                return "rgb(" + (u((w(t[0].slice(4)) - R) * n) + R) + "," + (u((w(t[1]) - G) * n) + G) + "," + (u((w(t[2]) - B) * n) + B) + ")"
            } else {
                var f = w(c0.slice(1), 16), t = w((c1 ? c1 : p < 0 ? "#000000" : "#FFFFFF").slice(1), 16), R1 = f >> 16, G1 = f >> 8 & 0x00FF, B1 = f & 0x0000FF;
                return "#" + (0x1000000 + (u(((t >> 16) - R1) * n) + R1) * 0x10000 + (u(((t >> 8 & 0x00FF) - G1) * n) + G1) * 0x100 + (u(((t & 0x0000FF) - B1) * n) + B1)).toString(16).slice(1)
            }
        },
        makeInteractive: function (inputText, responseText) {

            var ligherShade = this.getLigherShade(0.72, this.themeColor);

            var id = 'int-link-' + new Date().getTime();
            var linkPattern = '<a id="{id}" style="itemStyle" href="javascript:DheeChatApi.sendInteractiveResponse(\'{r}\', \'{id}\')">{m}</a>';
            if (responseText.startsWith('http')) {
                linkPattern = '<a id="{id}" style="itemStyle" href="{r}" target="_blank">{m}</a>';
            }
            if (inputText.startsWith("*")) {
                inputText = inputText.substring(1);
                linkPattern = linkPattern.replace("itemStyle", "background-color:" + ligherShade);
            } else {
                linkPattern = linkPattern.replace("itemStyle", "");
            }
            if (responseText.startsWith("*")) {
                responseText = responseText.substring(1);
            }

            return linkPattern.replace('{m}', inputText).replace('{r}', responseText)
                .replace('{id}', id).replace('{id}', id);
        },
        sendInteractiveResponse: function (inputText, sourceId) {
            if (window.dhee_minimise_typing) {
                $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "inline-block");
            }
            this.sendThisMessage(inputText);
        },
        formatIfNeeded: function (text, internal) {

            var extBegin = "[[EXT:";
            var extEnd = "]]";
            if (internal) {
                extBegin = "{{EXT:";
                extEnd = "}}";
            }
            if (!this.themeColor) {
                this.themeColor = "#074F8C"
            }
            var ligherShade = this.getLigherShade(0.72, this.themeColor);
            var extBeginIndex = text.indexOf(extBegin);
            if (extBeginIndex >= 0) {
                var lastPlainIndex = 0;
                var outputText = "";
                var finalOutput = "";
                var inputText = text;
                while (extBeginIndex >= 0) {
                    finalOutput = finalOutput + outputText + inputText.substring(lastPlainIndex, extBeginIndex);
                    inputText = inputText.substring(extBeginIndex);
                    var firstPipeIndex = inputText.indexOf('|');
                    var displayType = inputText.substring(extBegin.length, firstPipeIndex);
                    var endIndex = inputText.indexOf(extEnd);
                    outputText = "";
                    if (displayType === 'UNORDERED_LIST' || displayType === 'ORDERED_LIST') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var listItemsHtml = '';
                        for (var i = 0; i < listItems.length; i++) {
                            if (!internal) {
                                listItemsHtml = listItemsHtml + '<li>' + this.createLinksWhereApplicable(listItems[i]) + '</li> \n';
                            } else {
                                listItemsHtml = listItemsHtml + '<li>' + listItems[i] + '</li> \n';
                            }
                        }
                        if (displayType === 'UNORDERED_LIST') {
                            outputText = outputText + '<ul class="ordinaryOptList">' + listItemsHtml + '</ul>';
                        }
                        if (displayType === 'ORDERED_LIST') {
                            outputText = outputText + '<ol class="ordinaryOptList">' + listItemsHtml + '</ol>';
                        }
                        outputText = '<div class="ordinaryOptionsBox">' + outputText + '</div>'
                    } else if (displayType === 'INTERACTIVE_LIST') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var listItemsHtml = '';
                        for (var i = 0; i < listItems.length; i++) {
                            var imgUrl = listItems[i];
                            var label = listItems[i];
                            if (listItems[i].indexOf('^') > 0) {
                                var keyLabel = listItems[i].split('^');
                                imgUrl = keyLabel[1];
                                label = keyLabel[0];
                            }
                            listItemsHtml = listItemsHtml + '<li><div class="form-check">' + this.makeInteractive(label, imgUrl) + '</div></li> \n';
                        }
                        outputText = outputText + '<ul class="chatoptList">' + listItemsHtml + '</ul>';
                        outputText = '<div class="optionsBox">' + outputText + '</div>'
                    } else if (displayType === 'BUTTON') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var listItemsHtml = '';
                        var itemHtml;
                        var special;
                        for (var i = 0; i < listItems.length; i++) {
                            var imgUrl = listItems[i];
                            var label = listItems[i];
                            if (listItems[i].indexOf('^') > 0) {
                                var keyLabel = listItems[i].split('^');
                                imgUrl = keyLabel[1];
                                label = keyLabel[0];
                            }
                            special = false;
                            if (label.startsWith("*")) {
                                special = true;
                                label = label.substring(1);
                            }
                            if (imgUrl.startsWith("*")) {
                                imgUrl = imgUrl.substring(1);
                            }
                            imgUrl = DheeChatApi.escapeJs(imgUrl);


                            itemHtml = '<a class="optionBtn" style="buttonStyle" href="javascript:DheeChatApi.sendInteractiveResponse(\'' + imgUrl + '\', \'b-001\')"><span>' + label + '</span></a> \n';
                            if (special) {
                                itemHtml = itemHtml.replace("buttonStyle", "background-color:" + ligherShade);
                            } else {
                                itemHtml = itemHtml.replace("buttonStyle", "");
                            }

                            listItemsHtml = listItemsHtml + itemHtml;
                        }
                        outputText = '<div class="optionsBox">' + listItemsHtml + '</div>';
                        if (window.dhee_minimise_typing) {
                            $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "none");
                        }
                    } else if (displayType === 'LINKBUTTON') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var listItemsHtml = '';
                        var itemHtml;
                        var special;
                        for (var i = 0; i < listItems.length; i++) {
                            var imgUrl = listItems[i];
                            var label = listItems[i];
                            if (listItems[i].indexOf('^') > 0) {
                                var keyLabel = listItems[i].split('^');
                                imgUrl = keyLabel[1];
                                label = keyLabel[0];
                            }
                            special = false;
                            if (label.startsWith("*")) {
                                special = true;
                                label = label.substring(1);
                            }
                            if (imgUrl.startsWith("*")) {
                                imgUrl = imgUrl.substring(1);
                            }
                            itemHtml = '<a href="javascript:DheeChatApi.sendInteractiveResponse(\'' + imgUrl + '\', \'lb-001\')"><span>' + label + '</span></a> \n';

                            listItemsHtml = listItemsHtml + itemHtml;
                        }
                        outputText = '<div class="optionsBox">' + listItemsHtml + '</div>';
                        if (window.dhee_minimise_typing) {
                            $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "none");
                        }
                    } else if (displayType === 'LINK') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var listItemsHtml = '';
                        for (var i = 0; i < listItems.length; i++) {
                            var imgUrl = listItems[i];
                            var label = listItems[i];
                            if (listItems[i].indexOf('^') > 0) {
                                var keyLabel = listItems[i].split('^');
                                imgUrl = keyLabel[1];
                                label = keyLabel[0];
                            }
                            listItemsHtml = listItemsHtml + '<a target="_blank" href="' + imgUrl + '"><span>' + label + '</span></a> \n';
                        }
                        outputText = listItemsHtml;
                    } else if (displayType === 'IMGCAR') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var listItemsHtml = '';
                        var itemTemplate = '<div class="carousel-item {active} col-md-6"><div class="card"><img class="card-img-top img-fluid" src="{imgUrl}" alt="Card image cap" onclick="DheeChatApi.sendInteractiveResponse(\'{feedback}\', \'lb-001\')"/><div class="carousel-caption d-md-block"><div class="captionLabel">{label}</div></div></div></div>';
                        var carouselTemplate = $("#imageCarouselTemplate").html();
                        for (var i = 0; i < listItems.length; i++) {
                            var imgUrl = listItems[i];
                            var label = listItems[i];
                            var feedback;
                            if (listItems[i].indexOf('^') > 0) {
                                var keyLabel = listItems[i].split('^');
                                imgUrl = keyLabel[1];
                                label = keyLabel[0];
                                feedback = keyLabel[2];
                            }
                            var active = "";
                            if (i == 0) {
                                active = "active";
                            }
                            listItemsHtml = listItemsHtml + itemTemplate.replace('{imgUrl}', imgUrl).replace('{label}', label).replace('{feedback}', feedback).replace('{active}', active) + '\n';
                            if (window.dhee_minimise_typing) {
                                $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "none");
                            }
                        }
                        outputText = carouselTemplate.replace('listings', listItemsHtml);
                        var carId = 'imgcar' + new Date().getTime();
                        outputText = outputText.replace(/carId/g, carId);
                        setTimeout(function () {
                            window.dhee_apply_img_carousel(carId);
                            if (window.dhee_minimise_typing) {
                                $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "none");
                            }
                        }, 100)
                    } else if (displayType === 'CUSTOMTEXT') {
                        var listItemsString = inputText.substring(firstPipeIndex + 1, endIndex);
                        var listItems = listItemsString.split('|');
                        var textAreaHTML = '';
                        var textAreaTemplate = $("#customTextInputTemplate").html();
                        for (var i = 0; i < listItems.length; i++) {
                            var label = listItems[i];
                            var taId = 'cTxtA-' + new Date().getTime();
                            textAreaHTML = textAreaHTML + textAreaTemplate.replace('textAreaPlaceholder', label).
                                replace('textAreaId', taId).replace('textAreaId', taId) + '\n';
                        }
                        outputText = textAreaHTML;
                        $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "none");
                    } else if (displayType === 'FILEUPLOAD') {

                        outputText = FileUpload.initNew(inputText, firstPipeIndex, endIndex);
                    }
                    lastPlainIndex = endIndex + 2;
                    extBeginIndex = inputText.indexOf(extBegin, lastPlainIndex);
                    if (extBeginIndex < 0) {
                        finalOutput = finalOutput + outputText + inputText.substring(lastPlainIndex);
                    }
                }

                return finalOutput;
            }
            if (!internal) {
                return this.createLinksWhereApplicable(text);
            }
            return text;
        },
        submitCustomText: function (textAreaId) {
            $("#messageInput, #dhee_chat_record_button, #sendChatButton").css("display", "inline-block");
            var inputText = $('#' + textAreaId).val();
            this.sendThisMessage(inputText);
        },
        initiatePaymentFramework: function () {
            var paymentGateway = window.dhee_payment_gateway;
            if (paymentGateway == "RAZORPAY") {
                $.getScript("https://checkout.razorpay.com/v1/checkout.js", function (data, textStatus, jqxhr) {
                    console.log("Loaded RZ gateway");
                });

            }

        },

        initiatePayment: function (utterance) {
            var context = utterance.currentContext;
            var params = context.params.paymentParams;
            var themeColor = this.themeColor;
            var paymentGateway = window.dhee_payment_gateway;
            var self = this;
            if (paymentGateway == "RAZORPAY") {
                var options = {
                    "key": params.keyId,
                    "amount": params.amount, // 2000 paise = INR 20
                    "name": params.merchantName,
                    "description": params.description,
                    "image": "",
                    "handler": function (response) {
                        console.log("Received paymentId " + response.razorpay_payment_id);
                        var paymentId = response.razorpay_payment_id;
                        var contextParams = {
                            paymentId: paymentId
                        }
                        self.sendCommandMessage('CAPTURE_PAYMENT', contextParams);
                        if (self.supportsGA) {
                            gtag('event', 'payment_capture', { gateway: paymentGateway });
                        }
                    },
                    "prefill": {
                        "name": params.userName,
                        "email": params.userEmail,
                        "contact": params.contactNumber
                    },
                    "notes": {
                        "address": params.userAddress
                    },
                    "theme": {
                        "color": themeColor
                    }
                };
                var rzpy = new Razorpay(options);
                rzpy.open();

            }
        },
        saveIfNeeded: function () {
            if (!window.dhee_bosh_connection) {
                return;
            }
            //Save if chat is in progress
            var con = dhee_bosh_connection;
            var me = this;
            if (typeof con != 'undefined' && con && con.connected()) {
                // save backend type
                if (con._hold) {
                    // must be binding
                    (new JSJaCCookie('btype', 'binding')).write();
                } else {
                    (new JSJaCCookie('btype', 'polling')).write();
                }
            }

        },

        detectClient: function () {

            var dheeChatApi = this;
            // Opera 8.0+
            var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

            // Firefox 1.0+
            var isFirefox = typeof InstallTrigger !== 'undefined';

            // Safari 3.0+ "[object HTMLElementConstructor]"
            var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) {
                return p.toString() === "[object SafariRemoteNotification]";
            })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));

            // Internet Explorer 6-11
            var isIE = /*@cc_on!@*/false || !!document.documentMode;

            // Edge 20+
            var isEdge = !isIE && !!window.StyleMedia;

            // Chrome 1+
            var isChrome = !!window.chrome && !!window.chrome.webstore;

            // Blink engine detection
            var isBlink = (isChrome || isOpera) && !!window.CSS;

            this.clientType = null;
            if (isOpera) {
                this.clientType = "OTHERS";
            } else if (isFirefox) {
                this.clientType = "FIREFOX";
            } else if (isSafari) {
                this.clientType = "SAFARI";
            } else if (isIE || isEdge) {
                this.clientType = "IE";
            } else if (isChrome) {
                this.clientType = "CHROME";
            } else if (isBlink) {
                this.clientType = "OTHERS";
            } else if ((navigator.userAgent.indexOf("Chrome") != -1)) {
                this.clientType = "CHROME";
            } else {
                this.clientType = "OTHERS";
            }

            var userAgent = window.navigator.userAgent,
                platform = window.navigator.platform,
                macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
                windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
                iosPlatforms = ['iPhone', 'iPad', 'iPod'];

            this.deviceSubTypeType = null;
            if (macosPlatforms.indexOf(platform) !== -1) {
                this.deviceSubTypeType = 'MAC';
            } else if (iosPlatforms.indexOf(platform) !== -1) {
                this.deviceSubTypeType = 'IOS';
            } else if (windowsPlatforms.indexOf(platform) !== -1) {
                this.deviceSubTypeType = 'WINDOWS';
            } else if (/Windows Phone/.test(userAgent)) {
                this.deviceSubTypeType = 'OTHERS';
            } else if (/Android/.test(userAgent)) {
                this.deviceSubTypeType = 'ANDROID';
            } else if (!this.deviceSubTypeType && /Linux/.test(platform)) {
                this.deviceSubTypeType = 'LINUX';
            } else {
                this.deviceSubTypeType = 'OTHERS';
            }

            var isMobile = false; //initiate as false
            // device detection
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)
                || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0, 4))) {
                isMobile = true;
            }

            this.deviceType = null;
            if (isMobile) {
                this.deviceType = "MOBILE";
            } else {
                this.deviceType = "DESKTOP";
            }

            this.pageURL = window.location.href;
            this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            this.locale = navigator.language || navigator.userLanguage;
            this.deviceModel = WURFL.complete_device_name;
            navigator.geolocation.getCurrentPosition(function (location) {
                dheeChatApi.lattitude = location.coords.latitude;
                dheeChatApi.longitude = location.coords.longitude;
                dheeChatApi.accuracy = location.coords.accuracy;
            });
            //alert(this.deviceSubTypeType + " " + this.clientType + " " + this.deviceType);
        },

        toClose: false,
        botName: "Dhee",
        bubbles: {},
        audioVisualization: false,
        started: false,
        langCodes: {
            ENGLISH: 'en-IN',
            BANGLA: 'bn-IN',
            GUJARATI: 'gu-IN',
            HINDI: 'hi-IN',
            KANNADA: 'kn-IN',
            MALAYALAM: 'ml-IN',
            MARATHI: 'mr-IN',
            TAMIL: 'ta-IN',
            TELUGU: 'te-IN'
        },
        femaleVoiceNames: [
            "female", "zira", "heera", "kalpana", "samantha", "fiona", "victoria"
        ],
        themeColor: window.dhee_theme_color,
        otpVerification: window.dhee_otp_verification
    }

    window.DheeChatApi = DheeChatApi;
    return DheeChatApi;
});
