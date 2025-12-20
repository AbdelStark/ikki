import { derived, writable } from "svelte/store";

interface PreferencesState {
  hideAmounts: boolean;
}

const initialState: PreferencesState = {
  hideAmounts: false,
};

function createPreferencesStore() {
  const { subscribe, update, set } = writable<PreferencesState>(initialState);

  return {
    subscribe,
    toggleHideAmounts: () =>
      update((state) => ({
        ...state,
        hideAmounts: !state.hideAmounts,
      })),
    setHideAmounts: (hide: boolean) =>
      update((state) => ({
        ...state,
        hideAmounts: hide,
      })),
    reset: () => set(initialState),
  };
}

export const preferences = createPreferencesStore();
export const hideAmounts = derived(preferences, ($preferences) => $preferences.hideAmounts);
