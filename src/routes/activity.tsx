import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/activity")({
  component: () => <Navigate to="/bookings" />,
});
