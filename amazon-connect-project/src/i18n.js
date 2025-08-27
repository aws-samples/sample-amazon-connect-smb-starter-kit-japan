// i18n.js

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          "common.app.loadingMessage": "Loading app...",
          "common.config.loadingMessage": "Loading configuration...",
          "common.header.loadingMessage": "Loading header...",
          "contact.info.loadingMessage": "Loading contact info...",
          "tab.outbound.loadingMessage": "Loading outbound tab...",
          "tab.attribute.loadingMessage": "Loading attributes tab...",
          "tab.history.loadingMessage": "Loading history tab..."
        }
      },
      ja: {
        translation: {
          "common.app.loadingMessage": "アプリを読み込んでいます...",
          "common.config.loadingMessage": "設定を読み込んでいます...",
          "common.header.loadingMessage": "ヘッダーを読み込んでいます...",
          "contact.info.loadingMessage": "コンタクト情報を読み込んでいます...",
          "tab.outbound.loadingMessage": "外線発信タブを読み込んでいます...",
          "tab.attribute.loadingMessage": "属性タブを読み込んでいます...",
          "tab.history.loadingMessage": "履歴タブを読み込んでいます..."
        }
      }
    },
    lng: "ja",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
