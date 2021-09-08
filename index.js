const line = require('@line/bot-sdk');

const client = new line.Client({channelAccessToken: process.env.ACCESS_TOKEN});

exports.handler = async (event) => {
    console.log('event:', event);
    const event_data = JSON.parse(event.body);
    console.log('event.body:', JSON.stringify(event_data));
    const messageData = event_data.events && event_data.events[0];
    console.log('text:' + JSON.stringify(messageData.message.text));

    const postData = {
        'type': 'text',
        'text': messageData.message.text
    };

    try {
        await client.replyMessage(messageData.replyToken, postData);
    } catch(error) {
        console.log(error);
    }
};