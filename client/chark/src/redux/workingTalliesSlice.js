import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { fetchTallies } from '../services/tally';

const initialState = {
  fetching: false,
  tallies: [],
};

export const fetchTemplates = createAsyncThunk('workingTallies/fetchTemplates', async (args) => {
  try {
    const fields = [
      'tally_ent',
      'tally_seq',
      'contract',
      'comment',
      'tally_uuid',
      'hold_terms',
      'part_terms',
      'tally_type',
      'status',
      'part_cid',
      'part_cert',
      'hold_cert',
    ];
    console.log(args.entry, 'args entry')

    const data = await fetchTallies(args.wm, {
      fields,
      where: { left: "status", oper: "in", entry: args.entry },
      order: {
        field: 'crt_date',
        asc: false,
      }
    })

    return data?.map(el => ({
      tally_uuid: el.tally_uuid,
      tally_ent: el.tally_ent,
      id: el.tally_seq,
      contract: el.contract,
      comment: el.comment,
      hold_terms: el.hold_terms,
      part_terms: el.part_terms,
      tally_type: el.tally_type,
      status: el.status,
      part_cid: el.part_cid,
      part_cert: el.part_cert,
      hold_cert: el.hold_cert,
    }));

  } catch(err) {
    console.log(err, 'err err err')
    throw err;
  }

})


export const workingTalliesSlice = createSlice({
  name: 'workingTallies',
  initialState: initialState,
  reducers: {
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state, action) => {
        state.fetching = true;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.tallies = action.payload;
        state.fetching = false;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.fetching = false;
      })
  },
});

export default workingTalliesSlice.reducer;