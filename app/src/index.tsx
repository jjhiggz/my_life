/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import AppShell from "./AppShell";
import Activities from "./pages/Activities";
import Food from "./pages/Food";
import Workouts from "./pages/Workouts";
import Plans from "./pages/Plans";
import ActivityDetail from "./pages/ActivityDetail";
import { initTelemetry } from "./lib/telemetry";
import "./App.css";

initTelemetry();

render(
  () => (
    <Router root={AppShell}>
      <Route path="/" component={() => null} />
      <Route path="/activities" component={Activities} />
      <Route path="/food" component={Food} />
      <Route path="/workouts" component={Workouts} />
      <Route path="/plans" component={Plans} />
      <Route path="/activity/:id" component={ActivityDetail} />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
