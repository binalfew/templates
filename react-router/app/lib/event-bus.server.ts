// Re-export event bus for use with ~/lib/ alias in app services
export { eventBus } from "../../server/event-bus.js";
export type { BusEvent, BusListener } from "../../server/event-bus.js";
