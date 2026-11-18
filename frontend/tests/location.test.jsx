import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { JobLocation } from "../src/components/JobLocation";
vi.mock('../src/components/LocationMap', () => ({ default: ({ onChange }) => <div role="region" aria-label="Choose job location on map"><button type="button" onClick={() => onChange({ type: 'Point', coordinates: [-16.65, 13.27] })}>Move pin</button></div> }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Harness({ observe }) {
  const [value, set] = useState(null);
  return <JobLocation value={value} onChange={point => { set(point); observe?.(point); }} />;
}
it("requests location only on a deliberate click, hides coordinates and supports removal", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({ coords: { longitude: -16.7, latitude: 13.4 } }),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  render(<Harness />);
  await screen.findByRole('region');
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
it("allows continuation after permission denial", async () => {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (_success, failure) => failure({ code: 1 }),
    },
  });
  render(<Harness />);
  await screen.findByRole('region');
  fireEvent.click(
    screen.getByRole("button", { name: "Use my current location" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "continue using your town or address",
  );
});
it("handles unavailable geolocation without making it required", async () => {
  vi.stubGlobal("navigator", {});
  render(<Harness />);
  await screen.findByRole('region');
  fireEvent.click(
    screen.getByRole("button", { name: "Use my current location" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Location sharing is unavailable",
  );
});
it('keeps a manually moved pin when an older GPS request finishes', async () => {
  let finish;
  const observe = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: success => { finish = success; } } });
  render(<Harness observe={observe} />); await screen.findByRole('region');
  fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move pin' }));
  finish({ coords: { longitude: -16.7, latitude: 13.4 } });
  expect(observe).toHaveBeenCalledTimes(1);
  expect(observe).toHaveBeenLastCalledWith({ type: 'Point', coordinates: [-16.65, 13.27] });
});
it('keeps maps out of the worker base and discovery location controls', () => {
  const { rerender } = render(<JobLocation mode="base" value={null} onChange={() => {}} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  rerender(<JobLocation mode="search" value={null} onChange={() => {}} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
