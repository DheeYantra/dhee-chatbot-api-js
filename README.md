# dhee-chatbot-api-js

The javascript API for initiating chat with agents deployed in Dhee.AI cloud.

Download the JS file [dhee-chat-api.js](https://raw.githubusercontent.com/DheeYantra/dhee-chatbot-api-js/main/src/main/resources/static/dhee-chat-api.js)  and include it in your server's scripts.

Add the script then to the HTML page where you would want your users to have voice conversations.


Initialize the chat client as below:

```javascript

var dheeChatConfig = {};
dheeChatConfig.instanceId = 'js-api-test';
dheeChatConfig.inputMessageBoxId = 'userMessage';
dheeChatConfig.onIncomingMessage = onMessage;
dheeChatConfig.onAllBotsBusy = onAllBotsBusy;
DheeChatApi.init(dheeChatConfig);

```

A chat is started using the function start, as in the example below : 

```javascript

DheeChatApi.launchDheeChat(USERNAME, CONTACTNUMBER, LANGUAGE);

```
USERNAME is the name with which the bot is supposed to address the chat user.
CONTACTNUMBER is the mobile number of the chat user if available. Else fill in with 10 zeros.

**Supported languages are : ENGLISH, HINDI, BANGLA, TAMIL, TELUGU, KANNADA, MARATHI, GUJARATI, MALAYALAM**

Event handlers can be set as below :
```javascript

dheeChatConfig.onIncomingMessage =  function(message) {
// handle message from bot, like displaying in a div.
}

```
Events supported are onIncomingMessage, onError, onAllBotsBusy.


At any point disable speak aloud feature with -
```javascript
            DheeChatApi.disableSpeechSynthesis()
```

To re-enable speech synthesis -

```javascript
            DheeChatApi.enableSpeechSynthesis()
```

To change the language of interaction -

```javascript
            DheeChatApi.changeLanguage(NEW_LANGUAGE)
```
Possible values of NEW_LANGUAGE are string values of the subset of supported languages chosen by you in your project.


After the chat, the bot disconnects the call. Of course at any point of conversation, the user can disconnect the call. To facilitate this, use this function -
```javascript
            DheeChatApi.endChat()
```



Issue reports, fix/extention PRs are welcome!
