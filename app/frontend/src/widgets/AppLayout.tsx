import {useState} from "react";
import {NavLink,Outlet} from "react-router-dom";
import {useTheme} from "../shared/theme/ThemeProvider";
export function AppLayout(){
 const [collapsed,setCollapsed]=useState(false);const [mobileOpen,setMobileOpen]=useState(false);const {mode,setMode}=useTheme();
 const nextTheme=mode==="system"?"light":mode==="light"?"dark":"system";const themeLabel=mode==="system"?"Авто":mode==="light"?"Светлая":"Тёмная";
 return <div className="app-shell"><header className="app-header">
  <button className="icon-button mobile-menu-button" aria-label="Открыть меню" onClick={()=>setMobileOpen(v=>!v)}>☰</button>
  <NavLink to="/" className="brand" onClick={()=>setMobileOpen(false)}><span className="brand-mark">⌖</span><span className="brand-copy"><strong>На городской карте</strong><small>Городские места и события</small></span></NavLink>
  <div className="header-actions"><button className="theme-button" onClick={()=>setMode(nextTheme)} title="Изменить тему"><span aria-hidden="true">{mode==="dark"?"☾":mode==="light"?"☀":"◐"}</span><span>{themeLabel}</span></button><NavLink to="/moderator" className="header-link">Модерация</NavLink></div>
 </header><div className="app-body"><div className={"sidebar-backdrop "+(mobileOpen?"visible":"")} onClick={()=>setMobileOpen(false)}/>
  <aside className={"app-sidebar "+(collapsed?"collapsed ":"")+(mobileOpen?"mobile-open":"")}><div className="sidebar-topline"><span className="eyebrow">Навигация</span><button className="icon-button collapse-button" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?"Развернуть меню":"Свернуть меню"}>{collapsed?"⇥":"⇤"}</button><button className="icon-button mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Закрыть меню">×</button></div>
   <nav className="sidebar-nav"><NavLink to="/" end className={({isActive})=>"sidebar-link "+(isActive?"active":"")} onClick={()=>setMobileOpen(false)}><span className="nav-icon">⌖</span><span className="nav-label">Карта</span></NavLink><NavLink to="/moderator" className={({isActive})=>"sidebar-link "+(isActive?"active":"")} onClick={()=>setMobileOpen(false)}><span className="nav-icon">▣</span><span className="nav-label">Кабинет модератора</span></NavLink></nav>
   <div className="sidebar-divider"/><div className="sidebar-foot"><span className="sidebar-foot-mark">●</span><span className="nav-label">Открытая городская карта</span></div>
  </aside><main className="app-main"><Outlet/></main></div></div>;
}
