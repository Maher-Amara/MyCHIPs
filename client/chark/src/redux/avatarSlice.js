import { Buffer } from 'buffer';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage'

import { localStorage } from '../config/constants';
import { fetchTallyFile } from '../services/tally';

const initialState = {
  imagesByDigest: {}, // { [digest]: string }
};

/**
  * @param {Object} - args
  * @param {tally} - args.tally
  */
export const fetchImagesByDigest = createAsyncThunk('openTallies/fetchImagesByDigest', async (args, { getState }) => {
  const state = getState();
  let tallies = [];
  const imagesByDigestState = state.avatar?.imagesByDigest ?? {};

  if(args.status === 'open') {
    tallies = state.openTallies;
  } else if(args.status === 'working') {
    tallies = state.workingTallies;
  }

  const hashes = tallies.hashes ?? [];
  const promises = [];

  let _imagesByDigest = {};
  try {
    const storageValue = await AsyncStorage.getItem(localStorage.TallyPictures);
    _imagesByDigest = JSON.parse(storageValue ?? {});
  } catch(err) {
    _imagesByDigest = {};
  }

  for(let hash of hashes) {
    if(hash.digest in _imagesByDigest || imagesByDigestState[hash.digest]) {
      continue;
    }

    promises.push(fetchTallyFile(args.wm, hash.digest, hash.tally_seq));
  }

  try {
    const files = await Promise.all(promises);

    for(let file of files) {
      const fileData = file?.[0]?.file_data;
      const file_fmt = file?.[0]?.file_fmt;
      const digest = file?.[0]?.digest;

      console.log(digest, 'file')

      if(fileData) {
        const base64 = Buffer.from(fileData).toString('base64')
        const image = `data:${file_fmt};base64,${base64}`;
        _imagesByDigest[digest] = image;
      }
    }

    await AsyncStorage.setItem(localStorage.TallyPictures, JSON.stringify(_imagesByDigest));

    return {
      ...imagesByDigestState,
      ..._imagesByDigest,
    }
  } catch(err) {
    console.log(err, 'errrkjaskdjf')
    throw err;
  }
})

export const avatarSlice = createSlice({
  name: 'avatar',
  initialState: initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchImagesByDigest.fulfilled, (state, action) => {
        state.imagesByDigest = action.payload ?? {};
      })
  },
});

export default avatarSlice.reducer;