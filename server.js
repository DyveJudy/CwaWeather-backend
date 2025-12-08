require("dotenv").config();
const express = require("express");
const cors = require("cors");// 引入 cors 模組
const axios = require("axios");

const app = express();

// 新增設定 CORS：允許來自您的 GitHub Pages 網域的請求
// 請確保這個網域 'https://dyvejudy.github.io' 是準確的
const corsOptions = {
  origin: 'https://dyvejudy.github.io', // ⬅️ 必須是您的前端網域
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // 允許帶有 Cookie/Header 等憑證
  optionsSuccessStatus: 204
}
// END CORS 設定

const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
// ⚠️ 將原來的 app.use(cors()); 替換成下方的設定
app.use(cors(corsOptions)); // ⬅️ 啟用帶有您網域的 CORS 設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取德城市天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
const getWeatherByCity = async (req, res) => {
  try {
    // 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 呼叫 CWA API - 一般天氣預報（36小時）
    // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName:req.params.cityName,
        },
      }
    );

    // 取得城市天氣資料
    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得城市天氣資料",
      });
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    // 解析天氣要素
    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = value.parameterName;
            break;
          case "PoP":
            forecast.rain = value.parameterName + "%";
            break;
          case "MinT":
            forecast.minTemp = value.parameterName + "°C";
            break;
          case "MaxT":
            forecast.maxTemp = value.parameterName + "°C";
            break;
          case "CI":
            forecast.comfort = value.parameterName;
            break;
          case "WS":
            forecast.windSpeed = value.parameterName;
            break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      kaohsiung: "/api/weather/臺北市",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/api/weather/", (req, res) => {
    res.status(400).json({ // 使用 400 Bad Request 更合適
        error: "缺少城市名稱",
        message: "請在網址後方加上城市名稱，例如: /api/weather/臺北市",
        example: "https://cwaweather-test.zeabur.app/api/weather/臺北市"
    });
});

// 取得城市氣預報
app.get("/api/weather/:cityName", getWeatherByCity);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});
app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`);
});  