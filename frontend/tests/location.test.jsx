import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { JobLocation } from "../src/components/JobLocation";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Harness() {
  const [value, set] = useState(null);
  return <JobLocation value={value} onChange={set} />;
}
it("requests location only on a deliberate click, hides coordinates and supports removal", () => {
  const getCurrentPosition = vi.fn((success) =>
    success({ coords: { longitude: -16.7, latitude: 13.4 } }),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  render(<Harness />);
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Use my current location" }),
  );
  expect(screen.getByText("Precise job location added.")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("-16.7");
  fireEvent.click(screen.getByRole("button", { name: "Remove location" }));
  expect(
    screen.queryByText("Precise job location added."),
  ).not.toBeInTheDocument();
});
it("allows continuation after permission denial", () => {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (_success, failure) => failure({ code: 1 }),
    },
  });
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Use my current location" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "continue using your town or address",
  );
});
it("handles unavailable geolocation without making it required", () => {
  vi.stubGlobal("navigator", {});
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Use my current location" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Location sharing is unavailable",
  );
});
