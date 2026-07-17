"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type Group } from "./api";

type Ctx = {
  groups: Group[];
  gid: string | null;
  setGid: (gid: string) => void;
  groupName: string;
  error: string | null;
};

const GroupContext = createContext<Ctx>({
  groups: [],
  gid: null,
  setGid: () => {},
  groupName: "",
  error: null,
});

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [gid, setGidState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .groups()
      .then((gs) => {
        setGroups(gs);
        const stored = localStorage.getItem("ergos-analytics-gid");
        const initial = gs.find((g) => g.id === stored)?.id ?? gs[0]?.id ?? null;
        setGidState(initial);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const setGid = (id: string) => {
    localStorage.setItem("ergos-analytics-gid", id);
    setGidState(id);
  };

  const groupName = groups.find((g) => g.id === gid)?.name ?? "";

  return (
    <GroupContext.Provider value={{ groups, gid, setGid, groupName, error }}>
      {children}
    </GroupContext.Provider>
  );
}

export const useGroup = () => useContext(GroupContext);
