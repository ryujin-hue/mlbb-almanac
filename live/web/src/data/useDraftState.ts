/**
 * Keadaan draf dalam URL.
 *
 * Setiap draf boleh dikongsi: pautan "Draft" yang dihantar kepada
 * rakan membawa blue picks, red picks, bans, dan hero yang sedang
 * dipilih. Kalau keadaan tinggal dalam React sahaja, pautan itu tidak
 * bermakna.
 */
import { useCallback, useMemo } from 'react';

import { navigate, useSearch } from '../router';
import { emptyDraft, type DraftState, type DraftTeam } from '../lib/draft';

const PARAM: Record<string, 'bans' | 'picks'> = {
  bb: 'bans',
  rb: 'bans',
  bp: 'picks',
  rp: 'picks',
};

/**
 * Pemisah senarai ialah `~`, bukan `,`.
 *
 * `URLSearchParams.get()` pun sudah decode nilai, jadi pemisah `,` akan
 * memecahkan nama yang mengandungi koma ("miya, layla" -> dua entri).
 * `~` tidak di-encode oleh encodeURIComponent, jadi ia selamat.
 */
const LIST_SEPARATOR = '~';

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(LIST_SEPARATOR)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Baca keadaan draf daripada query string semasa. */
export function parseDraftState(search: string): DraftState {
  const params = new URLSearchParams(search);
  const state = emptyDraft();

  for (const [param, slot] of Object.entries(PARAM)) {
    const values = splitList(params.get(param));
    if (slot === 'bans') {
      state.bans.blue = param === 'bb' ? values : state.bans.blue;
      state.bans.red = param === 'rb' ? values : state.bans.red;
    } else {
      state.picks.blue = param === 'bp' ? values : state.picks.blue;
      state.picks.red = param === 'rp' ? values : state.picks.red;
    }
  }

  state.selected = params.get('sel');

  return state;
}

/** Tulis keadaan draf ke query string (ganti, bukan tambah sejarah). */
export function writeDraftState(state: DraftState, search: string): string {
  const params = new URLSearchParams(search);

  const set = (key: string, values: string[]) => {
    if (values.length === 0) params.delete(key);
    else params.set(key, values.map((value) => encodeURIComponent(value)).join(LIST_SEPARATOR));
  };

  set('bb', state.bans.blue);
  set('rb', state.bans.red);
  set('bp', state.picks.blue);
  set('rp', state.picks.red);

  if (state.selected) params.set('sel', state.selected);
  else params.delete('sel');

  const query = params.toString();
  return `/draft${query ? `?${query}` : ''}`;
}

/** Hook: keadaan draf + fungsi kemas kini (URL sebagai sumber kebenaran). */
export function useDraftState(): [DraftState, (next: DraftState) => void] {
  const search = useSearch();
  const state = useMemo(() => parseDraftState(search), [search]);

  const write = useCallback(
    (next: DraftState) => {
      navigate(writeDraftState(next, search), { replace: true });
    },
    [search]
  );

  return [state, write];
}

/** Label ringkas untuk satu pasukan - guna dalam UI. */
export function teamKey(team: DraftTeam): string {
  return team === 'blue' ? 'biru' : 'merah';
}
