const {
  CostExplorerClient,
  GetCostAndUsageCommand,
} = require("@aws-sdk/client-cost-explorer");
const line = require("@line/bot-sdk");
const crypto = require('crypto');

const client = new line.Client({
  channelAccessToken: process.env.ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
});
const REGION = "ap-northeast-1";

// async/await.
const getMonthlyAmount = async (target) => {
  try {
    const client = new CostExplorerClient({ region: REGION });
    const BASE = new Date(target.getFullYear(), target.getMonth(), 1);
    const NEXT_MONTH = new Date(BASE.getFullYear(), BASE.getMonth(), 1);
    NEXT_MONTH.setMonth(NEXT_MONTH.getMonth() + 1);

    const day_from = new Date(BASE.getFullYear(), BASE.getMonth(), 1);
    const day_to = new Date(NEXT_MONTH.getFullYear(), NEXT_MONTH.getMonth(), 1);

    // memo: Start->include, End->not inculude
    const params = {
      TimePeriod: {
        Start: toYMDString(day_from),
        End: toYMDString(day_to),
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
    return "";
  }
};

const parseFloatAndFloor = (str_val) => {
  return Math.floor(parseFloat(str_val) * 1000) / 1000;
};

const toYMDString = (dt) => {
  const mm = ('00' + (dt.getMonth()+1)).slice(-2);
  const dd = ('00' + dt.getDate()).slice(-2);
  return `${dt.getFullYear()}-${mm}-${dd}`;
};

exports.handler = async (event) => {
  console.log("event:", event);

  // signature検証
  const signature = crypto
    .createHmac('SHA256', client.config.channelSecret)
    .update(event.body).digest('base64');

  if (event.headers['x-line-signature'] !== signature) {
    console.log('signature error!');
    return;
  }

  const event_data = JSON.parse(event.body);
  console.log("event.body:", JSON.stringify(event_data));
  const messageData = event_data.events && event_data.events[0];
  console.log("text:" + JSON.stringify(messageData.message.text));

  const target_date = new Date(); //TODO 日付指定はまだ
  target_date.setDate(1);
  const end_date = new Date(target_date.getFullYear(), target_date.getMonth(), 1);
  end_date.setMonth(end_date.getMonth() + 1);
  end_date.setDate(end_date.getDate() - 1);

  const amount_str = await getMonthlyAmount(target_date);
  const message = amount_str
    ? `期間: ${toYMDString(target_date)}～${toYMDString(end_date)}\nAWS利用料: ${parseFloatAndFloor(amount_str)}$`
    : "AWS料金の取得に失敗しました😩";
  const postData = {
    type: "text",
    text: message,
  };

  try {
    await client.replyMessage(messageData.replyToken, postData);
  } catch (error) {
    console.log(error);
  }
};
