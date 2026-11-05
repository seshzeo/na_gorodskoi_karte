import React from "react";
import ReactDOM from "react-dom/client";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {BrowserRouter,Routes,Route} from "react-router-dom";
import {MapPage} from "./pages/map/MapPage";
import {ModeratorPage} from "./pages/moderator/ModeratorPage";
import "./styles.css";
const client=new QueryClient({defaultOptions:{queries:{staleTime:30000,gcTime:300000,refetchOnWindowFocus:false,retry:1}}});
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={client}><BrowserRouter><Routes><Route path="/" element={<MapPage/>}/><Route path="/moderator" element={<ModeratorPage/>}/></Routes></BrowserRouter></QueryClientProvider></React.StrictMode>);