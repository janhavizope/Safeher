import { EventEmitter } from "node:events";

export type IncidentEventType = "submitted" | "status-updated" | "details-updated";

export type IncidentEventPayload = {
  type: IncidentEventType;
  incidentId: number;
  status?: string;
};

class IncidentEventBus extends EventEmitter {
  broadcast(payload: IncidentEventPayload) {
    this.emit("incident-update", payload);
  }
}

export const incidentEvents = new IncidentEventBus();
incidentEvents.setMaxListeners(0);

export function broadcastIncidentEvent(payload: IncidentEventPayload) {
  incidentEvents.broadcast(payload);
}