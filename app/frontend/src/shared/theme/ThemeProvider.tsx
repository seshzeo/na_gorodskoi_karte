import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";

export type ThemeMode = "system" | "light" | "dark";
type ThemeContextValue = {mode:ThemeMode;resolvedTheme:"light"|"dark";setMode:(mode:ThemeMode)=>void};
const ThemeContext=createContext<ThemeContextValue|null>(null);
function getInitialMode():ThemeMode { try { const value=localStorage.getItem("map-theme"); return value==="light"||value==="dark"||value==="system"?value:"system"; } catch { return "system"; } }
export function ThemeProvider({children}:{children:ReactNode}) {
 const [mode,setMode]=useState<ThemeMode>(getInitialMode);
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.("(prefers-color-scheme: dark)").matches??false);
 useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const update=(event:MediaQueryListEvent)=>setSystemDark(event.matches);media.addEventListener("change",update);return ()=>media.removeEventListener("change",update);},[]);
 const resolvedTheme=mode==="system"?(systemDark?"dark":"light"):mode;
 useEffect(()=>{document.documentElement.dataset.theme=resolvedTheme;document.documentElement.style.colorScheme=resolvedTheme;try{localStorage.setItem("map-theme",mode);}catch{/* storage can be unavailable */}},[mode,resolvedTheme]);
 const value=useMemo(()=>({mode,resolvedTheme,setMode}),[mode,resolvedTheme]);
 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error("useTheme must be used inside ThemeProvider");return value;}
