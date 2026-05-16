import { Counter, Trend, Rate } from 'k6/metrics';

// All custom metrics defined in ONE place
// Import what you need in your test files

export const errorCount          = new Counter('errors');
export const apiErrorRate        = new Rate('api_error_rate');
export const shipmentsDuration   = new Trend('shipments_duration', true);
export const createOrderDuration = new Trend('create_order_duration', true);
export const tripDuration        = new Trend('trip_create_duration', true);
