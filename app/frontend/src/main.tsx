import React from "react";
import ReactDOM from "react-dom/client";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {BrowserRouter,Route,Routes} from "react-router-dom";
import {ThemeProvider} from "./shared/theme/ThemeProvider";
import {AuthBootstrap} from "./features/auth/model/authStore";
import {AppLayout} from "./widgets/AppLayout";
import {MapPage} from "./pages/map/MapPage";
import {ModeratorPage} from "./pages/moderator/ModeratorPage";
import "./styles.css";

const client=new QueryClient({defaultOptions:{queries:{staleTime:30000,gcTime:300000,refetchOnWindowFocus:false,retry:1}}});
ReactDOM.createRoot(document.getElementById("root")!).render(
 <React.StrictMode><ThemeProvider><QueryClientProvider client={client}><BrowserRouter>
  <AuthBootstrap/>
  <Routes><Route element={<AppLayout/>}><Route path="/" element={<MapPage/>}/><Route path="/moderator" element={<ModeratorPage/>}/></Route></Routes>
 </BrowserRouter></QueryClientProvider></ThemeProvider></React.StrictMode>
);
