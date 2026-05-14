/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import AppShell from "./AppShell";
import Activities from "./pages/Activities";
import Calendar from "./pages/Calendar";
import Food from "./pages/Food";
import Workouts from "./pages/Workouts";
import Analytics from "./pages/Analytics";
import Journal from "./pages/Journal";
import Plans from "./pages/Plans";
import Settings from "./pages/Settings";
import ActivityDetail from "./pages/ActivityDetail";
import { initTelemetry } from "./lib/telemetry";
import { applySavedTheme } from "./lib/theme";
import "./App.css";

applySavedTheme();
initTelemetry();

render(
  () => (
    <Router root={AppShell}>
      <Route path="/" component={() => null} />
      <Route path="/activities" component={Activities} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/food" component={Food} />
      <Route path="/workouts" component={Workouts} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/journal" component={Journal} />
      <Route path="/settings" component={Settings} />
      <Route path="/plans" component={Plans} />
      <Route path="/activity/:id" component={ActivityDetail} />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
