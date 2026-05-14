import { createSignal } from "solid-js";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

const MODALITIES = ["bike", "run", "swim", "row", "hike", "walk", "other"];

export default function LogCardioDialog(props: {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [modality, setModality] = createSignal<string>("bike");
  const [title, setTitle] = createSignal("");
  const [duration, setDuration] = createSignal<number | undefined>(undefined);
  const [distanceMi, setDistanceMi] = createSignal<number | undefined>(
    undefined,
  );
  const [elevationFt, setElevationFt] = createSignal<number | undefined>(
    undefined,
  );
  const [avgHr, setAvgHr] = createSignal<number | undefined>(undefined);
  const [caloriesBurned, setCaloriesBurned] = createSignal<number | undefined>(undefined);
  const [notes, setNotes] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const reset = () => {
    setModality("bike");
    setTitle("");
    setDuration(undefined);
    setDistanceMi(undefined);
    setElevationFt(undefined);
    setAvgHr(undefined);
    setCaloriesBurned(undefined);
    setNotes("");
  };

  const submit = async () => {
    if (busy()) return;
    setBusy(true);
    try {
      await invoke("log_cardio_workout", {
        modality: modality(),
        title: title().trim() || null,
        durationMin: duration() ?? null,
        distanceM: distanceMi() ? distanceMi()! * 1609.344 : null,
        elevationM: elevationFt() ? elevationFt()! * 0.3048 : null,
        avgHr: avgHr() ?? null,
        caloriesBurned: caloriesBurned() ?? null,
        energyBefore: null,
        energyAfter: null,
        location: null,
        notes: notes().trim() || null,
      });
      props.onLogged();
      reset();
      props.onClose();
    } catch (e) {
      console.error("log cardio failed", e);
      alert(`Failed: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          props.onClose();
        }
      }}
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Log cardio workout</DialogTitle>
          <DialogDescription>
            Distance, time, and modality. Skip whatever you don't track.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="flex gap-2">
            <select
              value={modality()}
              onChange={(e) => setModality(e.currentTarget.value)}
              class="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MODALITIES.map((m) => (
                <option value={m}>{m}</option>
              ))}
            </select>
            <Input
              placeholder="Title (optional)"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              class="flex-1"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Distance (mi)"
              value={distanceMi() ?? ""}
              onInput={(e) =>
                setDistanceMi(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            />
            <Input
              type="number"
              placeholder="Duration (min)"
              value={duration() ?? ""}
              onInput={(e) =>
                setDuration(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            />
            <Input
              type="number"
              placeholder="Elevation (ft)"
              value={elevationFt() ?? ""}
              onInput={(e) =>
                setElevationFt(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            />
            <Input
              type="number"
              placeholder="Avg HR"
              value={avgHr() ?? ""}
              onInput={(e) =>
                setAvgHr(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            />
            <Input
              type="number"
              placeholder="Calories"
              value={caloriesBurned() ?? ""}
              onInput={(e) =>
                setCaloriesBurned(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            />
          </div>
          <Input
            placeholder="Notes (optional)"
            value={notes()}
            onInput={(e) => setNotes(e.currentTarget.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
