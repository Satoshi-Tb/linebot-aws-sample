const {
  CostExplorerClient,
  GetCostAndUsageCommand,
} = require("@aws-sdk/client-cost-explorer");
const line = require('@line/bot-sdk');

const client = new line.Client({channelAccessToken: process.env.ACCESS_TOKEN});
const REGION = "ap-northeast-1";

// async/await.
const getMonthlyAmount = async (in_ymd_from) => {
  try {
    const client = new CostExplorerClient({ region: REGION });
    const BASE = new Date(2021, 8, 1);
    //const BASE = new Date();
    const NEXT_MONTH = new Date(BASE.getFullYear(), BASE.getMonth(), 1);
    NEXT_MONTH.setMonth(NEXT_MONTH.getMonth() + 1);

    const day_from = new Date(BASE.getFullYear(), BASE.getMonth(), 1, 9, 0, 0);
    const day_to = new Date(
      NEXT_MONTH.getFullYear(),
      NEXT_MONTH.getMonth(),
      1,
      9,
      0,
      0
    );

    const ymd_from = day_from.toISOString().substring(0, 10);
    const ymd_to = day_to.toISOString().substring(0, 10);

    // memo: Start->include, End->not inculude
    const params = {
      TimePeriod: {
        Start: ymd_from,
        End: ymd_to,
      },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
    };
    console.log(params);
    const command = new GetCostAndUsageCommand(params);
    const result = await client.send(command);
    console.log(result);
    return result.ResultsByTime[0].Total.UnblendedCost.Amount;
    // process data.
  } catch (error) {
    // error handling.
    console.log(error);
    return '';
  }
};

const parseFloatAndFloor = (str_val) => {
  return Math.floor(parseFloat(str_val) * 1000) / 1000;
}

exports.handler = async (event) => {
    console.log('event:', event);
    const event_data = JSON.parse(event.body);
    console.log('event.body:', JSON.stringify(event_data));
    const messageData = event_data.events && event_data.events[0];
    console.log('text:' + JSON.stringify(messageData.message.text));

    const amount_str = await getMonthlyAmount('202109'); //TODO 日付指定はまだ
    const message = amount_str ? `期間: XXXXXXXX～XXXXXXX\nAWS利用料: ${parseFloatAndFloor(amount_str)}$` : 'AWS料金の取得に失敗しました😩';
    const postData = {
        'type': 'text',
        'text': message
    };

    try {
        await client.replyMessage(messageData.replyToken, postData);
    } catch(error) {
        console.log(error);
    }
};