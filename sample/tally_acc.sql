--User 10000 signs tally in acceptance of terms

update mychips.tallies set request = 'open', user_sig = 'James signature' where tally_ent = 10000 and status = 'draft';

select user_cdi, part_cdi, tally_type, state from mychips.tallies_v;
