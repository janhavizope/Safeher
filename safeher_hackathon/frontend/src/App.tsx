import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmergencyFab } from "./components/EmergencyFab";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Report from "./pages/Report";
import MapViewer from "./pages/MapViewer";
import Admin from "./pages/Admin";
import TrackReport from "./pages/TrackReport";
import SafeRoute from "./pages/SafeRoute";
import { SafetySentinelProvider } from "./contexts/SafetySentinel";
import Community from "./pages/Community";
import SafeWalk from "./pages/SafeWalk";
import PublicTrack from "./pages/PublicTrack";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/report" component={Report} />
      <Route path="/map" component={MapViewer} />
      <Route path="/track" component={TrackReport} />
      <Route path="/admin" component={Admin} />
      <Route path="/route" component={SafeRoute} />
      <Route path="/community" component={Community} />
      <Route path="/safewalk" component={SafeWalk} />
      <Route path="/track/:token" component={PublicTrack} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
          <SafetySentinelProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <EmergencyFab />
            </TooltipProvider>
          </SafetySentinelProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
