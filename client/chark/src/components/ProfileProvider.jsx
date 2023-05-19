import React, { useState, useEffect } from 'react';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'

import ProfileContext from '../context/ProfileContext';
import useCurrentUser from '../hooks/useCurrentUser';
import { getComm, getPersonal, getAddresses, getLang, getCurrency, getCountry } from '../services/profile';

import { languageMap } from '../utils/language';
import useSocket from '../hooks/useSocket';

const deviceLanguage =
  Platform.OS === 'ios'
    ? NativeModules.SettingsManager.settings.AppleLocale || NativeModules.SettingsManager.settings.AppleLanguages[0]
    : NativeModules.I18nManager.localeIdentifier;

const lang = `${languageMap[deviceLanguage]?.name ?? ''} (${deviceLanguage})`;

const ProfileProvider = ({ children }) => {
  const { user } = useCurrentUser();
  const user_ent = user?.curr_eid;
  const { wm } = useSocket();


  const [preferredLanguage, setPreferredLanguage] = useState({
    name: languageMap[deviceLanguage]?.name ?? '',
    code: languageMap[deviceLanguage]?.language,
  });

  const [preferredCurrency, setPreferredCurrency] = useState({
    name: '',
    code: '',
  });

  const [communications, setCommunications] = useState([]);
  const [personal, setPersonal] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [lang, setLang] = useState({});

  useEffect(() => {
    getPersonal(wm, user_ent).then(data => {
      setPersonal(data);
      return data;
    })
    .then((data) => getCountry(wm, data.country))
    .then(country => {
      if(!country) { 
        return;
      }

      getCurrency(wm, country.cur_code).then(currency  => {
        if(currency) {
          setPreferredCurrency({
            name: currency.cur_name,
            code: currency.cur_code,
          })
        }
      })
    })
    .catch(err => {
      // console.log("Country Exception", err);
    });
  }, [setPersonal])

  useEffect(() => {
    AsyncStorage.getItem('preferredLanguage').then((data) => {
      if (data) {
        try {
          const language = JSON.parse(data);
          setPreferredLanguage({
            name: language?.eng_name,
            code: language?.code,
          })
        } catch (err) {
          console.log('Error parsing language data', err)
        }
      }
    })
  }, [])

  useEffect(() => {
    AsyncStorage.getItem('preferredCurrency').then((data) => {
      if (data) {
        try {
          const currency = JSON.parse(data);
          setPreferredCurrency({
            name: currency?.cur_name,
            code: currency?.cur_code,
          })
        } catch (err) {
          console.log("Error parsing currecy data", err)
        }
      }
    })
  }, [])

  return (
    <ProfileContext.Provider value={{
      preferredCurrency,
      setPreferredCurrency,
      preferredLanguage,
      setPreferredLanguage,
      lang,
      setLang,
      communications,
      addresses,
      personal,
      setCommunications,
      setPersonal,
      setAddresses,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export default ProfileProvider;
