require('dotenv').config();
const axios = require('axios');

// 環境変数から基本情報を取得
const {
  RAKUTEN_API_KEY,
  LINE_NOTIFY_TOKEN,
  HOTEL_ID,
} = process.env;

// 実行日の次の日を取得
const getNextDay = () => {
  const today = new Date();
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 1);
  return nextDay.toISOString().split('T')[0];
};

// 開始日から3ヶ月後の日付を取得
const getThreeMonthsLater = (startDate) => {
  const start = new Date(startDate);
  const threeMonthsLater = new Date(start);
  threeMonthsLater.setMonth(start.getMonth() + 3);
  return threeMonthsLater.toISOString().split('T')[0];
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
      checkinDate: checkin.toISOString().split('T')[0],
      checkoutDate: checkout.toISOString().split('T')[0]
    });
    start.setDate(start.getDate() + 1);
  }

  return dates;
};

const dates = getDatesInRange(START_DATE, END_DATE);

const checkAvailability = async () => {
  const { checkinDate, checkoutDate } = dates.shift();

  try {
    const response = await axios.get('https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426', {
      params: {
        applicationId: RAKUTEN_API_KEY,
        hotelNo: HOTEL_ID,
        checkinDate,
        checkoutDate,
      }
    });

    const data = response.data;

    if (data.hotels && data.hotels.length > 0) {
      const hotelName = data.hotels[0].hotel[0].hotelBasicInfo.hotelName;
      await sendLineNotification(`空室があります！ホテル名: ${hotelName} チェックイン: ${checkinDate}`);
    }
  } catch (error) {
    if(error?.response?.status!==404){
    console.error(`エラーが発生しました (チェックイン: ${checkinDate}):`, error);
    }
  }

  if (dates.length > 0) {
    setTimeout(checkAvailability, 1000); // 1秒遅らせる
  }
};

const sendLineNotification = async (message) => {
  try {
    await axios.post('https://notify-api.line.me/api/notify',
      new URLSearchParams({ message }),
      {
        headers: {
          Authorization: `Bearer ${LINE_NOTIFY_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
  } catch (error) {
    console.error('LINE通知の送信中にエラーが発生しました:', error);
  }
};

// スクリプトの実行
checkAvailability();
