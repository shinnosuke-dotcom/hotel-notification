const { TwitterApi } = require("twitter-api-v2");
const axios = require("axios");
require("dotenv").config();

// 環境変数から基本情報を取得
const { RAKUTEN_API_KEY, LINE_NOTIFY_TOKEN, HOTEL_ID, RAKUTEN_AFFILIATE_ID } =
  process.env;

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET_KEY,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// 実行日の次の日を取得
const getNextDay = () => {
  const today = new Date();
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 1);
  return nextDay.toISOString().split("T")[0];
};

// 開始日から3ヶ月後の日付を取得
const getThreeMonthsLater = (startDate) => {
  const start = new Date(startDate);
  const threeMonthsLater = new Date(start);
  threeMonthsLater.setMonth(start.getMonth() + 3);
  return threeMonthsLater.toISOString().split("T")[0];
};

const START_DATE = getNextDay();
const END_DATE = getThreeMonthsLater(START_DATE);

const getDatesInRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];

  while (start <= end) {
    const checkin = new Date(start);
    const checkout = new Date(start);
    checkout.setDate(checkin.getDate() + 1);
    dates.push({
      checkinDate: checkin.toISOString().split("T")[0],
      checkoutDate: checkout.toISOString().split("T")[0],
    });
    start.setDate(start.getDate() + 1);
  }

  return dates;
};

const dates = getDatesInRange(START_DATE, END_DATE);

const checkAvailability = async () => {
  const { checkinDate, checkoutDate } = dates.shift();

  try {
    const response = await axios.get(
      "https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426",
      {
        params: {
          applicationId: RAKUTEN_API_KEY,
          hotelNo: HOTEL_ID,
          checkinDate,
          checkoutDate,
        },
      }
    );

    const data = response.data;

    if (data.hotels && data.hotels.length > 0) {
      const hotelName = data.hotels[0].hotel[0].hotelBasicInfo.hotelName;
      const hotelURL =
        data.hotels[0].hotel[0].hotelBasicInfo.hotelInformationUrl;
      //  data.hotels[0].hotel[1].roomInfo[0].roomBasicInfo.reserveUrl;

      const message = `【空室情報】
トイストーリーホテルに空室があります！

チェックイン日: ${checkinDate} 
予約ページ: ${hotelURL}

#disney #トイストーリーホテル #pr`;

      await sendTwitterNotification(message);
      await sendLineNotification(message);
    }
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error(
        `エラーが発生しました (チェックイン: ${checkinDate}):`,
        error
      );
    }
  }

  if (dates.length > 0) {
    setTimeout(checkAvailability, 1000); // 1秒遅らせる
  }
};

const sendTwitterNotification = async (message) => {
  try {
    await twitterClient.v2.tweet(message);
  } catch (error) {
    console.error("tweet中にエラーが発生しました:", error);
  }
};

const sendLineNotification = async (message) => {
  try {
    await axios.post(
      "https://notify-api.line.me/api/notify",
      new URLSearchParams({ message }),
      {
        headers: {
          Authorization: `Bearer ${LINE_NOTIFY_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
  } catch (error) {
    console.error("LINE通知の送信中にエラーが発生しました:", error);
  }
};

// スクリプトの実行
checkAvailability();
