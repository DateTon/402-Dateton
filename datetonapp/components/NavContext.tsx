"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NavContextType = {
    navVisible: boolean;
    setNavVisible: (v: boolean) => void;
};

const NavContext = createContext<NavContextType>({
    navVisible: true,
    setNavVisible: () => {},
});

export function NavProvider({ children }: { children: ReactNode }) {
    const [navVisible, setNavVisible] = useState(true);
    return (
        <NavContext.Provider value={{ navVisible, setNavVisible }}>
            {children}
        </NavContext.Provider>
    );
}

export function useNav() {
    return useContext(NavContext);
}
