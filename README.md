# dhee-chatbot-api-js

The javascript API for initiating chat with agents deployed in Dhee.AI cloud.

Download the JS file dhee-chat-api.js from the **downloads** folder and include it in your server's scripts.

Add the script then to the HTML page where you would want your users to have voice conversations.


Initialize the chat client as below:

```javascript

TBD

```

A chat is started using the function start, as in the example below : 

```javascript

TBD

```

**Supported languages are : ENGLISH, HINDI, BANGLA, TAMIL, TELUGU, KANNADA, MARATHI, GUJARATI, MALAYALAM**

Event handlers can be set as below :
```javascript

TBD

```
Events supported are TBD.


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
