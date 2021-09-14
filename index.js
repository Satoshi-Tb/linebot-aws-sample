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


const parseFloatAndFloor = (str_val) => {
  return Math.floor(parseFloat(str_val) * 1000) / 1000;
};

const toYMDString = (dt) => {
  const mm = ('00' + (dt.getMonth()+1)).slice(-2);
  const dd = ('00' + dt.getDate()).slice(-2);
  return `${dt.getFullYear()}-${mm}-${dd}`;
};

// CostExplorer問い合わせ
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

// Lineレスポンス
const replyMessage = async (messageData, message) => {
  const postData = {
    type: "text",
    text: message,
  };

  try {
    await client.replyMessage(messageData.replyToken, postData);
  } catch (error) {
    console.log(error);
  }
}

// AWS Lambdaハンドラ
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

  if (messageData.type !== 'message') {
    console.log(`ハンドルできないメッセージタイプ: ${messageData.type}`);
    return;
  }

  const text = messageData.message.text
 
  let target_date = undefined;
  if (text === '料金') {
    target_date = new Date(); 
    target_date.setDate(1);
  } else if(/^[0-9]{4}[0-1][0-9]$/.test(text)){
    //yyyymm形式の場合
    const yyyymm = parseInt(text);
    const y = parseInt(text.substring(0, 4));
    const m = parseInt(text.substring(4));
    const today = new Date();
    const now_yyyymm = parseInt(today.getFullYear()) * 100 + parseInt(today.getMonth() + 1);

    if (m > 12　|| m == 0 || yyyymm > now_yyyymm || (now_yyyymm - 100) >= yyyymm) {
      await replyMessage(messageData, '年月は、現在から過去1年以内を指定してください😩');
      return;
    }

    target_date = new Date(y, m - 1, 1);
  } else {
    await replyMessage(messageData, '「料金」、または「年月（YYYYMM）」をつぶやいて下さい😌');
    return;
  }

  const end_date = new Date(target_date.getFullYear(), target_date.getMonth(), 1);
  end_date.setMonth(end_date.getMonth() + 1);
  end_date.setDate(end_date.getDate() - 1);

  const amount_str = await getMonthlyAmount(target_date);
  const message = amount_str
    ? `期間: ${toYMDString(target_date)}～${toYMDString(end_date)}\nAWS利用料: ${parseFloatAndFloor(amount_str)}$`
    : "AWS料金の取得に失敗しました😩";

  await replyMessage(messageData, message);
};
