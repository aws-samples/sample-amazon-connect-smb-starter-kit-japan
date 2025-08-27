import { useTranslation } from 'react-i18next';
import './i18n';
import React, { useState, useEffect, Suspense } from 'react';
import { AmazonConnectApp, AppContactScope } from "@amazon-connect/app";
import { AgentClient, AgentStateChangedEventData, ContactClient } from "@amazon-connect/contact";
import { VoiceClient } from "@amazon-connect/voice";
import { applyConnectTheme } from "@amazon-connect/theme";
import { loadConfig } from './config';

// Cloudscapeコンポーネントを遅延ロード
const Container = React.lazy(() => import("@cloudscape-design/components/container"));
const Header = React.lazy(() => import("@cloudscape-design/components/header"));
const Tabs = React.lazy(() => import("@cloudscape-design/components/tabs"));
const SpaceBetween = React.lazy(() => import("@cloudscape-design/components/space-between"));
const FormField = React.lazy(() => import("@cloudscape-design/components/form-field"));
const Input = React.lazy(() => import("@cloudscape-design/components/input"));
const Select = React.lazy(() => import("@cloudscape-design/components/select"));
const Button = React.lazy(() => import("@cloudscape-design/components/button"));
const Box = React.lazy(() => import("@cloudscape-design/components/box"));
const StatusIndicator = React.lazy(() => import("@cloudscape-design/components/status-indicator"));
const Alert = React.lazy(() => import("@cloudscape-design/components/alert"));
const ColumnLayout = React.lazy(() => import("@cloudscape-design/components/column-layout"));

import '@cloudscape-design/global-styles/index.css';
import './App.css';

// グローバル変数としてVoiceClientを保持
let voiceClientInstance = null;

// 追加: initializeAppState用のグローバル変数
let initializeAppState;

// グローバルで初期化
const connectApp = AmazonConnectApp.init({
  onCreate: async (event) => {
    const { appInstanceId } = event.context;
    console.log('App initialized: ', appInstanceId);
    voiceClientInstance = new VoiceClient();
    applyConnectTheme();

    // 追加: アプリ作成時に初期化処理を行う
    if (initializeAppState) {
      await initializeAppState();
    }
  },
  onDestroy: (event) => {
    console.log('App being destroyed');
  },
});

// クライアントのインスタンス化
const agentClient = new AgentClient();
const contactClient = new ContactClient();

function App() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');
  const [agentInfo, setAgentInfo] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('outbound');
  const [outboundNumber, setOutboundNumber] = useState('');
  const [outboundStatus, setOutboundStatus] = useState('');
  const [selectedQueueARN, setSelectedQueueARN] = useState('');
  const [availableQueues, setAvailableQueues] = useState([]);
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumberWithoutCode, setPhoneNumberWithoutCode] = useState('');
  const [contactAttributes, setContactAttributes] = useState({});
  const [hasActiveContact, setHasActiveContact] = useState(false);

  const getQueueDisplayName = (queueName) => {
    if (!config?.queueDisplayNames || typeof queueName !== 'string') {
      return null;
    }
    return config.queueDisplayNames[queueName] || queueName;
  };

  const formatPhoneNumber = (countryCode, phoneNumber) => {
    if (countryCode === '+81' && phoneNumber.startsWith('0')) {
      return `${countryCode}${phoneNumber.substring(1)}`;
    }
    return `${countryCode}${phoneNumber}`;
  };

  // 修正: fetchContactData関数
  async function fetchContactData() {
    try {
      const initialContactId = await contactClient.getInitialContactId(AppContactScope.CurrentContactId);
      console.log('Initial Contact ID:', initialContactId);

      if (!initialContactId) {
        setContactInfo({
          id: '-',
          channelType: 'No active contact',
          phoneNumber: '-',
          queueName: '-',
          timestamp: new Date().toLocaleString()
        });
        return;
      }

      const type = await contactClient.getType(AppContactScope.CurrentContactId);
      console.log('Contact type:', type);

      let phoneNumber = 'N/A';
      let queueName = 'N/A';

      try {
        if (type === 'voice' && voiceClientInstance) {
          const voicePhoneNumber = await voiceClientInstance.getPhoneNumber(AppContactScope.CurrentContactId);
          console.log('Voice phone number:', voicePhoneNumber);
          phoneNumber = voicePhoneNumber || 'N/A';

          try {
            const queueDetails = await contactClient.getQueue(AppContactScope.CurrentContactId);
            console.log('Queue details:', queueDetails);
            queueName = queueDetails?.name || 'N/A';
          } catch (queueError) {
            console.error('Error fetching queue:', queueError);
          }
        }
      } catch (voiceError) {
        console.error('Error fetching voice phone number:', voiceError);
      }

      if (phoneNumber === 'N/A') {
        try {
          const phoneAttr = await contactClient.getAttribute(
            AppContactScope.CurrentContactId,
            'CustomerEndpoint'
          );
          if (phoneAttr?.value) phoneNumber = phoneAttr.value;
        } catch (attrError) {
          console.error('Error fetching contact attributes:', attrError);
        }
      }

      setContactInfo({
        id: initialContactId,
        channelType: type || 'No active contact',
        phoneNumber: phoneNumber,
        queueName: queueName,
        timestamp: new Date().toLocaleString()
      });

    } catch (error) {
      console.error('Error fetching contact data:', error);
      setContactInfo({
        id: '-',
        channelType: 'No active contact',
        phoneNumber: '-',
        queueName: '-',
        timestamp: new Date().toLocaleString()
      });
    }
  }

  // 修正: fetchContactAttributes関数
  const fetchContactAttributes = async () => {
    try {
      const initialContactId = await contactClient.getInitialContactId(AppContactScope.CurrentContactId);
      
      if (!initialContactId) {
        setContactAttributes({});
        setHasActiveContact(false);
        return;
      }

      const type = await contactClient.getType(AppContactScope.CurrentContactId);
      
      if (type === 'voice') {
        const attributeKeys = Array.from(
          { length: config.maxContactAttributes }, 
          (_, i) => `Key${i + 1}`
        );
        const attributes = await contactClient.getAttributes(
          AppContactScope.CurrentContactId,
          attributeKeys
        );
        console.log('Fetched contact attributes:', attributes);
        setContactAttributes(attributes || {});
        setHasActiveContact(true);
      } else {
        setContactAttributes({});
        setHasActiveContact(false);
      }
    } catch (error) {
      console.error('Error fetching contact attributes:', error);
      setContactAttributes({});
      setHasActiveContact(false);
    }
  };

  async function fetchAgentData() {
    try {
      const arn = await agentClient.getARN();
      const currentState = await agentClient.getState();
      const agentName = await agentClient.getName();
      const routingProfile = await agentClient.getRoutingProfile();

      console.log('Agent data:', {
        currentState,
        agentName,
        routingProfile
      });

      setStatus('Connected');
      setAgentInfo(prevInfo => ({
        agentARN: arn,
        agentId: arn ? arn.split('/').pop() : '-',
        agentName: agentName || '-',
        currentState: currentState.state?.name || currentState.state?.type || 'Unknown',
        routingProfile: routingProfile,
        timestamp: new Date().toLocaleString()
      }));

    } catch (error) {
      console.error('Error fetching agent data:', error);
      setStatus('Error processing agent info');
    }
  }

  // 追加: initializeAppState関数の定義
  initializeAppState = async () => {
    try {
      const initialContactId = await contactClient.getInitialContactId(AppContactScope.CurrentContactId);
      const status = await agentClient.getState();
      console.log('Initializing app state, initial contact ID:', initialContactId);

      if (initialContactId) {
        const type = await contactClient.getType(AppContactScope.CurrentContactId);
        console.log('Current contact type:', type);
        
        if (type === 'voice') {
          await fetchContactData();
          await fetchContactAttributes();
          setHasActiveContact(true);

          // ステータスに応じてメッセージを変更するが、コンタクト情報は維持
          if (status.name === 'AfterCallWork') {
            setOutboundStatus('アフターコールワークを終了してください');
          } else {
            setOutboundStatus('通話中');
          }
        }

      } else {
        setContactInfo({
          id: '-',
          channelType: 'No active contact',
          phoneNumber: '-',
          queueName: '-',
          timestamp: new Date().toLocaleString()
        });
        setContactAttributes({});
        setHasActiveContact(false);
        setOutboundStatus('');
      }
    } catch (error) {
      console.error('Error initializing app state:', error);
      setContactInfo({
        id: '-',
        channelType: 'No active contact',
        phoneNumber: '-',
        queueName: '-',
        timestamp: new Date().toLocaleString()
      });
      setContactAttributes({});
      setHasActiveContact(false);
      setOutboundStatus('');
    }
  };

  const handleOutboundCall = async () => {
    if (!voiceClientInstance) {
      setOutboundStatus('システムの初期化中です。しばらくお待ちください。');
      return;
    }

    if (!phoneNumberWithoutCode) {
      setOutboundStatus('電話番号を入力してください');
      return;
    }

    if (!selectedQueueARN) {
      setOutboundStatus('発信キューを選択してください');
      return;
    }

    const formattedNumber = formatPhoneNumber(countryCode, phoneNumberWithoutCode);

    const phoneNumberPattern = /^\+[1-9]\d{1,14}$/;
    if (!phoneNumberPattern.test(formattedNumber)) {
      setOutboundStatus('電話番号が正しい形式ではありません');
      return;
    }

    try {
      const permission = await voiceClientInstance.getOutboundCallPermission();
      if (permission === false) {
        setOutboundStatus('発信できません: 発信権限がありません');
        return;
      }
      if (status.name === 'Busy') {
        setOutboundStatus('通話中');
      } else {
        setOutboundStatus('');
      }

      console.log('Making outbound call to:', formattedNumber);
      const outboundCallResult = await voiceClientInstance.createOutboundCall(formattedNumber, {
        queueARN: selectedQueueARN
      });
      setPhoneNumberWithoutCode('');
    } catch (error) {
      console.error('Outbound call error:', error);
      if (error.message.includes('requestNotAuthorized')) {
        setOutboundStatus('発信権限エラー: アプリケーション統合で Contact.Details.Edit 権限を有効にしてください。');
      } else {
        setOutboundStatus(`発信エラー: ${error.message}`);
      }
    }
  };

  const stateChangeHandler = async (data) => {
    try {
      const currentState = await agentClient.getState();
      setAgentInfo(prevInfo => ({
        ...prevInfo,
        currentState: currentState.state?.name || 'Unknown',
        timestamp: new Date().toLocaleString()
      }));
    } catch (error) {
      console.error('State change error:', error);
    }
  };

  useEffect(() => {
    loadConfig()
      .then(configData => {
        console.log('Config loaded:', configData);
        setConfig(configData);
        setCountryCode(configData.countryCode[0]?.value || '+81');
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load config:', error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!config) return;

    const initialize = async () => {
      await initializeAppState();
      await fetchAgentData();
    };

    initialize();

    const agentSubscription = agentClient.onStateChanged(stateChangeHandler);

    const contactHandler = async () => {
      await fetchContactData();
      await fetchAgentData();
    };

    const onConnectedHandler = async () => {
      await contactHandler();
      await fetchContactAttributes();
      setOutboundStatus('通話中');
    };

    const onDestroyedHandler = async () => {
      await contactHandler();
      setContactAttributes({});
      setHasActiveContact(false);
      setOutboundStatus('');
    };

    const onStartingAcwHandler = async () => {
      await contactHandler();
      setOutboundStatus('アフターコールワークを終了してください');
    };

    contactClient.onConnected(onConnectedHandler);
    contactClient.onStartingAcw(onStartingAcwHandler);
    contactClient.onDestroyed(onDestroyedHandler);

    return () => {
      if (agentSubscription?.unsubscribe) {
        agentSubscription.unsubscribe();
      }
    };
  }, [config]);

  useEffect(() => {
    if (agentInfo?.routingProfile?.queues) {
      setAvailableQueues(agentInfo.routingProfile.queues.filter(queue => queue.name));
      if (agentInfo.routingProfile.queues.length > 0) {
        setSelectedQueueARN(agentInfo.routingProfile.queues[0].queueARN);
      }
    }
  }, [agentInfo]);

  if (loading || !config) {
    return <div>{t('common.config.loadingMessage')}</div>;
  }

  const renderHeader = () => (
    <Suspense fallback={<div>{t('common.header.loadingMessage')}</div>}>
      <Header
        variant="h1"
        description={`Status: ${status} | Version: ${config?.version || 'N/A'}`}
      >
      </Header>
    </Suspense>
  );

  const renderContactInfo = () => (
    <Suspense fallback={<div>{t('contact.info.loadingMessage')}</div>}>
      <ColumnLayout columns={2} variant="text-grid">
        <div>
          <Box variant="awsui-key-label">
            <Box fontWeight="bold">コンタクトID</Box>
          </Box>
          <Box variant="p">{contactInfo?.id || '-'}</Box>
        </div>
        <div>
          <Box variant="awsui-key-label">
            <Box fontWeight="bold">キュー名</Box>
          </Box>
          <Box variant="p">{contactInfo?.queueName || '-'}</Box>
        </div>
        <div>
          <Box variant="awsui-key-label">
            <Box fontWeight="bold">電話番号</Box>
          </Box>
          <Box variant="p">{contactInfo?.phoneNumber || '-'}</Box>
        </div>
        <div>
          <Box variant="awsui-key-label">
            <Box fontWeight="bold">更新日時</Box>
          </Box>
          <Box variant="p">{contactInfo?.timestamp || '-'}</Box>
        </div>
      </ColumnLayout>
    </Suspense>
  );

  const renderOutboundTab = () => {
    const countryOptions = config ? Object.entries(config.countryCode).map(([label, value]) => ({
      label,
      value
    })) : [];

    return (
      <Suspense fallback={<div>{t('tab.outbound.loadingMessage')}</div>}>
        <Container>
          <SpaceBetween size="l">
            <FormField label="発信キュー(発信者ID番号)">
              <Select
                selectedOption={
                  availableQueues.find(q => q.queueARN === selectedQueueARN)
                    ? {
                        label: (() => {
                          const queue = availableQueues.find(q => q.queueARN === selectedQueueARN);
                          const displayNumber = getQueueDisplayName(queue?.name);
                          return displayNumber 
                            ? `${queue.name} (${displayNumber})`
                            : queue.name;
                        })(),
                        value: selectedQueueARN
                      }
                    : null
                }
                onChange={({ detail }) => setSelectedQueueARN(detail.selectedOption.value)}
                options={availableQueues.map(queue => ({
                  label: getQueueDisplayName(queue.name)
                    ? `${queue.name} (${getQueueDisplayName(queue.name)})`
                    : queue.name,
                  value: queue.queueARN
                }))}
              />
            </FormField>

            <FormField label="発信先電話番号">
              <div className="phone-number-container">
                <Select
                  selectedOption={countryOptions.find(option => option.value === countryCode)}
                  onChange={({ detail }) => setCountryCode(detail.selectedOption.value)}
                  options={countryOptions}
                  className="country-code-select"
                />
                <Input
                  value={phoneNumberWithoutCode}
                  onChange={({ detail }) => setPhoneNumberWithoutCode(detail.value)}
                  placeholder="電話番号を入力してください"
                  className="phone-number-input"
                />
                <Button
                  variant="primary"
                  onClick={handleOutboundCall}
                  disabled={!phoneNumberWithoutCode || !selectedQueueARN || !voiceClientInstance}
                >
                  発信
                </Button>
              </div>
            </FormField>

            {outboundStatus && (
              <Alert type={outboundStatus.includes('エラー') ? 'error' : 'success'}>
                {outboundStatus}
              </Alert>
            )}
          </SpaceBetween>
        </Container>
      </Suspense>
    );
  };

 const renderContactAttribute = (key) => {
  const allowedKeys = Object.keys(config?.contactAttributes || {});
  if (!allowedKeys.includes(key)) {
    return null;
  }
  
  return (
    <div key={key}>
      <Box variant="awsui-key-label">
        <Box fontWeight="bold">{config?.contactAttributes[key]}</Box>
      </Box>
      <Box variant="p">
        {contactAttributes[key]?.value || '-'}
      </Box>
    </div>
  );
};

 const renderAttributesTab = () => (
  <Suspense fallback={<div>{t('tab.attribute.loadingMessage')}</div>}>
    <Container>
      {hasActiveContact && config ? (
        <SpaceBetween size="l">
          <ColumnLayout columns={2} variant="text-grid">
            {Object.keys(config?.contactAttributes || {}).map(renderContactAttribute)}
          </ColumnLayout>
        </SpaceBetween>
      ) : (
        <Alert type="info">
          通話が確立されると、コンタクト属性が表示されます。
        </Alert>
      )}
    </Container>
  </Suspense>
);

  return (
    <Suspense fallback={<div>{t('common.app.loadingMessage')}</div>}>
      <div className="app">
        <SpaceBetween size="l">
          {renderHeader()}
          {renderContactInfo()}
          
          <Tabs
            tabs={[
              {
                label: "外線発信",
                id: "outbound",
                content: renderOutboundTab()
              },
              {
                label: "自分の通話履歴",
                id: "history",
                content: (
                  <Suspense fallback={<div>{t('tab.history.loadingMessage')}</div>}>
                    <Container>
                      <Button
                        onClick={() => window.open(config?.contactSearchUrl || '#', '_blank')}
                      >
                        通話履歴を開く
                      </Button>
                    </Container>
                  </Suspense>
                )
              },
              {
                label: "コンタクト属性",
                id: "attributes",
                content: renderAttributesTab()
              }
            ]}
            activeTabId={activeTab}
            onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          />
        </SpaceBetween>
      </div>
    </Suspense>
  );
}

export default App;


