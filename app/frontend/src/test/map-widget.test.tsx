import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MapWidget } from "../widgets/MapWidget";

const ol = vi.hoisted(() => ({
  maps: [] as any[],
  features: [] as any[],
  usePointsMock: vi.fn(),
}));

vi.mock("../entities/point/model/usePoints", () => ({
  usePoints: (...args: unknown[]) => ol.usePointsMock(...args),
}));

vi.mock("ol/Map", () => ({
  default: class MockMap {
    options: any;
    handlers = new Map<string, Function[]>();
    layers: any[] = [];
    target: any;
    size: any = [100, 100];
    featureAtPixel: any = null;

    constructor(options: any) {
      this.options = options;
      this.target = options.target;
      this.layers = [...options.layers];
      ol.maps.push(this);
    }

    view = { calculateExtent: () => [1, 2, 3, 4], animate: vi.fn() };
    getSize() { return this.size; }
    getView() { return this.view; }
    on(event: string, callback: Function) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
    }
    un(event: string, callback: Function) {
      this.handlers.set(event, (this.handlers.get(event) ?? []).filter((fn) => fn !== callback));
    }
    setTarget(target: any) { this.target = target; }
    addLayer(layer: any) { this.layers.push(layer); }
    removeLayer(layer: any) { this.layers = this.layers.filter((item) => item !== layer); }
    forEachFeatureAtPixel(_pixel: any, callback: Function) {
      if (this.featureAtPixel) return callback(this.featureAtPixel);
      return undefined;
    }
    emit(event: string, payload: any = {}) {
      (this.handlers.get(event) ?? []).forEach((callback) => callback(payload));
    }
  },
}));

vi.mock("ol/View", () => ({
  default: class MockView {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/layer/Tile", () => ({
  default: class MockTileLayer {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/source/OSM", () => ({
  default: class MockOSM {},
}));

vi.mock("ol/layer/Vector", () => ({
  default: class MockVectorLayer {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/source/Vector", () => ({
  default: class MockVectorSource {
    features: any[] = [];
    addFeature(feature: any) { this.features.push(feature); }
  },
}));

vi.mock("ol/Feature", () => ({
  default: class MockFeature {
    values: any;
    constructor(values: any) {
      this.values = values;
      ol.features.push(this);
    }
    get(key: string) { return this.values[key]; }
  },
}));

vi.mock("ol/geom/Point", () => ({
  default: class MockPoint {
    constructor(public coordinates: any) {}
  },
}));

vi.mock("ol/style/Style", () => ({
  default: class MockStyle {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/style/Circle", () => ({
  default: class MockCircle {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/style/Fill", () => ({
  default: class MockFill {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/proj", () => ({
  fromLonLat: (coordinates: number[]) => coordinates,
  toLonLat: (coordinates: number[]) => coordinates,
}));

const city = { id: "balakovo", name: "Балаково", latitude: 52.033, longitude: 47.783 };

const point = {
  id: 7,
  title: "Городское событие",
  description: "Описание",
  latitude: 51.5,
  longitude: 46.0,
  category_id: 1,
  category_name: "События",
  author_name: "Автор",
  event_at: "2026-01-01T12:00:00Z",
  status: "approved",
};

describe("MapWidget", () => {
  beforeEach(() => {
    ol.maps.length = 0;
    ol.features.length = 0;
    ol.usePointsMock.mockReset();
    ol.usePointsMock.mockReturnValue({
      data: [point],
      isFetching: false,
      isError: false,
    });
  });

  afterEach(() => cleanup());

  it("creates the map, loads points and selects a clicked marker", async () => {
    const onSelect = vi.fn();

    const { container, unmount } = render(
      <MapWidget categoryId={3} city={city} onSelect={onSelect} onMapClick={vi.fn()} />,
    );

    await waitFor(() => {
      expect(ol.usePointsMock).toHaveBeenCalledWith("1,2,3,4", 3);
    });

    const map = ol.maps[0];
    expect(map).toBeDefined();
    expect(map.target).toBe(container.querySelector(".map-canvas"));
    expect(map.layers).toHaveLength(2);
    expect(ol.features).toHaveLength(1);

    map.featureAtPixel = ol.features[0];
    map.emit("singleclick", { pixel: [10, 20] });

    expect(onSelect).toHaveBeenCalledWith(point);

    unmount();
    expect(map.target).toBeUndefined();
    expect(map.handlers.get("singleclick")).toHaveLength(0);
  });

  it("shows loading and error states", () => {
    ol.usePointsMock.mockReturnValue({
      data: undefined,
      isFetching: true,
      isError: true,
    });

    const { container } = render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

    expect(container.querySelector(".status")).toBeInTheDocument();
    expect(container.querySelector(".status.error")).toBeInTheDocument();
    expect(container.querySelector(".status")).toBeInTheDocument();
    expect(container.querySelector(".status.error")).toBeInTheDocument();
  });

  it("handles a map without a measurable size", async () => {
    render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

    const map = ol.maps[0];
    map.size = undefined;
    map.emit("moveend");

    expect(map.target).toBeTruthy();
  });

  it("does not select anything when a click misses all markers", async () => {
    const onSelect = vi.fn();

    render(<MapWidget city={city} onSelect={onSelect} onMapClick={vi.fn()} />);

    await waitFor(() => expect(ol.features).toHaveLength(1));

    ol.maps[0].featureAtPixel = null;
    ol.maps[0].emit("singleclick", { pixel: [0, 0], coordinate: [46.034, 51.533] });

    expect(onSelect).not.toHaveBeenCalled();
  });
});


it("removes the moveend handler on unmount", () => {
  ol.maps.length = 0;
  ol.features.length = 0;
  ol.usePointsMock.mockReturnValue({ data: [point], isFetching: false, isError: false });
  const { unmount } = render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);
  const map = ol.maps[0];

  expect(map.handlers.get("moveend")).toHaveLength(1);

  unmount();

  expect(map.handlers.get("moveend")).toHaveLength(0);
  expect(map.target).toBeUndefined();
});

it("does not select a marker missing from the current points data", async () => {
  ol.maps.length = 0;
  ol.features.length = 0;
  ol.usePointsMock.mockReturnValue({ data: [point], isFetching: false, isError: false });
  const onSelect = vi.fn();

  render(<MapWidget city={city} onSelect={onSelect} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.features).toHaveLength(1));

  ol.maps[0].featureAtPixel = {
    get: (key: string) => key === "pointId" ? 999 : undefined,
  };

  ol.maps[0].emit("singleclick", { pixel: [10, 20] });

  expect(onSelect).not.toHaveBeenCalled();
});


