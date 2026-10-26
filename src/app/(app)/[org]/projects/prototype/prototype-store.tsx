"use client";

import { createContext, use, useReducer, useState } from "react";
import {
  createPrototypeState,
  prototypeStateReducer,
  type PrototypeState,
  type PrototypeStateAction,
} from "./prototype-model";

type Store = {
  state: PrototypeState;
  dispatch: (action: PrototypeStateAction) => void;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);

/**
 * Demo state shared by the prototype's pages (projects and all materials).
 * It lives in the prototype layout, so it survives moving between them,
 * and resets on reload. Nothing is stored.
 */
export function PrototypeStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(prototypeStateReducer, undefined, createPrototypeState);
  const [activeProjectId, setActiveProjectId] = useState(state.projects[0].id);
  return (
    <StoreContext value={{ state, dispatch, activeProjectId, setActiveProjectId }}>{children}</StoreContext>
  );
}

export function usePrototypeStore(): Store {
  const store = use(StoreContext);
  if (!store) throw new Error("usePrototypeStore must be used inside PrototypeStoreProvider");
  return store;
}
